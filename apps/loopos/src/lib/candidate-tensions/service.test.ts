import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  closeCandidateTensionWithHuman,
  confirmCandidateTensionWithHuman,
  createCandidateTension,
  mergeCandidateTensionWithHuman,
} from "./service";

type Row = {
  id: string;
  organizationId: string;
  title: string;
  evidenceSummary: string;
  sourceKind: "GOAL";
  sourceRef: Record<string, unknown>;
  ownerRoleId: string;
  detectedById: string;
  status: "DETECTED" | "CONFIRMED" | "DISMISSED" | "MERGED" | "FALSE_POSITIVE";
  suggestedMode: "TACTICAL" | "GOVERNANCE" | null;
  confirmedTensionId: string | null;
  confirmedById: string | null;
  confirmedAt: Date | null;
  terminalReason: string | null;
  mergedIntoId: string | null;
};

function createStore() {
  const roles = new Map<string, { organizationId: string; assigneeIds: string[] }>([
    ["role-1", { organizationId: "org-1", assigneeIds: ["human-1"] }],
    ["role-2", { organizationId: "org-1", assigneeIds: ["human-1"] }],
  ]);
  const people = new Map<string, { organizationId: string; entityType: "HUMAN" | "AGENT" }>([
    ["agent-1", { organizationId: "org-1", entityType: "AGENT" }],
    ["human-1", { organizationId: "org-1", entityType: "HUMAN" }],
    ["human-2", { organizationId: "org-1", entityType: "HUMAN" }],
    ["other-human", { organizationId: "org-2", entityType: "HUMAN" }],
  ]);
  const tensions = new Map<string, { organizationId: string }>([
    ["tension-1", { organizationId: "org-1" }],
    ["other-tension", { organizationId: "org-2" }],
  ]);
  const candidates = new Map<string, Row>();
  const auditEvents: Record<string, unknown>[] = [];
  let nextCandidate = 1;

  const store: {
    auditEvents: Record<string, unknown>[];
    candidates: Map<string, Row>;
    roleDef: {
      findFirst(args: {
        where: {
          id: string;
          organizationId: string;
          assignees?: { some: { id: string; organizationId: string; entityType: "HUMAN" } };
        };
      }): Promise<{ id: string } | null>;
    };
    person: {
      findFirst(args: { where: { id: string; organizationId: string; entityType?: "HUMAN" } }): Promise<{ id: string } | null>;
    };
    tension: {
      findFirst(args: { where: { id: string; organizationId: string } }): Promise<{ id: string; organizationId: string } | null>;
    };
    candidateTension: {
      create(args: { data: Partial<Row> }): Promise<Row>;
      findFirst(args: { where: { id: string; organizationId: string } }): Promise<Row | null>;
      update(args: { where: { id_organizationId: { id: string; organizationId: string } }; data: Partial<Row> }): Promise<Row>;
    };
    candidateTensionAuditEvent: {
      create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
    };
    $transaction<T>(fn: (tx: ReturnType<typeof createStore>) => Promise<T>): Promise<T>;
  } = {
    auditEvents,
    candidates,
    roleDef: {
      async findFirst(args: {
        where: {
          id: string;
          organizationId: string;
          assignees?: { some: { id: string; organizationId: string; entityType: "HUMAN" } };
        };
      }) {
        const role = roles.get(args.where.id);
        if (!role || role.organizationId !== args.where.organizationId) return null;
        const assignee = args.where.assignees?.some;
        if (assignee) {
          const person = people.get(assignee.id);
          if (
            !person ||
            person.organizationId !== assignee.organizationId ||
            person.entityType !== "HUMAN" ||
            !role.assigneeIds.includes(assignee.id)
          ) {
            return null;
          }
        }
        return { id: args.where.id };
      },
    },
    person: {
      async findFirst(args: { where: { id: string; organizationId: string; entityType?: "HUMAN" } }) {
        const person = people.get(args.where.id);
        if (!person || person.organizationId !== args.where.organizationId) return null;
        if (args.where.entityType && person.entityType !== args.where.entityType) return null;
        return { id: args.where.id };
      },
    },
    tension: {
      async findFirst(args: { where: { id: string; organizationId: string } }) {
        const tension = tensions.get(args.where.id);
        if (!tension || tension.organizationId !== args.where.organizationId) return null;
        return { id: args.where.id, organizationId: args.where.organizationId };
      },
    },
    candidateTension: {
      async create(args: { data: Partial<Row> }) {
        const row = {
          id: `candidate-${nextCandidate++}`,
          organizationId: args.data.organizationId ?? "org-1",
          title: args.data.title ?? "",
          evidenceSummary: args.data.evidenceSummary ?? "",
          sourceKind: "GOAL" as const,
          sourceRef: args.data.sourceRef ?? {},
          ownerRoleId: args.data.ownerRoleId ?? "",
          detectedById: args.data.detectedById ?? "",
          status: "DETECTED" as const,
          suggestedMode: args.data.suggestedMode ?? null,
          confirmedTensionId: null,
          confirmedById: null,
          confirmedAt: null,
          terminalReason: null,
          mergedIntoId: null,
        };
        candidates.set(row.id, row);
        return row;
      },
      async findFirst(args: { where: { id: string; organizationId: string } }) {
        const row = candidates.get(args.where.id);
        if (!row || row.organizationId !== args.where.organizationId) return null;
        return row;
      },
      async update(args: { where: { id_organizationId: { id: string; organizationId: string } }; data: Partial<Row> }) {
        const row = candidates.get(args.where.id_organizationId.id);
        assert.ok(row);
        assert.equal(row.organizationId, args.where.id_organizationId.organizationId);
        const updated = { ...row, ...args.data };
        candidates.set(updated.id, updated);
        return updated;
      },
    },
    candidateTensionAuditEvent: {
      async create(args: { data: Record<string, unknown> }) {
        auditEvents.push(args.data);
        return args.data;
      },
    },
    async $transaction<T>(fn: (tx: typeof store) => Promise<T>) {
      return fn(store);
    },
  };
  return store;
}

const draft = {
  organizationId: "org-1",
  title: "Goal evidence is missing",
  evidenceSummary: "The owner role has no weekly goal progress evidence.",
  sourceKind: "GOAL" as const,
  sourceRef: { goalId: "goal-1", evidenceId: "evidence-1" },
  ownerRoleId: "role-1",
  detectedById: "agent-1",
  suggestedMode: "TACTICAL" as const,
};

describe("V6-M5-B candidate tension persistence service", () => {
  test("creates a detected candidate and append-only detection audit without creating formal tension", async () => {
    const store = createStore();
    const created = await createCandidateTension(store, draft);

    assert.equal(created.id, "candidate-1");
    assert.equal(created.status, "DETECTED");
    assert.equal(created.confirmedTensionId, null);
    assert.equal(store.auditEvents.length, 1);
    assert.equal(store.auditEvents[0]?.type, "DETECTED");
    assert.equal(store.auditEvents[0]?.actorPersonId, "agent-1");
  });

  test("confirms only through the owner Role's human assignee and existing same-org formal tension", async () => {
    const store = createStore();
    await createCandidateTension(store, draft);

    await assert.rejects(
      () =>
        confirmCandidateTensionWithHuman(store, {
          organizationId: "org-1",
          candidateId: "candidate-1",
          confirmedTensionId: "tension-1",
          actorPersonId: "human-2",
        }),
      /HUMAN_OWNER_ROLE_ASSIGNEE_REQUIRED/,
    );
    await assert.rejects(
      () =>
        confirmCandidateTensionWithHuman(store, {
          organizationId: "org-1",
          candidateId: "candidate-1",
          confirmedTensionId: "other-tension",
          actorPersonId: "human-1",
        }),
      /CONFIRMED_TENSION_NOT_FOUND/,
    );

    const confirmed = await confirmCandidateTensionWithHuman(store, {
      organizationId: "org-1",
      candidateId: "candidate-1",
      confirmedTensionId: "tension-1",
      actorPersonId: "human-1",
    });

    assert.equal(confirmed.status, "CONFIRMED");
    assert.equal(confirmed.confirmedTensionId, "tension-1");
    assert.equal(confirmed.confirmedById, "human-1");
    assert.ok(confirmed.confirmedAt);
    assert.equal(store.auditEvents.at(-1)?.type, "CONFIRMED");
  });

  test("dismisses and marks false positives only by the owner Role's human assignee", async () => {
    const store = createStore();
    await createCandidateTension(store, draft);

    const dismissed = await closeCandidateTensionWithHuman(store, {
      organizationId: "org-1",
      candidateId: "candidate-1",
      actorPersonId: "human-1",
      reason: "Already handled in the meeting",
    });
    assert.equal(dismissed.status, "DISMISSED");
    assert.equal(dismissed.terminalReason, "Already handled in the meeting");
    assert.equal(store.auditEvents.at(-1)?.type, "DISMISSED");

    await createCandidateTension(store, draft);
    const falsePositive = await closeCandidateTensionWithHuman(store, {
      organizationId: "org-1",
      candidateId: "candidate-2",
      actorPersonId: "human-1",
      reason: "The signal was stale",
      falsePositive: true,
    });
    assert.equal(falsePositive.status, "FALSE_POSITIVE");
    assert.equal(store.auditEvents.at(-1)?.type, "MARKED_FALSE_POSITIVE");
  });

  test("merges only detected same-org candidates and keeps terminal audit evidence", async () => {
    const store = createStore();
    await createCandidateTension(store, draft);
    await createCandidateTension(store, { ...draft, title: "Same missing evidence" });

    const merged = await mergeCandidateTensionWithHuman(store, {
      organizationId: "org-1",
      candidateId: "candidate-1",
      actorPersonId: "human-1",
      mergedIntoId: "candidate-2",
      reason: "Duplicate signal",
    });

    assert.equal(merged.status, "MERGED");
    assert.equal(merged.mergedIntoId, "candidate-2");
    assert.equal(merged.confirmedTensionId, null);
    assert.equal(store.auditEvents.at(-1)?.type, "MERGED");
  });

  test("refuses terminal-state mutation", async () => {
    const store = createStore();
    await createCandidateTension(store, draft);
    await closeCandidateTensionWithHuman(store, {
      organizationId: "org-1",
      candidateId: "candidate-1",
      actorPersonId: "human-1",
      reason: "Already resolved",
    });

    await assert.rejects(
      () =>
        confirmCandidateTensionWithHuman(store, {
          organizationId: "org-1",
          candidateId: "candidate-1",
          confirmedTensionId: "tension-1",
          actorPersonId: "human-1",
        }),
      /CANDIDATE_NOT_DETECTED/,
    );
  });
});
