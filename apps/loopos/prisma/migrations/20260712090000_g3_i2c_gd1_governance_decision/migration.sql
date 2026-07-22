-- CreateEnum
CREATE TYPE "GovernanceDecisionProcessState" AS ENUM ('READY', 'CLARIFICATION_REQUIRED', 'OBJECTION_PENDING', 'AMENDMENT_REQUIRED', 'NOT_ADOPTED', 'ADOPTED');

-- CreateEnum
CREATE TYPE "GovernanceProposalRevisionSource" AS ENUM ('INITIAL', 'CLARIFICATION', 'AMENDMENT');

-- CreateEnum
CREATE TYPE "GovernanceDecisionOperationKind" AS ENUM ('INITIALIZE', 'SUBMIT_REVISION', 'REQUEST_CLARIFICATION', 'RAISE_OBJECTION', 'ASSESS_OBJECTION', 'RECORD_NON_ADOPTION', 'ADOPT_ROLE');

-- CreateEnum
CREATE TYPE "GovernanceDecisionOperationStatus" AS ENUM ('PROCESSING', 'FAILED', 'SUCCEEDED');

-- AlterEnum
ALTER TYPE "InterfaceWorkflowArtifactType" ADD VALUE 'ROLE';

-- CreateTable
CREATE TABLE "governance_decision_processes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "sourceTensionId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "sourceTensionArtifactId" TEXT NOT NULL,
    "proposalArtifactId" TEXT NOT NULL,
    "routeArtifactId" TEXT NOT NULL,
    "proposerId" TEXT NOT NULL,
    "state" "GovernanceDecisionProcessState" NOT NULL DEFAULT 'READY',
    "currentRevision" INTEGER NOT NULL DEFAULT 1,
    "currentRevisionId" TEXT,
    "activeClarification" JSONB,
    "activeObjection" JSONB,
    "activeObjectionSequence" INTEGER,
    "recordedById" TEXT,
    "recordedAt" TIMESTAMP(3),
    "resultNote" TEXT,
    "outcomeRoleId" TEXT,
    "decisionId" TEXT,
    "changeLogId" TEXT,
    "applicationAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastApplicationError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "governance_decision_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance_proposal_revisions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "authoredById" TEXT NOT NULL,
    "currentStructure" TEXT NOT NULL,
    "proposedStructure" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "expectedImpact" TEXT NOT NULL,
    "typedChange" JSONB NOT NULL,
    "sourceKind" "GovernanceProposalRevisionSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "governance_proposal_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance_decision_operations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "processId" TEXT,
    "meetingId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "operation" "GovernanceDecisionOperationKind" NOT NULL,
    "operationScope" TEXT NOT NULL,
    "mutationKey" TEXT NOT NULL,
    "canonicalPayloadHash" TEXT NOT NULL,
    "status" "GovernanceDecisionOperationStatus" NOT NULL DEFAULT 'PROCESSING',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "leaseToken" TEXT NOT NULL,
    "leaseExpiresAt" TIMESTAMP(3) NOT NULL,
    "failureCode" TEXT,
    "resultEnvelope" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "governance_decision_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "governance_decision_processes_proposalId_key" ON "governance_decision_processes"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "governance_decision_processes_outcomeRoleId_key" ON "governance_decision_processes"("outcomeRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "governance_decision_processes_decisionId_key" ON "governance_decision_processes"("decisionId");

-- CreateIndex
CREATE UNIQUE INDEX "governance_decision_processes_changeLogId_key" ON "governance_decision_processes"("changeLogId");

-- CreateIndex
CREATE INDEX "governance_decision_processes_organizationId_meetingId_stat_idx" ON "governance_decision_processes"("organizationId", "meetingId", "state");

-- CreateIndex
CREATE INDEX "governance_decision_processes_organizationId_runId_idx" ON "governance_decision_processes"("organizationId", "runId");

-- CreateIndex
CREATE INDEX "governance_decision_processes_proposerId_organizationId_idx" ON "governance_decision_processes"("proposerId", "organizationId");

-- CreateIndex
CREATE INDEX "governance_decision_processes_recordedById_organizationId_idx" ON "governance_decision_processes"("recordedById", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "governance_decision_processes_id_organizationId_key" ON "governance_decision_processes"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "governance_decision_processes_id_proposalId_organizationId_key" ON "governance_decision_processes"("id", "proposalId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "governance_decision_processes_proposalId_organizationId_key" ON "governance_decision_processes"("proposalId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "governance_decision_processes_currentRevisionId_id_proposal_key" ON "governance_decision_processes"("currentRevisionId", "id", "proposalId", "organizationId", "currentRevision");

-- CreateIndex
CREATE UNIQUE INDEX "governance_decision_processes_outcomeRoleId_organizationId_key" ON "governance_decision_processes"("outcomeRoleId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "governance_decision_processes_decisionId_organizationId_key" ON "governance_decision_processes"("decisionId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "governance_decision_processes_changeLogId_organizationId_key" ON "governance_decision_processes"("changeLogId", "organizationId");

-- CreateIndex
CREATE INDEX "governance_proposal_revisions_organizationId_proposalId_idx" ON "governance_proposal_revisions"("organizationId", "proposalId");

-- CreateIndex
CREATE INDEX "governance_proposal_revisions_authoredById_organizationId_idx" ON "governance_proposal_revisions"("authoredById", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "governance_proposal_revisions_processId_revision_key" ON "governance_proposal_revisions"("processId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "governance_proposal_revisions_proposalId_revision_key" ON "governance_proposal_revisions"("proposalId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "governance_proposal_revisions_id_processId_proposalId_organ_key" ON "governance_proposal_revisions"("id", "processId", "proposalId", "organizationId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "governance_decision_operations_mutationKey_key" ON "governance_decision_operations"("mutationKey");

-- CreateIndex
CREATE INDEX "governance_decision_operations_status_leaseExpiresAt_idx" ON "governance_decision_operations"("status", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "governance_decision_operations_organizationId_meetingId_ope_idx" ON "governance_decision_operations"("organizationId", "meetingId", "operation");

-- CreateIndex
CREATE INDEX "governance_decision_operations_organizationId_proposalId_idx" ON "governance_decision_operations"("organizationId", "proposalId");

-- CreateIndex
CREATE INDEX "governance_decision_operations_processId_organizationId_idx" ON "governance_decision_operations"("processId", "organizationId");

-- CreateIndex
CREATE INDEX "governance_decision_operations_actorId_organizationId_idx" ON "governance_decision_operations"("actorId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "governance_decision_operations_organizationId_proposalId_me_key" ON "governance_decision_operations"("organizationId", "proposalId", "meetingId", "revision", "operation", "operationScope");

-- CreateIndex
CREATE UNIQUE INDEX "change_logs_id_organizationId_key" ON "change_logs"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "decision_records_id_organizationId_key" ON "decision_records"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "governance_proposals_id_organizationId_key" ON "governance_proposals"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "governance_decision_processes" ADD CONSTRAINT "governance_decision_processes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_decision_processes" ADD CONSTRAINT "governance_decision_processes_proposalId_organizationId_fkey" FOREIGN KEY ("proposalId", "organizationId") REFERENCES "governance_proposals"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_decision_processes" ADD CONSTRAINT "governance_decision_processes_sourceTensionId_organization_fkey" FOREIGN KEY ("sourceTensionId", "organizationId") REFERENCES "tensions"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_decision_processes" ADD CONSTRAINT "governance_decision_processes_runId_organizationId_fkey" FOREIGN KEY ("runId", "organizationId") REFERENCES "interface_workflow_runs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_decision_processes" ADD CONSTRAINT "governance_decision_processes_meetingId_organizationId_fkey" FOREIGN KEY ("meetingId", "organizationId") REFERENCES "meetings"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_decision_processes" ADD CONSTRAINT "governance_decision_processes_sourceTensionArtifactId_orga_fkey" FOREIGN KEY ("sourceTensionArtifactId", "organizationId", "runId") REFERENCES "interface_workflow_artifacts"("id", "organizationId", "runId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_decision_processes" ADD CONSTRAINT "governance_decision_processes_proposalArtifactId_organizat_fkey" FOREIGN KEY ("proposalArtifactId", "organizationId", "runId") REFERENCES "interface_workflow_artifacts"("id", "organizationId", "runId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_decision_processes" ADD CONSTRAINT "governance_decision_processes_routeArtifactId_organization_fkey" FOREIGN KEY ("routeArtifactId", "organizationId", "runId") REFERENCES "interface_workflow_artifacts"("id", "organizationId", "runId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_decision_processes" ADD CONSTRAINT "governance_decision_processes_proposerId_organizationId_fkey" FOREIGN KEY ("proposerId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_decision_processes" ADD CONSTRAINT "governance_decision_processes_currentRevisionId_id_proposa_fkey" FOREIGN KEY ("currentRevisionId", "id", "proposalId", "organizationId", "currentRevision") REFERENCES "governance_proposal_revisions"("id", "processId", "proposalId", "organizationId", "revision") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_decision_processes" ADD CONSTRAINT "governance_decision_processes_recordedById_organizationId_fkey" FOREIGN KEY ("recordedById", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_decision_processes" ADD CONSTRAINT "governance_decision_processes_outcomeRoleId_organizationId_fkey" FOREIGN KEY ("outcomeRoleId", "organizationId") REFERENCES "role_defs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_decision_processes" ADD CONSTRAINT "governance_decision_processes_decisionId_organizationId_fkey" FOREIGN KEY ("decisionId", "organizationId") REFERENCES "decision_records"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_decision_processes" ADD CONSTRAINT "governance_decision_processes_changeLogId_organizationId_fkey" FOREIGN KEY ("changeLogId", "organizationId") REFERENCES "change_logs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_proposal_revisions" ADD CONSTRAINT "governance_proposal_revisions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_proposal_revisions" ADD CONSTRAINT "governance_proposal_revisions_processId_proposalId_organiz_fkey" FOREIGN KEY ("processId", "proposalId", "organizationId") REFERENCES "governance_decision_processes"("id", "proposalId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_proposal_revisions" ADD CONSTRAINT "governance_proposal_revisions_proposalId_organizationId_fkey" FOREIGN KEY ("proposalId", "organizationId") REFERENCES "governance_proposals"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_proposal_revisions" ADD CONSTRAINT "governance_proposal_revisions_authoredById_organizationId_fkey" FOREIGN KEY ("authoredById", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_decision_operations" ADD CONSTRAINT "governance_decision_operations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_decision_operations" ADD CONSTRAINT "governance_decision_operations_proposalId_organizationId_fkey" FOREIGN KEY ("proposalId", "organizationId") REFERENCES "governance_proposals"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_decision_operations" ADD CONSTRAINT "governance_decision_operations_processId_proposalId_organi_fkey" FOREIGN KEY ("processId", "proposalId", "organizationId") REFERENCES "governance_decision_processes"("id", "proposalId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_decision_operations" ADD CONSTRAINT "governance_decision_operations_meetingId_organizationId_fkey" FOREIGN KEY ("meetingId", "organizationId") REFERENCES "meetings"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_decision_operations" ADD CONSTRAINT "governance_decision_operations_actorId_organizationId_fkey" FOREIGN KEY ("actorId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Process state and outcome columns form a closed, database-enforced projection.
ALTER TABLE "governance_decision_processes"
  ADD CONSTRAINT "governance_decision_processes_currentRevision_check" CHECK ("currentRevision" > 0),
  ADD CONSTRAINT "governance_decision_processes_applicationAttempts_check" CHECK ("applicationAttempts" >= 0),
  ADD CONSTRAINT "governance_decision_processes_activeObjectionSequence_check" CHECK ("activeObjectionSequence" IS NULL OR "activeObjectionSequence" > 0),
  ADD CONSTRAINT "governance_decision_processes_lastApplicationError_check" CHECK ("lastApplicationError" IS NULL OR char_length("lastApplicationError") BETWEEN 1 AND 128),
  ADD CONSTRAINT "governance_decision_processes_state_projection_check" CHECK (
    (
      "state" = 'READY'
      AND "activeClarification" IS NULL AND "activeObjection" IS NULL AND "activeObjectionSequence" IS NULL
      AND "recordedById" IS NULL AND "recordedAt" IS NULL AND "resultNote" IS NULL
      AND "outcomeRoleId" IS NULL AND "decisionId" IS NULL AND "changeLogId" IS NULL
    ) OR (
      "state" = 'CLARIFICATION_REQUIRED'
      AND "activeClarification" IS NOT NULL AND jsonb_typeof("activeClarification") = 'object'
      AND "activeObjection" IS NULL AND "activeObjectionSequence" IS NULL
      AND "recordedById" IS NULL AND "recordedAt" IS NULL AND "resultNote" IS NULL
      AND "outcomeRoleId" IS NULL AND "decisionId" IS NULL AND "changeLogId" IS NULL
    ) OR (
      "state" IN ('OBJECTION_PENDING', 'AMENDMENT_REQUIRED')
      AND "activeClarification" IS NULL
      AND "activeObjection" IS NOT NULL AND jsonb_typeof("activeObjection") = 'object'
      AND "activeObjectionSequence" IS NOT NULL
      AND "recordedById" IS NULL AND "recordedAt" IS NULL AND "resultNote" IS NULL
      AND "outcomeRoleId" IS NULL AND "decisionId" IS NULL AND "changeLogId" IS NULL
    ) OR (
      "state" = 'NOT_ADOPTED'
      AND "activeClarification" IS NULL AND "activeObjection" IS NULL AND "activeObjectionSequence" IS NULL
      AND "recordedById" IS NOT NULL AND "recordedAt" IS NOT NULL
      AND "resultNote" IS NOT NULL AND btrim("resultNote") <> ''
      AND "outcomeRoleId" IS NULL AND "decisionId" IS NULL AND "changeLogId" IS NULL
    ) OR (
      "state" = 'ADOPTED'
      AND "activeClarification" IS NULL AND "activeObjection" IS NULL AND "activeObjectionSequence" IS NULL
      AND "recordedById" IS NOT NULL AND "recordedAt" IS NOT NULL
      AND "outcomeRoleId" IS NOT NULL AND "decisionId" IS NOT NULL AND "changeLogId" IS NOT NULL
    )
  );

ALTER TABLE "governance_proposal_revisions"
  ADD CONSTRAINT "governance_proposal_revisions_revision_check" CHECK ("revision" > 0),
  ADD CONSTRAINT "governance_proposal_revisions_complete_snapshot_check" CHECK (
    btrim("currentStructure") <> ''
    AND btrim("proposedStructure") <> ''
    AND btrim("rationale") <> ''
    AND btrim("expectedImpact") <> ''
    AND jsonb_typeof("typedChange") = 'object'
  );

ALTER TABLE "governance_decision_operations"
  ADD CONSTRAINT "governance_decision_operations_revision_check" CHECK ("revision" > 0),
  ADD CONSTRAINT "governance_decision_operations_attempt_check" CHECK ("attempt" > 0),
  ADD CONSTRAINT "governance_decision_operations_binding_text_check" CHECK (
    btrim("operationScope") <> '' AND btrim("mutationKey") <> ''
    AND btrim("canonicalPayloadHash") <> '' AND btrim("leaseToken") <> ''
  ),
  ADD CONSTRAINT "governance_decision_operations_init_process_check" CHECK (("operation" = 'INITIALIZE') = ("processId" IS NULL)),
  ADD CONSTRAINT "governance_decision_operations_status_envelope_check" CHECK (
    ("status" = 'PROCESSING' AND "failureCode" IS NULL AND "resultEnvelope" IS NULL)
    OR ("status" = 'FAILED' AND "failureCode" IS NOT NULL AND char_length("failureCode") BETWEEN 1 AND 128 AND "resultEnvelope" IS NULL)
    OR ("status" = 'SUCCEEDED' AND "failureCode" IS NULL AND "resultEnvelope" IS NOT NULL AND jsonb_typeof("resultEnvelope") = 'object')
  );

CREATE OR REPLACE FUNCTION enforce_governance_decision_process_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
     OR OLD."proposalId" IS DISTINCT FROM NEW."proposalId"
     OR OLD."sourceTensionId" IS DISTINCT FROM NEW."sourceTensionId"
     OR OLD."runId" IS DISTINCT FROM NEW."runId"
     OR OLD."meetingId" IS DISTINCT FROM NEW."meetingId"
     OR OLD."sourceTensionArtifactId" IS DISTINCT FROM NEW."sourceTensionArtifactId"
     OR OLD."proposalArtifactId" IS DISTINCT FROM NEW."proposalArtifactId"
     OR OLD."routeArtifactId" IS DISTINCT FROM NEW."routeArtifactId"
     OR OLD."proposerId" IS DISTINCT FROM NEW."proposerId"
     OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt" THEN
    RAISE EXCEPTION 'governance decision process provenance is immutable';
  END IF;
  IF OLD."outcomeRoleId" IS NOT NULL AND OLD."outcomeRoleId" IS DISTINCT FROM NEW."outcomeRoleId"
     OR OLD."decisionId" IS NOT NULL AND OLD."decisionId" IS DISTINCT FROM NEW."decisionId"
     OR OLD."changeLogId" IS NOT NULL AND OLD."changeLogId" IS DISTINCT FROM NEW."changeLogId" THEN
    RAISE EXCEPTION 'governance decision process outcomes are immutable once recorded';
  END IF;
  IF OLD."state" = 'ADOPTED' AND OLD IS DISTINCT FROM NEW THEN
    RAISE EXCEPTION 'adopted governance decision processes are terminal';
  END IF;

  IF OLD."state" = NEW."state" THEN
    IF OLD."state" = 'READY'
       AND OLD."currentRevision" = NEW."currentRevision"
       AND OLD."currentRevisionId" IS NULL
       AND NEW."currentRevisionId" IS NOT NULL
       AND OLD."activeClarification" IS NOT DISTINCT FROM NEW."activeClarification"
       AND OLD."activeObjection" IS NOT DISTINCT FROM NEW."activeObjection"
       AND OLD."activeObjectionSequence" IS NOT DISTINCT FROM NEW."activeObjectionSequence"
       AND OLD."recordedById" IS NOT DISTINCT FROM NEW."recordedById"
       AND OLD."recordedAt" IS NOT DISTINCT FROM NEW."recordedAt"
       AND OLD."resultNote" IS NOT DISTINCT FROM NEW."resultNote"
       AND OLD."outcomeRoleId" IS NOT DISTINCT FROM NEW."outcomeRoleId"
       AND OLD."decisionId" IS NOT DISTINCT FROM NEW."decisionId"
       AND OLD."changeLogId" IS NOT DISTINCT FROM NEW."changeLogId"
       AND OLD."applicationAttempts" = NEW."applicationAttempts"
       AND OLD."lastApplicationError" IS NOT DISTINCT FROM NEW."lastApplicationError" THEN
      RETURN NEW;
    END IF;

    IF OLD."state" = 'READY'
       AND OLD."currentRevision" = NEW."currentRevision"
       AND OLD."currentRevisionId" IS NOT DISTINCT FROM NEW."currentRevisionId"
       AND OLD."activeClarification" IS NOT DISTINCT FROM NEW."activeClarification"
       AND OLD."activeObjection" IS NOT DISTINCT FROM NEW."activeObjection"
       AND OLD."activeObjectionSequence" IS NOT DISTINCT FROM NEW."activeObjectionSequence"
       AND OLD."recordedById" IS NOT DISTINCT FROM NEW."recordedById"
       AND OLD."recordedAt" IS NOT DISTINCT FROM NEW."recordedAt"
       AND OLD."resultNote" IS NOT DISTINCT FROM NEW."resultNote"
       AND OLD."outcomeRoleId" IS NOT DISTINCT FROM NEW."outcomeRoleId"
       AND OLD."decisionId" IS NOT DISTINCT FROM NEW."decisionId"
       AND OLD."changeLogId" IS NOT DISTINCT FROM NEW."changeLogId"
       AND NEW."applicationAttempts" = OLD."applicationAttempts" + 1
       AND NEW."lastApplicationError" IS NOT NULL THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'same-state governance decision process rewrites are forbidden';
  END IF;

  IF OLD."applicationAttempts" IS DISTINCT FROM NEW."applicationAttempts"
     OR OLD."lastApplicationError" IS DISTINCT FROM NEW."lastApplicationError" THEN
    RAISE EXCEPTION 'governance state transitions cannot rewrite technical attempt projections';
  END IF;

  IF OLD."state" = 'READY'
     AND NEW."state" IN ('CLARIFICATION_REQUIRED', 'OBJECTION_PENDING', 'NOT_ADOPTED', 'ADOPTED') THEN
    IF NEW."currentRevision" <> OLD."currentRevision"
       OR OLD."currentRevisionId" IS DISTINCT FROM NEW."currentRevisionId" THEN
      RAISE EXCEPTION 'meeting-result governance transitions must keep the current revision';
    END IF;
  ELSIF OLD."state" = 'OBJECTION_PENDING'
        AND NEW."state" IN ('READY', 'AMENDMENT_REQUIRED') THEN
    IF NEW."currentRevision" <> OLD."currentRevision"
       OR OLD."currentRevisionId" IS DISTINCT FROM NEW."currentRevisionId" THEN
      RAISE EXCEPTION 'objection assessment transitions must keep the current revision';
    END IF;
  ELSIF OLD."state" = 'AMENDMENT_REQUIRED' AND NEW."state" = 'NOT_ADOPTED' THEN
    IF NEW."currentRevision" <> OLD."currentRevision"
       OR OLD."currentRevisionId" IS DISTINCT FROM NEW."currentRevisionId" THEN
      RAISE EXCEPTION 'non-adoption must keep the current revision';
    END IF;
  ELSIF (OLD."state" = 'CLARIFICATION_REQUIRED' AND NEW."state" = 'READY')
        OR (OLD."state" = 'AMENDMENT_REQUIRED' AND NEW."state" = 'READY')
        OR (OLD."state" = 'NOT_ADOPTED' AND NEW."state" = 'READY') THEN
    IF NEW."currentRevision" <> OLD."currentRevision" + 1
       OR OLD."currentRevisionId" IS NOT DISTINCT FROM NEW."currentRevisionId"
       OR NEW."currentRevisionId" IS NULL THEN
      RAISE EXCEPTION 'proposer-authored governance revisions must advance exactly one revision';
    END IF;
  ELSE
    RAISE EXCEPTION 'illegal governance decision process state transition';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "governance_decision_processes_enforce_mutation"
BEFORE UPDATE ON "governance_decision_processes"
FOR EACH ROW EXECUTE FUNCTION enforce_governance_decision_process_mutation();

CREATE OR REPLACE FUNCTION validate_governance_decision_current_revision()
RETURNS TRIGGER AS $$
DECLARE
  process "governance_decision_processes"%ROWTYPE;
  revision "governance_proposal_revisions"%ROWTYPE;
BEGIN
  SELECT * INTO process FROM "governance_decision_processes" WHERE "id" = NEW."id";
  IF process."currentRevisionId" IS NULL THEN
    RAISE EXCEPTION 'current revision pointer is required at commit';
  END IF;
  SELECT * INTO revision FROM "governance_proposal_revisions" WHERE "id" = process."currentRevisionId";
  IF NOT FOUND
     OR revision."organizationId" IS DISTINCT FROM process."organizationId"
     OR revision."processId" IS DISTINCT FROM process."id"
     OR revision."proposalId" IS DISTINCT FROM process."proposalId"
     OR revision."revision" IS DISTINCT FROM process."currentRevision" THEN
    RAISE EXCEPTION 'current revision pointer must match organization, process, proposal, and revision';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "governance_decision_processes_validate_current_revision"
AFTER INSERT OR UPDATE ON "governance_decision_processes"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_governance_decision_current_revision();

CREATE OR REPLACE FUNCTION reject_governance_proposal_revision_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'governance proposal revisions are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "governance_proposal_revisions_reject_mutation"
BEFORE UPDATE OR DELETE ON "governance_proposal_revisions"
FOR EACH ROW EXECUTE FUNCTION reject_governance_proposal_revision_mutation();

CREATE OR REPLACE FUNCTION enforce_governance_decision_operation_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'PROCESSING'
       OR NEW."attempt" <> 1
       OR NEW."leaseExpiresAt" <= CURRENT_TIMESTAMP THEN
      RAISE EXCEPTION 'new governance decision operations require a fresh processing lease';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'governance decision operations cannot be deleted';
  END IF;
  IF OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
     OR OLD."proposalId" IS DISTINCT FROM NEW."proposalId"
     OR OLD."processId" IS DISTINCT FROM NEW."processId"
     OR OLD."meetingId" IS DISTINCT FROM NEW."meetingId"
     OR OLD."actorId" IS DISTINCT FROM NEW."actorId"
     OR OLD."revision" IS DISTINCT FROM NEW."revision"
     OR OLD."operation" IS DISTINCT FROM NEW."operation"
     OR OLD."operationScope" IS DISTINCT FROM NEW."operationScope"
     OR OLD."mutationKey" IS DISTINCT FROM NEW."mutationKey"
     OR OLD."canonicalPayloadHash" IS DISTINCT FROM NEW."canonicalPayloadHash"
     OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt" THEN
    RAISE EXCEPTION 'governance decision operation bindings are immutable';
  END IF;
  IF OLD."status" = 'PROCESSING' AND NEW."status" IN ('SUCCEEDED', 'FAILED') THEN
    IF OLD."leaseExpiresAt" <= CURRENT_TIMESTAMP
       OR OLD."leaseToken" IS DISTINCT FROM NEW."leaseToken"
       OR OLD."leaseExpiresAt" IS DISTINCT FROM NEW."leaseExpiresAt"
       OR OLD."attempt" IS DISTINCT FROM NEW."attempt" THEN
      RAISE EXCEPTION 'lease-owned operation finalization requires the unexpired active lease';
    END IF;
  ELSIF OLD."status" = 'FAILED' AND NEW."status" = 'PROCESSING' THEN
    IF OLD."leaseToken" IS NOT DISTINCT FROM NEW."leaseToken"
       OR NEW."attempt" <> OLD."attempt" + 1
       OR NEW."leaseExpiresAt" <= CURRENT_TIMESTAMP THEN
      RAISE EXCEPTION 'failed operation reclaim requires a rotated active lease and next attempt';
    END IF;
  ELSIF OLD."status" = 'PROCESSING' AND NEW."status" = 'PROCESSING' THEN
    IF OLD."leaseExpiresAt" > CURRENT_TIMESTAMP
       OR OLD."leaseToken" IS NOT DISTINCT FROM NEW."leaseToken"
       OR NEW."attempt" <> OLD."attempt" + 1
       OR NEW."leaseExpiresAt" <= CURRENT_TIMESTAMP THEN
      RAISE EXCEPTION 'processing operation reclaim requires an expired lease, rotation, and next attempt';
    END IF;
  ELSE
    RAISE EXCEPTION 'illegal governance decision operation status transition';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "governance_decision_operations_enforce_mutation"
BEFORE INSERT OR UPDATE OR DELETE ON "governance_decision_operations"
FOR EACH ROW EXECUTE FUNCTION enforce_governance_decision_operation_mutation();

-- Reviewed rollback (execute in this reverse order):
-- DROP TRIGGER "governance_decision_operations_enforce_mutation" ON "governance_decision_operations";
-- DROP FUNCTION enforce_governance_decision_operation_mutation();
-- DROP TRIGGER "governance_proposal_revisions_reject_mutation" ON "governance_proposal_revisions";
-- DROP FUNCTION reject_governance_proposal_revision_mutation();
-- DROP TRIGGER "governance_decision_processes_validate_current_revision" ON "governance_decision_processes";
-- DROP FUNCTION validate_governance_decision_current_revision();
-- DROP TRIGGER "governance_decision_processes_enforce_mutation" ON "governance_decision_processes";
-- DROP FUNCTION enforce_governance_decision_process_mutation();
-- ALTER TABLE "governance_decision_processes" DROP CONSTRAINT "governance_decision_processes_currentRevisionId_id_proposa_fkey";
-- DROP TABLE "governance_decision_operations";
-- DROP TABLE "governance_proposal_revisions";
-- DROP TABLE "governance_decision_processes";
-- DROP INDEX "governance_proposals_id_organizationId_key";
-- DROP INDEX "decision_records_id_organizationId_key";
-- DROP INDEX "change_logs_id_organizationId_key";
-- DO $$ BEGIN
--   IF EXISTS (SELECT 1 FROM "interface_workflow_artifacts" WHERE "artifactType" = 'ROLE') THEN
--     RAISE EXCEPTION 'remove disposable-fixture ROLE artifacts before GD1 rollback';
--   END IF;
-- END $$;
-- ALTER TYPE "InterfaceWorkflowArtifactType" RENAME TO "InterfaceWorkflowArtifactType_old";
-- CREATE TYPE "InterfaceWorkflowArtifactType" AS ENUM ('TENSION', 'PROJECT', 'ACTION', 'GOVERNANCE_PROPOSAL', 'MEETING');
-- ALTER TABLE "interface_workflow_artifacts" ALTER COLUMN "artifactType" TYPE "InterfaceWorkflowArtifactType" USING ("artifactType"::text::"InterfaceWorkflowArtifactType");
-- DROP TYPE "InterfaceWorkflowArtifactType_old";
-- DROP TYPE "GovernanceDecisionOperationStatus";
-- DROP TYPE "GovernanceDecisionOperationKind";
-- DROP TYPE "GovernanceProposalRevisionSource";
-- DROP TYPE "GovernanceDecisionProcessState";
