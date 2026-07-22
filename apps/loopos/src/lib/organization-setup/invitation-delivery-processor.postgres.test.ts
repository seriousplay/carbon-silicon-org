import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import Module, { createRequire } from "node:module";
import { after, before, describe, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "@/generated/prisma/client";

type ServiceModule = typeof import("./invitation-delivery-service");
type ProcessorModule = typeof import("./invitation-delivery-processor");
type EnvelopeModule = typeof import("./invitation-token-envelope");

const databaseUrl =
  process.env.TEST_DATABASE_URL
  ?? process.env.RTW1_S0_TEST_DATABASE_URL
  ?? process.env.DATABASE_URL;
const require = createRequire(import.meta.url);
const originalInvitationEncryptionSecret = process.env.INVITATION_TOKEN_ENCRYPTION_SECRET;
const originalBasePath = process.env.NEXT_PUBLIC_BASE_PATH;

type Fixture = Readonly<{
  prefix: string;
  organizationId: string;
  userId: string;
  personId: string;
  invitationIds: readonly string[];
}>;

if (!databaseUrl) {
  test("V6-M1-C2D invitation delivery processor against PostgreSQL", {
    skip: "TEST_DATABASE_URL, RTW1_S0_TEST_DATABASE_URL, or DATABASE_URL is required",
  }, () => {});
} else {
  describe("V6-M1-C2D invitation delivery processor against PostgreSQL", { concurrency: 1 }, () => {
    let originalServerOnlyModule: NodeJS.Module | undefined;
    let serverOnlyPath = "";
    let pool: Pool;
    let client: PrismaClient;
    let service: ServiceModule;
    let processor: ProcessorModule;
    let envelope: EnvelopeModule;
    let dependencies: ReturnType<ServiceModule["createPrismaInvitationDeliveryDependencies"]>;
    let fixture: Fixture | undefined;

    before(async () => {
      serverOnlyPath = require.resolve("server-only");
      originalServerOnlyModule = require.cache[serverOnlyPath];
      const serverOnlyShim = new Module(serverOnlyPath);
      serverOnlyShim.filename = serverOnlyPath;
      serverOnlyShim.loaded = true;
      require.cache[serverOnlyPath] = serverOnlyShim;

      process.env.INVITATION_TOKEN_ENCRYPTION_SECRET = "c2d-postgres-envelope-test-secret";
      process.env.NEXT_PUBLIC_BASE_PATH = "/loopos";
      service = await import("./invitation-delivery-service");
      processor = await import("./invitation-delivery-processor");
      envelope = await import("./invitation-token-envelope");
      pool = new Pool({ connectionString: databaseUrl, max: 6 });
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
      if (originalBasePath === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
      else process.env.NEXT_PUBLIC_BASE_PATH = originalBasePath;
    });

    test("processes a queued invitation through fake provider and preserves tenant denial", async () => {
      const prefix = `m1-c2d-${randomUUID()}`;
      const organizationId = `${prefix}-org`;
      const userId = `${prefix}-user`;
      const personId = `${prefix}-person`;
      const invitationIds = [`${prefix}-sent`, `${prefix}-wrong-tenant`];
      fixture = { prefix, organizationId, userId, personId, invitationIds };
      await createFixture(pool, fixture);

      const now = new Date();
      const actor = { organizationId, userId, personId };
      const sentToken = `${prefix}-sent-token`;
      const sentCreated = await service.createInvitationForDelivery({
        actor,
        invitationId: invitationIds[0]!,
        email: `${prefix}-sent@example.invalid`,
        tokenHash: createHash("sha256").update(sentToken).digest("hex"),
        tokenCiphertext: envelope.encryptInvitationToken(sentToken, {
          organizationId,
          invitationId: invitationIds[0]!,
        }),
        requestedMode: "IMMEDIATE",
        now,
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1_000),
      }, dependencies);
      assert.ok(sentCreated.ok && sentCreated.status === "QUEUED");
      if (!sentCreated.ok || sentCreated.status !== "QUEUED") return;

      const providerCalls: Array<Readonly<{
        to: string;
        organizationName: string;
        invitationUrl: string;
      }>> = [];
      const processed = await processor.processInvitationDeliveryJob({
        organizationId,
        jobId: sentCreated.jobId,
        now,
        leaseDurationMs: 60_000,
      }, {
        deliveryDependencies: dependencies,
        newLeaseToken: () => `${prefix}-lease`,
        emailProvider: {
          async sendInvitationEmail(params) {
            providerCalls.push({ ...params });
            return true;
          },
        },
      });
      assert.deepEqual(processed, { ok: true, status: "SENT", jobId: sentCreated.jobId });
      assert.deepEqual(providerCalls, [{
        to: `${prefix}-sent@example.invalid`,
        organizationName: "M1 C2D Processor",
        invitationUrl: `/loopos/invite/${sentToken}`,
      }]);
      assert.deepEqual(await jobState(pool, sentCreated.jobId), {
        status: "SENT",
        attemptCount: 1,
        leaseToken: null,
        leaseExpiresAt: null,
        lastErrorCode: null,
      });
      assert.equal(await invitationCompleted(pool, invitationIds[0]!), true);

      const wrongTenantToken = `${prefix}-wrong-token`;
      const wrongTenantCreated = await service.createInvitationForDelivery({
        actor,
        invitationId: invitationIds[1]!,
        email: `${prefix}-wrong@example.invalid`,
        tokenHash: createHash("sha256").update(wrongTenantToken).digest("hex"),
        tokenCiphertext: envelope.encryptInvitationToken(wrongTenantToken, {
          organizationId,
          invitationId: invitationIds[1]!,
        }),
        requestedMode: "IMMEDIATE",
        now,
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1_000),
      }, dependencies);
      assert.ok(wrongTenantCreated.ok && wrongTenantCreated.status === "QUEUED");
      if (!wrongTenantCreated.ok || wrongTenantCreated.status !== "QUEUED") return;
      const callCountBeforeWrongTenant = providerCalls.length;
      assert.deepEqual(await processor.processInvitationDeliveryJob({
        organizationId: `${prefix}-other-org`,
        jobId: wrongTenantCreated.jobId,
        now,
        leaseDurationMs: 60_000,
      }, {
        deliveryDependencies: dependencies,
        emailProvider: {
          async sendInvitationEmail() {
            throw new Error("provider must not run");
          },
        },
      }), { ok: false, code: "JOB_NOT_CLAIMABLE" });
      assert.equal(providerCalls.length, callCountBeforeWrongTenant);
      assert.equal(await fixtureResidue(pool, prefix, true), 7);

      await cleanupFixture(pool, fixture);
      assert.equal(await fixtureResidue(pool, prefix), 0);
      fixture = undefined;
    });
  });
}

async function createFixture(pool: Pool, fixture: Fixture): Promise<void> {
  const circleId = `${fixture.prefix}-circle`;
  await pool.query(`
    INSERT INTO "organizations" ("id", "name", "slug", "updatedAt")
    VALUES ($1, 'M1 C2D Processor', $2, CURRENT_TIMESTAMP)
  `, [fixture.organizationId, `${fixture.prefix}-org`]);
  await pool.query(`
    INSERT INTO "users" ("id", "email", "updatedAt")
    VALUES ($1, $2, CURRENT_TIMESTAMP)
  `, [fixture.userId, `${fixture.prefix}@example.invalid`]);
  await pool.query(`
    INSERT INTO "memberships" ("id", "userId", "organizationId", "role")
    VALUES ($1, $2, $3, 'ORG_ADMIN')
  `, [`${fixture.prefix}-membership`, fixture.userId, fixture.organizationId]);
  await pool.query(`
    INSERT INTO "circles"
      ("id", "organizationId", "name", "number", "type", "purpose", "updatedAt")
    VALUES ($1, $2, 'Root', 'CUSTOM', 'STRATEGY', 'Fixture', CURRENT_TIMESTAMP)
  `, [circleId, fixture.organizationId]);
  await pool.query(`
    INSERT INTO "people"
      ("id", "organizationId", "name", "userId", "homeCircleId", "updatedAt")
    VALUES ($1, $2, 'Actor', $3, $4, CURRENT_TIMESTAMP)
  `, [fixture.personId, fixture.organizationId, fixture.userId, circleId]);
}

async function cleanupFixture(pool: Pool, fixture: Fixture): Promise<void> {
  await pool.query(
    'DELETE FROM "organization_invitation_delivery_jobs" WHERE "organizationId" = $1',
    [fixture.organizationId],
  );
  await pool.query(
    'DELETE FROM "organization_invitations" WHERE "id" = ANY($1::text[])',
    [fixture.invitationIds],
  );
  await pool.query('DELETE FROM "people" WHERE "id" = $1', [fixture.personId]);
  await pool.query('DELETE FROM "circles" WHERE "id" LIKE $1', [`${fixture.prefix}%`]);
  await pool.query('DELETE FROM "memberships" WHERE "id" LIKE $1', [`${fixture.prefix}%`]);
  await pool.query('DELETE FROM "users" WHERE "id" = $1', [fixture.userId]);
  await pool.query('DELETE FROM "organizations" WHERE "id" = $1', [fixture.organizationId]);
}

async function jobState(
  pool: Pool,
  jobId: string,
): Promise<Readonly<{
  status: string;
  attemptCount: number;
  leaseToken: string | null;
  leaseExpiresAt: Date | null;
  lastErrorCode: string | null;
}>> {
  const result = await pool.query<{
    status: string;
    attemptCount: number;
    leaseToken: string | null;
    leaseExpiresAt: Date | null;
    lastErrorCode: string | null;
  }>(`
    SELECT "status"::text AS status, "attemptCount", "leaseToken",
           "leaseExpiresAt", "lastErrorCode"
    FROM "organization_invitation_delivery_jobs"
    WHERE "id" = $1
  `, [jobId]);
  return result.rows[0]!;
}

async function invitationCompleted(pool: Pool, invitationId: string): Promise<boolean> {
  const result = await pool.query<{ completed: boolean }>(`
    SELECT "deliveryCompletedAt" IS NOT NULL AS completed
    FROM "organization_invitations"
    WHERE "id" = $1
  `, [invitationId]);
  return result.rows[0]?.completed ?? false;
}

async function fixtureResidue(pool: Pool, prefix: string, includeLiveFixture = false): Promise<number> {
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
  const count = Number(result.rows[0]?.count ?? "-1");
  return includeLiveFixture ? count : count;
}
