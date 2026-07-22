DROP INDEX IF EXISTS "tactical_outcome_proposals_organizationId_provenanceKind_idx";
DROP INDEX IF EXISTS "tensions_organizationId_handlingMode_status_idx";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "tactical_outcome_proposals" WHERE "provenanceKind" = 'ORDINARY_TENSION') THEN
    RAISE EXCEPTION 'Rollback blocked: accepted ordinary tactical outcomes require a forward compatibility migration';
  END IF;
END $$;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "tactical_outcome_proposals"
    WHERE "lastMutationKey" IS NOT NULL
    GROUP BY "lastMutationKey"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Rollback blocked: duplicate mutation keys across organizations cannot satisfy the former global unique constraint';
  END IF;
END $$;
DROP INDEX "tactical_outcome_proposals_organizationId_lastMutationKey_key";
CREATE UNIQUE INDEX "tactical_outcome_proposals_lastMutationKey_key" ON "tactical_outcome_proposals"("lastMutationKey");
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_completedById_organizationId_fkey", DROP COLUMN "completedById";
ALTER TABLE "tactical_outcome_proposals" DROP CONSTRAINT IF EXISTS "tactical_outcome_proposals_provenance_check";
ALTER TABLE "tactical_outcome_proposals" ALTER COLUMN "runId" SET NOT NULL, ALTER COLUMN "sourceTensionArtifactId" SET NOT NULL, ALTER COLUMN "routeArtifactId" SET NOT NULL, DROP COLUMN "provenanceKind";
ALTER TABLE "tensions" DROP COLUMN "aiHandlingSuggestion", DROP COLUMN "handlingMode";
DROP TYPE "TacticalOutcomeProvenanceKind";
DROP TYPE "TensionHandlingMode";
