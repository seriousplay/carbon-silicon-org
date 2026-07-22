import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import {
  classifyMemoryCandidateAuthorityRoute,
  confirmMemoryCandidate,
  createDraftMemoryCandidate,
  isMemoryCandidateExpired,
  rejectMemoryCandidate,
  submitMemoryCandidate,
  supersedeMemoryCandidate,
  MemoryCandidateLifecycleError,
} from "./memory-candidate-lifecycle";
import type {
  MemoryCandidateActor,
  MemoryCandidateSourceRef,
} from "./memory-candidate-types";

const now = new Date("2026-07-15T12:00:00.000Z");
const later = new Date("2026-07-16T12:00:00.000Z");
const owner: MemoryCandidateActor = Object.freeze({
  type: "person",
  id: "person-owner",
  label: "Owner",
});
const reviewer: MemoryCandidateActor = Object.freeze({
  type: "process",
  id: "goal:strategy-process",
  label: "Strategic process",
});
const goalSource: MemoryCandidateSourceRef = Object.freeze({
  type: "goal",
  id: "goal-a",
  label: "Increase activation",
  applicationUrl: "/app/goals?goal=goal-a",
  observedAt: now.toISOString(),
});

function draft(overrides: Partial<Parameters<typeof createDraftMemoryCandidate>[0]> = {}) {
  return createDraftMemoryCandidate({
    id: "candidate-a",
    organizationId: "org-a",
    ownerPersonId: owner.id,
    actor: owner,
    claim: "Activation Goal evidence is stale.",
    rationale: "The current Goal has not been checked in recently.",
    sourceRefs: [goalSource],
    now,
    ...overrides,
  });
}

function submitted() {
  return submitMemoryCandidate(draft(), {
    actor: owner,
    now: later,
    reason: "Submit for source-authority review.",
  });
}

describe("V5-M4-B1 memory candidate lifecycle", () => {
  test("creates an owner-private draft with source-authority route and frozen audit trail", () => {
    const candidate = draft();

    assert.equal(candidate.schemaVersion, 1);
    assert.equal(candidate.status, "DRAFT");
    assert.equal(candidate.claim, "Activation Goal evidence is stale.");
    assert.equal(candidate.authorityRoute.kind, "GOAL_STRATEGY");
    assert.equal(candidate.submittedBy, null);
    assert.equal(candidate.confirmedBy, null);
    assert.equal(candidate.validFrom, null);
    assert.equal(candidate.auditTrail.length, 1);
    assert.equal(candidate.auditTrail[0]?.type, "CREATED");
    assert.equal(Object.isFrozen(candidate), true);
    assert.equal(Object.isFrozen(candidate.sourceRefs), true);
    assert.equal(Object.isFrozen(candidate.sourceRefs[0]), true);
    assert.equal(Object.isFrozen(candidate.auditTrail), true);
  });

  test("classifies by highest source authority and defaults unowned knowledge to tension", () => {
    assert.equal(classifyMemoryCandidateAuthorityRoute([goalSource]).kind, "GOAL_STRATEGY");
    assert.equal(classifyMemoryCandidateAuthorityRoute([
      { ...goalSource, type: "role", applicationUrl: "/app/roles/role-a" },
    ]).kind, "GOVERNANCE");
    assert.equal(classifyMemoryCandidateAuthorityRoute([
      { ...goalSource, type: "project", applicationUrl: "/app/projects/project-a" },
    ]).kind, "TACTICAL");
    assert.equal(classifyMemoryCandidateAuthorityRoute([
      { ...goalSource, type: "meeting", applicationUrl: "/app/meetings/meeting-a" },
    ]).kind, "MEETING_RECORD");
    assert.equal(classifyMemoryCandidateAuthorityRoute([
      { ...goalSource, type: "meeting", applicationUrl: "/app/meetings/meeting-a" },
      { ...goalSource, type: "role", applicationUrl: "/app/roles/role-a" },
    ]).kind, "GOVERNANCE");
    assert.equal(classifyMemoryCandidateAuthorityRoute([
      { ...goalSource, type: "project", applicationUrl: "/app/projects/project-a" },
      { ...goalSource, type: "target", applicationUrl: "/app/goals?target=target-a" },
    ]).kind, "GOAL_STRATEGY");
    assert.equal(classifyMemoryCandidateAuthorityRoute([]).kind, "TENSION");
  });

  test("requires explicit owner submission and freezes the reviewed claim and sources", () => {
    const candidate = submitted();

    assert.equal(candidate.status, "SUBMITTED");
    assert.equal(candidate.submittedBy?.id, owner.id);
    assert.equal(candidate.claim, "Activation Goal evidence is stale.");
    assert.equal(candidate.sourceRefs[0]?.id, "goal-a");
    assert.deepEqual(candidate.auditTrail.map((event) => event.type), ["CREATED", "SUBMITTED"]);
    assert.throws(
      () => submitMemoryCandidate(draft(), {
        actor: { type: "person", id: "person-other", label: "Other" },
        now: later,
      }),
      (error) => error instanceof MemoryCandidateLifecycleError && error.code === "OWNER_REQUIRED",
    );
  });

  test("confirms a submitted candidate with validity metadata and treats expiry as derived state", () => {
    const candidate = confirmMemoryCandidate(submitted(), {
      actor: reviewer,
      now: later,
      validFrom: "2026-07-16T00:00:00.000Z",
      validUntil: "2026-08-16T00:00:00.000Z",
      reason: "Confirmed through source authority.",
    });

    assert.equal(candidate.status, "CONFIRMED");
    assert.equal(candidate.confirmedBy?.id, reviewer.id);
    assert.equal(candidate.validFrom, "2026-07-16T00:00:00.000Z");
    assert.equal(isMemoryCandidateExpired(candidate, new Date("2026-08-15T23:59:59.000Z")), false);
    assert.equal(isMemoryCandidateExpired(candidate, new Date("2026-08-16T00:00:00.000Z")), true);
    assert.deepEqual(candidate.auditTrail.map((event) => event.type), ["CREATED", "SUBMITTED", "CONFIRMED"]);
  });

  test("blocks caller-selected routes and confirmation outside the source authority route", () => {
    const candidate = draft({
      sourceRefs: [
        { ...goalSource, type: "meeting", applicationUrl: "/app/meetings/meeting-a" },
        { ...goalSource, type: "role", id: "role-a", applicationUrl: "/app/roles/role-a" },
      ],
    });

    assert.equal(candidate.authorityRoute.kind, "GOVERNANCE");
    assert.throws(
      () => confirmMemoryCandidate(submitMemoryCandidate(candidate, { actor: owner, now: later }), {
        actor: { type: "process", id: "meeting:meeting-a", label: "Meeting record" },
        now: later,
        validFrom: later.toISOString(),
      }),
      (error) => error instanceof MemoryCandidateLifecycleError && error.code === "UNAUTHORIZED_CONFIRMATION",
    );
    assert.throws(
      () => confirmMemoryCandidate(submitted(), {
        actor: { type: "process", id: "brain:organization-brain", label: "Organization Brain" },
        now: later,
        validFrom: later.toISOString(),
      }),
      (error) => error instanceof MemoryCandidateLifecycleError && error.code === "UNAUTHORIZED_CONFIRMATION",
    );
  });

  test("deep-freezes source refs from externally hydrated candidates", () => {
    const mutableSource = {
      type: "goal",
      id: "goal-mutable",
      label: "Mutable Goal",
      applicationUrl: "/app/goals?goal=goal-mutable",
      observedAt: now.toISOString(),
    } satisfies MemoryCandidateSourceRef;
    const candidate = submitMemoryCandidate({
      ...draft(),
      sourceRefs: [mutableSource],
      status: "DRAFT",
    }, {
      actor: owner,
      now: later,
    });

    mutableSource.label = "Changed outside";

    assert.equal(candidate.sourceRefs[0]?.label, "Mutable Goal");
    assert.equal(Object.isFrozen(candidate.sourceRefs[0]), true);
  });

  test("rejects or supersedes without mutating closed candidates in place", () => {
    const original = submitted();
    const rejected = rejectMemoryCandidate(original, {
      actor: reviewer,
      now: later,
      reason: "Not supported by source authority.",
    });
    const confirmed = confirmMemoryCandidate(original, {
      actor: reviewer,
      now: later,
      validFrom: later.toISOString(),
    });
    const superseded = supersedeMemoryCandidate(confirmed, {
      actor: reviewer,
      now: new Date("2026-07-17T12:00:00.000Z"),
      reason: "Later source record replaced this claim.",
      supersededBy: {
        type: "sourceRecord",
        id: "meeting-decision-a",
        label: "Later decision",
        applicationUrl: "/app/meetings/meeting-a",
      },
    });

    assert.equal(original.status, "SUBMITTED");
    assert.equal(rejected.status, "REJECTED");
    assert.equal(superseded.status, "SUPERSEDED");
    assert.equal(superseded.supersededBy?.id, "meeting-decision-a");
    assert.throws(
      () => confirmMemoryCandidate(rejected, {
        actor: reviewer,
        now: later,
        validFrom: later.toISOString(),
      }),
      (error) => error instanceof MemoryCandidateLifecycleError && error.code === "INVALID_STATUS",
    );
  });

  test("rejects invalid inputs, unauthorized sources, invalid validity, and AI-style actors", () => {
    assert.throws(
      () => draft({ sourceRefs: [{ ...goalSource, applicationUrl: "https://example.com/app/goals" }] }),
      (error) => error instanceof MemoryCandidateLifecycleError && error.code === "INVALID_SOURCE",
    );
    assert.throws(
      () => confirmMemoryCandidate(submitted(), {
        actor: reviewer,
        now: later,
        validFrom: "2026-08-16T00:00:00.000Z",
        validUntil: "2026-08-16T00:00:00.000Z",
      }),
      (error) => error instanceof MemoryCandidateLifecycleError && error.code === "INVALID_VALIDITY",
    );
    assert.throws(
      () => createDraftMemoryCandidate({
        id: "candidate-ai",
        organizationId: "org-a",
        ownerPersonId: owner.id,
        actor: { type: "brain", id: "brain-a", label: "Brain" } as unknown as MemoryCandidateActor,
        claim: "The Brain cannot own a candidate.",
        rationale: "It must be explicitly submitted by a person.",
        sourceRefs: [goalSource],
        now,
      }),
      (error) => error instanceof MemoryCandidateLifecycleError && error.code === "INVALID_ACTOR",
    );
  });

  test("static boundary has no database, action, command execution, provider, plugin, or retrieval imports", () => {
    const source = readFileSync("src/lib/organization-brain/memory-candidate-lifecycle.ts", "utf8");
    const importLines = source.split("\n").filter((line) => line.startsWith("import"));
    assert.deepEqual(importLines, [
      "import type {",
    ]);
    const forbidden = [
      "prisma",
      "server-only",
      "actions",
      "confirmGoalCommandPreview",
      "CommandRegistry",
      "provider",
      "plugin",
      "deployment",
      "child_process",
      "SharedMemory",
      "sharedMemory",
      "memory retrieval",
    ];
    for (const token of forbidden) {
      assert.equal(source.includes(token), false, token);
    }
  });
});
