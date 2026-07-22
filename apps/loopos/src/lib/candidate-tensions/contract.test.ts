import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import {
  CANDIDATE_TENSION_SOURCE_KINDS,
  CANDIDATE_TENSION_STATUSES,
  candidateIsFormalTension,
  confirmCandidateTension,
  createDetectedCandidateTension,
  dismissCandidateTension,
  mergeCandidateTension,
  validateCandidateTensionDraft,
} from "./contract";

const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL(
    "../../../prisma/migrations/20260721013000_v6_m5a_candidate_tension_data_contract/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

const baseDraft = Object.freeze({
  organizationId: "org-1",
  title: "Goal progress has no supporting evidence",
  evidenceSummary: "Goal check-ins have been missing for two weeks.",
  sourceKind: "GOAL" as const,
  sourceRef: { type: "goal", id: "goal-1", evidenceId: "ev_abc" },
  ownerRoleId: "role-1",
  detectedById: "agent-1",
  suggestedMode: "TACTICAL" as const,
});

describe("V6-M5-A candidate tension data contract", () => {
  test("defines candidate tension lifecycle and evidence source vocabulary", () => {
    assert.deepEqual(CANDIDATE_TENSION_STATUSES, [
      "DETECTED",
      "CONFIRMED",
      "DISMISSED",
      "MERGED",
      "FALSE_POSITIVE",
    ]);
    assert.deepEqual(CANDIDATE_TENSION_SOURCE_KINDS, [
      "GOAL",
      "METRIC",
      "PROJECT",
      "ACTION",
      "ROLE",
      "BUSINESS_LOOP",
      "AI_EXECUTION_AUDIT",
      "MEMORY",
      "MEETING",
      "EXTERNAL_SIGNAL",
    ]);

    assert.match(schema, /enum CandidateTensionStatus \{[\s\S]*DETECTED[\s\S]*CONFIRMED[\s\S]*FALSE_POSITIVE[\s\S]*\}/);
    assert.match(schema, /model CandidateTension \{/);
    assert.match(schema, /@@map\("candidate_tensions"\)/);
    assert.match(migration, /CREATE TABLE "candidate_tensions"/);
    assert.match(migration, /"sourceRef" JSONB NOT NULL/);
    assert.match(migration, /"confirmedTensionId" TEXT/);
    assert.doesNotMatch(schema, /confirmedTensionId\s+String\?\s+@unique/);
    assert.match(schema, /@@unique\(\[confirmedTensionId, organizationId\]\)/);
    assert.match(migration, /candidate_tensions_lifecycle_state_check/);
    assert.match(migration, /"status" = 'CONFIRMED'[\s\S]*"confirmedTensionId" IS NOT NULL[\s\S]*"confirmedById" IS NOT NULL[\s\S]*"confirmedAt" IS NOT NULL/);
    assert.match(migration, /"status" = 'DETECTED'[\s\S]*"confirmedTensionId" IS NULL[\s\S]*"terminalReason" IS NULL[\s\S]*"mergedIntoId" IS NULL/);
    assert.match(migration, /"status" = 'MERGED'[\s\S]*"mergedIntoId" IS NOT NULL/);
    assert.doesNotMatch(migration, /INSERT INTO "tensions"|CREATE TRIGGER|scheduler|worker|dispatch|biocoach/i);
  });

  test("requires source evidence, owner Role, detector, and valid routing suggestion", () => {
    assert.deepEqual(validateCandidateTensionDraft({}), [
      "ORGANIZATION_REQUIRED",
      "TITLE_REQUIRED",
      "EVIDENCE_REQUIRED",
      "OWNER_ROLE_REQUIRED",
      "DETECTOR_REQUIRED",
      "UNSUPPORTED_SOURCE_KIND",
      "SOURCE_REF_REQUIRED",
    ]);
    assert.deepEqual(validateCandidateTensionDraft({ ...baseDraft, suggestedMode: "STRATEGY" }), [
      "UNSUPPORTED_SUGGESTED_MODE",
    ]);
    assert.deepEqual(validateCandidateTensionDraft(baseDraft), []);
  });

  test("creates detected candidates without creating formal tensions", () => {
    const candidate = createDetectedCandidateTension("candidate-1", baseDraft);

    assert.equal(candidate.status, "DETECTED");
    assert.equal(candidate.confirmedTensionId, null);
    assert.equal(candidate.ownerRoleId, "role-1");
    assert.equal(candidateIsFormalTension(candidate), false);
  });

  test("confirms a detected candidate only by linking a later formal tension", () => {
    const candidate = createDetectedCandidateTension("candidate-1", baseDraft);
    const confirmed = confirmCandidateTension(candidate, {
      confirmedTensionId: "tension-1",
      confirmedById: "human-1",
    });

    assert.equal(confirmed.status, "CONFIRMED");
    assert.equal(confirmed.confirmedTensionId, "tension-1");
    assert.equal(confirmed.confirmedById, "human-1");
    assert.equal(candidate.confirmedTensionId, null);
  });

  test("supports dismissal, false-positive marking, and merge without formal tension", () => {
    const candidate = createDetectedCandidateTension("candidate-1", baseDraft);
    assert.equal(dismissCandidateTension(candidate, { reason: "Already resolved" }).status, "DISMISSED");
    assert.equal(dismissCandidateTension(candidate, { reason: "Bad signal", falsePositive: true }).status, "FALSE_POSITIVE");
    const merged = mergeCandidateTension(candidate, { mergedIntoId: "candidate-2", reason: "Duplicate" });
    assert.equal(merged.status, "MERGED");
    assert.equal(merged.mergedIntoId, "candidate-2");
    assert.equal(merged.confirmedTensionId, null);
  });

  test("terminal candidates cannot be confirmed or changed again", () => {
    const candidate = createDetectedCandidateTension("candidate-1", baseDraft);
    const dismissed = dismissCandidateTension(candidate, { reason: "Already resolved" });

    assert.throws(() => confirmCandidateTension(dismissed, { confirmedTensionId: "tension-1", confirmedById: "human-1" }), /CANDIDATE_NOT_DETECTED/);
    assert.throws(() => mergeCandidateTension(dismissed, { mergedIntoId: "candidate-2", reason: "Duplicate" }), /CANDIDATE_NOT_DETECTED/);
  });
});
