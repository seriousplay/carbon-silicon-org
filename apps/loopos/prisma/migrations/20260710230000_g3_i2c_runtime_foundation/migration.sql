-- CreateEnum
CREATE TYPE "InterfaceWorkflowRunStatus" AS ENUM ('ACTIVE', 'WAITING', 'COMPLETED', 'TERMINATED', 'PAUSED');

-- CreateEnum
CREATE TYPE "InterfaceWorkflowCommandStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "InterfaceWorkflowArtifactType" AS ENUM ('TENSION', 'PROJECT', 'ACTION', 'GOVERNANCE_PROPOSAL', 'MEETING');

-- AlterTable
ALTER TABLE "role_defs" ADD CONSTRAINT "role_defs_id_organizationId_key" UNIQUE ("id", "organizationId");

-- CreateTable
CREATE TABLE "interface_workflow_runs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workbenchId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "status" "InterfaceWorkflowRunStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentNodeId" TEXT NOT NULL,
    "currentNodeVisit" INTEGER NOT NULL DEFAULT 0,
    "evidence" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "starterId" TEXT NOT NULL,
    "lastActorId" TEXT,
    "waitingRoleBindingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interface_workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interface_workflow_run_role_bindings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "personId" TEXT,
    "roleDefId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interface_workflow_run_role_bindings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "interface_workflow_run_role_bindings_exactly_one_target" CHECK (("personId" IS NOT NULL) <> ("roleDefId" IS NOT NULL))
);

-- CreateTable
CREATE TABLE "interface_workflow_run_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeVisit" INTEGER NOT NULL,
    "actorId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interface_workflow_run_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interface_workflow_commands" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeVisit" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "clientIdempotencyKey" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" "InterfaceWorkflowCommandStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interface_workflow_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interface_workflow_artifacts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "artifactType" "InterfaceWorkflowArtifactType" NOT NULL,
    "artifactId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interface_workflow_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "interface_workflow_runs_id_organizationId_key" ON "interface_workflow_runs"("id", "organizationId");
CREATE UNIQUE INDEX "interface_workflow_runs_waitingRoleBindingId_id_organizationId_key" ON "interface_workflow_runs"("waitingRoleBindingId", "id", "organizationId");
CREATE INDEX "interface_workflow_runs_organizationId_status_idx" ON "interface_workflow_runs"("organizationId", "status");
CREATE INDEX "interface_workflow_runs_workbenchId_versionId_idx" ON "interface_workflow_runs"("workbenchId", "versionId");
CREATE INDEX "interface_workflow_runs_starterId_organizationId_idx" ON "interface_workflow_runs"("starterId", "organizationId");
CREATE INDEX "interface_workflow_runs_lastActorId_organizationId_idx" ON "interface_workflow_runs"("lastActorId", "organizationId");
CREATE UNIQUE INDEX "interface_workflow_run_role_bindings_runId_roleId_key" ON "interface_workflow_run_role_bindings"("runId", "roleId");
CREATE UNIQUE INDEX "interface_workflow_run_role_bindings_id_runId_organizationId_key" ON "interface_workflow_run_role_bindings"("id", "runId", "organizationId");
CREATE INDEX "interface_workflow_run_role_bindings_organizationId_personId_idx" ON "interface_workflow_run_role_bindings"("organizationId", "personId");
CREATE INDEX "interface_workflow_run_role_bindings_organizationId_roleDefId_idx" ON "interface_workflow_run_role_bindings"("organizationId", "roleDefId");
CREATE UNIQUE INDEX "interface_workflow_run_events_runId_sequence_key" ON "interface_workflow_run_events"("runId", "sequence");
CREATE INDEX "interface_workflow_run_events_organizationId_runId_idx" ON "interface_workflow_run_events"("organizationId", "runId");
CREATE INDEX "interface_workflow_run_events_actorId_organizationId_idx" ON "interface_workflow_run_events"("actorId", "organizationId");
CREATE UNIQUE INDEX "interface_workflow_commands_runId_clientIdempotencyKey_key" ON "interface_workflow_commands"("runId", "clientIdempotencyKey");
CREATE UNIQUE INDEX "interface_workflow_commands_runId_nodeId_nodeVisit_kind_key" ON "interface_workflow_commands"("runId", "nodeId", "nodeVisit", "kind");
CREATE INDEX "interface_workflow_commands_organizationId_status_idx" ON "interface_workflow_commands"("organizationId", "status");
CREATE INDEX "interface_workflow_commands_actorId_organizationId_idx" ON "interface_workflow_commands"("actorId", "organizationId");
CREATE UNIQUE INDEX "interface_workflow_artifacts_runId_artifactType_artifactId_relation_key" ON "interface_workflow_artifacts"("runId", "artifactType", "artifactId", "relation");
CREATE INDEX "interface_workflow_artifacts_organizationId_artifactType_artifactId_idx" ON "interface_workflow_artifacts"("organizationId", "artifactType", "artifactId");

-- AddForeignKey
ALTER TABLE "interface_workflow_runs" ADD CONSTRAINT "interface_workflow_runs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interface_workflow_runs" ADD CONSTRAINT "interface_workflow_runs_workbenchId_organizationId_fkey" FOREIGN KEY ("workbenchId", "organizationId") REFERENCES "interface_workbenches"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interface_workflow_runs" ADD CONSTRAINT "interface_workflow_runs_versionId_workbenchId_organizationId_fkey" FOREIGN KEY ("versionId", "workbenchId", "organizationId") REFERENCES "interface_workbench_versions"("id", "workbenchId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interface_workflow_runs" ADD CONSTRAINT "interface_workflow_runs_starterId_organizationId_fkey" FOREIGN KEY ("starterId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interface_workflow_runs" ADD CONSTRAINT "interface_workflow_runs_lastActorId_organizationId_fkey" FOREIGN KEY ("lastActorId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interface_workflow_run_role_bindings" ADD CONSTRAINT "interface_workflow_run_role_bindings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interface_workflow_run_role_bindings" ADD CONSTRAINT "interface_workflow_run_role_bindings_runId_organizationId_fkey" FOREIGN KEY ("runId", "organizationId") REFERENCES "interface_workflow_runs"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interface_workflow_run_role_bindings" ADD CONSTRAINT "interface_workflow_run_role_bindings_personId_organizationId_fkey" FOREIGN KEY ("personId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interface_workflow_run_role_bindings" ADD CONSTRAINT "interface_workflow_run_role_bindings_roleDefId_organizationId_fkey" FOREIGN KEY ("roleDefId", "organizationId") REFERENCES "role_defs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interface_workflow_run_events" ADD CONSTRAINT "interface_workflow_run_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interface_workflow_run_events" ADD CONSTRAINT "interface_workflow_run_events_runId_organizationId_fkey" FOREIGN KEY ("runId", "organizationId") REFERENCES "interface_workflow_runs"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interface_workflow_run_events" ADD CONSTRAINT "interface_workflow_run_events_actorId_organizationId_fkey" FOREIGN KEY ("actorId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interface_workflow_commands" ADD CONSTRAINT "interface_workflow_commands_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interface_workflow_commands" ADD CONSTRAINT "interface_workflow_commands_runId_organizationId_fkey" FOREIGN KEY ("runId", "organizationId") REFERENCES "interface_workflow_runs"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interface_workflow_commands" ADD CONSTRAINT "interface_workflow_commands_actorId_organizationId_fkey" FOREIGN KEY ("actorId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interface_workflow_artifacts" ADD CONSTRAINT "interface_workflow_artifacts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interface_workflow_artifacts" ADD CONSTRAINT "interface_workflow_artifacts_runId_organizationId_fkey" FOREIGN KEY ("runId", "organizationId") REFERENCES "interface_workflow_runs"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interface_workflow_runs" ADD CONSTRAINT "interface_workflow_runs_waitingRoleBindingId_id_organizationId_fkey" FOREIGN KEY ("waitingRoleBindingId", "id", "organizationId") REFERENCES "interface_workflow_run_role_bindings"("id", "runId", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- A run remains pinned to the exact organization/workbench/version selected at start.
CREATE OR REPLACE FUNCTION reject_interface_workflow_run_version_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
       OR OLD."workbenchId" IS DISTINCT FROM NEW."workbenchId"
       OR OLD."versionId" IS DISTINCT FROM NEW."versionId" THEN
        RAISE EXCEPTION 'interface_workflow_runs version ownership is immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "interface_workflow_runs_reject_version_change"
BEFORE UPDATE ON "interface_workflow_runs"
FOR EACH ROW EXECUTE FUNCTION reject_interface_workflow_run_version_change();

-- Event rows form the ordered audit log and can only be appended.
CREATE OR REPLACE FUNCTION reject_interface_workflow_run_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'interface_workflow_run_events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "interface_workflow_run_events_reject_mutation"
BEFORE UPDATE OR DELETE ON "interface_workflow_run_events"
FOR EACH ROW EXECUTE FUNCTION reject_interface_workflow_run_event_mutation();

-- Reviewed rollback (execute in this reverse order):
-- DROP TRIGGER "interface_workflow_run_events_reject_mutation" ON "interface_workflow_run_events";
-- DROP FUNCTION reject_interface_workflow_run_event_mutation();
-- DROP TRIGGER "interface_workflow_runs_reject_version_change" ON "interface_workflow_runs";
-- DROP FUNCTION reject_interface_workflow_run_version_change();
-- ALTER TABLE "interface_workflow_runs" DROP CONSTRAINT "interface_workflow_runs_waitingRoleBindingId_id_organizationId_fkey";
-- DROP TABLE "interface_workflow_artifacts", "interface_workflow_commands", "interface_workflow_run_events", "interface_workflow_run_role_bindings", "interface_workflow_runs";
-- ALTER TABLE "role_defs" DROP CONSTRAINT "role_defs_id_organizationId_key";
-- DROP TYPE "InterfaceWorkflowArtifactType";
-- DROP TYPE "InterfaceWorkflowCommandStatus";
-- DROP TYPE "InterfaceWorkflowRunStatus";
