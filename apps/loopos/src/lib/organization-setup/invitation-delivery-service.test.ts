import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { after, before, describe, test } from "node:test";

import type {
  InvitationDeliveryActor,
  InvitationDeliveryCompletionContext,
  InvitationDeliveryDependencies,
  InvitationDeliveryInvitation,
  InvitationDeliveryJob,
  InvitationDeliveryTransaction,
} from "./invitation-delivery-service";

type ServiceModule = typeof import("./invitation-delivery-service");

const require = createRequire(import.meta.url);
let originalServerOnlyModule: NodeJS.Module | undefined;
let serverOnlyPath = "";
let service: ServiceModule;

before(async () => {
  serverOnlyPath = require.resolve("server-only");
  originalServerOnlyModule = require.cache[serverOnlyPath];
  const serverOnlyShim = new Module(serverOnlyPath);
  serverOnlyShim.filename = serverOnlyPath;
  serverOnlyShim.loaded = true;
  require.cache[serverOnlyPath] = serverOnlyShim;
  service = await import("./invitation-delivery-service");
});

after(() => {
  if (originalServerOnlyModule) require.cache[serverOnlyPath] = originalServerOnlyModule;
  else delete require.cache[serverOnlyPath];
});

const NOW = new Date("2026-07-20T10:00:00.000Z");
const ACTOR: InvitationDeliveryActor = {
  organizationId: "organization-1",
  userId: "user-1",
  personId: "person-1",
};

type MutableInvitation = {
  -readonly [Key in keyof InvitationDeliveryInvitation]: InvitationDeliveryInvitation[Key];
};

type MutableJob = {
  -readonly [Key in keyof InvitationDeliveryJob]: InvitationDeliveryJob[Key];
};

type FakeStore = {
  membershipRole: string | null;
  organizationLifecycle: string | null;
  availableHomeCircleIds: Set<string>;
  invitation: MutableInvitation | null;
  createdInvitationInput: Record<string, unknown> | null;
  jobs: Map<string, MutableJob>;
  writes: string[];
  transactionCalls: number;
  transactionErrors: unknown[];
  nextId: number;
};

function invitation(
  overrides: Partial<MutableInvitation> = {},
): MutableInvitation {
  return {
    id: "invitation-1",
    organizationId: ACTOR.organizationId,
    lifecycleStatus: "SETUP",
    deliveryMode: "HELD",
    releasedAt: null,
    deliveryCompletedAt: null,
    revokedAt: null,
    consumedAt: null,
    expiresAt: new Date("2026-07-21T10:00:00.000Z"),
    ...overrides,
  };
}

function claimableInvitation(
  overrides: Partial<MutableInvitation> = {},
): MutableInvitation {
  return invitation({
    deliveryMode: "IMMEDIATE",
    releasedAt: new Date(NOW.getTime() - 1),
    ...overrides,
  });
}

function job(overrides: Partial<MutableJob> = {}): MutableJob {
  return {
    id: "job-1",
    organizationId: ACTOR.organizationId,
    invitationId: "invitation-1",
    status: "PENDING",
    attemptCount: 0,
    maxAttempts: 3,
    availableAt: NOW,
    leaseToken: null,
    leaseExpiresAt: null,
    lastErrorCode: null,
    sentAt: null,
    ...overrides,
  };
}

function store(overrides: Partial<FakeStore> = {}): FakeStore {
  return {
    membershipRole: "ORG_MEMBER",
    organizationLifecycle: "SETUP",
    availableHomeCircleIds: new Set(["home-circle-1"]),
    invitation: invitation(),
    createdInvitationInput: null,
    jobs: new Map(),
    writes: [],
    transactionCalls: 0,
    transactionErrors: [],
    nextId: 1,
    ...overrides,
  };
}

function transaction(fake: FakeStore): InvitationDeliveryTransaction {
  return {
    async getActorMembershipRole(actor) {
      return actor === ACTOR || (
        actor.organizationId === ACTOR.organizationId
        && actor.userId === ACTOR.userId
        && actor.personId === ACTOR.personId
      ) ? fake.membershipRole : null;
    },
    async getInvitationForUpdate(organizationId, invitationId) {
      return fake.invitation?.organizationId === organizationId
        && fake.invitation.id === invitationId
        ? fake.invitation
        : null;
    },
    async getOrganizationLifecycleForUpdate() {
      return fake.organizationLifecycle;
    },
    async homeCircleIsAvailable(organizationId, homeCircleId) {
      return organizationId === ACTOR.organizationId
        && fake.availableHomeCircleIds.has(homeCircleId);
    },
    async createInvitation(input) {
      fake.createdInvitationInput = { ...input };
      fake.invitation = invitation({
        id: input.id,
        organizationId: input.organizationId,
        lifecycleStatus: fake.organizationLifecycle ?? "UNKNOWN",
        deliveryMode: input.deliveryMode,
        releasedAt: input.releasedAt,
        expiresAt: input.expiresAt,
      });
      fake.writes.push("invitation:create");
    },
    async getJobForInvitationForUpdate(organizationId, invitationId) {
      return [...fake.jobs.values()].find(
        (candidate) => candidate.organizationId === organizationId
          && candidate.invitationId === invitationId,
      ) ?? null;
    },
    async queueInvitation(input) {
      assert.ok(fake.invitation);
      fake.invitation.deliveryMode = "IMMEDIATE";
      fake.invitation.releasedAt = input.releasedAt;
      fake.writes.push("invitation:queue");
    },
    async createPendingJob(input) {
      const created = job({
        id: input.id,
        organizationId: input.organizationId,
        invitationId: input.invitationId,
        availableAt: input.availableAt,
        maxAttempts: input.maxAttempts,
      });
      fake.jobs.set(created.id, created);
      fake.writes.push("job:create");
      return created;
    },
    async getJobForUpdate(organizationId, jobId) {
      const found = fake.jobs.get(jobId);
      return found?.organizationId === organizationId ? found : null;
    },
    async claimJob(input) {
      const found = fake.jobs.get(input.jobId);
      assert.ok(found);
      found.status = "PROCESSING";
      found.attemptCount = input.attemptCount;
      found.leaseToken = input.leaseToken;
      found.leaseExpiresAt = input.leaseExpiresAt;
      found.lastErrorCode = null;
      fake.writes.push("job:claim");
    },
    async cancelJob(input) {
      const found = fake.jobs.get(input.jobId);
      assert.ok(found);
      found.status = "CANCELLED";
      found.leaseToken = null;
      found.leaseExpiresAt = null;
      found.lastErrorCode = "INVITATION_UNAVAILABLE";
      found.sentAt = null;
      fake.writes.push("job:cancelled");
    },
    async getCompletionContextForUpdate(organizationId, jobId) {
      const found = fake.jobs.get(jobId);
      if (!found || found.organizationId !== organizationId || !fake.invitation) return null;
      return { job: found, invitation: fake.invitation } satisfies InvitationDeliveryCompletionContext;
    },
    async getProviderPayloadForUpdate(organizationId, jobId, leaseToken, now) {
      const found = fake.jobs.get(jobId);
      if (
        !found
        || found.organizationId !== organizationId
        || !fake.invitation
        || found.status !== "PROCESSING"
        || found.leaseToken !== leaseToken
        || !found.leaseExpiresAt
        || found.leaseExpiresAt.getTime() <= now.getTime()
      ) {
        return null;
      }
      return {
        job: found,
        invitation: {
          ...fake.invitation,
          email: "invited@example.invalid",
          tokenHash: "a".repeat(64),
          deliveryTokenCiphertext: "v1.AQEBAQEBAQEBAQEB.Y2lwaGVy.FRUVERUZFRUVERUVFRUVEQ",
          organizationName: "Example Org",
        },
      };
    },
    async completeSuccess(input) {
      const found = fake.jobs.get(input.jobId);
      assert.ok(found && fake.invitation);
      found.status = "SENT";
      found.leaseToken = null;
      found.leaseExpiresAt = null;
      found.lastErrorCode = null;
      found.sentAt = input.now;
      fake.invitation.deliveryCompletedAt = input.now;
      fake.writes.push("job:sent", "invitation:completed");
    },
    async completeFailure(input) {
      const found = fake.jobs.get(input.jobId);
      assert.ok(found);
      found.status = "FAILED";
      found.availableAt = input.retryAt;
      found.leaseToken = null;
      found.leaseExpiresAt = null;
      found.lastErrorCode = input.errorCode;
      fake.writes.push("job:failed");
    },
  };
}

function dependencies(fake: FakeStore): InvitationDeliveryDependencies {
  return {
    async transaction(work) {
      fake.transactionCalls += 1;
      const error = fake.transactionErrors.shift();
      if (error) throw error;
      return work(transaction(fake));
    },
    newId() {
      const id = `generated-job-${fake.nextId}`;
      fake.nextId += 1;
      return id;
    },
    isRetryableTransactionError(error) {
      return Boolean(
        error
        && typeof error === "object"
        && "code" in error
        && (error.code === "40001" || error.code === "40P01"),
      );
    },
    isInvitationConflictError(error) {
      return Boolean(
        error
        && typeof error === "object"
        && "code" in error
        && (error.code === "23505" || error.code === "P2002"),
      );
    },
  };
}

const TOKEN_CIPHERTEXT = `v1.${Buffer.alloc(12, 1).toString("base64url")}.${Buffer.from("ciphertext").toString("base64url")}.${Buffer.alloc(16, 2).toString("base64url")}`;

function createInput(overrides: Partial<Parameters<ServiceModule["createInvitationForDelivery"]>[0]> = {}) {
  return {
    actor: ACTOR,
    invitationId: "new-invitation-1",
    email: "member@example.invalid",
    tokenHash: "a".repeat(64),
    tokenCiphertext: TOKEN_CIPHERTEXT,
    now: NOW,
    expiresAt: new Date(NOW.getTime() + 24 * 60 * 60 * 1_000),
    ...overrides,
  };
}

describe("V6-M1-C2 invitation delivery service", () => {
  test("atomically creates SETUP hold and ACTIVE or explicit immediate queue without returning secrets", async () => {
    const held = store({ membershipRole: "ORG_ADMIN", invitation: null });
    const heldResult = await service.createInvitationForDelivery(createInput(), dependencies(held));
    assert.deepEqual(heldResult, {
      ok: true,
      status: "HELD",
      invitationId: "new-invitation-1",
    });
    assert.deepEqual(held.writes, ["invitation:create"]);
    assert.equal(held.jobs.size, 0);
    assert.doesNotMatch(JSON.stringify(heldResult), /member@|aaaa|ciphertext/);
    assert.equal(held.createdInvitationInput?.deliveryMode, "HELD");
    assert.equal(held.createdInvitationInput?.homeCircleId, null);

    for (const current of [
      store({ membershipRole: "ORG_ADMIN", organizationLifecycle: "ACTIVE", invitation: null }),
      store({ membershipRole: "ORG_ADMIN", invitation: null }),
    ]) {
      const queued = await service.createInvitationForDelivery(createInput({
        requestedMode: current.organizationLifecycle === "SETUP" ? "IMMEDIATE" : undefined,
      }), dependencies(current));
      assert.deepEqual(queued, {
        ok: true,
        status: "QUEUED",
        invitationId: "new-invitation-1",
        jobId: "generated-job-1",
      });
      assert.deepEqual(current.writes, ["invitation:create", "job:create"]);
      assert.equal(current.jobs.get("generated-job-1")?.maxAttempts, 3);
      assert.equal(current.createdInvitationInput?.deliveryMode, "IMMEDIATE");
    }
  });

  test("creation freshly enforces ORG_ADMIN, lifecycle, home-circle tenant, and fixed conflicts", async () => {
    const cases = [
      { fake: store({ invitation: null }), expected: "ACCESS_DENIED" },
      {
        fake: store({ membershipRole: "ORG_ADMIN", organizationLifecycle: null, invitation: null }),
        expected: "INVITATION_UNAVAILABLE",
      },
      {
        fake: store({ membershipRole: "ORG_ADMIN", invitation: null }),
        input: { homeCircleId: "cross-tenant-circle" },
        expected: "INVITATION_UNAVAILABLE",
      },
    ] as const;
    for (const item of cases) {
      assert.deepEqual(
        await service.createInvitationForDelivery(
          createInput("input" in item ? item.input : {}),
          dependencies(item.fake),
        ),
        { ok: false, code: item.expected },
      );
      assert.deepEqual(item.fake.writes, []);
    }

    const conflict = store({
      membershipRole: "ORG_ADMIN",
      invitation: null,
      transactionErrors: [{ code: "23505" }],
    });
    assert.deepEqual(
      await service.createInvitationForDelivery(createInput(), dependencies(conflict)),
      { ok: false, code: "INVITATION_CONFLICT" },
    );
    assert.deepEqual(conflict.writes, []);
  });

  test("creation rejects malformed secrets and dates before opening a transaction", async () => {
    for (const input of [
      createInput({ tokenHash: "raw-token" }),
      createInput({ tokenCiphertext: "raw-token" }),
      createInput({ email: "UPPER@example.invalid" }),
      createInput({ expiresAt: NOW }),
      createInput({ expiresAt: new Date(NOW.getTime() + 31 * 24 * 60 * 60 * 1_000) }),
    ]) {
      const fake = store({ membershipRole: "ORG_ADMIN", invitation: null });
      assert.deepEqual(
        await service.createInvitationForDelivery(input, dependencies(fake)),
        { ok: false, code: "INVALID_INPUT" },
      );
      assert.equal(fake.transactionCalls, 0);
    }
  });
  test("holds SETUP invitations without a job and freshly reloads current authority", async () => {
    const fake = store();
    assert.deepEqual(
      await service.prepareInvitationDelivery(
        { actor: ACTOR, invitationId: "invitation-1", now: NOW },
        dependencies(fake),
      ),
      { ok: true, status: "HELD", invitationId: "invitation-1" },
    );
    assert.deepEqual(fake.writes, []);
    assert.equal(fake.jobs.size, 0);

    fake.membershipRole = null;
    assert.deepEqual(
      await service.prepareInvitationDelivery(
        { actor: ACTOR, invitationId: "invitation-1", now: NOW },
        dependencies(fake),
      ),
      { ok: false, code: "ACCESS_DENIED" },
    );
    assert.deepEqual(fake.writes, []);
  });

  test("requires current ORG_ADMIN for SETUP immediate and lets ACTIVE members queue", async () => {
    const setupMember = store();
    assert.deepEqual(
      await service.prepareInvitationDelivery(
        {
          actor: ACTOR,
          invitationId: "invitation-1",
          requestedMode: "IMMEDIATE",
          now: NOW,
        },
        dependencies(setupMember),
      ),
      { ok: false, code: "ORG_ADMIN_REQUIRED" },
    );
    assert.deepEqual(setupMember.writes, []);

    setupMember.membershipRole = "ORG_ADMIN";
    const queued = await service.prepareInvitationDelivery(
      {
        actor: ACTOR,
        invitationId: "invitation-1",
        requestedMode: "IMMEDIATE",
        now: NOW,
      },
      dependencies(setupMember),
    );
    assert.deepEqual(queued, {
      ok: true,
      status: "QUEUED",
      invitationId: "invitation-1",
      jobId: "generated-job-1",
    });
    assert.equal(setupMember.jobs.get("generated-job-1")?.maxAttempts, 3);
    assert.deepEqual(setupMember.writes, ["invitation:queue", "job:create"]);

    const activeMember = store({ invitation: invitation({ lifecycleStatus: "ACTIVE" }) });
    assert.equal((await service.prepareInvitationDelivery(
      { actor: ACTOR, invitationId: "invitation-1", now: NOW },
      dependencies(activeMember),
    )).ok, true);
    assert.deepEqual(activeMember.writes, ["invitation:queue", "job:create"]);
  });

  test("repeated queue reuses one job and unavailable or cross-tenant invitations never write", async () => {
    const fake = store({ membershipRole: "ORG_ADMIN" });
    const first = await service.prepareInvitationDelivery(
      { actor: ACTOR, invitationId: "invitation-1", requestedMode: "IMMEDIATE", now: NOW },
      dependencies(fake),
    );
    fake.writes.length = 0;
    const second = await service.prepareInvitationDelivery(
      { actor: ACTOR, invitationId: "invitation-1", requestedMode: "IMMEDIATE", now: NOW },
      dependencies(fake),
    );
    assert.deepEqual(second, first);
    assert.equal(fake.jobs.size, 1);
    assert.deepEqual(fake.writes, []);

    for (const unavailable of [
      invitation({ revokedAt: NOW }),
      invitation({ consumedAt: NOW }),
      invitation({ expiresAt: NOW }),
      null,
      invitation({ organizationId: "another-organization" }),
    ]) {
      const denied = store({ membershipRole: "ORG_ADMIN", invitation: unavailable });
      assert.deepEqual(
        await service.prepareInvitationDelivery(
          { actor: ACTOR, invitationId: "invitation-1", requestedMode: "IMMEDIATE", now: NOW },
          dependencies(denied),
        ),
        { ok: false, code: "INVITATION_UNAVAILABLE" },
      );
      assert.deepEqual(denied.writes, []);
    }
  });

  test("claims eligible pending, failed, and stale jobs once while clearing prior errors", async () => {
    for (const candidate of [
      job(),
      job({ status: "FAILED", attemptCount: 1, lastErrorCode: "TIMEOUT" }),
      job({
        status: "PROCESSING",
        attemptCount: 1,
        leaseToken: "old-lease",
        leaseExpiresAt: new Date(NOW.getTime() - 1),
      }),
    ]) {
      const fake = store({
        invitation: claimableInvitation(),
        jobs: new Map([[candidate.id, candidate]]),
      });
      const claimed = await service.claimInvitationDeliveryJob({
        organizationId: ACTOR.organizationId,
        jobId: candidate.id,
        leaseToken: "new-lease",
        now: NOW,
        leaseDurationMs: 60_000,
      }, dependencies(fake));
      assert.equal(claimed.ok, true);
      assert.equal(candidate.attemptCount, claimed.ok ? claimed.attemptCount : -1);
      assert.equal(candidate.lastErrorCode, null);
      assert.deepEqual(fake.writes, ["job:claim"]);
    }
  });

  test("missing, not-ready, sent, exhausted, and invalid claims return fixed results without writes", async () => {
    const cases = [
      undefined,
      job({ status: "PENDING", availableAt: new Date(NOW.getTime() + 1) }),
      job({ status: "PROCESSING", attemptCount: 1, leaseToken: "live", leaseExpiresAt: new Date(NOW.getTime() + 1) }),
      job({ status: "SENT", attemptCount: 1, sentAt: NOW }),
      job({ status: "FAILED", attemptCount: 3, lastErrorCode: "TIMEOUT" }),
      job({ status: "CANCELLED", lastErrorCode: "INVITATION_UNAVAILABLE" }),
    ];
    for (const candidate of cases) {
      const fake = store({
        invitation: claimableInvitation(),
        jobs: candidate ? new Map([[candidate.id, candidate]]) : new Map(),
      });
      assert.deepEqual(await service.claimInvitationDeliveryJob({
        organizationId: ACTOR.organizationId,
        jobId: "job-1",
        leaseToken: "new-lease",
        now: NOW,
        leaseDurationMs: 60_000,
      }, dependencies(fake)), { ok: false, code: "JOB_NOT_CLAIMABLE" });
      assert.deepEqual(fake.writes, []);
    }

    const invalid = store();
    assert.deepEqual(await service.claimInvitationDeliveryJob({
      organizationId: ACTOR.organizationId,
      jobId: "job-1",
      leaseToken: " invalid ",
      now: NOW,
      leaseDurationMs: 60_000,
    }, dependencies(invalid)), { ok: false, code: "INVALID_INPUT" });
    assert.equal(invalid.transactionCalls, 0);
  });

  test("claim durably cancels every invalid invitation state before leasing", async () => {
    const invalidInvitations = [
      claimableInvitation({ lifecycleStatus: "UNKNOWN" }),
      claimableInvitation({ deliveryMode: "HELD", releasedAt: null }),
      claimableInvitation({ releasedAt: null }),
      claimableInvitation({ releasedAt: new Date(NOW.getTime() + 1) }),
      claimableInvitation({ deliveryCompletedAt: NOW }),
      claimableInvitation({ revokedAt: NOW }),
      claimableInvitation({ consumedAt: NOW }),
      claimableInvitation({ expiresAt: NOW }),
    ];

    for (const currentInvitation of invalidInvitations) {
      const pending = job();
      const fake = store({
        invitation: currentInvitation,
        jobs: new Map([[pending.id, pending]]),
      });
      assert.deepEqual(await service.claimInvitationDeliveryJob({
        organizationId: ACTOR.organizationId,
        jobId: pending.id,
        leaseToken: "new-lease",
        now: NOW,
        leaseDurationMs: 60_000,
      }, dependencies(fake)), { ok: false, code: "INVITATION_UNAVAILABLE" });
      assert.equal(pending.status, "CANCELLED");
      assert.equal(pending.attemptCount, 0);
      assert.equal(pending.leaseToken, null);
      assert.equal(pending.leaseExpiresAt, null);
      assert.equal(pending.lastErrorCode, "INVITATION_UNAVAILABLE");
      assert.deepEqual(fake.writes, ["job:cancelled"]);
    }
  });

  test("success requires the matching live lease and a still-usable invitation", async () => {
    const processing = job({
      status: "PROCESSING",
      attemptCount: 1,
      leaseToken: "live-lease",
      leaseExpiresAt: new Date(NOW.getTime() + 60_000),
    });
    const fake = store({
      invitation: invitation({ deliveryMode: "IMMEDIATE", releasedAt: new Date(NOW.getTime() - 1) }),
      jobs: new Map([[processing.id, processing]]),
    });
    assert.deepEqual(await service.completeInvitationDeliverySuccess({
      organizationId: ACTOR.organizationId,
      jobId: processing.id,
      leaseToken: "wrong-lease",
      now: NOW,
    }, dependencies(fake)), { ok: false, code: "LEASE_NOT_OWNED" });
    assert.deepEqual(fake.writes, []);

    assert.deepEqual(await service.completeInvitationDeliverySuccess({
      organizationId: ACTOR.organizationId,
      jobId: processing.id,
      leaseToken: "live-lease",
      now: NOW,
    }, dependencies(fake)), {
      ok: true,
      status: "SENT",
      jobId: processing.id,
      sentAt: NOW.toISOString(),
    });
    assert.deepEqual(fake.writes, ["job:sent", "invitation:completed"]);
  });

  test("expired leases do not write and invalid-at-success durably cancels", async () => {
    const expiredLease = job({
      status: "PROCESSING",
      attemptCount: 1,
      leaseToken: "lease",
      leaseExpiresAt: NOW,
    });
    const expiredFake = store({
      invitation: claimableInvitation(),
      jobs: new Map([[expiredLease.id, expiredLease]]),
    });
    assert.deepEqual(await service.completeInvitationDeliverySuccess({
      organizationId: ACTOR.organizationId,
      jobId: expiredLease.id,
      leaseToken: "lease",
      now: NOW,
    }, dependencies(expiredFake)), { ok: false, code: "LEASE_NOT_OWNED" });
    assert.deepEqual(expiredFake.writes, []);

    const invalidAtSuccess = job({
      status: "PROCESSING",
      attemptCount: 1,
      leaseToken: "lease",
      leaseExpiresAt: new Date(NOW.getTime() + 1),
    });
    const invalidFake = store({
      invitation: claimableInvitation({ revokedAt: NOW }),
      jobs: new Map([[invalidAtSuccess.id, invalidAtSuccess]]),
    });
    assert.deepEqual(await service.completeInvitationDeliverySuccess({
      organizationId: ACTOR.organizationId,
      jobId: invalidAtSuccess.id,
      leaseToken: "lease",
      now: NOW,
    }, dependencies(invalidFake)), { ok: false, code: "INVITATION_UNAVAILABLE" });
    assert.equal(invalidAtSuccess.status, "CANCELLED");
    assert.equal(invalidAtSuccess.leaseToken, null);
    assert.equal(invalidAtSuccess.lastErrorCode, "INVITATION_UNAVAILABLE");
    assert.deepEqual(invalidFake.writes, ["job:cancelled"]);
    invalidFake.writes.length = 0;
    assert.deepEqual(await service.claimInvitationDeliveryJob({
      organizationId: ACTOR.organizationId,
      jobId: invalidAtSuccess.id,
      leaseToken: "new-lease",
      now: NOW,
      leaseDurationMs: 60_000,
    }, dependencies(invalidFake)), { ok: false, code: "JOB_NOT_CLAIMABLE" });
    assert.deepEqual(invalidFake.writes, []);
  });

  test("failure accepts only redacted codes, preserves attempts, and exhausted work cannot reclaim", async () => {
    const processing = job({
      status: "PROCESSING",
      attemptCount: 2,
      maxAttempts: 2,
      leaseToken: "live-lease",
      leaseExpiresAt: new Date(NOW.getTime() + 60_000),
    });
    const fake = store({
      invitation: claimableInvitation(),
      jobs: new Map([[processing.id, processing]]),
    });
    const retryAt = new Date(NOW.getTime() + 30_000);
    assert.deepEqual(await service.completeInvitationDeliveryFailure({
      organizationId: ACTOR.organizationId,
      jobId: processing.id,
      leaseToken: "wrong-lease",
      now: NOW,
      retryAt,
      errorCode: "TIMEOUT",
    }, dependencies(fake)), { ok: false, code: "LEASE_NOT_OWNED" });
    assert.deepEqual(fake.writes, []);

    processing.leaseExpiresAt = NOW;
    assert.deepEqual(await service.completeInvitationDeliveryFailure({
      organizationId: ACTOR.organizationId,
      jobId: processing.id,
      leaseToken: "live-lease",
      now: NOW,
      retryAt,
      errorCode: "TIMEOUT",
    }, dependencies(fake)), { ok: false, code: "LEASE_NOT_OWNED" });
    assert.deepEqual(fake.writes, []);
    processing.leaseExpiresAt = new Date(NOW.getTime() + 60_000);

    assert.deepEqual(await service.completeInvitationDeliveryFailure({
      organizationId: ACTOR.organizationId,
      jobId: processing.id,
      leaseToken: "live-lease",
      now: NOW,
      retryAt,
      errorCode: "TIMEOUT",
    }, dependencies(fake)), {
      ok: true,
      status: "FAILED",
      jobId: processing.id,
      retryAt: retryAt.toISOString(),
      attemptsExhausted: true,
    });
    assert.equal(processing.attemptCount, 2);
    assert.equal(processing.lastErrorCode, "TIMEOUT");

    fake.writes.length = 0;
    assert.deepEqual(await service.claimInvitationDeliveryJob({
      organizationId: ACTOR.organizationId,
      jobId: processing.id,
      leaseToken: "next-lease",
      now: retryAt,
      leaseDurationMs: 60_000,
    }, dependencies(fake)), { ok: false, code: "JOB_NOT_CLAIMABLE" });
    assert.deepEqual(fake.writes, []);

    const invalid = store({ jobs: new Map([["job-1", job({
      status: "PROCESSING",
      attemptCount: 1,
      leaseToken: "live-lease",
      leaseExpiresAt: new Date(NOW.getTime() + 60_000),
    })]]) });
    assert.deepEqual(await service.completeInvitationDeliveryFailure({
      organizationId: ACTOR.organizationId,
      jobId: "job-1",
      leaseToken: "live-lease",
      now: NOW,
      retryAt,
      errorCode: "raw provider response" as "TIMEOUT",
    }, dependencies(invalid)), { ok: false, code: "INVALID_INPUT" });
    assert.deepEqual(invalid.writes, []);
  });

  test("retries serializable conflicts and maps exhausted or raw failures to INTERNAL_ERROR", async () => {
    const retrying = store({ transactionErrors: [{ code: "40001" }, { code: "40P01" }] });
    assert.equal((await service.prepareInvitationDelivery(
      { actor: ACTOR, invitationId: "invitation-1", now: NOW },
      dependencies(retrying),
    )).ok, true);
    assert.equal(retrying.transactionCalls, 3);

    for (const errors of [
      [{ code: "40001" }, { code: "40001" }, { code: "40001" }],
      [new Error("secret database topology")],
    ]) {
      const broken = store({ transactionErrors: errors });
      assert.deepEqual(await service.prepareInvitationDelivery(
        { actor: ACTOR, invitationId: "invitation-1", now: NOW },
        dependencies(broken),
      ), { ok: false, code: "INTERNAL_ERROR" });
      assert.deepEqual(broken.writes, []);
    }
  });
});
