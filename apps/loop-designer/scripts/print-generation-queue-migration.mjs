#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const GENERATION_QUEUE_MIGRATIONS = [
  "supabase/migrations/202606210001_loop_designer_generation_jobs.sql",
];

export function buildGenerationQueueMigrationBundle() {
  return `${GENERATION_QUEUE_MIGRATIONS.map((filePath) => {
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
  process.stdout.write(buildGenerationQueueMigrationBundle());
}
