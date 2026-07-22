CREATE TYPE "TacticalOutcomeKind" AS ENUM ('PROJECT', 'ACTION');
CREATE TYPE "TacticalOutcomeProposalStatus" AS ENUM ('PROPOSED', 'RETURNED', 'REJECTED', 'APPROVED');

CREATE UNIQUE INDEX "circles_id_organizationId_key" ON "circles"("id", "organizationId");
CREATE UNIQUE INDEX "tensions_id_organizationId_key" ON "tensions"("id", "organizationId");
CREATE UNIQUE INDEX "meetings_id_organizationId_key" ON "meetings"("id", "organizationId");
CREATE UNIQUE INDEX "projects_id_organizationId_key" ON "projects"("id", "organizationId");
CREATE UNIQUE INDEX "interface_workflow_artifacts_id_organizationId_runId_key"
  ON "interface_workflow_artifacts"("id", "organizationId", "runId");

CREATE TABLE "tactical_outcome_proposals" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "tensionId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "sourceTensionArtifactId" TEXT NOT NULL,
  "routeArtifactId" TEXT NOT NULL,
  "proposerId" TEXT NOT NULL,
  "kind" "TacticalOutcomeKind" NOT NULL,
  "title" TEXT NOT NULL,
  "expectedResult" TEXT,
  "acceptanceCriteria" TEXT,
  "circleId" TEXT NOT NULL,
  "responsiblePersonId" TEXT NOT NULL,
  "deadline" TIMESTAMP(3),
  "status" "TacticalOutcomeProposalStatus" NOT NULL DEFAULT 'PROPOSED',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "recordedById" TEXT,
  "meetingDecisionNote" TEXT,
  "recordedAt" TIMESTAMP(3),
  "outcomeProjectId" TEXT,
  "outcomeActionId" TEXT,
  "lastMutationKey" TEXT,
  "lastMutationResult" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tactical_outcome_proposals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tactical_outcome_proposals_revision_check" CHECK ("revision" >= 1),
  CONSTRAINT "tactical_outcome_proposals_content_check" CHECK (
    ("kind" = 'PROJECT' AND length(btrim("title")) > 0 AND "expectedResult" IS NOT NULL AND length(btrim("expectedResult")) > 0 AND "acceptanceCriteria" IS NULL AND "deadline" IS NULL)
    OR
    ("kind" = 'ACTION' AND length(btrim("title")) > 0 AND "expectedResult" IS NULL AND "acceptanceCriteria" IS NOT NULL AND length(btrim("acceptanceCriteria")) > 0)
  ),
  CONSTRAINT "tactical_outcome_proposals_result_check" CHECK (
    ("status" = 'PROPOSED' AND "recordedById" IS NULL AND "recordedAt" IS NULL AND "meetingDecisionNote" IS NULL AND "outcomeProjectId" IS NULL AND "outcomeActionId" IS NULL)
    OR
    ("status" IN ('RETURNED', 'REJECTED') AND "recordedById" IS NOT NULL AND "recordedAt" IS NOT NULL AND "meetingDecisionNote" IS NOT NULL AND length(btrim("meetingDecisionNote")) > 0 AND "outcomeProjectId" IS NULL AND "outcomeActionId" IS NULL)
    OR
    ("status" = 'APPROVED' AND "recordedById" IS NOT NULL AND "recordedAt" IS NOT NULL AND (("kind" = 'PROJECT' AND "outcomeProjectId" IS NOT NULL AND "outcomeActionId" IS NULL) OR ("kind" = 'ACTION' AND "outcomeActionId" IS NOT NULL AND "outcomeProjectId" IS NULL)))
  ),
  CONSTRAINT "tactical_outcome_proposals_mutation_result_check" CHECK (
    ("lastMutationKey" IS NULL AND "lastMutationResult" IS NULL)
    OR ("lastMutationKey" IS NOT NULL AND "lastMutationResult" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "tactical_outcome_proposals_tensionId_key" ON "tactical_outcome_proposals"("tensionId");
CREATE UNIQUE INDEX "tactical_outcome_proposals_outcomeProjectId_key" ON "tactical_outcome_proposals"("outcomeProjectId");
CREATE UNIQUE INDEX "tactical_outcome_proposals_outcomeActionId_key" ON "tactical_outcome_proposals"("outcomeActionId");
CREATE UNIQUE INDEX "tactical_outcome_proposals_lastMutationKey_key" ON "tactical_outcome_proposals"("lastMutationKey");
CREATE UNIQUE INDEX "tactical_outcome_proposals_tensionId_organizationId_key" ON "tactical_outcome_proposals"("tensionId", "organizationId");
CREATE UNIQUE INDEX "tactical_outcome_proposals_outcomeProjectId_organizationId_key" ON "tactical_outcome_proposals"("outcomeProjectId", "organizationId");
CREATE UNIQUE INDEX "tactical_outcome_proposals_outcomeActionId_organizationId_key" ON "tactical_outcome_proposals"("outcomeActionId", "organizationId");
CREATE INDEX "tactical_outcome_proposals_organizationId_meetingId_status_idx" ON "tactical_outcome_proposals"("organizationId", "meetingId", "status");
CREATE INDEX "tactical_outcome_proposals_organizationId_proposerId_idx" ON "tactical_outcome_proposals"("organizationId", "proposerId");
CREATE INDEX "tactical_outcome_proposals_organizationId_responsiblePersonId_idx" ON "tactical_outcome_proposals"("organizationId", "responsiblePersonId");
CREATE INDEX "tactical_outcome_proposals_organizationId_runId_idx" ON "tactical_outcome_proposals"("organizationId", "runId");

ALTER TABLE "tactical_outcome_proposals" ADD CONSTRAINT "tactical_outcome_proposals_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tactical_outcome_proposals" ADD CONSTRAINT "tactical_outcome_proposals_tensionId_organizationId_fkey" FOREIGN KEY ("tensionId", "organizationId") REFERENCES "tensions"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tactical_outcome_proposals" ADD CONSTRAINT "tactical_outcome_proposals_runId_organizationId_fkey" FOREIGN KEY ("runId", "organizationId") REFERENCES "interface_workflow_runs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tactical_outcome_proposals" ADD CONSTRAINT "tactical_outcome_proposals_meetingId_organizationId_fkey" FOREIGN KEY ("meetingId", "organizationId") REFERENCES "meetings"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tactical_outcome_proposals" ADD CONSTRAINT "tactical_outcome_proposals_sourceArtifact_fkey" FOREIGN KEY ("sourceTensionArtifactId", "organizationId", "runId") REFERENCES "interface_workflow_artifacts"("id", "organizationId", "runId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tactical_outcome_proposals" ADD CONSTRAINT "tactical_outcome_proposals_routeArtifact_fkey" FOREIGN KEY ("routeArtifactId", "organizationId", "runId") REFERENCES "interface_workflow_artifacts"("id", "organizationId", "runId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tactical_outcome_proposals" ADD CONSTRAINT "tactical_outcome_proposals_proposerId_organizationId_fkey" FOREIGN KEY ("proposerId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tactical_outcome_proposals" ADD CONSTRAINT "tactical_outcome_proposals_recordedById_organizationId_fkey" FOREIGN KEY ("recordedById", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tactical_outcome_proposals" ADD CONSTRAINT "tactical_outcome_proposals_circleId_organizationId_fkey" FOREIGN KEY ("circleId", "organizationId") REFERENCES "circles"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tactical_outcome_proposals" ADD CONSTRAINT "tactical_outcome_proposals_responsiblePersonId_organizationId_fkey" FOREIGN KEY ("responsiblePersonId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tactical_outcome_proposals" ADD CONSTRAINT "tactical_outcome_proposals_outcomeProjectId_organizationId_fkey" FOREIGN KEY ("outcomeProjectId", "organizationId") REFERENCES "projects"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tactical_outcome_proposals" ADD CONSTRAINT "tactical_outcome_proposals_outcomeActionId_organizationId_fkey" FOREIGN KEY ("outcomeActionId", "organizationId") REFERENCES "tensions"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reviewed rollback (execute in this reverse order):
-- DROP TABLE "tactical_outcome_proposals";
-- DROP INDEX "interface_workflow_artifacts_id_organizationId_runId_key";
-- DROP INDEX "projects_id_organizationId_key";
-- DROP INDEX "meetings_id_organizationId_key";
-- DROP INDEX "tensions_id_organizationId_key";
-- DROP INDEX "circles_id_organizationId_key";
-- DROP TYPE "TacticalOutcomeProposalStatus";
-- DROP TYPE "TacticalOutcomeKind";
