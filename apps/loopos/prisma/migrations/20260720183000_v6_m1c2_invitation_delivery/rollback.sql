BEGIN;

DROP INDEX "organization_invitation_delivery_jobs_status_lease_idx";
DROP INDEX "organization_invitation_delivery_jobs_org_status_available_idx";
DROP INDEX "organization_invitation_delivery_jobs_invitationId_organizationId_key";
DROP INDEX "organization_invitation_delivery_jobs_invitationId_key";
DROP TABLE "organization_invitation_delivery_jobs";

DROP INDEX "organization_invitations_id_organizationId_key";

ALTER TABLE "organization_invitations"
  DROP CONSTRAINT "organization_invitations_delivery_lifecycle_check",
  DROP CONSTRAINT "organization_invitations_delivery_token_envelope_check",
  DROP COLUMN "deliveryCompletedAt",
  DROP COLUMN "releasedAt",
  DROP COLUMN "deliveryMode",
  DROP COLUMN "deliveryTokenCiphertext";

DROP TYPE "OrganizationInvitationDeliveryJobStatus";
DROP TYPE "InvitationDeliveryMode";

COMMIT;
