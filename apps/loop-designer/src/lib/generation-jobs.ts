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

const DEFAULT_MAX_ATTEMPTS = Math.max(1, Number(process.env.LOOP_GENERATION_MAX_ATTEMPTS || 2));

type PlanGenerationJobRow = {
  id: string;
  sessionId: string;
  enterpriseId: string;
  userId: string;
  status: string;
  useOrgMemory: boolean;
  attempts: number;
  maxAttempts: number;
  lockedAt: Date | null;
  lockedBy: string | null;
  lastError: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

const PLAN_GENERATION_FAILURE_MESSAGE = "模型已返回方案草稿，但角色引用没有通过校验。请重新点击生成，系统会重新生成并自动修复角色引用。";

function normalizeJob(row: PlanGenerationJobRow): PlanGenerationJob {
  return {
    id: row.id,
    sessionId: row.sessionId,
    enterpriseId: row.enterpriseId,
    userId: row.userId,
    status: row.status as PlanGenerationJobStatus,
    useOrgMemory: row.useOrgMemory,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    lockedAt: row.lockedAt?.toISOString() ?? null,
    lockedBy: row.lockedBy,
    lastError: row.lastError,
    metadata: row.metadata ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

function isMissingQueueSchemaError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message ?? "";
  return error?.code === "P2021" || message.includes("GenerationJob");
}

export function userFacingGenerationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("模型输出结构无效") || message.includes("未定义角色")) return PLAN_GENERATION_FAILURE_MESSAGE;
  if (message.includes("模型生成超时")) return "模型生成时间较长，请稍后重试或刷新页面查看是否已经完成。";
  if (message.includes("模型服务不可用")) return "模型服务暂时不可用，请稍后重试。";
  if (message.includes("模型服务未配置")) return "模型服务未配置，暂时无法生成真实 LLM 回路方案。";
  return "方案生成失败，请稍后重试。";
}

export async function checkGenerationQueueSchema() {
  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "Supabase service role is not configured" };
  try {
    await admin.loopDesignerGenerationJob.findFirst({ take: 1 });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Generation queue schema check failed" };
  }
}

export async function getLatestPlanGenerationJob(user: AppUser, sessionId: string): Promise<PlanGenerationJob | null> {
  const admin = getAdminClient();
  if (!admin) return null;
  const data = await admin.loopDesignerGenerationJob.findFirst({
    where: {
      enterpriseId: user.enterpriseId,
      userId: user.id,
      sessionId,
    },
    orderBy: { createdAt: "desc" },
  });
  return data ? normalizeJob(data as unknown as PlanGenerationJobRow) : null;
}

async function getActivePlanGenerationJob(user: AppUser, sessionId: string): Promise<PlanGenerationJob | null> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const data = await admin.loopDesignerGenerationJob.findFirst({
    where: {
      enterpriseId: user.enterpriseId,
      userId: user.id,
      sessionId,
      status: { in: ["queued", "running"] },
    },
    orderBy: { createdAt: "desc" },
  });
  return data ? normalizeJob(data as unknown as PlanGenerationJobRow) : null;
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

  let data;
  try {
    data = await admin.loopDesignerGenerationJob.create({
      data: {
        sessionId: session.id,
        enterpriseId: user.enterpriseId,
        userId: user.id,
        status: "queued",
        useOrgMemory: input.useOrgMemory,
        attempts: 0,
        maxAttempts: DEFAULT_MAX_ATTEMPTS,
        metadata: { source: "loop-designer-generate-api" },
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const racedJob = await getActivePlanGenerationJob(user, session.id);
      if (racedJob) {
        await updateSession(user, session.id, { status: "generating", context });
        return { session: { ...session, status: "generating", context }, job: racedJob };
      }
    }
    throw new Error((error as Error)?.message || "Unable to enqueue generation job");
  }

  await updateSession(user, session.id, { status: "generating", context });
  return { session: { ...session, status: "generating", context }, job: normalizeJob(data as unknown as PlanGenerationJobRow) };
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

const STALE_RUNNING_AFTER_MS = Number(process.env.LOOP_GENERATION_STALE_MS || 15 * 60 * 1000);

async function findClaimCandidate(status: "queued" | "running"): Promise<PlanGenerationJob | null> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const where: Record<string, unknown> = { status };
  if (status === "running") {
    where.lockedAt = { lt: new Date(Date.now() - STALE_RUNNING_AFTER_MS) };
  }
  const orderBy = status === "queued" ? { createdAt: "asc" as const } : { lockedAt: "asc" as const };
  const data = await admin.loopDesignerGenerationJob.findFirst({
    where: where as any,
    orderBy,
  });
  return data ? normalizeJob(data as unknown as PlanGenerationJobRow) : null;
}

async function claimJob(job: PlanGenerationJob, workerId: string): Promise<PlanGenerationJob | null> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  if (job.attempts >= job.maxAttempts) {
    await markJobFailed(job, "生成任务超过最大重试次数。");
    return null;
  }
  const now = new Date();
  const whereClause: Record<string, unknown> = { id: job.id, status: job.status };
  if (job.status === "running") {
    whereClause.lockedAt = { lt: new Date(Date.now() - STALE_RUNNING_AFTER_MS) };
  }
  try {
    const data = await admin.loopDesignerGenerationJob.update({
      where: whereClause as any,
      data: {
        status: "running",
        attempts: job.attempts + 1,
        lockedAt: now,
        lockedBy: workerId,
        startedAt: job.startedAt ? new Date(job.startedAt) : now,
        lastError: null,
        updatedAt: now,
      },
    });
    return normalizeJob(data as unknown as PlanGenerationJobRow);
  } catch {
    return null;
  }
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
  const data = await admin.loopDesignerUser.findFirst({
    where: {
      id: job.userId,
      enterpriseId: job.enterpriseId,
    },
    select: {
      id: true,
      tenantKey: true,
      enterpriseId: true,
      openId: true,
      unionId: true,
      feishuUserId: true,
      displayName: true,
      avatarUrl: true,
    },
  });
  if (!data) throw new Error("Generation job user not found");
  return normalizeUser(data);
}

async function markJobSucceeded(job: PlanGenerationJob, metadata: Record<string, unknown>) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const now = new Date();
  await admin.loopDesignerGenerationJob.update({
    where: { id: job.id },
    data: {
      status: "succeeded",
      lockedAt: null,
      lockedBy: null,
      lastError: null,
      metadata: { ...job.metadata, ...metadata },
      finishedAt: now,
      updatedAt: now,
    },
  });
}

async function markJobFailed(job: PlanGenerationJob, message: string) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const now = new Date();
  await admin.loopDesignerGenerationJob.update({
    where: { id: job.id },
    data: {
      status: "failed",
      lockedAt: null,
      lockedBy: null,
      lastError: message,
      finishedAt: now,
      updatedAt: now,
    },
  });
}

function isUniqueViolation(error: unknown) {
  return error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002";
}
