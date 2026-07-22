DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "governance_decision_processes" WHERE "provenanceKind" = 'ORDINARY_TENSION') THEN
    RAISE EXCEPTION 'Rollback blocked: canonical ordinary governance history requires forward correction';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "governance_decision_operations"
    GROUP BY "mutationKey"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Rollback blocked: cross-organization governance mutation key reuse cannot satisfy the former global constraint';
  END IF;
END $$;

DROP INDEX "governance_decision_operations_organizationId_mutationKey_key";
CREATE UNIQUE INDEX "governance_decision_operations_mutationKey_key" ON "governance_decision_operations"("mutationKey");
DROP INDEX "governance_decision_processes_organizationId_provenanceKind_idx";
ALTER TABLE "governance_decision_processes"
  DROP CONSTRAINT "governance_decision_processes_provenance_check",
  ALTER COLUMN "runId" SET NOT NULL,
  ALTER COLUMN "sourceTensionArtifactId" SET NOT NULL,
  ALTER COLUMN "proposalArtifactId" SET NOT NULL,
  ALTER COLUMN "routeArtifactId" SET NOT NULL,
  DROP COLUMN "provenanceKind";
DROP TYPE "GovernanceDecisionProvenanceKind";
