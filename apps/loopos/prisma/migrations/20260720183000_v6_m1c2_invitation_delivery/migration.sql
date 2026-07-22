BEGIN;

CREATE TYPE "InvitationDeliveryMode" AS ENUM ('HELD', 'IMMEDIATE');
CREATE TYPE "OrganizationInvitationDeliveryJobStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'SENT',
  'FAILED',
  'CANCELLED'
);

ALTER TABLE "organization_invitations"
  ADD COLUMN "deliveryTokenCiphertext" TEXT,
  ADD COLUMN "deliveryMode" "InvitationDeliveryMode",
  ADD COLUMN "releasedAt" TIMESTAMP(3),
  ADD COLUMN "deliveryCompletedAt" TIMESTAMP(3);

-- Historical invitations predate delivery orchestration. Mark them complete
-- without creating jobs so this migration can never trigger retroactive sends.
UPDATE "organization_invitations"
SET
  "deliveryMode" = 'IMMEDIATE',
  "releasedAt" = "createdAt",
  "deliveryCompletedAt" = "createdAt";

ALTER TABLE "organization_invitations"
  ALTER COLUMN "deliveryMode" SET NOT NULL,
  ALTER COLUMN "deliveryMode" SET DEFAULT 'HELD';

ALTER TABLE "organization_invitations"
  ADD CONSTRAINT "organization_invitations_delivery_lifecycle_check" CHECK (
    (
      "deliveryMode" = 'HELD'
      AND "releasedAt" IS NULL
      AND "deliveryCompletedAt" IS NULL
    )
    OR (
      "deliveryMode" = 'IMMEDIATE'
      AND "releasedAt" IS NOT NULL
      AND (
        "deliveryCompletedAt" IS NULL
        OR "deliveryCompletedAt" >= "releasedAt"
      )
    )
  ),
  ADD CONSTRAINT "organization_invitations_delivery_token_envelope_check" CHECK (
    (
      "deliveryCompletedAt" IS NOT NULL
      AND "deliveryTokenCiphertext" IS NULL
    )
    OR (
      "deliveryTokenCiphertext" IS NOT NULL
      AND length("deliveryTokenCiphertext") BETWEEN 44 AND 2048
      AND "deliveryTokenCiphertext" ~ '^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{22}$'
      AND length(split_part("deliveryTokenCiphertext", '.', 3)) BETWEEN 2 AND 1366
      AND "deliveryTokenCiphertext" <> "tokenHash"
    )
  );

CREATE UNIQUE INDEX "organization_invitations_id_organizationId_key"
  ON "organization_invitations"("id", "organizationId");

CREATE TABLE "organization_invitation_delivery_jobs" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "invitationId" TEXT NOT NULL,
  "status" "OrganizationInvitationDeliveryJobStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseToken" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "organization_invitation_delivery_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_invitation_delivery_jobs_attempt_count_check" CHECK (
    "attemptCount" >= 0 AND "attemptCount" <= "maxAttempts"
  ),
  CONSTRAINT "organization_invitation_delivery_jobs_max_attempts_check" CHECK (
    "maxAttempts" BETWEEN 1 AND 100
  ),
  CONSTRAINT "organization_invitation_delivery_jobs_lease_token_check" CHECK (
    "leaseToken" IS NULL
    OR (
      length("leaseToken") BETWEEN 1 AND 128
      AND btrim("leaseToken") = "leaseToken"
    )
  ),
  CONSTRAINT "organization_invitation_delivery_jobs_error_code_check" CHECK (
    "lastErrorCode" IS NULL
    OR (
      length("lastErrorCode") BETWEEN 1 AND 64
      AND "lastErrorCode" ~ '^[A-Z][A-Z0-9_]*$'
    )
  ),
  CONSTRAINT "organization_invitation_delivery_jobs_status_check" CHECK (
    (
      "status" = 'PENDING'
      AND "attemptCount" >= 0
      AND "leaseToken" IS NULL
      AND "leaseExpiresAt" IS NULL
      AND "lastErrorCode" IS NULL
      AND "sentAt" IS NULL
    )
    OR (
      "status" = 'PROCESSING'
      AND "attemptCount" >= 1
      AND "leaseToken" IS NOT NULL
      AND "leaseExpiresAt" IS NOT NULL
      AND "lastErrorCode" IS NULL
      AND "sentAt" IS NULL
    )
    OR (
      "status" = 'SENT'
      AND "attemptCount" >= 1
      AND "leaseToken" IS NULL
      AND "leaseExpiresAt" IS NULL
      AND "lastErrorCode" IS NULL
      AND "sentAt" IS NOT NULL
    )
    OR (
      "status" = 'FAILED'
      AND "attemptCount" >= 1
      AND "leaseToken" IS NULL
      AND "leaseExpiresAt" IS NULL
      AND "lastErrorCode" IS NOT NULL
      AND "sentAt" IS NULL
    )
    OR (
      "status" = 'CANCELLED'
      AND "leaseToken" IS NULL
      AND "leaseExpiresAt" IS NULL
      AND "lastErrorCode" = 'INVITATION_UNAVAILABLE'
      AND "sentAt" IS NULL
    )
  ),
  CONSTRAINT "organization_invitation_delivery_jobs_organization_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "organization_invitation_delivery_jobs_invitation_tenant_fkey"
    FOREIGN KEY ("invitationId", "organizationId")
    REFERENCES "organization_invitations"("id", "organizationId")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "organization_invitation_delivery_jobs_invitationId_key"
  ON "organization_invitation_delivery_jobs"("invitationId");
CREATE UNIQUE INDEX "organization_invitation_delivery_jobs_invitationId_organizationId_key"
  ON "organization_invitation_delivery_jobs"("invitationId", "organizationId");
CREATE INDEX "organization_invitation_delivery_jobs_org_status_available_idx"
  ON "organization_invitation_delivery_jobs"("organizationId", "status", "availableAt");
CREATE INDEX "organization_invitation_delivery_jobs_status_lease_idx"
  ON "organization_invitation_delivery_jobs"("status", "leaseExpiresAt");

REVOKE ALL ON TABLE "organization_invitation_delivery_jobs" FROM PUBLIC;

COMMIT;
