import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../../prisma/migrations/20260711120000_g3_i2c2b_tactical_outcome_proposals/migration.sql", import.meta.url), "utf8");
const ordinaryMigration = readFileSync(new URL("../../../prisma/migrations/20260713120000_rtw1_s2_ordinary_tactical_closure/migration.sql", import.meta.url), "utf8");
const rollback = readFileSync(new URL("../../../prisma/migrations/20260713120000_rtw1_s2_ordinary_tactical_closure/rollback.sql", import.meta.url), "utf8");

describe("G3-I2C-2B tactical outcome proposal persistence", () => {
  test("defines only Project and Action with the four versioned process states", () => {
    assert.match(schema, /enum TacticalOutcomeKind \{[\s\S]+PROJECT[\s\S]+ACTION[\s\S]+\}/);
    assert.match(schema, /enum TacticalOutcomeProposalStatus \{[\s\S]+PROPOSED[\s\S]+RETURNED[\s\S]+REJECTED[\s\S]+APPROVED[\s\S]+\}/);
    assert.match(schema, /revision\s+Int\s+@default\(1\)/);
    assert.match(migration, /revision_check[^;]+"revision" >= 1/);
  });

  test("pins source, exact route, meeting, proposer, responsibility, and tenant with foreign keys", () => {
    for (const field of ["organizationId", "tensionId", "runId", "meetingId", "sourceTensionArtifactId", "routeArtifactId", "proposerId", "circleId", "responsiblePersonId"]) {
      assert.match(schema, new RegExp(`${field}\\s+String`));
    }
    assert.match(migration, /FOREIGN KEY \("sourceTensionArtifactId", "organizationId", "runId"\)/);
    assert.match(migration, /FOREIGN KEY \("routeArtifactId", "organizationId", "runId"\)/);
    assert.match(migration, /FOREIGN KEY \("meetingId", "organizationId"\)/);
    assert.match(migration, /FOREIGN KEY \("responsiblePersonId", "organizationId"\)/);
  });

  test("enforces one proposal, one claimed outcome, idempotency, and kind-specific content", () => {
    assert.match(schema, /tensionId\s+String\s+@unique/);
    assert.match(schema, /outcomeProjectId\s+String\?\s+@unique/);
    assert.match(schema, /outcomeActionId\s+String\?\s+@unique/);
    assert.match(schema, /lastMutationKey\s+String\?\s*\n/);
    assert.doesNotMatch(schema, /lastMutationKey\s+String\?\s+@unique/);
    assert.match(schema, /@@unique\(\[organizationId, lastMutationKey\]\)/);
    assert.match(migration, /content_check/);
    assert.match(migration, /result_check/);
    assert.match(migration, /mutation_result_check/);
  });

  test("has a reviewable reverse-order rollback", () => {
    assert.match(migration, /Reviewed rollback \(execute in this reverse order\)/);
    assert.match(migration, /DROP TABLE "tactical_outcome_proposals"/);
    assert.match(migration, /DROP TYPE "TacticalOutcomeProposalStatus"/);
    assert.match(migration, /DROP TYPE "TacticalOutcomeKind"/);
  });
});

describe("RTW1-S2 ordinary tactical closure persistence", () => {
  test("keeps historical tensions unrouted and stores AI routing advice separately", () => {
    assert.match(schema, /enum TensionHandlingMode \{[\s\S]+UNROUTED[\s\S]+TACTICAL[\s\S]+GOVERNANCE[\s\S]+\}/);
    assert.match(schema, /handlingMode\s+TensionHandlingMode\s+@default\(UNROUTED\)/);
    assert.match(schema, /aiHandlingSuggestion\s+TensionHandlingMode\?/);
    assert.match(ordinaryMigration, /DEFAULT 'UNROUTED'/);
  });

  test("generalizes proposal provenance without weakening runtime exact provenance", () => {
    assert.match(schema, /enum TacticalOutcomeProvenanceKind \{[\s\S]+ORDINARY_TENSION[\s\S]+INTERFACE_RUN[\s\S]+\}/);
    assert.match(schema, /provenanceKind\s+TacticalOutcomeProvenanceKind/);
    for (const field of ["runId", "sourceTensionArtifactId", "routeArtifactId"]) {
      assert.match(schema, new RegExp(`${field}\\s+String\\?`));
    }
    assert.match(ordinaryMigration, /provenance_check/);
    assert.match(ordinaryMigration, /INTERFACE_RUN[\s\S]+"runId" IS NOT NULL[\s\S]+"sourceTensionArtifactId" IS NOT NULL[\s\S]+"routeArtifactId" IS NOT NULL/);
    assert.match(ordinaryMigration, /ORDINARY_TENSION[\s\S]+"runId" IS NULL[\s\S]+"sourceTensionArtifactId" IS NULL[\s\S]+"routeArtifactId" IS NULL/);
  });

  test("persists project completion actor and time and has executable reverse SQL", () => {
    assert.match(schema, /completedById\s+String\?/);
    assert.match(schema, /completedBy\s+Person\?\s+@relation\("ProjectCompletedBy", fields: \[completedById, organizationId\], references: \[id, organizationId\], onDelete: Restrict\)/);
    assert.match(ordinaryMigration, /DROP INDEX "tactical_outcome_proposals_lastMutationKey_key"/);
    assert.match(ordinaryMigration, /CREATE UNIQUE INDEX "tactical_outcome_proposals_organizationId_lastMutationKey_key"[\s\S]+\("organizationId", "lastMutationKey"\)/);
    assert.match(ordinaryMigration, /FOREIGN KEY \("completedById", "organizationId"\) REFERENCES "people"\("id", "organizationId"\)/);
    assert.match(rollback, /DROP COLUMN "completedById"/);
    assert.match(rollback, /duplicate mutation keys across organizations/);
    assert.match(rollback, /CREATE UNIQUE INDEX "tactical_outcome_proposals_lastMutationKey_key"/);
    assert.match(rollback, /DROP TYPE "TacticalOutcomeProvenanceKind"/);
    assert.match(rollback, /DROP TYPE "TensionHandlingMode"/);
  });
});
