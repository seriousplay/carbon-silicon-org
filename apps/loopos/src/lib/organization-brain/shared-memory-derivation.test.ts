import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import {
  confirmMemoryCandidate,
  createDraftMemoryCandidate,
  rejectMemoryCandidate,
  submitMemoryCandidate,
  supersedeMemoryCandidate,
} from "./memory-candidate-lifecycle";
import {
  deriveSharedMemoryEntry,
  rankSharedMemoryEntries,
  SharedMemoryDerivationError,
} from "./shared-memory-derivation";
import type {
  MemoryCandidate,
  MemoryCandidateActor,
  MemoryCandidateSourceRef,
} from "./memory-candidate-types";

const createdAt = new Date("2026-07-15T12:00:00.000Z");
const submittedAt = new Date("2026-07-15T13:00:00.000Z");
const confirmedAt = new Date("2026-07-15T14:00:00.000Z");
const readAt = new Date("2026-07-16T00:00:00.000Z");
const owner: MemoryCandidateActor = Object.freeze({
  type: "person",
  id: "person-owner",
  label: "Owner",
});
const confirmer: MemoryCandidateActor = Object.freeze({
  type: "process",
  id: "goal:person-reviewer",
  label: "Goal source authority",
});
const goalSource: MemoryCandidateSourceRef = Object.freeze({
  type: "goal",
  id: "goal-a",
  label: "Activation Goal",
  applicationUrl: "/app/goals?goal=goal-a",
  observedAt: createdAt.toISOString(),
});
const targetSource: MemoryCandidateSourceRef = Object.freeze({
  type: "target",
  id: "target-a",
  label: "Weekly activation evidence",
  applicationUrl: "/app/goals?target=target-a",
  observedAt: createdAt.toISOString(),
});

function draft(input: Partial<Parameters<typeof createDraftMemoryCandidate>[0]> = {}) {
  return createDraftMemoryCandidate({
    id: "candidate-a",
    organizationId: "org-a",
    ownerPersonId: owner.id,
    actor: owner,
    claim: "Activation Goal evidence is stale.",
    rationale: "The target has no recent check-in evidence.",
    sourceRefs: [goalSource, targetSource],
    now: createdAt,
    ...input,
  });
}

function submitted() {
  return submitMemoryCandidate(draft(), {
    actor: owner,
    now: submittedAt,
  });
}

function confirmed(input: Partial<Parameters<typeof confirmMemoryCandidate>[1]> = {}) {
  return confirmMemoryCandidate(submitted(), {
    actor: confirmer,
    now: confirmedAt,
    validFrom: "2026-07-15T14:00:00.000Z",
    ...input,
  });
}

describe("V5-M4-C1 shared memory derivation", () => {
  test("derives a frozen source-confirmed shared memory entry from an active confirmed candidate", () => {
    const entry = deriveSharedMemoryEntry(confirmed(), {
      authorizedSourceRefs: [goalSource, targetSource],
      now: readAt,
      queryText: "activation evidence",
    });

    assert.ok(entry);
    assert.equal(entry.schemaVersion, 1);
    assert.equal(entry.candidateId, "candidate-a");
    assert.equal(entry.confidence, "SOURCE_CONFIRMED");
    assert.equal(entry.claim, "Activation Goal evidence is stale.");
    assert.equal(entry.authorityRoute.kind, "GOAL_STRATEGY");
    assert.equal(entry.confirmedBy.id, "goal:person-reviewer");
    assert.equal(entry.validFrom, "2026-07-15T14:00:00.000Z");
    assert.equal(entry.validUntil, null);
    assert.equal(entry.supersededBy, null);
    assert.equal(entry.applicationUrl, "/app/goals");
    assert.deepEqual(entry.sourceRefs.map((ref) => ref.id), ["goal-a", "target-a"]);
    assert.equal(entry.ranking.textMatchCount, 2);
    assert.equal(Object.isFrozen(entry), true);
    assert.equal(Object.isFrozen(entry.sourceRefs), true);
    assert.equal(Object.isFrozen(entry.sourceRefs[0]), true);
  });

  test("filters source references to the caller-authorized subset", () => {
    const entry = deriveSharedMemoryEntry(confirmed(), {
      authorizedSourceRefs: [targetSource],
      now: readAt,
    });

    assert.ok(entry);
    assert.deepEqual(entry.sourceRefs.map((ref) => ref.id), ["target-a"]);
    assert.equal(entry.ranking.sourceCount, 1);
  });

  test("omits entries when no authorized source reference remains", () => {
    const entry = deriveSharedMemoryEntry(confirmed(), {
      authorizedSourceRefs: [{
        ...goalSource,
        id: "goal-other",
        applicationUrl: "/app/goals?goal=goal-other",
      }],
      now: readAt,
    });

    assert.equal(entry, null);
  });

  test("omits draft, submitted, rejected, expired, superseded, and future-valid candidates", () => {
    const rejected = rejectMemoryCandidate(submitted(), {
      actor: confirmer,
      now: confirmedAt,
      reason: "Insufficient evidence.",
    });
    const expired = confirmed({
      validFrom: "2026-07-15T00:00:00.000Z",
      validUntil: "2026-07-15T23:59:59.000Z",
    });
    const futureValid = confirmed({
      validFrom: "2026-07-17T00:00:00.000Z",
    });
    const superseded = supersedeMemoryCandidate(confirmed(), {
      actor: confirmer,
      now: new Date("2026-07-16T12:00:00.000Z"),
      reason: "Later source record replaced it.",
      supersededBy: {
        type: "sourceRecord",
        id: "decision-a",
        label: "Later decision",
        applicationUrl: "/app/meetings/meeting-a",
      },
    });

    for (const candidate of [draft(), submitted(), rejected, expired, futureValid, superseded]) {
      assert.equal(deriveSharedMemoryEntry(candidate, {
        authorizedSourceRefs: [goalSource, targetSource],
        now: readAt,
      }), null);
    }
  });

  test("rejects malformed confirmed candidates instead of producing raw errors", () => {
    const malformed = {
      ...confirmed(),
      validFrom: "not-a-date",
    } as MemoryCandidate;

    assert.throws(
      () => deriveSharedMemoryEntry(malformed, {
        authorizedSourceRefs: [goalSource],
        now: readAt,
      }),
      (error) => error instanceof SharedMemoryDerivationError && error.code === "INVALID_CANDIDATE",
    );
    for (const malformedCandidate of [
      { ...confirmed(), authorityRoute: null },
      { ...confirmed(), sourceRefs: null },
      { ...confirmed(), sourceRefs: [null] },
      { ...confirmed(), confirmedBy: null },
    ] as unknown as MemoryCandidate[]) {
      assert.throws(
        () => deriveSharedMemoryEntry(malformedCandidate, {
          authorizedSourceRefs: [goalSource],
          now: readAt,
        }),
        (error) => error instanceof SharedMemoryDerivationError && error.code === "INVALID_CANDIDATE",
      );
    }
  });

  test("ranks entries deterministically by text match, route rank, source count, validity, and id", () => {
    const goal = deriveSharedMemoryEntry(confirmed(), {
      authorizedSourceRefs: [goalSource, targetSource],
      now: readAt,
      queryText: "activation evidence",
    });
    const governance = deriveSharedMemoryEntry(confirmedCandidate({
      id: "candidate-b",
      sourceRef: {
        type: "role",
        id: "role-a",
        label: "Activation role",
        applicationUrl: "/app/roles/role-a",
        observedAt: createdAt.toISOString(),
      },
      confirmer: {
        type: "process",
        id: "governance:person-reviewer",
        label: "Governance source authority",
      },
      validFrom: "2026-07-15T15:00:00.000Z",
    }), {
      authorizedSourceRefs: [{
        type: "role",
        id: "role-a",
        label: "Activation role",
        applicationUrl: "/app/roles/role-a",
        observedAt: createdAt.toISOString(),
      }],
      now: readAt,
      queryText: "activation",
    });

    assert.ok(goal);
    assert.ok(governance);
    assert.deepEqual(rankSharedMemoryEntries([governance, goal], {
      text: "activation evidence",
      limit: 2,
    }).map((entry) => entry.candidateId), ["candidate-a", "candidate-b"]);
    assert.deepEqual(rankSharedMemoryEntries([governance, goal], {
      authorityRouteKind: "GOVERNANCE",
    }).map((entry) => entry.candidateId), ["candidate-b"]);
    assert.deepEqual(rankSharedMemoryEntries([governance, goal], {
      text: "missing-token",
    }), []);
  });

  test("rejects invalid query shape before ranking", () => {
    const entry = deriveSharedMemoryEntry(confirmed(), {
      authorizedSourceRefs: [goalSource],
      now: readAt,
    });

    assert.ok(entry);
    assert.throws(
      () => rankSharedMemoryEntries([entry], { limit: 21 }),
      (error) => error instanceof SharedMemoryDerivationError && error.code === "INVALID_QUERY",
    );
  });

  test("static boundary has no database, action, command execution, provider, plugin, deployment, or mutation imports", () => {
    const sources = [
      readFileSync("src/lib/organization-brain/shared-memory-types.ts", "utf8"),
      readFileSync("src/lib/organization-brain/shared-memory-derivation.ts", "utf8"),
    ].join("\n");
    const forbidden = [
      "prisma",
      "server-only",
      "actions",
      "confirmBrainCommandPreview",
      "CommandRegistry",
      "provider",
      "plugin",
      "deployment",
      "child_process",
      "memory-candidate-service",
      "confirmMemoryCandidateForActor",
      "rejectMemoryCandidateForActor",
      "supersedeMemoryCandidateForActor",
    ];
    for (const token of forbidden) {
      assert.equal(sources.includes(token), false, token);
    }
  });
});

function confirmedCandidate(input: Readonly<{
  id: string;
  sourceRef: MemoryCandidateSourceRef;
  confirmer: MemoryCandidateActor;
  validFrom: string;
}>): MemoryCandidate {
  const candidate = createDraftMemoryCandidate({
    id: input.id,
    organizationId: "org-a",
    ownerPersonId: owner.id,
    actor: owner,
    claim: `${input.sourceRef.label} memory is confirmed.`,
    rationale: "The source authority confirmed this operating memory.",
    sourceRefs: [input.sourceRef],
    now: createdAt,
  });
  return confirmMemoryCandidate(submitMemoryCandidate(candidate, {
    actor: owner,
    now: submittedAt,
  }), {
    actor: input.confirmer,
    now: confirmedAt,
    validFrom: input.validFrom,
  });
}
