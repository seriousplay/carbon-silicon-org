ALTER TYPE "RoleAssignmentApplicationStatus" ADD VALUE IF NOT EXISTS 'NOMINATED';

ALTER TABLE "role_assignment_applications"
  ADD COLUMN "nominatedAt" TIMESTAMP(3),
  ADD COLUMN "nominatedById" TEXT;

ALTER TABLE "role_assignment_applications"
  ADD CONSTRAINT "role_assignment_applications_nominatedById_organizationId_fkey"
  FOREIGN KEY ("nominatedById", "organizationId")
  REFERENCES "people"("id", "organizationId") ON DELETE SET NULL ON UPDATE CASCADE;
