import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { Pool } from "pg";

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  process.env.RTW1_S0_TEST_DATABASE_URL ??
  process.env.DATABASE_URL;

type Fixture = Readonly<{
  prefix: string;
  organizationA: string;
  organizationB: string;
  invitationIds: readonly string[];
}>;

function testCiphertext(index: number): string {
  return `v1.${Buffer.alloc(12, index + 1).toString("base64url")}.${Buffer.from(`cipher-${index}`).toString("base64url")}.${Buffer.alloc(16, index + 11).toString("base64url")}`;
}

async function assertPostgresReject(
  action: () => Promise<unknown>,
  expectedCode: "23503" | "23514",
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error && typeof error === "object");
    assert.equal("code" in error ? error.code : undefined, expectedCode);
    return true;
  });
}

if (!databaseUrl) {
  test("V6-M1-C2 invitation delivery constraints against PostgreSQL", {
    skip: "TEST_DATABASE_URL, RTW1_S0_TEST_DATABASE_URL, or DATABASE_URL is required",
  }, () => {});
} else {
  describe("V6-M1-C2 invitation delivery constraints against PostgreSQL", { concurrency: 1 }, () => {
    let pool: Pool;
    let fixture: Fixture | undefined;

    before(() => {
      pool = new Pool({ connectionString: databaseUrl, max: 2 });
    });

    after(async () => {
      if (fixture) {
        await pool.query(
          'DELETE FROM "organization_invitation_delivery_jobs" WHERE "id" LIKE $1',
          [`${fixture.prefix}%`],
        );
        await pool.query(
          'DELETE FROM "organization_invitations" WHERE "id" = ANY($1::text[])',
          [fixture.invitationIds],
        );
        await pool.query(
          'DELETE FROM "people" WHERE "id" LIKE $1',
          [`${fixture.prefix}%`],
        );
        await pool.query(
          'DELETE FROM "circles" WHERE "id" LIKE $1',
          [`${fixture.prefix}%`],
        );
        await pool.query(
          'DELETE FROM "organizations" WHERE "id" = ANY($1::text[])',
          [[fixture.organizationA, fixture.organizationB]],
        );

        const residual = await pool.query<{ count: string }>(`
          SELECT (
            (SELECT count(*) FROM "organizations" WHERE "id" LIKE $1) +
            (SELECT count(*) FROM "circles" WHERE "id" LIKE $1) +
            (SELECT count(*) FROM "people" WHERE "id" LIKE $1) +
            (SELECT count(*) FROM "organization_invitations" WHERE "id" LIKE $1) +
            (SELECT count(*) FROM "organization_invitation_delivery_jobs" WHERE "id" LIKE $1)
          )::text AS count
        `, [`${fixture.prefix}%`]);
        assert.equal(residual.rows[0]?.count, "0");
      }
      await pool.end();
    });

    test("rejects invalid attempt states and cross-tenant jobs while allowing valid queue states", async () => {
      const prefix = `m1-c2-${randomUUID()}`;
      const organizationA = `${prefix}-org-a`;
      const organizationB = `${prefix}-org-b`;
      const circleA = `${prefix}-circle-a`;
      const circleB = `${prefix}-circle-b`;
      const personA = `${prefix}-person-a`;
      const personB = `${prefix}-person-b`;
      const invitationIds = [
        `${prefix}-pending`,
        `${prefix}-processing`,
        `${prefix}-invalid-attempt`,
        `${prefix}-held`,
        `${prefix}-cancelled`,
        `${prefix}-cross-tenant`,
      ] as const;
      fixture = { prefix, organizationA, organizationB, invitationIds };

      await pool.query(`
        INSERT INTO "organizations" ("id", "name", "slug", "updatedAt")
        VALUES
          ($1, 'M1 C2 A', $2, CURRENT_TIMESTAMP),
          ($3, 'M1 C2 B', $4, CURRENT_TIMESTAMP)
      `, [organizationA, `${prefix}-a`, organizationB, `${prefix}-b`]);
      await pool.query(`
        INSERT INTO "circles"
          ("id", "organizationId", "name", "number", "type", "purpose", "updatedAt")
        VALUES
          ($1, $2, 'Root A', 'CUSTOM', 'STRATEGY', 'Fixture A', CURRENT_TIMESTAMP),
          ($3, $4, 'Root B', 'CUSTOM', 'STRATEGY', 'Fixture B', CURRENT_TIMESTAMP)
      `, [circleA, organizationA, circleB, organizationB]);
      await pool.query(`
        INSERT INTO "people"
          ("id", "organizationId", "name", "homeCircleId", "updatedAt")
        VALUES
          ($1, $2, 'Creator A', $3, CURRENT_TIMESTAMP),
          ($4, $5, 'Creator B', $6, CURRENT_TIMESTAMP)
      `, [personA, organizationA, circleA, personB, organizationB, circleB]);

      for (const [index, invitationId] of invitationIds.entries()) {
        const inTenantB = invitationId.endsWith("cross-tenant");
        await pool.query(`
          INSERT INTO "organization_invitations"
            ("id", "organizationId", "email", "tokenHash", "deliveryTokenCiphertext",
             "createdById", "expiresAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP)
        `, [
          invitationId,
          inTenantB ? organizationB : organizationA,
          `${prefix}-${index}@example.invalid`,
          `${prefix}-token-${index}`,
          testCiphertext(index),
          inTenantB ? personB : personA,
        ]);
      }

      for (const invalidCiphertext of [null, `${prefix}-token-0`, "v1.malformed"]) {
        await assertPostgresReject(
          () => pool.query(
            'UPDATE "organization_invitations" SET "deliveryTokenCiphertext" = $2 WHERE "id" = $1',
            [invitationIds[0], invalidCiphertext],
          ),
          "23514",
        );
      }

      await pool.query(`
        INSERT INTO "organization_invitation_delivery_jobs"
          ("id", "organizationId", "invitationId", "updatedAt")
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      `, [`${prefix}-job-pending`, organizationA, invitationIds[0]]);
      await pool.query(`
        INSERT INTO "organization_invitation_delivery_jobs"
          ("id", "organizationId", "invitationId", "status", "attemptCount",
           "leaseToken", "leaseExpiresAt", "updatedAt")
        VALUES ($1, $2, $3, 'PROCESSING', 1, 'lease-valid',
                CURRENT_TIMESTAMP + INTERVAL '5 minutes', CURRENT_TIMESTAMP)
      `, [`${prefix}-job-processing`, organizationA, invitationIds[1]]);

      const invalidAttemptCases = [
        {
          id: `${prefix}-job-invalid-processing`,
          status: "PROCESSING",
          state: "'lease-invalid', CURRENT_TIMESTAMP + INTERVAL '5 minutes', NULL, NULL",
        },
        {
          id: `${prefix}-job-invalid-sent`,
          status: "SENT",
          state: "NULL, NULL, NULL, CURRENT_TIMESTAMP",
        },
        {
          id: `${prefix}-job-invalid-failed`,
          status: "FAILED",
          state: "NULL, NULL, 'DELIVERY_FAILED', NULL",
        },
      ] as const;
      for (const invalid of invalidAttemptCases) {
        await assertPostgresReject(
          () => pool.query(`
            INSERT INTO "organization_invitation_delivery_jobs"
              ("id", "organizationId", "invitationId", "status", "attemptCount",
               "leaseToken", "leaseExpiresAt", "lastErrorCode", "sentAt", "updatedAt")
            VALUES ($1, $2, $3, $4, 0, ${invalid.state}, CURRENT_TIMESTAMP)
          `, [invalid.id, organizationA, invitationIds[2], invalid.status]),
          "23514",
        );
      }
      for (const invalidMaxAttempts of [0, 101]) {
        await assertPostgresReject(
          () => pool.query(`
            INSERT INTO "organization_invitation_delivery_jobs"
              ("id", "organizationId", "invitationId", "maxAttempts", "updatedAt")
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
          `, [
            `${prefix}-job-invalid-max-${invalidMaxAttempts}`,
            organizationA,
            invitationIds[2],
            invalidMaxAttempts,
          ]),
          "23514",
        );
      }
      await assertPostgresReject(
        () => pool.query(`
          INSERT INTO "organization_invitation_delivery_jobs"
            ("id", "organizationId", "invitationId", "attemptCount", "maxAttempts", "updatedAt")
          VALUES ($1, $2, $3, 4, 3, CURRENT_TIMESTAMP)
        `, [`${prefix}-job-attempts-over-max`, organizationA, invitationIds[2]]),
        "23514",
      );
      await assertPostgresReject(
        () => pool.query(`
          INSERT INTO "organization_invitation_delivery_jobs"
            ("id", "organizationId", "invitationId", "status", "lastErrorCode", "updatedAt")
          VALUES ($1, $2, $3, 'CANCELLED', 'DELIVERY_FAILED', CURRENT_TIMESTAMP)
        `, [`${prefix}-job-invalid-cancelled`, organizationA, invitationIds[2]]),
        "23514",
      );

      await pool.query(`
        INSERT INTO "organization_invitation_delivery_jobs"
          ("id", "organizationId", "invitationId", "status", "lastErrorCode", "updatedAt")
        VALUES ($1, $2, $3, 'CANCELLED', 'INVITATION_UNAVAILABLE', CURRENT_TIMESTAMP)
      `, [`${prefix}-job-cancelled`, organizationA, invitationIds[4]]);

      await assertPostgresReject(
        () => pool.query(
          'UPDATE "organization_invitations" SET "releasedAt" = CURRENT_TIMESTAMP WHERE "id" = $1',
          [invitationIds[3]],
        ),
        "23514",
      );
      await assertPostgresReject(
        () => pool.query(`
          INSERT INTO "organization_invitation_delivery_jobs"
            ("id", "organizationId", "invitationId", "updatedAt")
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        `, [`${prefix}-job-cross-tenant`, organizationA, invitationIds[5]]),
        "23503",
      );

      const jobs = await pool.query<{ status: string; attemptCount: number; maxAttempts: number }>(`
        SELECT "status", "attemptCount", "maxAttempts"
        FROM "organization_invitation_delivery_jobs"
        WHERE "id" LIKE $1
        ORDER BY "status"
      `, [`${prefix}-job-%`]);
      assert.deepEqual(jobs.rows, [
        { status: "PENDING", attemptCount: 0, maxAttempts: 3 },
        { status: "PROCESSING", attemptCount: 1, maxAttempts: 3 },
        { status: "CANCELLED", attemptCount: 0, maxAttempts: 3 },
      ]);
    });
  });
}
