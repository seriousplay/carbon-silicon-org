ALTER TABLE "organization_invitations" DROP CONSTRAINT IF EXISTS "organization_invitations_consumedById_fkey";
ALTER TABLE "organization_invitations" DROP CONSTRAINT IF EXISTS "organization_invitations_createdById_organizationId_fkey";
ALTER TABLE "organization_invitations" DROP CONSTRAINT IF EXISTS "organization_invitations_homeCircleId_organizationId_fkey";
ALTER TABLE "organization_invitations" DROP CONSTRAINT IF EXISTS "organization_invitations_organizationId_fkey";
ALTER TABLE "meetings" DROP CONSTRAINT IF EXISTS "meetings_endedById_organizationId_fkey";
DROP TABLE IF EXISTS "organization_invitations";
ALTER TABLE "meetings" DROP COLUMN IF EXISTS "endedById";
ALTER TABLE "meetings" DROP COLUMN IF EXISTS "endedAt";
ALTER TABLE "meetings" DROP COLUMN IF EXISTS "notesRevision";
