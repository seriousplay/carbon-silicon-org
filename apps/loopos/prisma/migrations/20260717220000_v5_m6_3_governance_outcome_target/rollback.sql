DROP INDEX IF EXISTS "governance_decision_processes_organizationId_outcomeChangeType_idx";
ALTER TABLE "governance_decision_processes"
  DROP COLUMN IF EXISTS "outcomeObjectId",
  DROP COLUMN IF EXISTS "outcomeChangeType";
