import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL(
    "../../../prisma/migrations/20260720183000_v6_m1c2_invitation_delivery/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const rollback = readFileSync(
  new URL(
    "../../../prisma/migrations/20260720183000_v6_m1c2_invitation_delivery/rollback.sql",
    import.meta.url,
  ),
  "utf8",
);

function block(kind: "enum" | "model", name: string): string {
  return schema.match(new RegExp(`^${kind} ${name} \\{[\\s\\S]*?^\\}`, "m"))?.[0] ?? "";
}

describe("V6-M1-C2 invitation delivery persistence contract", () => {
  test("persists delivery mode and one tenant-bound retryable job per invitation", () => {
    assert.match(block("enum", "InvitationDeliveryMode"), /\bHELD\b[\s\S]*\bIMMEDIATE\b/);
    assert.match(
      block("enum", "OrganizationInvitationDeliveryJobStatus"),
      /\bPENDING\b[\s\S]*\bPROCESSING\b[\s\S]*\bSENT\b[\s\S]*\bFAILED\b[\s\S]*\bCANCELLED\b/,
    );

    const invitation = block("model", "OrganizationInvitation");
    assert.match(invitation, /deliveryTokenCiphertext\s+String\?\s+@db\.Text/);
    assert.match(invitation, /deliveryMode\s+InvitationDeliveryMode\s+@default\(HELD\)/);
    assert.match(invitation, /releasedAt\s+DateTime\?/);
    assert.match(invitation, /deliveryCompletedAt\s+DateTime\?/);
    assert.match(invitation, /@@unique\(\[id, organizationId\]\)/);

    const job = block("model", "OrganizationInvitationDeliveryJob");
    assert.match(job, /invitationId\s+String\s+@unique/);
    assert.match(job, /status\s+OrganizationInvitationDeliveryJobStatus\s+@default\(PENDING\)/);
    assert.match(job, /attemptCount\s+Int\s+@default\(0\)/);
    assert.match(job, /maxAttempts\s+Int\s+@default\(3\)/);
    assert.match(job, /availableAt\s+DateTime\s+@default\(now\(\)\)/);
    assert.match(job, /fields:\s*\[invitationId, organizationId\]/);
    assert.match(job, /references:\s*\[id, organizationId\]/);
    assert.match(job, /@@unique\(\[invitationId, organizationId\]\)/);
    assert.match(job, /@@index\(\[organizationId, status, availableAt\]\)/);
  });

  test("backfills historical invitations as completed without creating delivery jobs", () => {
    const update = migration.match(
      /UPDATE "organization_invitations"[\s\S]*?;/,
    )?.[0] ?? "";
    assert.match(update, /"deliveryMode"\s*=\s*'IMMEDIATE'/);
    assert.match(update, /"releasedAt"\s*=\s*"createdAt"/);
    assert.match(update, /"deliveryCompletedAt"\s*=\s*"createdAt"/);

    const updateOffset = migration.indexOf(update);
    const notNullOffset = migration.indexOf(
      'ALTER COLUMN "deliveryMode" SET NOT NULL',
    );
    const defaultOffset = migration.indexOf(
      'ALTER COLUMN "deliveryMode" SET DEFAULT \'HELD\'',
    );
    assert.ok(updateOffset >= 0 && notNullOffset > updateOffset && defaultOffset > updateOffset);
    assert.doesNotMatch(
      migration,
      /INSERT\s+INTO\s+"organization_invitation_delivery_jobs"/i,
    );
  });

  test("enforces invitation and job lifecycle invariants in PostgreSQL", () => {
    assert.match(migration, /organization_invitations_delivery_lifecycle_check/);
    assert.match(migration, /"deliveryMode" = 'HELD'[\s\S]*"releasedAt" IS NULL/);
    assert.match(migration, /"deliveryMode" = 'IMMEDIATE'[\s\S]*"releasedAt" IS NOT NULL/);
    assert.match(migration, /organization_invitations_delivery_token_envelope_check/);
    assert.match(
      migration,
      /"deliveryCompletedAt" IS NOT NULL[\s\S]*"deliveryTokenCiphertext" IS NULL/,
    );
    assert.match(
      migration,
      /"deliveryTokenCiphertext" IS NOT NULL[\s\S]*length\("deliveryTokenCiphertext"\) BETWEEN 44 AND 2048/,
    );
    assert.ok(migration.includes(
      "~ '^v1\\.[A-Za-z0-9_-]{16}\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]{22}$'",
    ));
    assert.match(
      migration,
      /length\(split_part\("deliveryTokenCiphertext", '\.', 3\)\) BETWEEN 2 AND 1366/,
    );
    assert.match(migration, /"deliveryTokenCiphertext" <> "tokenHash"/);

    assert.match(migration, /organization_invitation_delivery_jobs_attempt_count_check/);
    assert.match(migration, /"attemptCount" >= 0 AND "attemptCount" <= "maxAttempts"/);
    assert.match(migration, /organization_invitation_delivery_jobs_max_attempts_check/);
    assert.match(migration, /"maxAttempts" BETWEEN 1 AND 100/);
    assert.match(migration, /"maxAttempts" INTEGER NOT NULL DEFAULT 3/);
    assert.match(migration, /organization_invitation_delivery_jobs_lease_token_check/);
    assert.match(migration, /length\("leaseToken"\) BETWEEN 1 AND 128/);
    assert.match(migration, /organization_invitation_delivery_jobs_error_code_check/);
    assert.match(migration, /length\("lastErrorCode"\) BETWEEN 1 AND 64/);
    assert.match(migration, /organization_invitation_delivery_jobs_status_check/);

    for (const status of ["PENDING", "PROCESSING", "SENT", "FAILED", "CANCELLED"]) {
      assert.match(migration, new RegExp(`"status" = '${status}'`));
    }
    assert.match(
      migration,
      /"status" = 'PENDING'[\s\S]*"attemptCount" >= 0[\s\S]*"leaseToken" IS NULL/,
    );
    assert.match(
      migration,
      /"status" = 'PROCESSING'[\s\S]*"attemptCount" >= 1[\s\S]*"leaseToken" IS NOT NULL[\s\S]*"leaseExpiresAt" IS NOT NULL/,
    );
    assert.match(
      migration,
      /"status" = 'SENT'[\s\S]*"attemptCount" >= 1[\s\S]*"leaseToken" IS NULL[\s\S]*"sentAt" IS NOT NULL/,
    );
    assert.match(
      migration,
      /"status" = 'FAILED'[\s\S]*"attemptCount" >= 1[\s\S]*"lastErrorCode" IS NOT NULL[\s\S]*"sentAt" IS NULL/,
    );
    assert.match(
      migration,
      /"status" = 'CANCELLED'[\s\S]*"leaseToken" IS NULL[\s\S]*"lastErrorCode" = 'INVITATION_UNAVAILABLE'[\s\S]*"sentAt" IS NULL/,
    );
  });

  test("binds jobs to invitation tenant and revokes PUBLIC table privileges", () => {
    assert.match(
      migration,
      /FOREIGN KEY \("invitationId", "organizationId"\)[\s\S]*REFERENCES "organization_invitations"\("id", "organizationId"\)/,
    );
    assert.match(
      migration,
      /FOREIGN KEY \("organizationId"\) REFERENCES "organizations"\("id"\)/,
    );
    assert.match(
      migration,
      /CREATE UNIQUE INDEX "organization_invitation_delivery_jobs_invitationId_key"/,
    );
    assert.match(
      migration,
      /REVOKE ALL ON TABLE "organization_invitation_delivery_jobs" FROM PUBLIC/,
    );
  });

  test("delivery jobs contain no recipient, token, API, provider, or payload fields", () => {
    const job = block("model", "OrganizationInvitationDeliveryJob");
    for (const forbidden of [
      "email",
      "token",
      "tokenHash",
      "apiKey",
      "provider",
      "payload",
      "recipient",
    ]) {
      assert.doesNotMatch(job, new RegExp(`^\\s*${forbidden}\\s+`, "m"));
    }

    const table = migration.match(
      /CREATE TABLE "organization_invitation_delivery_jobs" \([\s\S]*?\n\);/,
    )?.[0] ?? "";
    for (const forbidden of ["email", "tokenHash", "apiKey", "provider", "payload", "recipient"]) {
      assert.doesNotMatch(table, new RegExp(`"${forbidden}"`, "i"));
    }
  });

  test("rollback removes table, indexes, constraint, columns, and enums in dependency order", () => {
    const ordered = [
      'DROP INDEX "organization_invitation_delivery_jobs_status_lease_idx"',
      'DROP INDEX "organization_invitation_delivery_jobs_org_status_available_idx"',
      'DROP INDEX "organization_invitation_delivery_jobs_invitationId_organizationId_key"',
      'DROP INDEX "organization_invitation_delivery_jobs_invitationId_key"',
      'DROP TABLE "organization_invitation_delivery_jobs"',
      'DROP INDEX "organization_invitations_id_organizationId_key"',
      'DROP CONSTRAINT "organization_invitations_delivery_lifecycle_check"',
      'DROP CONSTRAINT "organization_invitations_delivery_token_envelope_check"',
      'DROP COLUMN "deliveryCompletedAt"',
      'DROP COLUMN "releasedAt"',
      'DROP COLUMN "deliveryMode"',
      'DROP COLUMN "deliveryTokenCiphertext"',
      'DROP TYPE "OrganizationInvitationDeliveryJobStatus"',
      'DROP TYPE "InvitationDeliveryMode"',
    ];
    let previousOffset = -1;
    for (const artifact of ordered) {
      const offset = rollback.indexOf(artifact);
      assert.ok(offset > previousOffset, `${artifact} must be removed in dependency order`);
      previousOffset = offset;
    }
  });
});
