import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, test } from "node:test";

import {
  confirmMemoryCandidate,
  createDraftMemoryCandidate,
  rejectMemoryCandidate,
  submitMemoryCandidate,
  supersedeMemoryCandidate,
} from "./memory-candidate-lifecycle";
import type {
  SharedMemoryRetrievalAuditStore,
  SharedMemoryRetrievalDependencies,
  SharedMemoryRetrievalStore,
} from "./shared-memory-service";
import type { ActorContext } from "../authorization/actor-context-resolver";
import type {
  MemoryCandidate,
  MemoryCandidateActor,
  MemoryCandidateSourceRef,
} from "./memory-candidate-types";

type ServiceModule = typeof import("./shared-memory-service");

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
  service = await import("./shared-memory-service");
});

after(() => {
  if (originalServerOnlyModule) require.cache[serverOnlyPath] = originalServerOnlyModule;
  else delete require.cache[serverOnlyPath];
  if (originalNodePath === undefined) delete process.env.NODE_PATH;
  else process.env.NODE_PATH = originalNodePath;
  moduleWithInitPaths._initPaths();
});

const now = new Date("2026-07-16T00:00:00.000Z");
const createdAt = new Date("2026-07-15T10:00:00.000Z");
const owner: MemoryCandidateActor = Object.freeze({
  type: "person",
  id: "person-owner",
  label: "Owner",
});
const reviewer: MemoryCandidateActor = Object.freeze({
  type: "process",
  id: "goal:person-reviewer",
  label: "Goal source authority",
});
const actor: ActorContext = Object.freeze({
  organizationId: "org-a",
  userId: "user-a",
  personId: "person-reader",
  membershipRole: "ORG_MEMBER",
  homeCircleId: "circle-a",
  assignedActiveRoleDefIds: Object.freeze(["role-a"]),
  ledActiveCircleIds: Object.freeze(["circle-a"]),
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
  label: "Activation target evidence",
  applicationUrl: "/app/goals?target=target-a",
  observedAt: createdAt.toISOString(),
});

class FakeSharedMemoryStore implements SharedMemoryRetrievalStore {
  candidates: MemoryCandidate[] = [];
  authorizedKeys = new Set<string>();
  listInputs: Parameters<SharedMemoryRetrievalStore["listConfirmedCandidates"]>[1][] = [];
  failList = false;
  failAuthorization = false;

  async listConfirmedCandidates(
    _actor: ActorContext,
    input: Parameters<SharedMemoryRetrievalStore["listConfirmedCandidates"]>[1],
  ) {
    if (this.failList) throw new Error("store failed");
    this.listInputs.push(input);
    return Object.freeze(this.candidates.filter((candidate) => (
      input.authorityRouteKind === null || candidate.authorityRoute.kind === input.authorityRouteKind
    )).slice(0, input.limit));
  }

  async authorizedSourceRefs(_actor: ActorContext, sourceRefs: readonly MemoryCandidateSourceRef[]) {
    if (this.failAuthorization) throw new Error("authorization failed");
    return Object.freeze(sourceRefs.filter((sourceRef) => this.authorizedKeys.has(sourceKey(sourceRef))));
  }
}

class FakeAuditStore implements SharedMemoryRetrievalAuditStore {
  records: Parameters<SharedMemoryRetrievalAuditStore["record"]>[1][] = [];
  fail = false;

  async record(_actor: ActorContext, input: Parameters<SharedMemoryRetrievalAuditStore["record"]>[1]) {
    if (this.fail) throw new Error("audit failed");
    this.records.push(input);
  }
}

function sourceKey(sourceRef: MemoryCandidateSourceRef): string {
  return `${sourceRef.type}:${sourceRef.id}:${sourceRef.applicationUrl}`;
}

function candidate(input: Readonly<{
  id: string;
  sourceRefs?: readonly MemoryCandidateSourceRef[];
  claim?: string;
  confirmer?: MemoryCandidateActor;
  validFrom?: string;
  validUntil?: string | null;
  status?: "DRAFT" | "SUBMITTED" | "CONFIRMED" | "REJECTED" | "SUPERSEDED";
}>): MemoryCandidate {
  const draft = createDraftMemoryCandidate({
    id: input.id,
    organizationId: "org-a",
    ownerPersonId: owner.id,
    actor: owner,
    claim: input.claim ?? "Activation Goal evidence is stale.",
    rationale: "The target has no recent check-in evidence.",
    sourceRefs: input.sourceRefs ?? [goalSource, targetSource],
    now: createdAt,
  });
  if (input.status === "DRAFT") return draft;
  const submitted = submitMemoryCandidate(draft, { actor: owner, now: createdAt });
  if (input.status === "SUBMITTED") return submitted;
  if (input.status === "REJECTED") {
    return rejectMemoryCandidate(submitted, {
      actor: reviewer,
      now: createdAt,
      reason: "Rejected.",
    });
  }
  const confirmed = confirmMemoryCandidate(submitted, {
    actor: input.confirmer ?? reviewer,
    now: createdAt,
    validFrom: input.validFrom ?? "2026-07-15T10:00:00.000Z",
    validUntil: input.validUntil,
  });
  if (input.status === "SUPERSEDED") {
    return supersedeMemoryCandidate(confirmed, {
      actor: reviewer,
      now: createdAt,
      reason: "Superseded.",
      supersededBy: {
        type: "sourceRecord",
        id: "decision-a",
        label: "Later decision",
        applicationUrl: "/app/meetings/meeting-a",
      },
    });
  }
  return confirmed;
}

function dependencies(input: Readonly<{
  store?: FakeSharedMemoryStore;
  audit?: FakeAuditStore;
  resolveActor?: () => Promise<ActorContext>;
}> = {}): Readonly<{
  dependencies: SharedMemoryRetrievalDependencies;
  store: FakeSharedMemoryStore;
  audit: FakeAuditStore;
}> {
  const store = input.store ?? new FakeSharedMemoryStore();
  const audit = input.audit ?? new FakeAuditStore();
  return {
    store,
    audit,
    dependencies: {
      resolveActor: input.resolveActor ?? (async () => actor),
      store,
      audit,
      now: () => now,
    },
  };
}

describe("V5-M4-C2 shared memory retrieval service", () => {
  test("rejects invalid input before actor, store, or audit calls", async () => {
    let actorCalls = 0;
    const { dependencies: deps, store, audit } = dependencies({
      resolveActor: async () => {
        actorCalls += 1;
        return actor;
      },
    });

    await assert.rejects(
      () => service.retrieveSharedMemoryForActor({ schemaVersion: 2 as 1 }, deps),
      (error) => error instanceof service.SharedMemoryRetrievalError && error.code === "INVALID_INPUT",
    );
    assert.equal(actorCalls, 0);
    assert.equal(store.candidates.length, 0);
    assert.equal(audit.records.length, 0);
  });

  test("maps missing actor context to fixed access denial without audit oracle", async () => {
    const { dependencies: deps, audit } = dependencies({
      resolveActor: async () => {
        throw new Error("no session");
      },
    });

    await assert.rejects(
      () => service.retrieveSharedMemoryForActor({ schemaVersion: 1 }, deps),
      (error) => error instanceof service.SharedMemoryRetrievalError && error.code === "ACCESS_DENIED",
    );
    assert.equal(audit.records.length, 0);
  });

  test("returns only active confirmed authorized entries and filters source refs", async () => {
    const { dependencies: deps, store, audit } = dependencies();
    store.candidates = [
      candidate({ id: "candidate-a" }),
      candidate({ id: "candidate-draft", status: "DRAFT" }),
      candidate({ id: "candidate-rejected", status: "REJECTED" }),
      candidate({ id: "candidate-expired", validUntil: "2026-07-15T23:59:59.000Z" }),
      candidate({ id: "candidate-future", validFrom: "2026-07-17T00:00:00.000Z" }),
      candidate({ id: "candidate-superseded", status: "SUPERSEDED" }),
    ];
    store.authorizedKeys.add(sourceKey(targetSource));

    const entries = await service.retrieveSharedMemoryForActor({
      schemaVersion: 1,
      text: "activation evidence",
      limit: 10,
    }, deps);

    assert.deepEqual(entries.map((entry) => entry.candidateId), ["candidate-a"]);
    assert.deepEqual(entries[0]?.sourceRefs.map((sourceRef) => sourceRef.id), ["target-a"]);
    assert.equal(audit.records.length, 1);
    assert.equal(audit.records[0]?.status, "SUCCEEDED");
    assert.equal(audit.records[0]?.resultCount, 1);
  });

  test("returns empty success without existence hint for unauthorized memory", async () => {
    const { dependencies: deps, store, audit } = dependencies();
    store.candidates = [candidate({ id: "candidate-a" })];

    const entries = await service.retrieveSharedMemoryForActor({ schemaVersion: 1 }, deps);

    assert.deepEqual(entries, []);
    assert.equal(audit.records.length, 1);
    assert.equal(audit.records[0]?.status, "SUCCEEDED");
    assert.equal(audit.records[0]?.resultCount, 0);
  });

  test("applies route filtering, text filtering, and bounded limit deterministically", async () => {
    const roleSource: MemoryCandidateSourceRef = Object.freeze({
      type: "role",
      id: "role-a",
      label: "Activation role",
      applicationUrl: "/app/roles/role-a",
      observedAt: createdAt.toISOString(),
    });
    const { dependencies: deps, store } = dependencies();
    store.candidates = [
      candidate({ id: "candidate-a", sourceRefs: [goalSource, targetSource], claim: "Activation evidence is stale." }),
      candidate({
        id: "candidate-b",
        sourceRefs: [roleSource],
        claim: "Activation role is overloaded.",
        confirmer: {
          type: "process",
          id: "governance:person-reviewer",
          label: "Governance source authority",
        },
      }),
    ];
    for (const sourceRef of [goalSource, targetSource, roleSource]) store.authorizedKeys.add(sourceKey(sourceRef));

    const entries = await service.retrieveSharedMemoryForActor({
      schemaVersion: 1,
      text: "activation",
      authorityRouteKind: "GOVERNANCE",
      limit: 1,
    }, deps);

    assert.deepEqual(entries.map((entry) => entry.candidateId), ["candidate-b"]);
    assert.deepEqual(store.listInputs, [{ authorityRouteKind: "GOVERNANCE", limit: 5 }]);
  });

  test("fails closed when candidate loading, source authorization, derivation, or audit fails", async () => {
    const loading = dependencies();
    loading.store.failList = true;
    await assert.rejects(
      () => service.retrieveSharedMemoryForActor({ schemaVersion: 1 }, loading.dependencies),
      (error) => error instanceof service.SharedMemoryRetrievalError && error.code === "RETRIEVAL_FAILED",
    );
    assert.equal(loading.audit.records[0]?.status, "FAILED");

    const authorization = dependencies();
    authorization.store.candidates = [candidate({ id: "candidate-a" })];
    authorization.store.failAuthorization = true;
    await assert.rejects(
      () => service.retrieveSharedMemoryForActor({ schemaVersion: 1 }, authorization.dependencies),
      (error) => error instanceof service.SharedMemoryRetrievalError && error.code === "RETRIEVAL_FAILED",
    );
    assert.equal(authorization.audit.records[0]?.status, "FAILED");

    const derivation = dependencies();
    derivation.store.candidates = [{ ...candidate({ id: "candidate-a" }), sourceRefs: [null] } as unknown as MemoryCandidate];
    await assert.rejects(
      () => service.retrieveSharedMemoryForActor({ schemaVersion: 1 }, derivation.dependencies),
      (error) => error instanceof service.SharedMemoryRetrievalError && error.code === "RETRIEVAL_FAILED",
    );
    assert.equal(derivation.audit.records[0]?.status, "FAILED");

    const auditFailure = dependencies();
    auditFailure.store.candidates = [candidate({ id: "candidate-a" })];
    auditFailure.store.authorizedKeys.add(sourceKey(goalSource));
    auditFailure.audit.fail = true;
    await assert.rejects(
      () => service.retrieveSharedMemoryForActor({ schemaVersion: 1 }, auditFailure.dependencies),
      (error) => error instanceof service.SharedMemoryRetrievalError && error.code === "AUDIT_FAILED",
    );
  });

  test("static boundary is server-only and has no UI, provider, plugin, deployment, command, or direct mutation imports", () => {
    const source = readFileSync("src/lib/organization-brain/shared-memory-service.ts", "utf8");
    assert.match(source, /import "server-only"/);
    for (const forbidden of [
      "@/app/",
      "brain-client",
      "provider",
      "plugin",
      "deployment",
      "child_process",
      "confirmBrainCommandPreview",
      "confirmMemoryCandidateForActor",
      "rejectMemoryCandidateForActor",
      "supersedeMemoryCandidateForActor",
    ]) {
      assert.equal(source.includes(forbidden), false, forbidden);
    }
  });
});
