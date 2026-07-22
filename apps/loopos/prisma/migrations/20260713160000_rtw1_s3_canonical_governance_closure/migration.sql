CREATE TYPE "GovernanceDecisionProvenanceKind" AS ENUM ('ORDINARY_TENSION', 'INTERFACE_RUN');

ALTER TABLE "governance_decision_processes"
  ADD COLUMN "provenanceKind" "GovernanceDecisionProvenanceKind";

UPDATE "governance_decision_processes" SET "provenanceKind" = 'INTERFACE_RUN';

ALTER TABLE "governance_decision_processes"
  ALTER COLUMN "provenanceKind" SET NOT NULL,
  ALTER COLUMN "runId" DROP NOT NULL,
  ALTER COLUMN "sourceTensionArtifactId" DROP NOT NULL,
  ALTER COLUMN "proposalArtifactId" DROP NOT NULL,
  ALTER COLUMN "routeArtifactId" DROP NOT NULL,
  ADD CONSTRAINT "governance_decision_processes_provenance_check" CHECK (
    ("provenanceKind" = 'INTERFACE_RUN' AND "runId" IS NOT NULL AND "sourceTensionArtifactId" IS NOT NULL AND "proposalArtifactId" IS NOT NULL AND "routeArtifactId" IS NOT NULL)
    OR
    ("provenanceKind" = 'ORDINARY_TENSION' AND "runId" IS NULL AND "sourceTensionArtifactId" IS NULL AND "proposalArtifactId" IS NULL AND "routeArtifactId" IS NULL)
  );

CREATE INDEX "governance_decision_processes_organizationId_provenanceKind_idx"
  ON "governance_decision_processes"("organizationId", "provenanceKind");

DROP INDEX "governance_decision_operations_mutationKey_key";
CREATE UNIQUE INDEX "governance_decision_operations_organizationId_mutationKey_key"
  ON "governance_decision_operations"("organizationId", "mutationKey");
