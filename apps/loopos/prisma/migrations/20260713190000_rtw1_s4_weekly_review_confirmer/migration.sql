ALTER TABLE "governance_logs"
ADD COLUMN "confirmedById" TEXT;

CREATE INDEX "governance_logs_organizationId_confirmedById_idx"
ON "governance_logs"("organizationId", "confirmedById");

ALTER TABLE "governance_logs"
ADD CONSTRAINT "governance_logs_confirmedById_organizationId_fkey"
FOREIGN KEY ("confirmedById", "organizationId")
REFERENCES "people"("id", "organizationId")
ON DELETE RESTRICT ON UPDATE CASCADE;
