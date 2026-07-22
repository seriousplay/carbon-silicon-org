import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import Module, { createRequire } from "node:module";
import { after, before, describe, test } from "node:test";

import {
  closeDisposableDbClient,
  createDisposableDbClient,
  requiredRtw1S0DatabaseUrl,
  type DisposableDbClient,
} from "@/test/rtw1-s0-disposable-db";

type ActivationServiceModule = typeof import("./activation-service");
type EnvelopeModule = typeof import("./invitation-token-envelope");
type ActivationActor = Parameters<ActivationServiceModule["activateOrganization"]>[0];

type Fixture = Readonly<{
  prefix: string;
  organizationId: string;
  userId: string;
  personId: string;
  circleId: string;
  roleId: string;
}>;

type FixtureOptions = Readonly<{
  admin?: boolean;
  purpose?: string | null;
}>;

const require = createRequire(import.meta.url);
let originalServerOnlyModule: NodeJS.Module | undefined;
let serverOnlyPath = "";
let client: DisposableDbClient;
let activateOrganization: ActivationServiceModule["activateOrganization"];
let createPrismaOrganizationActivationDependencies:
  ActivationServiceModule["createPrismaOrganizationActivationDependencies"];
let OrganizationActivationError: ActivationServiceModule["OrganizationActivationError"];
let envelope: EnvelopeModule;
const originalInvitationEncryptionSecret = process.env.INVITATION_TOKEN_ENCRYPTION_SECRET;

async function createReadyFixture(
  options: FixtureOptions = {},
): Promise<Fixture> {
  const prefix = `m1-c1-${randomUUID()}`;
  const organizationId = `${prefix}-org`;
  const userId = `${prefix}-user`;
  const circleId = `${prefix}-circle`;
  const personId = `${prefix}-person`;
  const roleId = `${prefix}-lead-role`;

  await client.prisma.user.create({
    data: {
      id: userId,
      email: `${prefix}@example.invalid`,
      name: "M1 C1 actor",
    },
  });
  await client.prisma.organization.create({
    data: {
      id: organizationId,
      name: `M1 C1 ${prefix}`,
      slug: prefix,
      purpose: options.purpose === undefined
        ? "让团队持续交付可验证的客户价值"
        : options.purpose,
    },
  });
  await client.prisma.membership.create({
    data: {
      id: `${prefix}-membership`,
      userId,
      organizationId,
      role: options.admin === false ? "ORG_MEMBER" : "ORG_ADMIN",
    },
  });
  await client.prisma.circle.create({
    data: {
      id: circleId,
      organizationId,
      name: "M1 C1 Root",
      number: "CUSTOM",
      type: "STRATEGY",
      purpose: "承载组织目的",
    },
  });
  await client.prisma.person.create({
    data: {
      id: personId,
      organizationId,
      userId,
      name: "M1 C1 actor",
      entityType: "HUMAN",
      homeCircleId: circleId,
    },
  });
  await client.prisma.circle.update({
    where: { id: circleId },
    data: { leadPersonId: personId },
  });
  await client.prisma.roleDef.create({
    data: {
      id: roleId,
      organizationId,
      circleId,
      name: "Circle Lead",
      purpose: "让组织目的持续落地",
      accountabilities: "维护组织运行并移除阻塞",
      ownershipType: "HOME",
      category: "CIRCLE_LEAD",
      status: "ACTIVE",
      assignees: { connect: { id: personId } },
    },
  });

  return { prefix, organizationId, userId, personId, circleId, roleId };
}

function actorFor(fixture: Fixture): ActivationActor {
  return {
    organizationId: fixture.organizationId,
    userId: fixture.userId,
    personId: fixture.personId,
  };
}

async function activationState(organizationId: string) {
  const [organization, snapshots, activatedEvents] = await Promise.all([
    client.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        lifecycleStatus: true,
        activatedAt: true,
        activatedById: true,
        activatedByOrganizationId: true,
      },
    }),
    client.prisma.organizationActivationSnapshot.findMany({
      where: { organizationId },
      select: { id: true, readiness: true, organizationSnapshot: true, checksum: true },
    }),
    client.prisma.organizationSetupEvent.findMany({
      where: { organizationId, type: "ACTIVATED" },
      select: { id: true, payload: true },
    }),
  ]);
  return { organization, snapshots, activatedEvents };
}

async function assertActivationError(
  action: () => Promise<unknown>,
  code: "ACCESS_DENIED" | "READINESS_FAILED",
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof OrganizationActivationError);
    assert.equal(error.code, code);
    return true;
  });
}

async function assertPostgresReject(
  action: () => Promise<unknown>,
  message: RegExp,
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error && typeof error === "object");
    assert.equal("code" in error ? error.code : undefined, "55000");
    assert.match("message" in error ? String(error.message) : "", message);
    return true;
  });
}

async function cleanupFixtures(): Promise<void> {
  const connection = await client.pool.connect();
  try {
    await connection.query("BEGIN");
    await connection.query(
      'ALTER TABLE "organizations" DISABLE TRIGGER "organizations_lifecycle_update_guard"',
    );
    await connection.query(
      'ALTER TABLE "organization_setup_events" DISABLE TRIGGER "organization_setup_events_append_only"',
    );
    await connection.query(
      'ALTER TABLE "organization_activation_snapshots" DISABLE TRIGGER "organization_activation_snapshots_append_only"',
    );
    await connection.query(`
      UPDATE "organizations"
      SET "lifecycleStatus" = 'SETUP',
          "activatedAt" = NULL,
          "activatedById" = NULL,
          "activatedByOrganizationId" = NULL
      WHERE "slug" LIKE 'm1-c1-%'
    `);
    await connection.query(`
      DELETE FROM "organization_activation_snapshots"
      WHERE "organizationId" IN (
        SELECT "id" FROM "organizations" WHERE "slug" LIKE 'm1-c1-%'
      )
    `);
    await connection.query(`
      DELETE FROM "organization_setup_events"
      WHERE "organizationId" IN (
        SELECT "id" FROM "organizations" WHERE "slug" LIKE 'm1-c1-%'
      )
    `);
    await connection.query(`
      DELETE FROM "organization_invitation_delivery_jobs"
      WHERE "organizationId" IN (
        SELECT "id" FROM "organizations" WHERE "slug" LIKE 'm1-c1-%'
      )
    `);
    await connection.query(`
      DELETE FROM "organization_invitations"
      WHERE "organizationId" IN (
        SELECT "id" FROM "organizations" WHERE "slug" LIKE 'm1-c1-%'
      )
    `);
    await connection.query('DELETE FROM "organizations" WHERE "slug" LIKE \'m1-c1-%\'');
    await connection.query('DELETE FROM "users" WHERE "email" LIKE \'m1-c1-%@example.invalid\'');
    await connection.query(
      'ALTER TABLE "organization_activation_snapshots" ENABLE TRIGGER "organization_activation_snapshots_append_only"',
    );
    await connection.query(
      'ALTER TABLE "organization_setup_events" ENABLE TRIGGER "organization_setup_events_append_only"',
    );
    await connection.query(
      'ALTER TABLE "organizations" ENABLE TRIGGER "organizations_lifecycle_update_guard"',
    );
    await connection.query("COMMIT");
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}

async function createInvitationFixtures(
  fixture: Fixture,
  invitationIds: readonly string[],
  now: Date,
): Promise<void> {
  const rows = [
    { id: invitationIds[0]!, mode: "HELD", consumed: null, revoked: null, expired: false, completed: false, job: false },
    { id: invitationIds[1]!, mode: "HELD", consumed: null, revoked: null, expired: false, completed: false, job: false },
    { id: invitationIds[2]!, mode: "HELD", consumed: now, revoked: null, expired: false, completed: false, job: false },
    { id: invitationIds[3]!, mode: "HELD", consumed: null, revoked: now, expired: false, completed: false, job: false },
    { id: invitationIds[4]!, mode: "HELD", consumed: null, revoked: null, expired: true, completed: false, job: false },
    { id: invitationIds[5]!, mode: "IMMEDIATE", consumed: null, revoked: null, expired: false, completed: false, job: true },
    { id: invitationIds[6]!, mode: "IMMEDIATE", consumed: null, revoked: null, expired: false, completed: true, job: false },
  ] as const;
  for (const [index, row] of rows.entries()) {
    const token = `${row.id}-release-token`;
    await client.pool.query(`
      INSERT INTO "organization_invitations" (
        "id", "organizationId", "email", "tokenHash", "deliveryTokenCiphertext",
        "createdById", "expiresAt", "consumedAt", "revokedAt", "deliveryMode",
        "releasedAt", "deliveryCompletedAt", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        to_timestamp($7 / 1000.0) AT TIME ZONE 'UTC',
        $8, $9, $10::"InvitationDeliveryMode", $11, $12, $13, $13
      )
    `, [
      row.id,
      fixture.organizationId,
      `${row.id}@example.invalid`,
      createHash("sha256").update(token).digest("hex"),
      envelope.encryptInvitationToken(token, {
        organizationId: fixture.organizationId,
        invitationId: row.id,
      }),
      fixture.personId,
      row.expired ? now.getTime() - 1_000 : now.getTime() + 24 * 60 * 60 * 1_000,
      row.consumed,
      row.revoked,
      row.mode,
      row.mode === "IMMEDIATE" ? now : null,
      row.completed ? now : null,
      now,
    ]);
    if (row.job) {
      await client.pool.query(`
        INSERT INTO "organization_invitation_delivery_jobs" (
          "id", "organizationId", "invitationId", "status", "attemptCount", "maxAttempts",
          "availableAt", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, 'PENDING', 0, 3, $4, $4, $4)
      `, [`${row.id}-job-${index}`, fixture.organizationId, row.id, now]);
    }
  }
}

async function invitationReleaseState(invitationIds: readonly string[]) {
  const result = await client.pool.query<{
    id: string;
    deliveryMode: string;
    released: boolean;
    completed: boolean;
    jobCount: string;
  }>(`
    SELECT
      i."id",
      i."deliveryMode"::text AS "deliveryMode",
      i."releasedAt" IS NOT NULL AS released,
      i."deliveryCompletedAt" IS NOT NULL AS completed,
      count(j."id")::text AS "jobCount"
    FROM "organization_invitations" i
    LEFT JOIN "organization_invitation_delivery_jobs" j
      ON j."invitationId" = i."id" AND j."organizationId" = i."organizationId"
    WHERE i."id" = ANY($1::text[])
    GROUP BY i."id", i."deliveryMode", i."releasedAt", i."deliveryCompletedAt"
    ORDER BY array_position($1::text[], i."id")
  `, [invitationIds]);
  return result.rows.map((row) => ({
    id: row.id,
    deliveryMode: row.deliveryMode,
    released: row.released,
    completed: row.completed,
    jobCount: Number(row.jobCount),
  }));
}

if (process.env.RTW1_S0_DB_REQUIRED !== "1") {
  test("V6-M1-C1 organization activation against disposable PostgreSQL", {
    skip: "RTW1_S0_DB_REQUIRED is not set",
  }, () => {});
} else {
  describe("V6-M1-C1 organization activation against disposable PostgreSQL", { concurrency: 1 }, () => {
    before(async () => {
      serverOnlyPath = require.resolve("server-only");
      originalServerOnlyModule = require.cache[serverOnlyPath];
      const serverOnlyShim = new Module(serverOnlyPath);
      serverOnlyShim.filename = serverOnlyPath;
      serverOnlyShim.loaded = true;
      require.cache[serverOnlyPath] = serverOnlyShim;

      ({
        activateOrganization,
        createPrismaOrganizationActivationDependencies,
        OrganizationActivationError,
      } = await import("./activation-service"));
      process.env.INVITATION_TOKEN_ENCRYPTION_SECRET = "activation-release-postgres-secret";
      envelope = await import("./invitation-token-envelope");
      client = createDisposableDbClient(requiredRtw1S0DatabaseUrl());
    });

    after(async () => {
      if (client) await closeDisposableDbClient(client);
      if (originalServerOnlyModule) require.cache[serverOnlyPath] = originalServerOnlyModule;
      else delete require.cache[serverOnlyPath];
      if (originalInvitationEncryptionSecret === undefined) {
        delete process.env.INVITATION_TOKEN_ENCRYPTION_SECRET;
      } else {
        process.env.INVITATION_TOKEN_ENCRYPTION_SECRET = originalInvitationEncryptionSecret;
      }
    });

    test("persists atomic evidence, rejects unsafe activation, and enforces irreversible ledgers", async () => {
      const dependencies = createPrismaOrganizationActivationDependencies(client.prisma);
      try {
        const successful = await createReadyFixture();
        await client.prisma.organizationBrainProfile.create({
          data: {
            id: `${successful.organizationId}-brain`,
            organizationId: successful.organizationId,
            name: "M1 C1 Brain",
            modelProvider: "deepseek",
            modelName: "deepseek-v4-pro",
            modelBaseUrl: "https://secret-provider.invalid/v1",
            modelApiKeyCiphertext: "ciphertext-secret-api-key",
          },
        });
        const success = await activateOrganization(actorFor(successful), dependencies);
        assert.equal(success.status, "ACTIVATED");
        assert.deepEqual(success.warningCodes, [
          "GOAL_CYCLE_MISSING",
          "ORGANIZATION_GOAL_MISSING",
          "MEETING_CADENCE_MISSING",
        ]);
        const successfulState = await activationState(successful.organizationId);
        assert.deepEqual(successfulState.organization, {
          lifecycleStatus: "ACTIVE",
          activatedAt: new Date(success.activatedAt),
          activatedById: successful.personId,
          activatedByOrganizationId: successful.organizationId,
        });
        assert.equal(successfulState.snapshots.length, 1);
        assert.equal(successfulState.activatedEvents.length, 1);
        assert.deepEqual(
          (successfulState.snapshots[0]!.readiness as { warningCodes: string[] }).warningCodes,
          success.warningCodes,
        );
        const persistedFacts = (successfulState.snapshots[0]!.organizationSnapshot as {
          readinessFacts: {
            organizationPurpose: string;
            structures: Array<{ id: string; leadPersonId: string; tacticalCadence: string | null }>;
            roles: Array<{ id: string; purpose: string; accountabilities: string; assigneeIds: string[]; humanAssigneeIds: string[] }>;
            brainModel: { provider: string; modelName: string; keyConfigured: boolean; available: boolean };
          };
        }).readinessFacts;
        assert.equal(persistedFacts.organizationPurpose, "让团队持续交付可验证的客户价值");
        assert.deepEqual(persistedFacts.structures, [{
          id: successful.circleId,
          parentId: null,
          leadPersonId: successful.personId,
          hasLead: true,
          tacticalCadence: null,
        }]);
        assert.equal(persistedFacts.roles[0]!.id, successful.roleId);
        assert.deepEqual(persistedFacts.roles[0]!.assigneeIds, [successful.personId]);
        assert.deepEqual(persistedFacts.roles[0]!.humanAssigneeIds, [successful.personId]);
        assert.deepEqual(persistedFacts.brainModel, {
          profileId: `${successful.organizationId}-brain`,
          provider: "deepseek",
          modelName: "deepseek-v4-pro",
          keyConfigured: true,
          available: true,
        });
        const persistedJson = JSON.stringify(successfulState.snapshots[0]!.organizationSnapshot);
        assert.doesNotMatch(persistedJson, /tokenHash|ciphertext|api.?key|secret-provider/i);
        const replay = await activateOrganization(actorFor(successful), dependencies);
        assert.equal(replay.status, "ALREADY_ACTIVE");
        assert.equal((await activationState(successful.organizationId)).snapshots.length, 1);

        const failedReadiness = await createReadyFixture({ purpose: null });
        await assertActivationError(
          () => activateOrganization(actorFor(failedReadiness), dependencies),
          "READINESS_FAILED",
        );
        assert.deepEqual(await activationState(failedReadiness.organizationId), {
          organization: {
            lifecycleStatus: "SETUP",
            activatedAt: null,
            activatedById: null,
            activatedByOrganizationId: null,
          },
          snapshots: [],
          activatedEvents: [],
        });

        const nonAdmin = await createReadyFixture({ admin: false });
        await assertActivationError(
          () => activateOrganization(actorFor(nonAdmin), dependencies),
          "ACCESS_DENIED",
        );
        assert.deepEqual((await activationState(nonAdmin.organizationId)).snapshots, []);
        assert.deepEqual((await activationState(nonAdmin.organizationId)).activatedEvents, []);

        const mismatched = await createReadyFixture();
        const mismatchUserId = `${mismatched.prefix}-mismatch-user`;
        const mismatchPersonId = `${mismatched.prefix}-mismatch-person`;
        await client.prisma.user.create({
          data: {
            id: mismatchUserId,
            email: `${mismatched.prefix}-mismatch@example.invalid`,
          },
        });
        await client.prisma.person.create({
          data: {
            id: mismatchPersonId,
            organizationId: mismatched.organizationId,
            userId: mismatchUserId,
            name: "Mismatched person",
            entityType: "HUMAN",
            homeCircleId: mismatched.circleId,
          },
        });
        await assertActivationError(
          () => activateOrganization({
            organizationId: mismatched.organizationId,
            userId: mismatched.userId,
            personId: mismatchPersonId,
          }, dependencies),
          "ACCESS_DENIED",
        );
        assert.deepEqual((await activationState(mismatched.organizationId)).snapshots, []);
        assert.deepEqual((await activationState(mismatched.organizationId)).activatedEvents, []);

        const correctTenant = await createReadyFixture();
        const wrongTenant = await createReadyFixture();
        await assertActivationError(
          () => activateOrganization({
            organizationId: correctTenant.organizationId,
            userId: wrongTenant.userId,
            personId: wrongTenant.personId,
          }, dependencies),
          "ACCESS_DENIED",
        );
        assert.deepEqual((await activationState(correctTenant.organizationId)).snapshots, []);
        assert.deepEqual((await activationState(correctTenant.organizationId)).activatedEvents, []);

        const release = await createReadyFixture();
        const releaseNow = new Date();
        const invitationIds = [
          `${release.prefix}-held-a`,
          `${release.prefix}-held-b`,
          `${release.prefix}-consumed`,
          `${release.prefix}-revoked`,
          `${release.prefix}-expired`,
          `${release.prefix}-immediate`,
          `${release.prefix}-completed`,
        ];
        await createInvitationFixtures(release, invitationIds, releaseNow);
        const releaseResult = await activateOrganization(actorFor(release), dependencies);
        assert.equal(releaseResult.status, "ACTIVATED");
        assert.deepEqual(await invitationReleaseState(invitationIds), [
          { id: invitationIds[0], deliveryMode: "IMMEDIATE", released: true, completed: false, jobCount: 1 },
          { id: invitationIds[1], deliveryMode: "IMMEDIATE", released: true, completed: false, jobCount: 1 },
          { id: invitationIds[2], deliveryMode: "HELD", released: false, completed: false, jobCount: 0 },
          { id: invitationIds[3], deliveryMode: "HELD", released: false, completed: false, jobCount: 0 },
          { id: invitationIds[4], deliveryMode: "HELD", released: false, completed: false, jobCount: 0 },
          { id: invitationIds[5], deliveryMode: "IMMEDIATE", released: true, completed: false, jobCount: 1 },
          { id: invitationIds[6], deliveryMode: "IMMEDIATE", released: true, completed: true, jobCount: 0 },
        ]);
        const releaseReplay = await activateOrganization(actorFor(release), dependencies);
        assert.equal(releaseReplay.status, "ALREADY_ACTIVE");
        assert.deepEqual(await invitationReleaseState(invitationIds), [
          { id: invitationIds[0], deliveryMode: "IMMEDIATE", released: true, completed: false, jobCount: 1 },
          { id: invitationIds[1], deliveryMode: "IMMEDIATE", released: true, completed: false, jobCount: 1 },
          { id: invitationIds[2], deliveryMode: "HELD", released: false, completed: false, jobCount: 0 },
          { id: invitationIds[3], deliveryMode: "HELD", released: false, completed: false, jobCount: 0 },
          { id: invitationIds[4], deliveryMode: "HELD", released: false, completed: false, jobCount: 0 },
          { id: invitationIds[5], deliveryMode: "IMMEDIATE", released: true, completed: false, jobCount: 1 },
          { id: invitationIds[6], deliveryMode: "IMMEDIATE", released: true, completed: true, jobCount: 0 },
        ]);
        const jobsJson = await client.pool.query<{ value: string }>(`
          SELECT COALESCE(jsonb_agg(to_jsonb(j))::text, '[]') AS value
          FROM "organization_invitation_delivery_jobs" j
          WHERE j."organizationId" = $1
        `, [release.organizationId]);
        assert.doesNotMatch(jobsJson.rows[0]!.value, /release-token|example\.invalid/i);

        const concurrent = await createReadyFixture();
        const concurrentResults = await Promise.all([
          activateOrganization(actorFor(concurrent), dependencies),
          activateOrganization(actorFor(concurrent), dependencies),
        ]);
        assert.deepEqual(
          concurrentResults.map((result) => result.status).sort(),
          ["ACTIVATED", "ALREADY_ACTIVE"],
        );
        const concurrentState = await activationState(concurrent.organizationId);
        assert.equal(concurrentState.snapshots.length, 1);
        assert.equal(concurrentState.activatedEvents.length, 1);

        await assertPostgresReject(
          () => client.pool.query(
            'UPDATE "organizations" SET "lifecycleStatus" = \'SETUP\' WHERE "id" = $1',
            [concurrent.organizationId],
          ),
          /activation is irreversible/i,
        );
        const snapshotId = concurrentState.snapshots[0]!.id;
        const eventId = concurrentState.activatedEvents[0]!.id;
        await assertPostgresReject(
          () => client.pool.query(
            'UPDATE "organization_activation_snapshots" SET "checksum" = \'tampered\' WHERE "id" = $1',
            [snapshotId],
          ),
          /append-only/i,
        );
        await assertPostgresReject(
          () => client.pool.query(
            'DELETE FROM "organization_activation_snapshots" WHERE "id" = $1',
            [snapshotId],
          ),
          /append-only/i,
        );
        await assertPostgresReject(
          () => client.pool.query(
            'UPDATE "organization_setup_events" SET "payload" = \'{}\'::jsonb WHERE "id" = $1',
            [eventId],
          ),
          /append-only/i,
        );
        await assertPostgresReject(
          () => client.pool.query(
            'DELETE FROM "organization_setup_events" WHERE "id" = $1',
            [eventId],
          ),
          /append-only/i,
        );
      } finally {
        await cleanupFixtures();
        assert.equal(
          await client.prisma.organization.count({ where: { slug: { startsWith: "m1-c1-" } } }),
          0,
        );
      }
    });
  });
}
