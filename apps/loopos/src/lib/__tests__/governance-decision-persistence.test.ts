import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../../prisma/migrations/20260713160000_rtw1_s3_canonical_governance_closure/migration.sql", import.meta.url), "utf8");
const rollback = readFileSync(new URL("../../../prisma/migrations/20260713160000_rtw1_s3_canonical_governance_closure/rollback.sql", import.meta.url), "utf8");

describe("RTW1-S3 governance provenance persistence", () => {
  test("uses a discriminated provenance kind and nullable runtime group", () => {
    assert.match(schema, /enum GovernanceDecisionProvenanceKind \{[\s\S]+ORDINARY_TENSION[\s\S]+INTERFACE_RUN/);
    assert.match(schema, /provenanceKind\s+GovernanceDecisionProvenanceKind/);
    for (const field of ["runId", "sourceTensionArtifactId", "proposalArtifactId", "routeArtifactId"]) assert.match(schema, new RegExp(`${field}\\s+String\\?`));
  });
  test("migration enforces runtime all-or-none and ordinary all-null", () => {
    assert.match(migration, /provenance_check/);
    assert.match(migration, /INTERFACE_RUN[\s\S]+"runId" IS NOT NULL[\s\S]+"routeArtifactId" IS NOT NULL/);
    assert.match(migration, /ORDINARY_TENSION[\s\S]+"runId" IS NULL[\s\S]+"routeArtifactId" IS NULL/);
  });
  test("rollback fails closed when ordinary canonical history exists", () => {
    assert.match(rollback, /Rollback blocked: canonical ordinary governance history/);
    assert.match(rollback, /ALTER COLUMN "runId" SET NOT NULL/);
  });
  test("operation idempotency is tenant scoped with fail-closed rollback", () => {
    assert.match(schema, /@@unique\(\[organizationId, mutationKey\]\)/);
    assert.match(migration, /DROP INDEX "governance_decision_operations_mutationKey_key"/);
    assert.match(migration, /\("organizationId", "mutationKey"\)/);
    assert.match(rollback, /cross-organization governance mutation key reuse/);
  });
});
