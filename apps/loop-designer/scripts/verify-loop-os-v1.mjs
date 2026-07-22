#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { LOOP_OS_V1_SCHEMA_CHECKS } from "./loop-os-v1-schema-contract.mjs";

loadEnv(".env.local");
loadEnv(".env.production");

const writeProbe = process.argv.includes("--write-probe");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const schemaMissingMessage = "Loop OS v1 database schema is not visible to the API. Run node scripts/apply-loop-os-v1-migration.mjs with a database URL, or run node scripts/print-loop-os-v1-migration.mjs and apply that SQL bundle, then rerun this verifier.";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY are required");
}

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

await verifyReadableSchema();

if (writeProbe) {
  await verifyWritableConstraints();
} else {
  console.log("PASS read-only Loop OS v1 schema verification");
  console.log("Run with --write-probe to verify unique constraints with temporary rows.");
}

async function verifyReadableSchema() {
  for (const check of LOOP_OS_V1_SCHEMA_CHECKS) {
    const { error } = await admin
      .from(check.table)
      .select(check.columns)
      .limit(1);
    if (error) throw new Error(`${check.table}: ${formatSupabaseError(error)}`);
    console.log(`PASS ${check.table} schema visible`);
  }
}

async function verifyWritableConstraints() {
  const runId = `loop-os-v1-verify-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  let enterpriseId;
  let userId;
  const assetIds = [];

  try {
    const enterprise = await must("insert verify enterprise", admin.from("loop_designer_enterprises").insert({
      tenant_key: runId,
      company_name: `Loop OS v1 Verify ${runId}`,
      subscription_tier: "enterprise",
      is_active: true,
    }).select("id").single());
    enterpriseId = enterprise.id;

    const user = await must("insert verify user", admin.from("loop_designer_users").insert({
      tenant_key: runId,
      open_id: `open-${runId}`,
      union_id: `union-${runId}`,
      display_name: "Loop OS v1 Verify",
      status: "active",
      enterprise_id: enterpriseId,
    }).select("id").single());
    userId = user.id;

    const assetA = await createAsset("Version Source Asset");
    const sourceVersionId = `session-version-${runId}`;
    await must("insert first source version", admin.from("loop_os_versions").insert({
      asset_id: assetA,
      version_number: 1,
      plan: { title: "Version Source Asset" },
      source_session_version_id: sourceVersionId,
      created_by: userId,
    }).select("id").single());
    await expectUniqueViolation("version source-session unique", admin.from("loop_os_versions").insert({
      asset_id: assetA,
      version_number: 2,
      plan: { title: "Version Source Asset duplicate" },
      source_session_version_id: sourceVersionId,
      created_by: userId,
    }));

    const workspaceId = `workspace-${runId}`;
    const circuitId = `circuit-${runId}`;
    await createAsset("Matrix Binding A", {
      matrix_workspace_id: workspaceId,
      matrix_circuit_logical_id: circuitId,
    });
    await expectUniqueViolation("active Matrix binding unique", admin.from("loop_os_assets").insert({
      enterprise_id: enterpriseId,
      title: "Matrix Binding B",
      domain: "verify",
      status: "active",
      matrix_workspace_id: workspaceId,
      matrix_circuit_logical_id: circuitId,
      created_by: userId,
    }));

    const parent = await createAsset("Parent Loop");
    const child = await createAsset("Child Loop");
    await must("insert parent relationship", admin.from("loop_os_relationships").insert({
      enterprise_id: enterpriseId,
      source_asset_id: parent,
      target_asset_id: child,
      type: "parent_child",
      created_by: userId,
    }).select("id").single());
    await expectUniqueViolation("parent-child unique", admin.from("loop_os_relationships").insert({
      enterprise_id: enterpriseId,
      source_asset_id: parent,
      target_asset_id: child,
      type: "parent_child",
      created_by: userId,
    }));

    const depSource = await createAsset("Dependency Source");
    const depTarget = await createAsset("Dependency Target");
    await must("insert dependency relationship", admin.from("loop_os_relationships").insert({
      enterprise_id: enterpriseId,
      source_asset_id: depSource,
      target_asset_id: depTarget,
      type: "dependency",
      interface_name: "verify interface",
      created_by: userId,
    }).select("id").single());
    await expectUniqueViolation("dependency unique", admin.from("loop_os_relationships").insert({
      enterprise_id: enterpriseId,
      source_asset_id: depSource,
      target_asset_id: depTarget,
      type: "dependency",
      interface_name: "verify interface",
      created_by: userId,
    }));

    console.log(`PASS writable Loop OS v1 constraint verification (${runId})`);
  } finally {
    if (enterpriseId) await admin.from("loop_os_relationships").delete().eq("enterprise_id", enterpriseId);
    if (assetIds.length) await admin.from("loop_os_versions").delete().in("asset_id", assetIds);
    if (assetIds.length) await admin.from("loop_os_assets").delete().in("id", assetIds);
    if (userId) await admin.from("loop_designer_users").delete().eq("id", userId);
    if (enterpriseId) await admin.from("loop_designer_enterprises").delete().eq("id", enterpriseId);
  }

  async function createAsset(title, extra = {}) {
    const row = await must(`insert asset ${title}`, admin.from("loop_os_assets").insert({
      enterprise_id: enterpriseId,
      title,
      domain: "verify",
      status: "active",
      created_by: userId,
      ...extra,
    }).select("id").single());
    assetIds.push(row.id);
    return row.id;
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
  if (error.code === "PGRST205" || error.message?.includes("schema cache")) return `${error.code || "unknown"} ${schemaMissingMessage}`;
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
