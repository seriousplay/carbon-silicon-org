CREATE TYPE "TensionHandlingMode" AS ENUM ('UNROUTED', 'TACTICAL', 'GOVERNANCE');
CREATE TYPE "TacticalOutcomeProvenanceKind" AS ENUM ('ORDINARY_TENSION', 'INTERFACE_RUN');

ALTER TABLE "tensions"
  ADD COLUMN "handlingMode" "TensionHandlingMode" NOT NULL DEFAULT 'UNROUTED',
  ADD COLUMN "aiHandlingSuggestion" "TensionHandlingMode";

ALTER TABLE "tactical_outcome_proposals"
  ADD COLUMN "provenanceKind" "TacticalOutcomeProvenanceKind";

UPDATE "tactical_outcome_proposals" SET "provenanceKind" = 'INTERFACE_RUN';

ALTER TABLE "tactical_outcome_proposals"
  ALTER COLUMN "provenanceKind" SET NOT NULL,
  ALTER COLUMN "runId" DROP NOT NULL,
  ALTER COLUMN "sourceTensionArtifactId" DROP NOT NULL,
  ALTER COLUMN "routeArtifactId" DROP NOT NULL,
  ADD CONSTRAINT "tactical_outcome_proposals_provenance_check" CHECK (
    ("provenanceKind" = 'INTERFACE_RUN' AND "runId" IS NOT NULL AND "sourceTensionArtifactId" IS NOT NULL AND "routeArtifactId" IS NOT NULL)
    OR
    ("provenanceKind" = 'ORDINARY_TENSION' AND "runId" IS NULL AND "sourceTensionArtifactId" IS NULL AND "routeArtifactId" IS NULL)
  );

DROP INDEX "tactical_outcome_proposals_lastMutationKey_key";
CREATE UNIQUE INDEX "tactical_outcome_proposals_organizationId_lastMutationKey_key"
  ON "tactical_outcome_proposals"("organizationId", "lastMutationKey");

ALTER TABLE "projects"
  ADD COLUMN "completedById" TEXT,
  ADD CONSTRAINT "projects_completedById_organizationId_fkey" FOREIGN KEY ("completedById", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "tensions_organizationId_handlingMode_status_idx" ON "tensions"("organizationId", "handlingMode", "status");
CREATE INDEX "tactical_outcome_proposals_organizationId_provenanceKind_idx" ON "tactical_outcome_proposals"("organizationId", "provenanceKind");
