import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { after, before, describe, test } from "node:test";

import type {
  ActivationOrganizationSnapshot,
  OrganizationActivationActor,
  OrganizationActivationDependencies,
  OrganizationActivationTransaction,
} from "./activation-service";

type ActivationServiceModule = typeof import("./activation-service");

const require = createRequire(import.meta.url);
let originalServerOnlyModule: NodeJS.Module | undefined;
let serverOnlyPath = "";
let activateOrganization: ActivationServiceModule["activateOrganization"];
let canonicalActivationJson: ActivationServiceModule["canonicalActivationJson"];
let OrganizationActivationError: ActivationServiceModule["OrganizationActivationError"];

before(async () => {
  serverOnlyPath = require.resolve("server-only");
  originalServerOnlyModule = require.cache[serverOnlyPath];
  const serverOnlyShim = new Module(serverOnlyPath);
  serverOnlyShim.filename = serverOnlyPath;
  serverOnlyShim.loaded = true;
  require.cache[serverOnlyPath] = serverOnlyShim;
  ({ activateOrganization, canonicalActivationJson, OrganizationActivationError } = await import("./activation-service"));
});

after(() => {
  if (originalServerOnlyModule) require.cache[serverOnlyPath] = originalServerOnlyModule;
  else delete require.cache[serverOnlyPath];
});

const NOW = new Date("2026-07-20T08:00:00.000Z");
const ACTOR: OrganizationActivationActor = {
  organizationId: "organization-1",
  userId: "user-1",
  personId: "person-1",
};

const ERROR_MESSAGES = {
  ORGANIZATION_NOT_FOUND: "Organization not found",
  ACCESS_DENIED: "Organization activation is not allowed",
  READINESS_FAILED: "Organization is not ready to activate",
  ACTIVE_EVIDENCE_INVALID: "Organization activation evidence is invalid",
  INTERNAL_ERROR: "Organization activation failed",
} as const;

type FakeOrganization = {
  id: string;
  lifecycleStatus: "SETUP" | "ACTIVE";
  purpose: string | null;
  setupStartedAt: Date;
  activatedAt: Date | null;
  activatedById: string | null;
  activatedByOrganizationId: string | null;
};

type FakeSnapshot = {
  id: string;
  organizationId: string;
  actorPersonId: string;
  schemaVersion: number;
  readiness: unknown;
  organizationSnapshot: unknown;
  checksum: string;
  activatedAt: Date;
};

type FakeEvent = {
  actorPersonId: string | null;
  payload: unknown;
};

type FakeStore = {
  lockFound: boolean;
  organization: FakeOrganization | null;
  bound: boolean;
  admin: boolean;
  organizationSnapshot: ActivationOrganizationSnapshot;
  snapshots: FakeSnapshot[];
  events: FakeEvent[];
  heldInvitationIds: string[];
  releasedInvitationIds: string[];
  writes: string[];
  transactionCalls: number;
  transactionErrors: unknown[];
};

function organizationSnapshot(): ActivationOrganizationSnapshot {
  return {
    schemaVersion: 1,
    organizationId: ACTOR.organizationId,
    setupStartedAt: "2026-07-01T00:00:00.000Z",
    structureIds: ["root"],
    rootStructureIds: ["root"],
    activeRoleIds: ["lead"],
    keyRoleIds: ["lead"],
    humanAssignedKeyRoleIds: ["lead"],
    goalCycleIds: ["cycle-1"],
    organizationGoalIds: ["goal-1"],
    brainProfileId: "brain-1",
    readinessFacts: {
      organizationPurpose: "持续为客户创造可验证价值",
      structures: [{
        id: "root",
        parentId: null,
        leadPersonId: "person-1",
        hasLead: true,
        tacticalCadence: "weekly",
      }],
      roles: [{
        id: "lead",
        status: "ACTIVE",
        key: true,
        purpose: "维护组织目的",
        accountabilities: "推进组织运行",
        assigneeIds: ["person-1"],
        humanAssigneeIds: ["person-1"],
      }],
      goalCycleIds: ["cycle-1"],
      rootOrganizationGoalIds: ["goal-1"],
      brainModel: {
        profileId: "brain-1",
        provider: "system",
        modelName: null,
        keyConfigured: false,
        available: true,
      },
      heldInvitationCount: 0,
    },
    counts: {
      activeStructures: 1,
      activeRoles: 1,
      keyRoles: 1,
      humanAssignedKeyRoles: 1,
      goalCycles: 1,
      organizationGoals: 1,
      heldInvitations: 0,
    },
  };
}

function createStore(overrides: Partial<FakeStore> = {}): FakeStore {
  return {
    lockFound: true,
    organization: {
      id: ACTOR.organizationId,
      lifecycleStatus: "SETUP",
      purpose: "持续为客户创造可验证价值",
      setupStartedAt: new Date("2026-07-01T00:00:00.000Z"),
      activatedAt: null,
      activatedById: null,
      activatedByOrganizationId: null,
    },
    bound: true,
    admin: true,
    organizationSnapshot: organizationSnapshot(),
    snapshots: [],
    events: [],
    heldInvitationIds: [],
    releasedInvitationIds: [],
    writes: [],
    transactionCalls: 0,
    transactionErrors: [],
    ...overrides,
  };
}

function createTransaction(store: FakeStore): OrganizationActivationTransaction {
  return {
    async lockOrganization() {
      return store.lockFound;
    },
    async getOrganization() {
      return store.organization;
    },
    async actorIsBound() {
      return store.bound;
    },
    async actorIsOrganizationAdmin() {
      return store.admin;
    },
    async loadReadinessState() {
      return {
        organizationSnapshot: store.organizationSnapshot,
      };
    },
    async getActivationSnapshots() {
      return store.snapshots;
    },
    async getActivationEvents() {
      return store.events;
    },
    async createActivationSnapshot(input) {
      store.writes.push("snapshot");
      store.snapshots.push({
        id: input.id,
        organizationId: input.organizationId,
        actorPersonId: input.actorPersonId,
        schemaVersion: 1,
        readiness: input.readiness,
        organizationSnapshot: input.organizationSnapshot,
        checksum: input.checksum,
        activatedAt: input.activatedAt,
      });
    },
    async appendActivationEvent(input) {
      store.writes.push("event");
      store.events.push({ actorPersonId: input.actorPersonId, payload: input.payload });
    },
    async releaseHeldInvitationsForActivation() {
      store.writes.push("release");
      const unreleased = store.heldInvitationIds.filter(
        (id) => !store.releasedInvitationIds.includes(id),
      );
      store.releasedInvitationIds.push(...unreleased);
      return unreleased.length;
    },
    async activateOrganization(input) {
      store.writes.push("organization");
      if (!store.organization) throw new Error("organization disappeared");
      store.organization.lifecycleStatus = "ACTIVE";
      store.organization.activatedAt = input.activatedAt;
      store.organization.activatedById = input.actorPersonId;
      store.organization.activatedByOrganizationId = input.organizationId;
    },
  };
}

function createDependencies(store: FakeStore): OrganizationActivationDependencies {
  return {
    async transaction(work) {
      const callIndex = store.transactionCalls;
      store.transactionCalls += 1;
      const transactionError = store.transactionErrors[callIndex];
      if (transactionError !== undefined) throw transactionError;
      return work(createTransaction(store));
    },
    now: () => new Date(NOW),
    isRetryableTransactionError(error) {
      return Boolean(error && typeof error === "object"
        && "code" in error
        && (error.code === "40001" || error.code === "40P01"));
    },
  };
}

async function assertActivationError(
  action: () => Promise<unknown>,
  code: keyof typeof ERROR_MESSAGES,
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof OrganizationActivationError);
    assert.equal(error.code, code);
    assert.equal(error.message, ERROR_MESSAGES[code]);
    return true;
  });
}

function assertDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}

async function createActivatedStore(): Promise<FakeStore> {
  const store = createStore();
  const result = await activateOrganization(ACTOR, createDependencies(store));
  assert.equal(result.status, "ACTIVATED");
  store.writes.length = 0;
  return store;
}

describe("organization activation service", () => {
  test("rejects empty actor input before opening a transaction", async () => {
    for (const field of ["organizationId", "userId", "personId"] as const) {
      const store = createStore();
      await assertActivationError(
        () => activateOrganization({ ...ACTOR, [field]: "  " }, createDependencies(store)),
        "ACCESS_DENIED",
      );
      assert.equal(store.transactionCalls, 0);
      assert.deepEqual(store.writes, []);
    }
  });

  test("rejects missing organization, unbound actor, and non-admin actor without writes", async () => {
    const cases: ReadonlyArray<readonly [string, Partial<FakeStore>, keyof typeof ERROR_MESSAGES]> = [
      ["missing organization", { lockFound: false, organization: null }, "ORGANIZATION_NOT_FOUND"],
      ["unbound person-user", { bound: false }, "ACCESS_DENIED"],
      ["non-admin membership", { admin: false }, "ACCESS_DENIED"],
    ];

    for (const [name, overrides, code] of cases) {
      const store = createStore(overrides);
      await assertActivationError(
        () => activateOrganization(ACTOR, createDependencies(store)),
        code,
      );
      assert.deepEqual(store.writes, [], name);
      assert.deepEqual(store.snapshots, [], name);
      assert.deepEqual(store.events, [], name);
      assert.equal(store.organization?.lifecycleStatus ?? null, overrides.organization === null ? null : "SETUP");
    }
  });

  test("returns READINESS_FAILED on a hard gate failure with no durable writes", async () => {
    const store = createStore({
      organizationSnapshot: {
        ...organizationSnapshot(),
        readinessFacts: { ...organizationSnapshot().readinessFacts, organizationPurpose: " " },
      },
    });

    await assertActivationError(
      () => activateOrganization(ACTOR, createDependencies(store)),
      "READINESS_FAILED",
    );

    assert.deepEqual(store.writes, []);
    assert.deepEqual(store.snapshots, []);
    assert.deepEqual(store.events, []);
    assert.equal(store.organization?.lifecycleStatus, "SETUP");
  });

  test("activates with warnings in snapshot-event-update order and returns deterministic frozen evidence", async () => {
    const warningSnapshot: ActivationOrganizationSnapshot = {
      ...organizationSnapshot(),
      goalCycleIds: [],
      organizationGoalIds: [],
      brainProfileId: null,
      readinessFacts: {
        ...organizationSnapshot().readinessFacts,
        structures: organizationSnapshot().readinessFacts.structures.map((item) => ({
          ...item,
          tacticalCadence: null,
        })),
        goalCycleIds: [],
        rootOrganizationGoalIds: [],
        brainModel: {
          profileId: null,
          provider: null,
          modelName: null,
          keyConfigured: false,
          available: false,
        },
        heldInvitationCount: 2,
      },
      counts: {
        ...organizationSnapshot().counts,
        goalCycles: 0,
        organizationGoals: 0,
        heldInvitations: 2,
      },
    };
    const firstStore = createStore({ organizationSnapshot: warningSnapshot });
    const secondStore = createStore({ organizationSnapshot: warningSnapshot });

    const first = await activateOrganization(ACTOR, createDependencies(firstStore));
    const second = await activateOrganization(ACTOR, createDependencies(secondStore));

    assert.equal(first.status, "ACTIVATED");
    assert.deepEqual(firstStore.writes, ["snapshot", "event", "release", "organization"]);
    assert.deepEqual(first.warningCodes, [
      "GOAL_CYCLE_MISSING",
      "ORGANIZATION_GOAL_MISSING",
      "MEETING_CADENCE_MISSING",
      "BRAIN_MODEL_UNAVAILABLE",
      "HELD_INVITATIONS_PENDING",
    ]);
    assert.match(first.evidence.checksum, /^[a-f0-9]{64}$/);
    assert.equal(first.evidence.checksum, second.evidence.checksum);
    assertDeepFrozen(first);
  });

  test("releases held invitations exactly once during successful activation", async () => {
    const store = createStore({ heldInvitationIds: ["invite-a", "invite-b"] });

    const activated = await activateOrganization(ACTOR, createDependencies(store));
    assert.equal(activated.status, "ACTIVATED");
    assert.deepEqual(store.writes, ["snapshot", "event", "release", "organization"]);
    assert.deepEqual(store.releasedInvitationIds, ["invite-a", "invite-b"]);

    store.writes.length = 0;
    const replay = await activateOrganization(ACTOR, createDependencies(store));
    assert.equal(replay.status, "ALREADY_ACTIVE");
    assert.deepEqual(store.writes, []);
    assert.deepEqual(store.releasedInvitationIds, ["invite-a", "invite-b"]);
  });

  test("returns ALREADY_ACTIVE from complete evidence without writes", async () => {
    const store = await createActivatedStore();

    const result = await activateOrganization(ACTOR, createDependencies(store));

    assert.equal(result.status, "ALREADY_ACTIVE");
    assert.equal(result.evidence.id, store.snapshots[0]!.id);
    assert.deepEqual(store.writes, []);
    assertDeepFrozen(result);
  });

  test("binds critical readiness facts into checksum and rebuilds readiness on replay", async () => {
    const firstSnapshot = organizationSnapshot();
    const secondSnapshot: ActivationOrganizationSnapshot = {
      ...organizationSnapshot(),
      readinessFacts: {
        ...organizationSnapshot().readinessFacts,
        roles: organizationSnapshot().readinessFacts.roles.map((role) => ({
          ...role,
          accountabilities: "推进组织运行并记录证据",
        })),
      },
    };
    const firstStore = createStore({ organizationSnapshot: firstSnapshot });
    const secondStore = createStore({ organizationSnapshot: secondSnapshot });

    const first = await activateOrganization(ACTOR, createDependencies(firstStore));
    const second = await activateOrganization(ACTOR, createDependencies(secondStore));
    assert.notEqual(first.evidence.checksum, second.evidence.checksum);
    assert.notDeepEqual(first.evidence.organizationSnapshot.readinessFacts,
      second.evidence.organizationSnapshot.readinessFacts);

    firstStore.writes.length = 0;
    secondStore.writes.length = 0;
    assert.equal((await activateOrganization(ACTOR, createDependencies(firstStore))).status, "ALREADY_ACTIVE");
    assert.equal((await activateOrganization(ACTOR, createDependencies(secondStore))).status, "ALREADY_ACTIVE");
    assert.deepEqual(firstStore.writes, []);
    assert.deepEqual(secondStore.writes, []);
  });

  test("uses one UTF-16 order for mixed-case symbol and Unicode IDs on activation and replay", async () => {
    const base = organizationSnapshot();
    const structureIds = ["!root", "A-child", "a-child", "界-child"];
    const roleIds = ["!role", "A-role", "a-role", "界-role"];
    const mixedSnapshot: ActivationOrganizationSnapshot = {
      ...base,
      structureIds,
      rootStructureIds: ["!root"],
      activeRoleIds: roleIds,
      keyRoleIds: ["!role"],
      humanAssignedKeyRoleIds: ["!role"],
      readinessFacts: {
        ...base.readinessFacts,
        structures: structureIds.map((id, index) => ({
          id,
          parentId: index === 0 ? null : "!root",
          leadPersonId: "person-1",
          hasLead: true,
          tacticalCadence: "weekly",
        })),
        roles: roleIds.map((id, index) => ({
          id,
          status: "ACTIVE",
          key: index === 0,
          purpose: "明确目的",
          accountabilities: "承担责任",
          assigneeIds: index === 0 ? ["!person", "A-person", "a-person", "界-person"] : [],
          humanAssigneeIds: index === 0 ? ["!person", "A-person", "a-person", "界-person"] : [],
        })),
      },
      counts: {
        ...base.counts,
        activeStructures: structureIds.length,
        activeRoles: roleIds.length,
        keyRoles: 1,
        humanAssignedKeyRoles: 1,
      },
    };
    const store = createStore({ organizationSnapshot: mixedSnapshot });

    assert.equal((await activateOrganization(ACTOR, createDependencies(store))).status, "ACTIVATED");
    store.writes.length = 0;
    assert.equal((await activateOrganization(ACTOR, createDependencies(store))).status, "ALREADY_ACTIVE");
    assert.deepEqual(store.writes, []);
  });

  test("fails closed when an ACTIVE snapshot, event, or checksum is damaged", async () => {
    const cases: ReadonlyArray<readonly [string, (store: FakeStore) => void]> = [
      ["snapshot", (store) => {
        store.snapshots[0]!.schemaVersion = 2;
      }],
      ["event", (store) => {
        store.events[0]!.payload = { corrupted: true };
      }],
      ["checksum", (store) => {
        store.snapshots[0]!.checksum = "0".repeat(64);
      }],
    ];

    for (const [name, damage] of cases) {
      const store = await createActivatedStore();
      damage(store);
      await assertActivationError(
        () => activateOrganization(ACTOR, createDependencies(store)),
        "ACTIVE_EVIDENCE_INVALID",
      );
      assert.deepEqual(store.writes, [], name);
    }
  });

  test("retries retryable serializable conflicts at most three attempts and succeeds", async () => {
    const store = createStore({
      transactionErrors: [{ code: "40001" }, { code: "40P01" }],
    });

    const result = await activateOrganization(ACTOR, createDependencies(store));

    assert.equal(result.status, "ACTIVATED");
    assert.equal(store.transactionCalls, 3);
    assert.deepEqual(store.writes, ["snapshot", "event", "release", "organization"]);
  });

  test("maps exhausted retryable and raw transaction errors to non-leaking INTERNAL_ERROR", async () => {
    const cases: ReadonlyArray<readonly [string, unknown[], number]> = [
      ["exhausted retry", [{ code: "40001" }, { code: "40001" }, { code: "40001" }], 3],
      ["raw error", [new Error("secret database topology")], 1],
    ];

    for (const [name, transactionErrors, expectedCalls] of cases) {
      const store = createStore({ transactionErrors });
      await assertActivationError(
        () => activateOrganization(ACTOR, createDependencies(store)),
        "INTERNAL_ERROR",
      );
      assert.equal(store.transactionCalls, expectedCalls, name);
      assert.deepEqual(store.writes, [], name);
    }
  });
});

describe("canonicalActivationJson", () => {
  test("is stable across nested object key order while preserving array order", () => {
    const left = canonicalActivationJson({
      z: 1,
      nested: { b: true, a: [{ y: "value", x: null }] },
      a: "first",
    });
    const right = canonicalActivationJson({
      a: "first",
      nested: { a: [{ x: null, y: "value" }], b: true },
      z: 1,
    });

    assert.equal(left, right);
    assert.equal(left, '{"a":"first","nested":{"a":[{"x":null,"y":"value"}],"b":true},"z":1}');
  });
});
