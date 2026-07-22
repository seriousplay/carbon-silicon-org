import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import Module, { createRequire } from "node:module";
import { after, before, describe, test } from "node:test";

import type {
  InvitationDeliveryCompletionContext,
  InvitationDeliveryDependencies,
  InvitationDeliveryInvitation,
  InvitationDeliveryJob,
  InvitationDeliveryProviderPayload,
  InvitationDeliveryTransaction,
} from "./invitation-delivery-service";

type ProcessorModule = typeof import("./invitation-delivery-processor");
type EnvelopeModule = typeof import("./invitation-token-envelope");

const require = createRequire(import.meta.url);
const NOW = new Date("2026-07-20T11:00:00.000Z");
const originalSecret = process.env.INVITATION_TOKEN_ENCRYPTION_SECRET;
const originalBasePath = process.env.NEXT_PUBLIC_BASE_PATH;

let originalServerOnlyModule: NodeJS.Module | undefined;
let serverOnlyPath = "";
let processor: ProcessorModule;
let envelope: EnvelopeModule;

before(async () => {
  serverOnlyPath = require.resolve("server-only");
  originalServerOnlyModule = require.cache[serverOnlyPath];
  const serverOnlyShim = new Module(serverOnlyPath);
  serverOnlyShim.filename = serverOnlyPath;
  serverOnlyShim.loaded = true;
  require.cache[serverOnlyPath] = serverOnlyShim;
  process.env.INVITATION_TOKEN_ENCRYPTION_SECRET = "processor-focused-test-secret-value";
  process.env.NEXT_PUBLIC_BASE_PATH = "/loopos";
  envelope = await import("./invitation-token-envelope");
  processor = await import("./invitation-delivery-processor");
});

after(() => {
  if (originalServerOnlyModule) require.cache[serverOnlyPath] = originalServerOnlyModule;
  else delete require.cache[serverOnlyPath];
  if (originalSecret === undefined) delete process.env.INVITATION_TOKEN_ENCRYPTION_SECRET;
  else process.env.INVITATION_TOKEN_ENCRYPTION_SECRET = originalSecret;
  if (originalBasePath === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
  else process.env.NEXT_PUBLIC_BASE_PATH = originalBasePath;
});

type MutableInvitation = {
  -readonly [Key in keyof InvitationDeliveryInvitation]: InvitationDeliveryInvitation[Key];
} & {
  email: string;
  tokenHash: string;
  deliveryTokenCiphertext: string;
  organizationName: string;
};

type MutableJob = {
  -readonly [Key in keyof InvitationDeliveryJob]: InvitationDeliveryJob[Key];
};

type FakeStore = {
  invitation: MutableInvitation;
  job: MutableJob;
  writes: string[];
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function store(overrides: Partial<FakeStore> = {}): FakeStore {
  const organizationId = "org-processor";
  const invitationId = "invitation-processor";
  const token = "processor-token";
  return {
    invitation: {
      id: invitationId,
      organizationId,
      lifecycleStatus: "ACTIVE",
      deliveryMode: "IMMEDIATE",
      releasedAt: new Date(NOW.getTime() - 10_000),
      deliveryCompletedAt: null,
      revokedAt: null,
      consumedAt: null,
      expiresAt: new Date(NOW.getTime() + 60_000),
      email: "invited@example.invalid",
      tokenHash: hashToken(token),
      deliveryTokenCiphertext: envelope.encryptInvitationToken(token, {
        organizationId,
        invitationId,
      }),
      organizationName: "Processor Org",
    },
    job: {
      id: "job-processor",
      organizationId,
      invitationId,
      status: "PENDING",
      attemptCount: 0,
      maxAttempts: 3,
      availableAt: NOW,
      leaseToken: null,
      leaseExpiresAt: null,
      lastErrorCode: null,
      sentAt: null,
    },
    writes: [],
    ...overrides,
  };
}

function dependencies(fake: FakeStore): InvitationDeliveryDependencies {
  function tx(): InvitationDeliveryTransaction {
    return {
      async getActorMembershipRole() {
        return null;
      },
      async getInvitationForUpdate() {
        return null;
      },
      async getOrganizationLifecycleForUpdate() {
        return null;
      },
      async homeCircleIsAvailable() {
        return false;
      },
      async createInvitation() {},
      async getJobForInvitationForUpdate() {
        return null;
      },
      async queueInvitation() {},
      async createPendingJob() {
        throw new Error("not used");
      },
      async getJobForUpdate(organizationId, jobId) {
        return fake.job.organizationId === organizationId && fake.job.id === jobId
          ? fake.job
          : null;
      },
      async claimJob(input) {
        fake.job.status = "PROCESSING";
        fake.job.attemptCount = input.attemptCount;
        fake.job.leaseToken = input.leaseToken;
        fake.job.leaseExpiresAt = input.leaseExpiresAt;
        fake.writes.push("claim");
      },
      async cancelJob(input) {
        if (fake.job.id !== input.jobId) return;
        fake.job.status = "CANCELLED";
        fake.job.leaseToken = null;
        fake.job.leaseExpiresAt = null;
        fake.job.lastErrorCode = "INVITATION_UNAVAILABLE";
        fake.writes.push("cancel");
      },
      async getCompletionContextForUpdate(organizationId, jobId) {
        if (fake.job.organizationId !== organizationId || fake.job.id !== jobId) return null;
        return { job: fake.job, invitation: fake.invitation } satisfies InvitationDeliveryCompletionContext;
      },
      async getProviderPayloadForUpdate(organizationId, jobId, leaseToken, now) {
        if (
          fake.job.organizationId !== organizationId
          || fake.job.id !== jobId
          || fake.job.status !== "PROCESSING"
          || fake.job.leaseToken !== leaseToken
          || !fake.job.leaseExpiresAt
          || fake.job.leaseExpiresAt.getTime() <= now.getTime()
        ) {
          return null;
        }
        return {
          job: fake.job,
          invitation: fake.invitation,
        } satisfies InvitationDeliveryProviderPayload;
      },
      async completeSuccess(input) {
        fake.job.status = "SENT";
        fake.job.leaseToken = null;
        fake.job.leaseExpiresAt = null;
        fake.job.lastErrorCode = null;
        fake.job.sentAt = input.now;
        fake.invitation.deliveryCompletedAt = input.now;
        fake.writes.push("sent");
      },
      async completeFailure(input) {
        fake.job.status = "FAILED";
        fake.job.availableAt = input.retryAt;
        fake.job.leaseToken = null;
        fake.job.leaseExpiresAt = null;
        fake.job.lastErrorCode = input.errorCode;
        fake.writes.push(`failed:${input.errorCode}`);
      },
    };
  }
  return {
    async transaction(work) {
      return work(tx());
    },
    newId() {
      return "unused";
    },
    isRetryableTransactionError() {
      return false;
    },
    isInvitationConflictError() {
      return false;
    },
  };
}

describe("V6-M1-C2D invitation delivery processor", () => {
  test("claims a job, decrypts the token, sends the invite, and marks it sent", async () => {
    const fake = store();
    const sent: Array<Record<string, string>> = [];
    const result = await processor.processInvitationDeliveryJob({
      organizationId: fake.job.organizationId,
      jobId: fake.job.id,
      now: NOW,
      leaseDurationMs: 60_000,
    }, {
      deliveryDependencies: dependencies(fake),
      newLeaseToken: () => "lease-processor",
      emailProvider: {
        async sendInvitationEmail(params) {
          sent.push({ ...params });
          return true;
        },
      },
    });

    assert.deepEqual(result, { ok: true, status: "SENT", jobId: fake.job.id });
    assert.deepEqual(fake.writes, ["claim", "sent"]);
    assert.deepEqual(sent, [{
      to: "invited@example.invalid",
      organizationName: "Processor Org",
      invitationUrl: "/loopos/invite/processor-token",
    }]);
    assert.equal(fake.invitation.deliveryCompletedAt?.toISOString(), new Date(NOW.getTime() + 1).toISOString());
  });

  test("records a retryable provider failure without leaking payload into the job", async () => {
    const fake = store();
    const result = await processor.processInvitationDeliveryJob({
      organizationId: fake.job.organizationId,
      jobId: fake.job.id,
      now: NOW,
      leaseDurationMs: 60_000,
      retryDelayMs: 30_000,
    }, {
      deliveryDependencies: dependencies(fake),
      newLeaseToken: () => "lease-provider-fails",
      emailProvider: {
        async sendInvitationEmail() {
          return false;
        },
      },
    });

    assert.equal(result.ok && result.status, "FAILED");
    assert.deepEqual(fake.writes, ["claim", "failed:PROVIDER_UNAVAILABLE"]);
    assert.equal(fake.job.status, "FAILED");
    assert.equal(fake.job.lastErrorCode, "PROVIDER_UNAVAILABLE");
    assert.doesNotMatch(JSON.stringify(fake.job), /processor-token|invited@example\.invalid|Processor Org/);
  });

  test("hash mismatch is a permanent failure and never calls the provider", async () => {
    const fake = store({
      invitation: {
        ...store().invitation,
        tokenHash: "b".repeat(64),
      },
    });
    let providerCalls = 0;
    const result = await processor.processInvitationDeliveryJob({
      organizationId: fake.job.organizationId,
      jobId: fake.job.id,
      now: NOW,
      leaseDurationMs: 60_000,
    }, {
      deliveryDependencies: dependencies(fake),
      newLeaseToken: () => "lease-hash-mismatch",
      emailProvider: {
        async sendInvitationEmail() {
          providerCalls += 1;
          return true;
        },
      },
    });

    assert.equal(result.ok && result.status, "FAILED");
    assert.equal(providerCalls, 0);
    assert.equal(fake.job.lastErrorCode, "DELIVERY_PERMANENT");
  });

  test("wrong tenant cannot claim or read provider payload", async () => {
    const fake = store();
    const result = await processor.processInvitationDeliveryJob({
      organizationId: "other-org",
      jobId: fake.job.id,
      now: NOW,
      leaseDurationMs: 60_000,
    }, {
      deliveryDependencies: dependencies(fake),
      newLeaseToken: () => "lease-wrong-tenant",
      emailProvider: {
        async sendInvitationEmail() {
          throw new Error("provider must not run");
        },
      },
    });

    assert.deepEqual(result, { ok: false, code: "JOB_NOT_CLAIMABLE" });
    assert.deepEqual(fake.writes, []);
  });
});
