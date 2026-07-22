ALTER TABLE "governance_decision_processes"
  ADD COLUMN "outcomeObjectId" TEXT,
  ADD COLUMN "outcomeChangeType" TEXT;

CREATE INDEX "governance_decision_processes_organizationId_outcomeChangeType_idx"
  ON "governance_decision_processes"("organizationId", "outcomeChangeType");
