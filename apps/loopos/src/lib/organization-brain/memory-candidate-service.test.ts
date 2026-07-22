import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, test } from "node:test";
import type { ActorContext } from "../authorization/actor-context-resolver";
import type {
  MemoryCandidateServiceDependencies,
  MemoryCandidateStore,
} from "./memory-candidate-service";
import type {
  MemoryCandidate,
  MemoryCandidateSourceRef,
} from "./memory-candidate-types";

type ServiceModule = typeof import("./memory-candidate-service");

const require = createRequire(import.meta.url);
const originalNodePath = process.env.NODE_PATH;
const compiledModules = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../node_modules/next/dist/compiled",
);
const moduleWithInitPaths = Module as typeof Module & { _initPaths(): void };
let originalServerOnlyModule: NodeJS.Module | undefined;
let serverOnlyPath = "";
let service: ServiceModule;

before(async () => {
  process.env.NODE_PATH = originalNodePath
    ? `${compiledModules}:${originalNodePath}`
    : compiledModules;
  moduleWithInitPaths._initPaths();
  serverOnlyPath = require.resolve("server-only");
  originalServerOnlyModule = require.cache[serverOnlyPath];
  const serverOnlyShim = new Module(serverOnlyPath);
  serverOnlyShim.filename = serverOnlyPath;
  serverOnlyShim.loaded = true;
  require.cache[serverOnlyPath] = serverOnlyShim;
  service = await import("./memory-candidate-service");
});

after(() => {
  if (originalServerOnlyModule) require.cache[serverOnlyPath] = originalServerOnlyModule;
  else delete require.cache[serverOnlyPath];
  if (originalNodePath === undefined) delete process.env.NODE_PATH;
  else process.env.NODE_PATH = originalNodePath;
  moduleWithInitPaths._initPaths();
});

const now = new Date("2026-07-15T12:00:00.000Z");
const later = new Date("2026-07-16T12:00:00.000Z");

const owner: ActorContext = Object.freeze({
  organizationId: "org-a",
  userId: "user-owner",
  personId: "person-owner",
  membershipRole: "ORG_MEMBER",
  homeCircleId: "circle-a",
  assignedActiveRoleDefIds: ["role-a"],
  ledActiveCircleIds: [],
});

const reviewer: ActorContext = Object.freeze({
  organizationId: "org-a",
  userId: "user-reviewer",
  personId: "person-reviewer",
  membershipRole: "ORG_MEMBER",
  homeCircleId: "circle-a",
  assignedActiveRoleDefIds: ["role-a"],
  ledActiveCircleIds: ["circle-a"],
});

const outsider: ActorContext = Object.freeze({
  organizationId: "org-a",
  userId: "user-outsider",
  personId: "person-outsider",
  membershipRole: "ORG_MEMBER",
  homeCircleId: "circle-b",
  assignedActiveRoleDefIds: [],
  ledActiveCircleIds: [],
});

const admin: ActorContext = Object.freeze({
  organizationId: "org-a",
  userId: "user-admin",
  personId: "person-admin",
  membershipRole: "ORG_ADMIN",
  homeCircleId: "circle-a",
  assignedActiveRoleDefIds: [],
  ledActiveCircleIds: [],
});

const sourceRef: MemoryCandidateSourceRef = Object.freeze({
  type: "goal",
  id: "goal-a",
  label: "Activation Goal",
  applicationUrl: "/app/goals?goal=goal-a",
  observedAt: now.toISOString(),
});

function sourceRefOf(type: MemoryCandidateSourceRef["type"], id = `${type}-a`): MemoryCandidateSourceRef {
  return Object.freeze({
    type,
    id,
    label: `${type} source`,
    applicationUrl: type === "meeting" || type === "decision" ? `/app/meetings/${id}` : `/app/${type}s`,
    observedAt: now.toISOString(),
  });
}

function validCreateInput(ref: MemoryCandidateSourceRef = sourceRef) {
  return {
    schemaVersion: 1 as const,
    claim: "Activation Goal evidence is stale.",
    rationale: "The latest check-in is outside the accepted cadence.",
    sourceRefs: [ref],
  };
}

function dependencies(input: {
  actor?: ActorContext;
  store?: FakeMemoryCandidateStore;
  currentNow?: Date;
  nextId?: string;
} = {}): MemoryCandidateServiceDependencies {
  const store = input.store ?? new FakeMemoryCandidateStore();
  return {
    resolveActor: async () => {
      if (!input.actor) throw new Error("missing actor");
      return input.actor;
    },
    store,
    now: () => input.currentNow ?? now,
    createId: () => input.nextId ?? "candidate-a",
  };
}

class FakeMemoryCandidateStore implements MemoryCandidateStore {
  readonly candidates = new Map<string, MemoryCandidate>();
  sourceAllowed = true;
  reviewRoutesByPerson = new Map([
    [reviewer.personId, new Set<MemoryCandidate["authorityRoute"]["kind"]>([
      "GOAL_STRATEGY",
      "GOVERNANCE",
      "TACTICAL",
      "MEETING_RECORD",
    ])],
  ]);

  async create(candidate: MemoryCandidate): Promise<MemoryCandidate> {
    this.candidates.set(candidate.id, candidate);
    return candidate;
  }

  async update(candidate: MemoryCandidate): Promise<MemoryCandidate> {
    this.candidates.set(candidate.id, candidate);
    return candidate;
  }

  async load(organizationId: string, candidateId: string): Promise<MemoryCandidate | null> {
    const candidate = this.candidates.get(candidateId);
    return candidate?.organizationId === organizationId ? candidate : null;
  }

  async listVisibleCandidates(actor: ActorContext, limit: number): Promise<readonly MemoryCandidate[]> {
    const visible: MemoryCandidate[] = [];
    for (const candidate of this.candidates.values()) {
      if (
        candidate.organizationId === actor.organizationId &&
        (
          candidate.ownerPersonId === actor.personId ||
          (candidate.status !== "DRAFT" && await this.canReviewRoute(actor, candidate))
        )
      ) {
        visible.push(candidate);
      }
      if (visible.length >= limit) break;
    }
    return visible;
  }

  async canUseSourceRefs(): Promise<boolean> {
    return this.sourceAllowed;
  }

  async canReviewRoute(actor: ActorContext, candidate: MemoryCandidate): Promise<boolean> {
    return this.reviewRoutesByPerson.get(actor.personId)?.has(candidate.authorityRoute.kind) ?? false;
  }
}

describe("V5-M4-B2 memory candidate service", () => {
  test("validates public input before resolving actor or touching persistence", async () => {
    await assert.rejects(
      () => service.createMemoryCandidateDraftForActor(
        { ...validCreateInput(), schemaVersion: 2 as 1 },
        dependencies({ actor: owner }),
      ),
      (error) => error instanceof service.MemoryCandidateServiceError && error.code === "INVALID_INPUT",
    );
  });

  test("returns fixed access denial when actor context cannot resolve", async () => {
    await assert.rejects(
      () => service.createMemoryCandidateDraftForActor(validCreateInput(), dependencies()),
      (error) => error instanceof service.MemoryCandidateServiceError && error.code === "ACCESS_DENIED",
    );
  });

  test("rejects unauthorized source refs without creating a candidate", async () => {
    const store = new FakeMemoryCandidateStore();
    store.sourceAllowed = false;

    await assert.rejects(
      () => service.createMemoryCandidateDraftForActor(validCreateInput(), dependencies({ actor: owner, store })),
      (error) => error instanceof service.MemoryCandidateServiceError && error.code === "NOT_AVAILABLE",
    );
    assert.equal(store.candidates.size, 0);
  });

  test("creates owner-private drafts and blocks non-owner submission", async () => {
    const store = new FakeMemoryCandidateStore();
    const draft = await service.createMemoryCandidateDraftForActor(
      validCreateInput(),
      dependencies({ actor: owner, store }),
    );

    assert.equal(draft.status, "DRAFT");
    assert.equal(draft.ownerPersonId, owner.personId);
    assert.equal(draft.submittedBy, null);
    assert.deepEqual(await service.listMemoryCandidatesForActor(
      { schemaVersion: 1 },
      dependencies({ actor: outsider, store }),
    ), []);
    await assert.rejects(
      () => service.submitMemoryCandidateForActor(
        { schemaVersion: 1, candidateId: draft.id },
        dependencies({ actor: outsider, store, currentNow: later }),
      ),
      (error) => error instanceof service.MemoryCandidateServiceError && error.code === "NOT_AVAILABLE",
    );
  });

  test("submits explicitly and lets only the source-authority reviewer confirm", async () => {
    const store = new FakeMemoryCandidateStore();
    const draft = await service.createMemoryCandidateDraftForActor(
      validCreateInput(),
      dependencies({ actor: owner, store }),
    );
    const submitted = await service.submitMemoryCandidateForActor(
      { schemaVersion: 1, candidateId: draft.id, reason: "Route this." },
      dependencies({ actor: owner, store, currentNow: later }),
    );

    assert.equal(submitted.status, "SUBMITTED");
    assert.equal(submitted.submittedBy?.id, owner.personId);
    assert.deepEqual(await service.listMemoryCandidatesForActor(
      { schemaVersion: 1 },
      dependencies({ actor: outsider, store }),
    ), []);
    await assert.rejects(
      () => service.confirmMemoryCandidateForActor(
        {
          schemaVersion: 1,
          candidateId: draft.id,
          validFrom: later.toISOString(),
        },
        dependencies({ actor: outsider, store, currentNow: later }),
      ),
      (error) => error instanceof service.MemoryCandidateServiceError && error.code === "NOT_AVAILABLE",
    );

    const confirmed = await service.confirmMemoryCandidateForActor(
      {
        schemaVersion: 1,
        candidateId: draft.id,
        validFrom: later.toISOString(),
        reason: "Confirmed by source authority.",
      },
      dependencies({ actor: reviewer, store, currentNow: later }),
    );

    assert.equal(confirmed.status, "CONFIRMED");
    assert.equal(confirmed.confirmedBy?.type, "process");
    assert.equal(confirmed.confirmedBy?.id, `goal:${reviewer.personId}`);
    assert.deepEqual(confirmed.auditTrail.map((event) => event.type), ["CREATED", "SUBMITTED", "CONFIRMED"]);
  });

  test("reviewable list includes only route-scoped authority candidates, not owner-visible drafts", async () => {
    const store = new FakeMemoryCandidateStore();
    const draft = await service.createMemoryCandidateDraftForActor(
      validCreateInput(),
      dependencies({ actor: owner, store }),
    );

    assert.deepEqual(await service.listMemoryCandidatesForActor(
      { schemaVersion: 1 },
      dependencies({ actor: owner, store }),
    ), [draft]);
    assert.deepEqual(await service.listReviewableMemoryCandidatesForActor(
      { schemaVersion: 1 },
      dependencies({ actor: owner, store }),
    ), []);

    const submitted = await service.submitMemoryCandidateForActor(
      { schemaVersion: 1, candidateId: draft.id },
      dependencies({ actor: owner, store, currentNow: later }),
    );

    assert.deepEqual(await service.listReviewableMemoryCandidatesForActor(
      { schemaVersion: 1 },
      dependencies({ actor: reviewer, store }),
    ), [submitted]);
    assert.deepEqual(await service.listReviewableMemoryCandidatesForActor(
      { schemaVersion: 1 },
      dependencies({ actor: outsider, store }),
    ), []);
  });

  test("route-scoped decisions cover goal, governance, tactical, and meeting authorities", async () => {
    const store = new FakeMemoryCandidateStore();
    const cases: Array<{
      sourceType: MemoryCandidateSourceRef["type"];
      route: MemoryCandidate["authorityRoute"]["kind"];
      processPrefix: string;
    }> = [
      { sourceType: "goal", route: "GOAL_STRATEGY", processPrefix: "goal:" },
      { sourceType: "circle", route: "GOVERNANCE", processPrefix: "governance:" },
      { sourceType: "project", route: "TACTICAL", processPrefix: "tactical:" },
      { sourceType: "meeting", route: "MEETING_RECORD", processPrefix: "meeting:" },
    ];

    for (const [index, item] of cases.entries()) {
      const draft = await service.createMemoryCandidateDraftForActor(
        validCreateInput(sourceRefOf(item.sourceType, `${item.sourceType}-${index}`)),
        dependencies({ actor: owner, store, nextId: `candidate-route-${index}` }),
      );
      assert.equal(draft.authorityRoute.kind, item.route);
      await service.submitMemoryCandidateForActor(
        { schemaVersion: 1, candidateId: draft.id },
        dependencies({ actor: owner, store, currentNow: later }),
      );
      const confirmed = await service.confirmMemoryCandidateForActor(
        {
          schemaVersion: 1,
          candidateId: draft.id,
          validFrom: later.toISOString(),
        },
        dependencies({ actor: reviewer, store, currentNow: later }),
      );
      assert.equal(confirmed.status, "CONFIRMED");
      assert.equal(confirmed.confirmedBy?.id, `${item.processPrefix}${reviewer.personId}`);
      assert.equal(confirmed.confirmedBy?.type, "process");
    }
  });

  test("denies owner, central admin, outsider, and unowned tension-route review shortcuts", async () => {
    const store = new FakeMemoryCandidateStore();
    const goalDraft = await service.createMemoryCandidateDraftForActor(
      validCreateInput(),
      dependencies({ actor: owner, store, nextId: "candidate-denial-goal" }),
    );
    const submittedGoal = await service.submitMemoryCandidateForActor(
      { schemaVersion: 1, candidateId: goalDraft.id },
      dependencies({ actor: owner, store, currentNow: later }),
    );

    assert.deepEqual(await service.listReviewableMemoryCandidatesForActor(
      { schemaVersion: 1 },
      dependencies({ actor: owner, store }),
    ), []);
    assert.deepEqual(await service.listReviewableMemoryCandidatesForActor(
      { schemaVersion: 1 },
      dependencies({ actor: admin, store }),
    ), []);
    await assert.rejects(
      () => service.confirmMemoryCandidateForActor(
        { schemaVersion: 1, candidateId: goalDraft.id, validFrom: later.toISOString() },
        dependencies({ actor: owner, store, currentNow: later }),
      ),
      (error) => error instanceof service.MemoryCandidateServiceError && error.code === "ACCESS_DENIED",
    );
    await assert.rejects(
      () => service.confirmMemoryCandidateForActor(
        { schemaVersion: 1, candidateId: goalDraft.id, validFrom: later.toISOString() },
        dependencies({ actor: admin, store, currentNow: later }),
      ),
      (error) => error instanceof service.MemoryCandidateServiceError && error.code === "NOT_AVAILABLE",
    );
    await assert.rejects(
      () => service.confirmMemoryCandidateForActor(
        { schemaVersion: 1, candidateId: goalDraft.id, validFrom: later.toISOString() },
        dependencies({ actor: outsider, store, currentNow: later }),
      ),
      (error) => error instanceof service.MemoryCandidateServiceError && error.code === "NOT_AVAILABLE",
    );

    const tensionDraft = await service.createMemoryCandidateDraftForActor(
      validCreateInput(sourceRefOf("unknown", "unowned-source")),
      dependencies({ actor: owner, store, nextId: "candidate-denial-tension" }),
    );
    await service.submitMemoryCandidateForActor(
      { schemaVersion: 1, candidateId: tensionDraft.id },
      dependencies({ actor: owner, store, currentNow: later }),
    );
    assert.equal(tensionDraft.authorityRoute.kind, "TENSION");
    assert.deepEqual(await service.listReviewableMemoryCandidatesForActor(
      { schemaVersion: 1 },
      dependencies({ actor: owner, store }),
    ), []);
    assert.deepEqual(await service.listReviewableMemoryCandidatesForActor(
      { schemaVersion: 1 },
      dependencies({ actor: reviewer, store }),
    ), [submittedGoal]);
    await assert.rejects(
      () => service.confirmMemoryCandidateForActor(
        { schemaVersion: 1, candidateId: tensionDraft.id, validFrom: later.toISOString() },
        dependencies({ actor: owner, store, currentNow: later }),
      ),
      (error) => error instanceof service.MemoryCandidateServiceError && error.code === "ACCESS_DENIED",
    );
  });

  test("rejects and supersedes through the same route-scoped authority", async () => {
    const store = new FakeMemoryCandidateStore();
    const rejectedDraft = await service.createMemoryCandidateDraftForActor(
      validCreateInput(),
      dependencies({ actor: owner, store, nextId: "candidate-reject" }),
    );
    await service.submitMemoryCandidateForActor(
      { schemaVersion: 1, candidateId: rejectedDraft.id },
      dependencies({ actor: owner, store, currentNow: later }),
    );
    const rejected = await service.rejectMemoryCandidateForActor(
      { schemaVersion: 1, candidateId: rejectedDraft.id, reason: "Insufficient evidence." },
      dependencies({ actor: reviewer, store, currentNow: later }),
    );
    assert.equal(rejected.status, "REJECTED");

    const confirmedDraft = await service.createMemoryCandidateDraftForActor(
      validCreateInput(),
      dependencies({ actor: owner, store, nextId: "candidate-supersede" }),
    );
    await service.submitMemoryCandidateForActor(
      { schemaVersion: 1, candidateId: confirmedDraft.id },
      dependencies({ actor: owner, store, currentNow: later }),
    );
    await service.confirmMemoryCandidateForActor(
      { schemaVersion: 1, candidateId: confirmedDraft.id, validFrom: later.toISOString() },
      dependencies({ actor: reviewer, store, currentNow: later }),
    );
    const superseded = await service.supersedeMemoryCandidateForActor(
      {
        schemaVersion: 1,
        candidateId: confirmedDraft.id,
        reason: "Later source replaced it.",
        supersededBy: {
          type: "sourceRecord",
          id: "goal-a",
          label: "Goal A",
          applicationUrl: "/app/goals?goal=goal-a",
        },
      },
      dependencies({ actor: reviewer, store, currentNow: new Date("2026-07-17T12:00:00.000Z") }),
    );

    assert.equal(superseded.status, "SUPERSEDED");
    assert.equal(superseded.supersededBy?.id, "goal-a");
  });

  test("static boundary has no UI, command execution, provider, plugin, deployment, or shared-memory retrieval imports", () => {
    const source = readFileSync("src/lib/organization-brain/memory-candidate-service.ts", "utf8");
    const forbidden = [
      "src/app",
      "components",
      "confirmBrainCommandPreview",
      "CommandRegistry",
      "provider",
      "plugin",
      "deployment",
      "SharedMemory",
      "sharedMemory",
      "memory retrieval",
    ];
    for (const token of forbidden) {
      assert.equal(source.includes(token), false, token);
    }
    assert.equal(source.includes("membershipRole === \"ORG_ADMIN\""), false);
  });
});
