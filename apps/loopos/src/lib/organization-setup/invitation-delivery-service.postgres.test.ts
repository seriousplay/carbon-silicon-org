import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import Module, { createRequire } from "node:module";
import { after, before, describe, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "@/generated/prisma/client";

type ServiceModule = typeof import("./invitation-delivery-service");
type EnvelopeModule = typeof import("./invitation-token-envelope");

const databaseUrl =
  process.env.TEST_DATABASE_URL
  ?? process.env.RTW1_S0_TEST_DATABASE_URL
  ?? process.env.DATABASE_URL;
const require = createRequire(import.meta.url);
const originalInvitationEncryptionSecret = process.env.INVITATION_TOKEN_ENCRYPTION_SECRET;
let tokenEnvelope: EnvelopeModule | undefined;

type Fixture = Readonly<{
  prefix: string;
  organizations: readonly string[];
  users: readonly string[];
  invitationIds: readonly string[];
}>;

if (!databaseUrl) {
  test("V6-M1-C2B invitation delivery service against PostgreSQL", {
    skip: "TEST_DATABASE_URL, RTW1_S0_TEST_DATABASE_URL, or DATABASE_URL is required",
  }, () => {});
} else {
  describe("V6-M1-C2B invitation delivery service against PostgreSQL", { concurrency: 1 }, () => {
    let originalServerOnlyModule: NodeJS.Module | undefined;
    let serverOnlyPath = "";
    let pool: Pool;
    let client: PrismaClient;
    let service: ServiceModule;
    let dependencies: ReturnType<ServiceModule["createPrismaInvitationDeliveryDependencies"]>;
    let fixture: Fixture | undefined;

    before(async () => {
      serverOnlyPath = require.resolve("server-only");
      originalServerOnlyModule = require.cache[serverOnlyPath];
      const serverOnlyShim = new Module(serverOnlyPath);
      serverOnlyShim.filename = serverOnlyPath;
      serverOnlyShim.loaded = true;
      require.cache[serverOnlyPath] = serverOnlyShim;

      service = await import("./invitation-delivery-service");
      tokenEnvelope = await import("./invitation-token-envelope");
      process.env.INVITATION_TOKEN_ENCRYPTION_SECRET = "c2c-postgres-envelope-test-secret";
      pool = new Pool({ connectionString: databaseUrl, max: 8 });
      client = new PrismaClient({ adapter: new PrismaPg(pool, { schema: "public" }) });
      dependencies = service.createPrismaInvitationDeliveryDependencies(client);
    });

    after(async () => {
      if (fixture) await cleanupFixture(pool, fixture);
      if (client) await client.$disconnect();
      if (pool) await pool.end();
      if (originalServerOnlyModule) require.cache[serverOnlyPath] = originalServerOnlyModule;
      else delete require.cache[serverOnlyPath];
      if (originalInvitationEncryptionSecret === undefined) {
        delete process.env.INVITATION_TOKEN_ENCRYPTION_SECRET;
      } else {
        process.env.INVITATION_TOKEN_ENCRYPTION_SECRET = originalInvitationEncryptionSecret;
      }
    });

    test("runs the durable hold, queue, lease, completion, isolation, and cleanup lifecycle", async () => {
      const prefix = `m1-c2b-${randomUUID()}`;
      const organizationA = `${prefix}-org-a`;
      const organizationB = `${prefix}-org-b`;
      const userA = `${prefix}-user-a`;
      const userB = `${prefix}-user-b`;
      const personA = `${prefix}-person-a`;
      const personB = `${prefix}-person-b`;
      const invitationNames = [
        "held",
        "queue",
        "concurrent-queue",
        "concurrent-claim",
        "stale-success",
        "failure",
        "revoked",
        "consumed",
        "expired",
        "success-invalid",
        "tenant-b",
        "create-setup-held",
        "create-setup-immediate",
        "create-active",
        "create-denied",
        "create-circle-denied",
        "create-rollback",
      ] as const;
      const invitationIds = invitationNames.map((name) => `${prefix}-${name}`);
      fixture = {
        prefix,
        organizations: [organizationA, organizationB],
        users: [userA, userB],
        invitationIds,
      };
      await createFixture(pool, {
        prefix,
        organizationA,
        organizationB,
        userA,
        userB,
        personA,
        personB,
        invitationIds,
      });

      const now = new Date();
      const actorA = { organizationId: organizationA, userId: userA, personId: personA };
      const actorB = { organizationId: organizationB, userId: userB, personId: personB };

      await pool.query(`
        UPDATE "organizations"
        SET "lifecycleStatus" = 'ACTIVE',
            "activatedAt" = $2,
            "activatedById" = $3,
            "activatedByOrganizationId" = $1
        WHERE "id" = $1
      `, [organizationB, now, personB]);

      const held = await service.prepareInvitationDelivery({
        actor: actorA,
        invitationId: invitationIds[0]!,
        now,
      }, dependencies);
      assert.deepEqual(held, { ok: true, status: "HELD", invitationId: invitationIds[0] });
      assert.equal(await jobCount(pool, invitationIds[0]!), 0);
      assert.deepEqual(await invitationDeliveryState(pool, invitationIds[0]!), {
        deliveryMode: "HELD",
        released: false,
        completed: false,
      });

      const queued = await service.prepareInvitationDelivery({
        actor: actorA,
        invitationId: invitationIds[1]!,
        requestedMode: "IMMEDIATE",
        now,
      }, dependencies);
      assert.equal(queued.ok && queued.status, "QUEUED");
      assert.equal(await jobCount(pool, invitationIds[1]!), 1);
      assert.deepEqual(await invitationDeliveryState(pool, invitationIds[1]!), {
        deliveryMode: "IMMEDIATE",
        released: true,
        completed: false,
      });

      const replay = await service.prepareInvitationDelivery({
        actor: actorA,
        invitationId: invitationIds[1]!,
        requestedMode: "IMMEDIATE",
        now,
      }, dependencies);
      assert.deepEqual(replay, queued);
      assert.equal(await jobCount(pool, invitationIds[1]!), 1);

      const concurrentQueue = await Promise.all([
        service.prepareInvitationDelivery({
          actor: actorA,
          invitationId: invitationIds[2]!,
          requestedMode: "IMMEDIATE",
          now,
        }, dependencies),
        service.prepareInvitationDelivery({
          actor: actorA,
          invitationId: invitationIds[2]!,
          requestedMode: "IMMEDIATE",
          now,
        }, dependencies),
      ]);
      assert.ok(concurrentQueue.every((item) => item.ok && item.status === "QUEUED"));
      assert.equal(
        concurrentQueue[0]!.ok && concurrentQueue[0]!.status === "QUEUED"
          ? concurrentQueue[0]!.jobId
          : null,
        concurrentQueue[1]!.ok && concurrentQueue[1]!.status === "QUEUED"
          ? concurrentQueue[1]!.jobId
          : null,
      );
      assert.equal(await jobCount(pool, invitationIds[2]!), 1);

      const claimPrepared = await service.prepareInvitationDelivery({
        actor: actorA,
        invitationId: invitationIds[3]!,
        requestedMode: "IMMEDIATE",
        now,
      }, dependencies);
      assert.ok(claimPrepared.ok && claimPrepared.status === "QUEUED");
      if (!claimPrepared.ok || claimPrepared.status !== "QUEUED") return;
      const concurrentClaim = await Promise.all([
        service.claimInvitationDeliveryJob({
          organizationId: organizationA,
          jobId: claimPrepared.jobId,
          leaseToken: "claim-winner-a",
          now,
          leaseDurationMs: 60_000,
        }, dependencies),
        service.claimInvitationDeliveryJob({
          organizationId: organizationA,
          jobId: claimPrepared.jobId,
          leaseToken: "claim-winner-b",
          now,
          leaseDurationMs: 60_000,
        }, dependencies),
      ]);
      assert.equal(concurrentClaim.filter((item) => item.ok).length, 1);
      assert.equal(concurrentClaim.filter((item) => !item.ok && item.code === "JOB_NOT_CLAIMABLE").length, 1);
      assert.equal((await jobState(pool, claimPrepared.jobId)).attemptCount, 1);

      const stalePrepared = await service.prepareInvitationDelivery({
        actor: actorA,
        invitationId: invitationIds[4]!,
        requestedMode: "IMMEDIATE",
        now,
      }, dependencies);
      assert.ok(stalePrepared.ok && stalePrepared.status === "QUEUED");
      if (!stalePrepared.ok || stalePrepared.status !== "QUEUED") return;
      const firstClaim = await service.claimInvitationDeliveryJob({
        organizationId: organizationA,
        jobId: stalePrepared.jobId,
        leaseToken: "stale-lease",
        now,
        leaseDurationMs: 1_000,
      }, dependencies);
      assert.ok(firstClaim.ok);
      assert.deepEqual(await service.completeInvitationDeliverySuccess({
        organizationId: organizationA,
        jobId: stalePrepared.jobId,
        leaseToken: "wrong-lease",
        now: new Date(now.getTime() + 500),
      }, dependencies), { ok: false, code: "LEASE_NOT_OWNED" });

      const setupHeldId = invitationIds[11]!;
      const setupImmediateId = invitationIds[12]!;
      const setupImmediatePlaintext = plaintextTokenForInvitation(setupImmediateId);
      const activeId = invitationIds[13]!;
      const deniedId = invitationIds[14]!;
      const circleDeniedId = invitationIds[15]!;
      const rollbackId = invitationIds[16]!;
      const setupHeld = await service.createInvitationForDelivery(createInput({
        invitationId: setupHeldId,
        actor: actorA,
      }), dependencies);
      assert.deepEqual(setupHeld, { ok: true, status: "HELD", invitationId: setupHeldId });
      assert.equal(await jobCount(pool, setupHeldId), 0);

      const setupImmediate = await service.createInvitationForDelivery(createInput({
        invitationId: setupImmediateId,
        actor: actorA,
        requestedMode: "IMMEDIATE",
        homeCircleId: `${prefix}-circle-a`,
      }), dependencies);
      assert.ok(setupImmediate.ok && setupImmediate.status === "QUEUED");
      assert.equal(await jobCount(pool, setupImmediateId), 1);

      const active = await service.createInvitationForDelivery(createInput({
        invitationId: activeId,
        actor: actorB,
      }), dependencies);
      assert.ok(active.ok && active.status === "QUEUED");
      assert.equal(await jobCount(pool, activeId), 1);

      await pool.query(
        `UPDATE "memberships" SET "role" = 'ORG_MEMBER'
         WHERE "organizationId" = $1 AND "userId" = $2`,
        [organizationA, userA],
      );
      assert.deepEqual(await service.createInvitationForDelivery(createInput({
        invitationId: deniedId,
        actor: actorA,
      }), dependencies), { ok: false, code: "ACCESS_DENIED" });
      assert.equal(await invitationCount(pool, deniedId), 0);
      await pool.query(
        `UPDATE "memberships" SET "role" = 'ORG_ADMIN'
         WHERE "organizationId" = $1 AND "userId" = $2`,
        [organizationA, userA],
      );

      assert.deepEqual(await service.createInvitationForDelivery(createInput({
        invitationId: circleDeniedId,
        actor: actorA,
        homeCircleId: `${prefix}-circle-b`,
      }), dependencies), { ok: false, code: "INVITATION_UNAVAILABLE" });
      assert.equal(await invitationCount(pool, circleDeniedId), 0);

      const rollbackDependencies = {
        ...dependencies,
        transaction<T>(work: (tx: Parameters<Parameters<typeof dependencies.transaction>[0]>[0]) => Promise<T>) {
          return dependencies.transaction((tx) => work({
            ...tx,
            async createPendingJob() {
              throw new Error("forced job failure");
            },
          }));
        },
      };
      assert.deepEqual(await service.createInvitationForDelivery(createInput({
        invitationId: rollbackId,
        actor: actorA,
        requestedMode: "IMMEDIATE",
      }), rollbackDependencies), { ok: false, code: "INTERNAL_ERROR" });
      assert.equal(await invitationCount(pool, rollbackId), 0);

      assert.deepEqual(await service.createInvitationForDelivery(createInput({
        invitationId: setupHeldId,
        actor: actorA,
      }), dependencies), { ok: false, code: "INVITATION_CONFLICT" });

      const persistedSecret = await pool.query<{
        tokenHash: string;
        deliveryTokenCiphertext: string;
        value: string;
      }>(`
        SELECT i."tokenHash", i."deliveryTokenCiphertext",
               to_jsonb(j)::text AS value
        FROM "organization_invitations" i
        JOIN "organization_invitation_delivery_jobs" j ON j."invitationId" = i."id"
        WHERE i."id" = $1
      `, [setupImmediateId]);
      assert.equal(
        persistedSecret.rows[0]?.tokenHash,
        createHash("sha256").update(setupImmediatePlaintext).digest("hex"),
      );
      assert.notEqual(
        persistedSecret.rows[0]?.deliveryTokenCiphertext,
        persistedSecret.rows[0]?.tokenHash,
      );
      for (const serialized of [
        persistedSecret.rows[0]?.deliveryTokenCiphertext ?? "",
        persistedSecret.rows[0]?.value ?? "",
      ]) {
        assert.doesNotMatch(serialized, new RegExp(setupImmediatePlaintext));
      }
      assert.deepEqual(await service.completeInvitationDeliverySuccess({
        organizationId: organizationA,
        jobId: stalePrepared.jobId,
        leaseToken: "stale-lease",
        now: new Date(now.getTime() + 1_000),
      }, dependencies), { ok: false, code: "LEASE_NOT_OWNED" });
      const recoveredAt = new Date(now.getTime() + 1_001);
      const recovered = await service.claimInvitationDeliveryJob({
        organizationId: organizationA,
        jobId: stalePrepared.jobId,
        leaseToken: "recovered-lease",
        now: recoveredAt,
        leaseDurationMs: 60_000,
      }, dependencies);
      assert.equal(recovered.ok && recovered.attemptCount, 2);
      const successAt = new Date(recoveredAt.getTime() + 1);
      assert.deepEqual(await service.completeInvitationDeliverySuccess({
        organizationId: organizationA,
        jobId: stalePrepared.jobId,
        leaseToken: "recovered-lease",
        now: successAt,
      }, dependencies), {
        ok: true,
        status: "SENT",
        jobId: stalePrepared.jobId,
        sentAt: successAt.toISOString(),
      });
      assert.deepEqual(await invitationDeliveryState(pool, invitationIds[4]!), {
        deliveryMode: "IMMEDIATE",
        released: true,
        completed: true,
      });

      const failurePrepared = await service.prepareInvitationDelivery({
        actor: actorA,
        invitationId: invitationIds[5]!,
        requestedMode: "IMMEDIATE",
        now,
      }, dependencies);
      assert.ok(failurePrepared.ok && failurePrepared.status === "QUEUED");
      if (!failurePrepared.ok || failurePrepared.status !== "QUEUED") return;
      await pool.query(
        'UPDATE "organization_invitation_delivery_jobs" SET "maxAttempts" = 2 WHERE "id" = $1',
        [failurePrepared.jobId],
      );
      const failureClaim = await service.claimInvitationDeliveryJob({
        organizationId: organizationA,
        jobId: failurePrepared.jobId,
        leaseToken: "failure-lease-1",
        now,
        leaseDurationMs: 60_000,
      }, dependencies);
      assert.ok(failureClaim.ok);
      const retryAt = new Date(now.getTime() + 2_000);
      assert.equal((await service.completeInvitationDeliveryFailure({
        organizationId: organizationA,
        jobId: failurePrepared.jobId,
        leaseToken: "failure-lease-1",
        now: new Date(now.getTime() + 1),
        retryAt,
        errorCode: "TIMEOUT",
      }, dependencies)).ok, true);
      assert.deepEqual(await service.claimInvitationDeliveryJob({
        organizationId: organizationA,
        jobId: failurePrepared.jobId,
        leaseToken: "too-early",
        now: new Date(retryAt.getTime() - 1),
        leaseDurationMs: 60_000,
      }, dependencies), { ok: false, code: "JOB_NOT_CLAIMABLE" });
      const finalClaim = await service.claimInvitationDeliveryJob({
        organizationId: organizationA,
        jobId: failurePrepared.jobId,
        leaseToken: "failure-lease-2",
        now: retryAt,
        leaseDurationMs: 60_000,
      }, dependencies);
      assert.equal(finalClaim.ok && finalClaim.attemptCount, 2);
      const exhaustedFailure = await service.completeInvitationDeliveryFailure({
        organizationId: organizationA,
        jobId: failurePrepared.jobId,
        leaseToken: "failure-lease-2",
        now: new Date(retryAt.getTime() + 1),
        retryAt: new Date(retryAt.getTime() + 2),
        errorCode: "DELIVERY_PERMANENT",
      }, dependencies);
      assert.equal(exhaustedFailure.ok && exhaustedFailure.attemptsExhausted, true);
      assert.deepEqual(await service.claimInvitationDeliveryJob({
        organizationId: organizationA,
        jobId: failurePrepared.jobId,
        leaseToken: "exhausted",
        now: new Date(retryAt.getTime() + 3),
        leaseDurationMs: 60_000,
      }, dependencies), { ok: false, code: "JOB_NOT_CLAIMABLE" });

      const invalidatedJobs: Array<Readonly<{ invitationId: string; jobId: string }>> = [];
      for (const invitationId of invitationIds.slice(6, 9)) {
        const prepared = await service.prepareInvitationDelivery({
          actor: actorA,
          invitationId,
          requestedMode: "IMMEDIATE",
          now,
        }, dependencies);
        assert.ok(prepared.ok && prepared.status === "QUEUED");
        if (!prepared.ok || prepared.status !== "QUEUED") return;
        invalidatedJobs.push({ invitationId, jobId: prepared.jobId });
      }

      await pool.query(
        'UPDATE "organization_invitations" SET "revokedAt" = $2 WHERE "id" = $1',
        [invitationIds[6], now],
      );
      await pool.query(
        'UPDATE "organization_invitations" SET "consumedAt" = $2 WHERE "id" = $1',
        [invitationIds[7], now],
      );
      await pool.query(
        `UPDATE "organization_invitations"
         SET "expiresAt" = to_timestamp($2 / 1000.0) AT TIME ZONE 'UTC'
         WHERE "id" = $1`,
        [invitationIds[8], now.getTime() - 1],
      );
      for (const invalidated of invalidatedJobs) {
        assert.deepEqual(await service.claimInvitationDeliveryJob({
          organizationId: organizationA,
          jobId: invalidated.jobId,
          leaseToken: `invalidated-${invalidated.invitationId}`,
          now,
          leaseDurationMs: 60_000,
        }, dependencies), { ok: false, code: "INVITATION_UNAVAILABLE" });
        assert.deepEqual(await jobState(pool, invalidated.jobId), {
          status: "CANCELLED",
          attemptCount: 0,
          maxAttempts: 3,
          leaseToken: null,
          leaseExpiresAt: null,
          lastErrorCode: "INVITATION_UNAVAILABLE",
        });
      }

      const invalidSuccessPrepared = await service.prepareInvitationDelivery({
        actor: actorA,
        invitationId: invitationIds[9]!,
        requestedMode: "IMMEDIATE",
        now,
      }, dependencies);
      assert.ok(invalidSuccessPrepared.ok && invalidSuccessPrepared.status === "QUEUED");
      if (!invalidSuccessPrepared.ok || invalidSuccessPrepared.status !== "QUEUED") return;
      assert.equal((await service.claimInvitationDeliveryJob({
        organizationId: organizationA,
        jobId: invalidSuccessPrepared.jobId,
        leaseToken: "invalid-success-lease",
        now,
        leaseDurationMs: 60_000,
      }, dependencies)).ok, true);
      await pool.query(
        'UPDATE "organization_invitations" SET "revokedAt" = $2 WHERE "id" = $1',
        [invitationIds[9], now],
      );
      assert.deepEqual(await service.completeInvitationDeliverySuccess({
        organizationId: organizationA,
        jobId: invalidSuccessPrepared.jobId,
        leaseToken: "invalid-success-lease",
        now: new Date(now.getTime() + 1),
      }, dependencies), { ok: false, code: "INVITATION_UNAVAILABLE" });
      assert.deepEqual(await jobState(pool, invalidSuccessPrepared.jobId), {
        status: "CANCELLED",
        attemptCount: 1,
        maxAttempts: 3,
        leaseToken: null,
        leaseExpiresAt: null,
        lastErrorCode: "INVITATION_UNAVAILABLE",
      });
      assert.deepEqual(await service.claimInvitationDeliveryJob({
        organizationId: organizationA,
        jobId: invalidSuccessPrepared.jobId,
        leaseToken: "cannot-revive",
        now: new Date(now.getTime() + 2),
        leaseDurationMs: 60_000,
      }, dependencies), { ok: false, code: "JOB_NOT_CLAIMABLE" });

      assert.deepEqual(await service.prepareInvitationDelivery({
        actor: actorA,
        invitationId: invitationIds[10]!,
        requestedMode: "IMMEDIATE",
        now,
      }, dependencies), { ok: false, code: "INVITATION_UNAVAILABLE" });
      const tenantBPrepared = await service.prepareInvitationDelivery({
        actor: actorB,
        invitationId: invitationIds[10]!,
        requestedMode: "IMMEDIATE",
        now,
      }, dependencies);
      assert.ok(tenantBPrepared.ok && tenantBPrepared.status === "QUEUED");
      if (!tenantBPrepared.ok || tenantBPrepared.status !== "QUEUED") return;
      assert.deepEqual(await service.claimInvitationDeliveryJob({
        organizationId: organizationA,
        jobId: tenantBPrepared.jobId,
        leaseToken: "wrong-tenant",
        now,
        leaseDurationMs: 60_000,
      }, dependencies), { ok: false, code: "JOB_NOT_CLAIMABLE" });
      assert.equal((await service.claimInvitationDeliveryJob({
        organizationId: organizationB,
        jobId: tenantBPrepared.jobId,
        leaseToken: "tenant-b-lease",
        now,
        leaseDurationMs: 60_000,
      }, dependencies)).ok, true);
      assert.deepEqual(await service.completeInvitationDeliverySuccess({
        organizationId: organizationA,
        jobId: tenantBPrepared.jobId,
        leaseToken: "tenant-b-lease",
        now: new Date(now.getTime() + 1),
      }, dependencies), { ok: false, code: "LEASE_NOT_OWNED" });

      const secretText = `${prefix}-secret-token-hash`;
      const emailText = `${prefix}-secret-recipient@example.invalid`;
      await pool.query(
        'UPDATE "organization_invitations" SET "tokenHash" = $2, "email" = $3 WHERE "id" = $1',
        [invitationIds[1], secretText, emailText],
      );
      const jobJson = await pool.query<{ value: string }>(`
        SELECT to_jsonb(j)::text AS value
        FROM "organization_invitation_delivery_jobs" j
        WHERE j."invitationId" = $1
      `, [invitationIds[1]]);
      for (const value of [JSON.stringify(queued), jobJson.rows[0]?.value ?? ""]) {
        assert.doesNotMatch(value, new RegExp(secretText, "i"));
        assert.doesNotMatch(value, new RegExp(emailText, "i"));
      }

      await cleanupFixture(pool, fixture);
      assert.equal(await fixtureResidue(pool, prefix), 0);
      fixture = undefined;
    });
  });
}

function testCiphertext(index: number): string {
  return `v1.${Buffer.alloc(12, index + 1).toString("base64url")}.${Buffer.from(`cipher-${index}`).toString("base64url")}.${Buffer.alloc(16, index + 21).toString("base64url")}`;
}

function createInput(input: Readonly<{
  invitationId: string;
  actor: Readonly<{ organizationId: string; userId: string; personId: string }>;
  requestedMode?: "HELD" | "IMMEDIATE";
  homeCircleId?: string;
}>) {
  assert.ok(tokenEnvelope);
  const now = new Date();
  const plaintextToken = plaintextTokenForInvitation(input.invitationId);
  return {
    ...input,
    email: `${input.invitationId}@example.invalid`,
    tokenHash: createHash("sha256").update(plaintextToken).digest("hex"),
    tokenCiphertext: tokenEnvelope.encryptInvitationToken(plaintextToken, {
      organizationId: input.actor.organizationId,
      invitationId: input.invitationId,
    }),
    now,
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1_000),
  };
}

function plaintextTokenForInvitation(invitationId: string): string {
  return `c2c-${createHash("sha256").update(invitationId).digest("base64url")}`;
}

async function createFixture(
  pool: Pool,
  input: Readonly<{
    prefix: string;
    organizationA: string;
    organizationB: string;
    userA: string;
    userB: string;
    personA: string;
    personB: string;
    invitationIds: readonly string[];
  }>,
): Promise<void> {
  const circleA = `${input.prefix}-circle-a`;
  const circleB = `${input.prefix}-circle-b`;
  await pool.query(`
    INSERT INTO "organizations" ("id", "name", "slug", "updatedAt")
    VALUES
      ($1, 'M1 C2B A', $2, CURRENT_TIMESTAMP),
      ($3, 'M1 C2B B', $4, CURRENT_TIMESTAMP)
  `, [input.organizationA, `${input.prefix}-a`, input.organizationB, `${input.prefix}-b`]);
  await pool.query(`
    INSERT INTO "users" ("id", "email", "updatedAt")
    VALUES
      ($1, $2, CURRENT_TIMESTAMP),
      ($3, $4, CURRENT_TIMESTAMP)
  `, [
    input.userA,
    `${input.prefix}-a@example.invalid`,
    input.userB,
    `${input.prefix}-b@example.invalid`,
  ]);
  await pool.query(`
    INSERT INTO "memberships" ("id", "userId", "organizationId", "role")
    VALUES
      ($1, $2, $3, 'ORG_ADMIN'),
      ($4, $5, $6, 'ORG_ADMIN')
  `, [
    `${input.prefix}-membership-a`, input.userA, input.organizationA,
    `${input.prefix}-membership-b`, input.userB, input.organizationB,
  ]);
  await pool.query(`
    INSERT INTO "circles"
      ("id", "organizationId", "name", "number", "type", "purpose", "updatedAt")
    VALUES
      ($1, $2, 'Root A', 'CUSTOM', 'STRATEGY', 'Fixture A', CURRENT_TIMESTAMP),
      ($3, $4, 'Root B', 'CUSTOM', 'STRATEGY', 'Fixture B', CURRENT_TIMESTAMP)
  `, [circleA, input.organizationA, circleB, input.organizationB]);
  await pool.query(`
    INSERT INTO "people"
      ("id", "organizationId", "name", "userId", "homeCircleId", "updatedAt")
    VALUES
      ($1, $2, 'Actor A', $3, $4, CURRENT_TIMESTAMP),
      ($5, $6, 'Actor B', $7, $8, CURRENT_TIMESTAMP)
  `, [
    input.personA, input.organizationA, input.userA, circleA,
    input.personB, input.organizationB, input.userB, circleB,
  ]);

  for (const [index, invitationId] of input.invitationIds.entries()) {
    if (invitationId.includes("-create-")) continue;
    const tenantB = invitationId.endsWith("tenant-b");
    await pool.query(`
      INSERT INTO "organization_invitations"
        ("id", "organizationId", "email", "tokenHash", "deliveryTokenCiphertext",
         "createdById", "expiresAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP)
    `, [
      invitationId,
      tenantB ? input.organizationB : input.organizationA,
      `${input.prefix}-${index}@example.invalid`,
      `${input.prefix}-token-${index}`,
      testCiphertext(index),
      tenantB ? input.personB : input.personA,
    ]);
  }
}

async function cleanupFixture(pool: Pool, fixture: Fixture): Promise<void> {
  await pool.query(
    'DELETE FROM "organization_invitation_delivery_jobs" WHERE "id" LIKE $1',
    [`${fixture.prefix}%`],
  );
  await pool.query(
    'DELETE FROM "organization_invitations" WHERE "id" = ANY($1::text[])',
    [fixture.invitationIds],
  );
  await pool.query(
    'DELETE FROM "organizations" WHERE "id" = ANY($1::text[])',
    [fixture.organizations],
  );
  await pool.query('DELETE FROM "people" WHERE "id" LIKE $1', [`${fixture.prefix}%`]);
  await pool.query('DELETE FROM "circles" WHERE "id" LIKE $1', [`${fixture.prefix}%`]);
  await pool.query('DELETE FROM "memberships" WHERE "id" LIKE $1', [`${fixture.prefix}%`]);
  await pool.query('DELETE FROM "users" WHERE "id" = ANY($1::text[])', [fixture.users]);
}

async function fixtureResidue(pool: Pool, prefix: string): Promise<number> {
  const result = await pool.query<{ count: string }>(`
    SELECT (
      (SELECT count(*) FROM "organizations" WHERE "id" LIKE $1) +
      (SELECT count(*) FROM "users" WHERE "id" LIKE $1) +
      (SELECT count(*) FROM "memberships" WHERE "id" LIKE $1) +
      (SELECT count(*) FROM "circles" WHERE "id" LIKE $1) +
      (SELECT count(*) FROM "people" WHERE "id" LIKE $1) +
      (SELECT count(*) FROM "organization_invitations" WHERE "id" LIKE $1) +
      (SELECT count(*) FROM "organization_invitation_delivery_jobs" WHERE "id" LIKE $1)
    )::text AS count
  `, [`${prefix}%`]);
  return Number(result.rows[0]?.count ?? "-1");
}

async function jobCount(pool: Pool, invitationId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(`
    SELECT count(*)::text AS count
    FROM "organization_invitation_delivery_jobs"
    WHERE "invitationId" = $1
  `, [invitationId]);
  return Number(result.rows[0]?.count ?? "-1");
}

async function invitationCount(pool: Pool, invitationId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(`
    SELECT count(*)::text AS count
    FROM "organization_invitations"
    WHERE "id" = $1
  `, [invitationId]);
  return Number(result.rows[0]?.count ?? "-1");
}

async function invitationDeliveryState(
  pool: Pool,
  invitationId: string,
): Promise<Readonly<{ deliveryMode: string; released: boolean; completed: boolean }>> {
  const result = await pool.query<{
    deliveryMode: string;
    released: boolean;
    completed: boolean;
  }>(`
    SELECT
      "deliveryMode"::text AS "deliveryMode",
      "releasedAt" IS NOT NULL AS released,
      "deliveryCompletedAt" IS NOT NULL AS completed
    FROM "organization_invitations"
    WHERE "id" = $1
  `, [invitationId]);
  return result.rows[0]!;
}

async function jobState(
  pool: Pool,
  jobId: string,
): Promise<Readonly<{
  status: string;
  attemptCount: number;
  maxAttempts: number;
  leaseToken: string | null;
  leaseExpiresAt: Date | null;
  lastErrorCode: string | null;
}>> {
  const result = await pool.query<{
    status: string;
    attemptCount: number;
    maxAttempts: number;
    leaseToken: string | null;
    leaseExpiresAt: Date | null;
    lastErrorCode: string | null;
  }>(`
    SELECT "status"::text AS status, "attemptCount", "maxAttempts",
           "leaseToken", "leaseExpiresAt", "lastErrorCode"
    FROM "organization_invitation_delivery_jobs"
    WHERE "id" = $1
  `, [jobId]);
  return result.rows[0]!;
}
