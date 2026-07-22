import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const schema = readFileSync(new URL("../../../../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../../../../prisma/migrations/20260710120000_g3_i2a_workbench_foundation/migration.sql", import.meta.url),
  "utf8",
);
const layoutMigration = readFileSync(new URL("../../../../prisma/migrations/20260710173000_g3_i2b_editor_layout/migration.sql", import.meta.url), "utf8");
const runtimeMigration = readFileSync(new URL("../../../../prisma/migrations/20260710230000_g3_i2c_runtime_foundation/migration.sql", import.meta.url), "utf8");

describe("static persistence contract checks", () => {
  test("schema defines draft revision and version/compiler publication metadata", () => {
    assert.match(schema, /draftRevision\s+Int\s+@default\(0\)/);
    assert.match(schema, /definitionSchemaVersion\s+Int/);
    assert.match(schema, /compilerVersion\s+String/);
    assert.match(schema, /publishedAt\s+DateTime\s+@default\(now\(\)\)/);
    assert.match(schema, /@@unique\(\[workbenchId, sourceHash\]\)/);
  });

  test("migration protects compound organization ownership", () => {
    assert.match(migration, /FOREIGN KEY \("interfaceId", "organizationId"\)/);
    assert.match(migration, /FOREIGN KEY \("publisherId", "organizationId"\)/);
    assert.match(migration, /FOREIGN KEY \("activeVersionId", "id", "organizationId"\)/);
    assert.match(migration, /FOREIGN KEY \("parentVersionId", "workbenchId", "organizationId"\)/);
  });

  test("migration stores revisions and versions and rejects published-version updates and deletes", () => {
    assert.match(migration, /"draftRevision" INTEGER NOT NULL DEFAULT 0/);
    assert.match(migration, /"definitionSchemaVersion" INTEGER NOT NULL/);
    assert.match(migration, /"compilerVersion" TEXT NOT NULL/);
    assert.match(migration, /"publishedAt" TIMESTAMP\(3\) NOT NULL DEFAULT CURRENT_TIMESTAMP/);
    assert.match(migration, /workbenchId_sourceHash_key/);
    assert.match(migration, /BEFORE UPDATE OR DELETE ON "interface_workbench_versions"/);
    assert.match(migration, /reject_interface_workbench_version_mutation/);
  });

  test("reviewed runtime migration binds runs to the published workbench version", () => {
    assert.match(schema, /model InterfaceWorkflowRun \{/);
    assert.match(runtimeMigration, /CREATE TABLE "interface_workflow_runs"/);
    assert.match(runtimeMigration, /FOREIGN KEY \("versionId", "workbenchId", "organizationId"\)/);
    assert.match(runtimeMigration, /interface_workflow_runs_reject_version_change/);
  });

  test("stores draft and immutable version layouts with safe defaults", () => {
    assert.match(schema, /draftLayout\s+Json\s+@default\("\{}"\)/);
    assert.match(schema, /editorLayout\s+Json/);
    assert.match(layoutMigration, /"draftLayout" JSONB NOT NULL DEFAULT '\{}'::jsonb/);
    assert.match(layoutMigration, /"editorLayout" JSONB NOT NULL DEFAULT '\{}'::jsonb/);
    assert.match(layoutMigration, /ALTER COLUMN "editorLayout" DROP DEFAULT/);
  });
});
