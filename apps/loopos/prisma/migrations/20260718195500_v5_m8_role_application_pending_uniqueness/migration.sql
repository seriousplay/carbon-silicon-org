DROP INDEX IF EXISTS "role_assignment_applications_roleId_applicantId_status_key";

CREATE UNIQUE INDEX IF NOT EXISTS "role_assignment_applications_one_pending_key"
  ON "role_assignment_applications"("roleId", "applicantId")
  WHERE "status" = 'PENDING';
