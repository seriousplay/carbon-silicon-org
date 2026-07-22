#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { buildLoopOsV1MigrationBundle } from "./print-loop-os-v1-migration.mjs";

const explicitDatabaseUrl = process.env.LOOP_OS_DATABASE_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const localPoolerUrl = readLocalPoolerUrl();
const databasePassword = process.env.PGPASSWORD || process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD;
const databaseUrl = explicitDatabaseUrl || (localPoolerUrl && databasePassword ? localPoolerUrl : "");

if (!databaseUrl) {
  const localHint = localPoolerUrl
    ? "A linked Supabase pooler URL was found; set PGPASSWORD or SUPABASE_DB_PASSWORD to use it."
    : "No linked Supabase pooler URL was found.";
  throw new Error(`LOOP_OS_DATABASE_URL, DATABASE_URL, SUPABASE_DB_URL, or a local pooler URL plus PGPASSWORD/SUPABASE_DB_PASSWORD is required. ${localHint} If you do not have direct database credentials, run node scripts/print-loop-os-v1-migration.mjs and apply the printed SQL in Supabase SQL Editor.`);
}

const result = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1"], {
  input: buildLoopOsV1MigrationBundle(),
  stdio: ["pipe", "inherit", "inherit"],
  encoding: "utf8",
  env: {
    ...process.env,
    ...(databasePassword ? { PGPASSWORD: databasePassword } : {}),
  },
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

console.log("Loop OS v1 migration bundle applied. Run node scripts/verify-loop-os-v1.mjs and node scripts/verify-loop-os-v1.mjs --write-probe next.");

function readLocalPoolerUrl() {
  const path = "supabase/.temp/pooler-url";
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8").trim();
}
