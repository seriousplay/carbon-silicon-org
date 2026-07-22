#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { buildGenerationQueueMigrationBundle } from "./print-generation-queue-migration.mjs";

const explicitDatabaseUrl = process.env.GENERATION_QUEUE_DATABASE_URL || process.env.LOOP_OS_DATABASE_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const localPoolerUrl = readLocalPoolerUrl();
const databasePassword = process.env.PGPASSWORD || process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD;
const databaseUrl = explicitDatabaseUrl || (localPoolerUrl && databasePassword ? localPoolerUrl : "");
const usingLocalPoolerUrl = !explicitDatabaseUrl && Boolean(localPoolerUrl && databasePassword);

if (!databaseUrl) {
  const localHint = localPoolerUrl
    ? "A linked Supabase pooler URL was found; set PGPASSWORD or SUPABASE_DB_PASSWORD to use it."
    : "No linked Supabase pooler URL was found.";
  throw new Error(`GENERATION_QUEUE_DATABASE_URL, LOOP_OS_DATABASE_URL, DATABASE_URL, SUPABASE_DB_URL, or a local pooler URL plus PGPASSWORD/SUPABASE_DB_PASSWORD is required. ${localHint} If you do not have direct database credentials, run node scripts/print-generation-queue-migration.mjs and apply that SQL in Supabase SQL Editor.`);
}

if (usingLocalPoolerUrl) {
  assertLocalPoolerMatchesAppProject(localPoolerUrl);
}

const result = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1"], {
  input: buildGenerationQueueMigrationBundle(),
  stdio: ["pipe", "inherit", "inherit"],
  encoding: "utf8",
  env: {
    ...process.env,
    ...(databasePassword ? { PGPASSWORD: databasePassword } : {}),
  },
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

console.log("Generation queue migration applied. Run node scripts/verify-generation-queue.mjs and node scripts/verify-generation-queue.mjs --write-probe next.");

function readLocalPoolerUrl() {
  const path = "supabase/.temp/pooler-url";
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8").trim();
}

function assertLocalPoolerMatchesAppProject(poolerUrl) {
  const poolerProjectRef = extractPoolerProjectRef(poolerUrl);
  const appProjectRef = extractSupabaseProjectRef(
    process.env.NEXT_PUBLIC_SUPABASE_URL || readEnvValue(".env.local", "NEXT_PUBLIC_SUPABASE_URL") || readEnvValue(".env.production", "NEXT_PUBLIC_SUPABASE_URL"),
  );
  if (!poolerProjectRef || !appProjectRef || poolerProjectRef === appProjectRef) return;
  throw new Error(`Linked Supabase pooler project (${poolerProjectRef}) does not match NEXT_PUBLIC_SUPABASE_URL project (${appProjectRef}). Set GENERATION_QUEUE_DATABASE_URL for the target project instead of using supabase/.temp/pooler-url.`);
}

function extractPoolerProjectRef(poolerUrl) {
  return poolerUrl.match(/postgres\.([^.@:/]+)@/)?.[1] || "";
}

function extractSupabaseProjectRef(url) {
  return url?.match(/^https?:\/\/([^.]+)\.supabase\.co/i)?.[1] || "";
}

function readEnvValue(path, key) {
  if (!existsSync(path)) return "";
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (line.startsWith(`${key}=`)) return line.slice(key.length + 1).trim();
  }
  return "";
}
