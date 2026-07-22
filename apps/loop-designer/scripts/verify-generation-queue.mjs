#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

loadEnv(".env.local");
loadEnv(".env.production");

const writeProbe = process.argv.includes("--write-probe");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const schemaMissingMessage = "Generation queue schema is not visible to the API. Run node scripts/apply-generation-queue-migration.mjs with a database URL, or run node scripts/print-generation-queue-migration.mjs and apply that SQL bundle, then rerun this verifier.";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY are required");
}

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

await verifyReadableSchema();

if (writeProbe) {
  await verifyWritableQueue();
} else {
  console.log("PASS read-only generation queue schema verification");
  console.log("Run with --write-probe to verify insert, active-job uniqueness, and cleanup.");
}

async function verifyReadableSchema() {
  const columns = [
    "id",
    "session_id",
    "enterprise_id",
    "user_id",
    "status",
    "use_org_memory",
    "attempts",
    "max_attempts",
    "locked_at",
    "locked_by",
    "last_error",
    "metadata",
    "created_at",
    "updated_at",
    "started_at",
    "finished_at",
  ].join(",");
  const { error } = await admin
    .from("loop_designer_generation_jobs")
    .select(columns)
    .limit(1);
  if (error) throw new Error(`loop_designer_generation_jobs: ${formatSupabaseError(error)}`);
  console.log("PASS loop_designer_generation_jobs schema visible");
}

async function verifyWritableQueue() {
  const runId = `generation-queue-verify-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  let enterpriseId;
  let userId;
  let sessionId;

  try {
    const enterprise = await must("insert verify enterprise", admin.from("loop_designer_enterprises").insert({
      tenant_key: runId,
      company_name: `Generation Queue Verify ${runId}`,
      subscription_tier: "enterprise",
      is_active: true,
    }).select("id").single());
    enterpriseId = enterprise.id;

    const user = await must("insert verify user", admin.from("loop_designer_users").insert({
      tenant_key: runId,
      open_id: `open-${runId}`,
      union_id: `union-${runId}`,
      display_name: "Generation Queue Verify",
      status: "active",
      enterprise_id: enterpriseId,
    }).select("id").single());
    userId = user.id;

    const session = await must("insert verify session", admin.from("loop_designer_sessions").insert({
      user_id: userId,
      enterprise_id: enterpriseId,
      status: "generating",
      participant_snapshot: {},
      context: { currentStep: 3, loopType: "verify" },
      responses: {},
      outputs: { messages: [], versions: [], refinementCount: 0 },
    }).select("id").single());
    sessionId = session.id;

    const firstJob = await must("insert first queued job", admin.from("loop_designer_generation_jobs").insert({
      session_id: sessionId,
      enterprise_id: enterpriseId,
      user_id: userId,
      status: "queued",
      use_org_memory: true,
      metadata: { runId },
    }).select("id").single());
    console.log(`PASS queued job insert (${firstJob.id})`);

    await expectUniqueViolation("one active generation job per session", admin.from("loop_designer_generation_jobs").insert({
      session_id: sessionId,
      enterprise_id: enterpriseId,
      user_id: userId,
      status: "queued",
      use_org_memory: false,
      metadata: { runId, duplicate: true },
    }));

    await must("finish first job", admin.from("loop_designer_generation_jobs").update({
      status: "succeeded",
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", firstJob.id).select("id").single());

    await must("insert second queued job after first finished", admin.from("loop_designer_generation_jobs").insert({
      session_id: sessionId,
      enterprise_id: enterpriseId,
      user_id: userId,
      status: "queued",
      use_org_memory: false,
      metadata: { runId, second: true },
    }).select("id").single());
    console.log(`PASS writable generation queue verification (${runId})`);
  } finally {
    if (enterpriseId) await admin.from("loop_designer_generation_jobs").delete().eq("enterprise_id", enterpriseId);
    if (sessionId) await admin.from("loop_designer_sessions").delete().eq("id", sessionId);
    if (userId) await admin.from("loop_designer_users").delete().eq("id", userId);
    if (enterpriseId) await admin.from("loop_designer_enterprises").delete().eq("id", enterpriseId);
  }
}

async function must(label, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${formatSupabaseError(error)}`);
  return data;
}

async function expectUniqueViolation(label, query) {
  const { error } = await query;
  if (!error) throw new Error(`${label}: expected unique violation but insert succeeded`);
  if (error.code !== "23505") throw new Error(`${label}: expected 23505, got ${formatSupabaseError(error)}`);
  console.log(`PASS ${label}`);
}

function formatSupabaseError(error) {
  if (error.code === "PGRST205" || error.code === "42P01" || error.message?.includes("schema cache")) {
    return `${error.code || "unknown"} ${schemaMissingMessage}`;
  }
  return `${error.code || "unknown"} ${error.message}`;
}

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1);
    process.env[key] ||= value;
  }
}
