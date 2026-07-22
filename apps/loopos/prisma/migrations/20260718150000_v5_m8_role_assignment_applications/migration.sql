CREATE TYPE "RoleAssignmentApplicationStatus" AS ENUM ('PENDING', 'WITHDRAWN', 'REJECTED', 'ACCEPTED');

CREATE TABLE "role_assignment_applications" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "status" "RoleAssignmentApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "motivation" TEXT NOT NULL,
    "capabilitySummary" TEXT NOT NULL,
    "commitment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "withdrawnAt" TIMESTAMP(3),

    CONSTRAINT "role_assignment_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "role_assignment_applications_roleId_applicantId_status_key"
  ON "role_assignment_applications"("roleId", "applicantId", "status");
CREATE INDEX "role_assignment_applications_organizationId_status_createdAt_idx"
  ON "role_assignment_applications"("organizationId", "status", "createdAt");
CREATE INDEX "role_assignment_applications_roleId_status_createdAt_idx"
  ON "role_assignment_applications"("roleId", "status", "createdAt");

ALTER TABLE "role_assignment_applications"
  ADD CONSTRAINT "role_assignment_applications_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_assignment_applications"
  ADD CONSTRAINT "role_assignment_applications_roleId_organizationId_fkey"
  FOREIGN KEY ("roleId", "organizationId") REFERENCES "role_defs"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_assignment_applications"
  ADD CONSTRAINT "role_assignment_applications_applicantId_organizationId_fkey"
  FOREIGN KEY ("applicantId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
