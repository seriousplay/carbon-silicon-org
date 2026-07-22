#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const LOOP_OS_V1_MIGRATIONS = [
  "supabase/migrations/202606190001_loop_os_assets.sql",
  "supabase/migrations/202606190002_loop_os_relationships.sql",
  "supabase/migrations/202606190004_loop_os_matrix_review.sql",
  "supabase/migrations/202606190005_loop_os_org_profiles.sql",
  "supabase/migrations/202606200001_loop_os_version_source_idempotency.sql",
  "supabase/migrations/202606200002_loop_os_matrix_binding_unique.sql",
  "supabase/migrations/202606200003_loop_os_api_schema_reload.sql",
];

export function buildLoopOsV1MigrationBundle() {
  return `${LOOP_OS_V1_MIGRATIONS.map((filePath) => {
    const sql = readFileSync(filePath, "utf8").trim();
    return [
      "-- ============================================================",
      `-- ${filePath}`,
      "-- ============================================================",
      sql,
      "",
    ].join("\n");
  }).join("\n")}\n`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(buildLoopOsV1MigrationBundle());
}
