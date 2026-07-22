import "server-only";

import { randomUUID } from "node:crypto";
import { CONVERSATION_STEPS } from "./conversation";
import { safeLogError } from "./api-error";
import { normalizeUser, type AppUser } from "./app-session";
import { buildMemoryContextForEnterpriseBestEffort } from "./memory-context";
import { generatePlanWithModel } from "./model";
import { getAuthorizedSession, updateSession } from "./sessions";
import { getAdminClient } from "./supabase";
import type { LoopDesignerSession, PlanGenerationJob, PlanGenerationJobStatus, SessionOutputs } from "./session-types";

const JOB_TABLE = "loop_designer_generation_jobs";
const STALE_RUNNING_AFTER_MS = Number(process.env.LOOP_GENERATION_STALE_MS || 15 * 60 * 1000);
const DEFAULT_MAX_ATTEMPTS = Math.max(1, Number(process.env.LOOP_GENERATION_MAX_ATTEMPTS || 2));

type PlanGenerationJobRow = {
  id: string;
  session_id: string;
  enterprise_id: string;
  user_id: string;
  status: PlanGenerationJobStatus;
  use_org_memory: boolean;
  attempts: number;
  max_attempts: number;
  locked_at: string | null;
  locked_by: string | null;
  last_error: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
};

const PLAN_GENERATION_FAILURE_MESSAGE = "模型已返回方案草稿，但角色引用没有通过校验。请重新点击生成，系统会重新生成并自动修复角色引用。";
const MISSING_QUEUE_SCHEMA_MESSAGE = "生成任务队列表尚未创建。请先执行 supabase/migrations/202606210001_loop_designer_generation_jobs.sql。";

function normalizeJob(row: PlanGenerationJobRow): PlanGenerationJob {
  return {
    id: row.id,
    sessionId: row.session_id,
    enterpriseId: row.enterprise_id,
    userId: row.user_id,
    status: row.status,
    useOrgMemory: row.use_org_memory,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    lockedAt: row.locked_at,
    lockedBy: row.locked_by,
    lastError: row.last_error,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

function isMissingQueueSchemaError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message ?? "";
  return error?.code === "42P01" || error?.code === "PGRST205" || message.includes(JOB_TABLE);
}

function assertQueueSchema(error: { code?: string; message?: string } | null | undefined) {
  if (isMissingQueueSchemaError(error)) throw new Error(MISSING_QUEUE_SCHEMA_MESSAGE);
}

export function userFacingGenerationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("模型输出结构无效") || message.includes("未定义角色")) return PLAN_GENERATION_FAILURE_MESSAGE;
  if (message.includes("模型生成超时")) return "模型生成时间较长，请稍后重试或刷新页面查看是否已经完成。";
  if (message.includes("模型服务不可用")) return "模型服务暂时不可用，请稍后重试。";
  if (message.includes("模型服务未配置")) return "模型服务未配置，暂时无法生成真实 LLM 回路方案。";
  if (message.includes(MISSING_QUEUE_SCHEMA_MESSAGE)) return MISSING_QUEUE_SCHEMA_MESSAGE;
  return "方案生成失败，请稍后重试。";
}

export async function checkGenerationQueueSchema() {
  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "Supabase service role is not configured" };
  const { error } = await admin
    .from(JOB_TABLE)
    .select("id,session_id,enterprise_id,user_id,status,use_org_memory,attempts,max_attempts,locked_at,locked_by,last_error,metadata,created_at,updated_at,started_at,finished_at")
    .limit(1);
  if (error) return { ok: false, error: formatQueueSchemaError(error) };
  return { ok: true };
}

function formatQueueSchemaError(error: { code?: string; message?: string }) {
  if (isMissingQueueSchemaError(error)) return MISSING_QUEUE_SCHEMA_MESSAGE;
  return `${error.code || "unknown"} ${error.message || "Generation queue schema check failed"}`;
}

export async function getLatestPlanGenerationJob(user: AppUser, sessionId: string): Promise<PlanGenerationJob | null> {
  const admin = getAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from(JOB_TABLE)
    .select("*")
    .eq("enterprise_id", user.enterpriseId)
    .eq("user_id", user.id)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingQueueSchemaError(error)) return null;
    throw new Error(error.message);
  }
  return data ? normalizeJob(data as PlanGenerationJobRow) : null;
}

async function getActivePlanGenerationJob(user: AppUser, sessionId: string): Promise<PlanGenerationJob | null> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const { data, error } = await admin
    .from(JOB_TABLE)
    .select("*")
    .eq("enterprise_id", user.enterpriseId)
    .eq("user_id", user.id)
    .eq("session_id", sessionId)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  assertQueueSchema(error);
  if (error) throw new Error(error.message);
  return data ? normalizeJob(data as PlanGenerationJobRow) : null;
}

export async function enqueuePlanGenerationJob(
  user: AppUser,
  session: LoopDesignerSession,
  input: { useOrgMemory: boolean },
): Promise<{ session: LoopDesignerSession; job: PlanGenerationJob }> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const activeJob = await getActivePlanGenerationJob(user, session.id);
  const context = { ...session.context, lastError: undefined };
  if (activeJob) {
    await updateSession(user, session.id, { status: "generating", context });
    return { session: { ...session, status: "generating", context }, job: activeJob };
  }

  const { data, error } = await admin
    .from(JOB_TABLE)
    .insert({
      session_id: session.id,
      enterprise_id: user.enterpriseId,
      user_id: user.id,
      status: "queued",
      use_org_memory: input.useOrgMemory,
      attempts: 0,
      max_attempts: DEFAULT_MAX_ATTEMPTS,
      metadata: { source: "loop-designer-generate-api" },
    })
    .select("*")
    .single();
  if (error?.code === "23505") {
    const racedJob = await getActivePlanGenerationJob(user, session.id);
    if (racedJob) {
      await updateSession(user, session.id, { status: "generating", context });
      return { session: { ...session, status: "generating", context }, job: racedJob };
    }
  }
  assertQueueSchema(error);
  if (error || !data) throw new Error(error?.message || "Unable to enqueue generation job");

  await updateSession(user, session.id, { status: "generating", context });
  return { session: { ...session, status: "generating", context }, job: normalizeJob(data as PlanGenerationJobRow) };
}

export async function runPlanGenerationJobBatch(input: { limit?: number; workerId?: string } = {}) {
  const workerId = input.workerId || `worker-${randomUUID()}`;
  const limit = Math.max(1, Math.min(10, input.limit ?? 1));
  const results: Array<{ jobId: string; status: "succeeded" | "failed"; error?: string }> = [];
  for (let index = 0; index < limit; index += 1) {
    const job = await claimNextPlanGenerationJob(workerId);
    if (!job) break;
    try {
      await executePlanGenerationJob(job, workerId);
      results.push({ jobId: job.id, status: "succeeded" });
    } catch (error) {
      const message = userFacingGenerationError(error);
      safeLogError("plan-generation-worker", error, { jobId: job.id, workerId });
      results.push({ jobId: job.id, status: "failed", error: message });
    }
  }
  return { workerId, processed: results.length, results };
}

async function claimNextPlanGenerationJob(workerId: string): Promise<PlanGenerationJob | null> {
  const queued = await findClaimCandidate("queued");
  if (queued) return claimJob(queued, workerId);
  const stale = await findClaimCandidate("running");
  if (stale) return claimJob(stale, workerId);
  return null;
}

async function findClaimCandidate(status: "queued" | "running"): Promise<PlanGenerationJob | null> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  let query = admin
    .from(JOB_TABLE)
    .select("*")
    .eq("status", status)
    .order(status === "queued" ? "created_at" : "locked_at", { ascending: true })
    .limit(1);
  if (status === "running") {
    query = query.lt("locked_at", new Date(Date.now() - STALE_RUNNING_AFTER_MS).toISOString());
  }
  const { data, error } = await query.maybeSingle();
  assertQueueSchema(error);
  if (error) throw new Error(error.message);
  return data ? normalizeJob(data as PlanGenerationJobRow) : null;
}

async function claimJob(job: PlanGenerationJob, workerId: string): Promise<PlanGenerationJob | null> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  if (job.attempts >= job.maxAttempts) {
    await markJobFailed(job, "生成任务超过最大重试次数。");
    return null;
  }
  const now = new Date().toISOString();
  let query = admin
    .from(JOB_TABLE)
    .update({
      status: "running",
      attempts: job.attempts + 1,
      locked_at: now,
      locked_by: workerId,
      started_at: job.startedAt ?? now,
      last_error: null,
      updated_at: now,
    })
    .eq("id", job.id)
    .eq("status", job.status);
  if (job.status === "running") {
    query = query.lt("locked_at", new Date(Date.now() - STALE_RUNNING_AFTER_MS).toISOString());
  }
  const { data, error } = await query.select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalizeJob(data as PlanGenerationJobRow) : null;
}

async function executePlanGenerationJob(job: PlanGenerationJob, workerId: string) {
  let user: AppUser | null = null;
  let session: LoopDesignerSession | null = null;
  try {
    user = await loadUserForJob(job);
    session = await getAuthorizedSession(user, job.sessionId);
    if (!session) throw new Error("Session not found for generation job");
    if (session.context.currentStep < CONVERSATION_STEPS.length) throw new Error("信息采集尚未完成");
    if (session.outputs.currentPlan) {
      await markJobSucceeded(job, { workerId, reusedExistingPlan: true });
      return;
    }

    const memoryContext = job.useOrgMemory
      ? await buildMemoryContextForEnterpriseBestEffort(user, {
        domain: session.context.loopType,
        loopType: session.context.loopType,
      })
      : undefined;
    const { plan, modelLabel } = await generatePlanWithModel(session, memoryContext);
    const version = { id: randomUUID(), createdAt: new Date().toISOString(), plan };
    const outputs: SessionOutputs = { ...session.outputs, currentPlan: plan, versions: [...session.outputs.versions, version] };
    await updateSession(user, session.id, {
      status: "submitted",
      context: { ...session.context, model: modelLabel, lastError: undefined },
      outputs,
    });
    await markJobSucceeded(job, { workerId, modelLabel, versionId: version.id });
  } catch (error) {
    const message = userFacingGenerationError(error);
    if (user && session) {
      await updateSession(user, session.id, { status: "failed", context: { ...session.context, lastError: message } });
    }
    await markJobFailed(job, message);
    throw error;
  }
}

async function loadUserForJob(job: PlanGenerationJob): Promise<AppUser> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const { data, error } = await admin
    .from("loop_designer_users")
    .select("id,tenant_key,enterprise_id,open_id,union_id,feishu_user_id,display_name,avatar_url")
    .eq("id", job.userId)
    .eq("enterprise_id", job.enterpriseId)
    .maybeSingle();
  if (error || !data) throw new Error(error?.message || "Generation job user not found");
  return normalizeUser(data);
}

async function markJobSucceeded(job: PlanGenerationJob, metadata: Record<string, unknown>) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const now = new Date().toISOString();
  const { error } = await admin
    .from(JOB_TABLE)
    .update({
      status: "succeeded",
      locked_at: null,
      locked_by: null,
      last_error: null,
      metadata: { ...job.metadata, ...metadata },
      finished_at: now,
      updated_at: now,
    })
    .eq("id", job.id);
  if (error) throw new Error(error.message);
}

async function markJobFailed(job: PlanGenerationJob, message: string) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const now = new Date().toISOString();
  const { error } = await admin
    .from(JOB_TABLE)
    .update({
      status: "failed",
      locked_at: null,
      locked_by: null,
      last_error: message,
      finished_at: now,
      updated_at: now,
    })
    .eq("id", job.id);
  if (error) throw new Error(error.message);
}
