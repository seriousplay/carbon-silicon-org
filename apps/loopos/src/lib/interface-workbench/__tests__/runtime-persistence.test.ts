import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const schema = readFileSync(new URL("../../../../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../../../../prisma/migrations/20260710230000_g3_i2c_runtime_foundation/migration.sql", import.meta.url),
  "utf8",
);

describe("runtime persistence contracts", () => {
  test("run projection pins ownership and stores resumable state", () => {
    assert.match(schema, /model InterfaceWorkflowRun \{/);
    assert.match(schema, /versionId\s+String/);
    assert.match(schema, /currentNodeId\s+String/);
    assert.match(schema, /currentNodeVisit\s+Int\s+@default\(0\)/);
    assert.match(schema, /evidence\s+Json\s+@default\("\{}"\)/);
    assert.match(schema, /revision\s+Int\s+@default\(0\)/);
    assert.match(schema, /waitingRoleBindingId\s+String\?/);
    assert.match(schema, /@@unique\(\[waitingRoleBindingId, id, organizationId\]\)/);
    assert.match(migration, /FOREIGN KEY \("versionId", "workbenchId", "organizationId"\)/);
    assert.match(migration, /FOREIGN KEY \("starterId", "organizationId"\)/);
    assert.match(migration, /FOREIGN KEY \("lastActorId", "organizationId"\)/);
  });

  test("symbolic role bindings have one organization-owned target", () => {
    assert.match(schema, /model InterfaceWorkflowRunRoleBinding \{/);
    assert.match(schema, /roleId\s+String/);
    assert.match(schema, /personId\s+String\?/);
    assert.match(schema, /roleDefId\s+String\?/);
    assert.match(migration, /CHECK \(\("personId" IS NOT NULL\) <> \("roleDefId" IS NOT NULL\)\)/);
    assert.match(migration, /FOREIGN KEY \("personId", "organizationId"\)/);
    assert.match(migration, /FOREIGN KEY \("roleDefId", "organizationId"\)/);
    assert.match(migration, /runId_roleId_key/);
  });

  test("events are ordered JSON append-only records", () => {
    assert.match(schema, /model InterfaceWorkflowRunEvent \{/);
    assert.match(schema, /sequence\s+Int/);
    assert.match(schema, /payload\s+Json/);
    assert.match(migration, /interface_workflow_run_events_runId_sequence_key/);
    assert.match(migration, /BEFORE UPDATE OR DELETE ON "interface_workflow_run_events"/);
    assert.match(migration, /reject_interface_workflow_run_event_mutation/);
  });

  test("commands enforce both idempotency identities and retain retry state", () => {
    assert.match(schema, /clientIdempotencyKey\s+String/);
    assert.match(schema, /attempts\s+Int\s+@default\(0\)/);
    assert.match(schema, /status\s+InterfaceWorkflowCommandStatus\s+@default\(PENDING\)/);
    assert.match(schema, /error\s+String\?/);
    assert.match(migration, /runId_clientIdempotencyKey_key/);
    assert.match(migration, /runId_nodeId_nodeVisit_kind_key/);
  });

  test("artifact links are typed metadata without domain-table foreign keys", () => {
    assert.match(schema, /model InterfaceWorkflowArtifact \{/);
    assert.match(schema, /artifactType\s+InterfaceWorkflowArtifactType/);
    assert.match(schema, /artifactId\s+String/);
    assert.match(schema, /relation\s+String/);
    assert.match(schema, /metadata\s+Json\s+@default\("\{}"\)/);
    assert.doesNotMatch(migration, /interface_workflow_artifacts[^;]+REFERENCES "(?:tensions|projects|governance_proposals|meetings)"/);
  });

  test("database triggers pin run versions and rollback steps are reviewable", () => {
    assert.match(migration, /OLD\."versionId" IS DISTINCT FROM NEW\."versionId"/);
    assert.match(migration, /interface_workflow_runs_reject_version_change/);
    assert.match(migration, /Reviewed rollback \(execute in this reverse order\)/);
    assert.match(migration, /DROP TYPE "InterfaceWorkflowRunStatus"/);
  });
});
