-- V6-M4-E: AI execution audit ledger contract.
-- Records future execution intent/readiness decisions only; it does not
-- perform automatic AI work.

CREATE TYPE "AiExecutionAuditEventStatus" AS ENUM ('RECORDED', 'DENIED');

CREATE UNIQUE INDEX "ai_coassign_policy_id_org_key"
  ON "ai_role_co_assignment_policies"("id", "organizationId");

CREATE TABLE "ai_execution_audit_events" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "aiPersonId" TEXT NOT NULL,
  "accountableHumanPersonId" TEXT NOT NULL,
  "requestedOperationLabel" TEXT NOT NULL,
  "sourceProcessType" TEXT,
  "sourceProcessId" TEXT,
  "status" "AiExecutionAuditEventStatus" NOT NULL,
  "readinessCode" TEXT NOT NULL,
  "maxRiskLevel" "AiCapabilityRiskLevel" NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "recordedById" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_execution_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_execution_audit_events_id_org_key"
  ON "ai_execution_audit_events"("id", "organizationId");

CREATE INDEX "ai_execution_audit_events_org_role_time_idx"
  ON "ai_execution_audit_events"("organizationId", "roleId", "occurredAt");

CREATE INDEX "ai_execution_audit_events_org_policy_time_idx"
  ON "ai_execution_audit_events"("organizationId", "policyId", "occurredAt");

CREATE INDEX "ai_execution_audit_events_org_status_time_idx"
  ON "ai_execution_audit_events"("organizationId", "status", "occurredAt");

ALTER TABLE "ai_execution_audit_events"
  ADD CONSTRAINT "ai_execution_audit_events_org_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_execution_audit_events"
  ADD CONSTRAINT "ai_execution_audit_events_role_org_fkey"
  FOREIGN KEY ("roleId", "organizationId") REFERENCES "role_defs"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_execution_audit_events"
  ADD CONSTRAINT "ai_execution_audit_events_policy_org_fkey"
  FOREIGN KEY ("policyId", "organizationId") REFERENCES "ai_role_co_assignment_policies"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_execution_audit_events"
  ADD CONSTRAINT "ai_execution_audit_events_agent_org_fkey"
  FOREIGN KEY ("aiPersonId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_execution_audit_events"
  ADD CONSTRAINT "ai_execution_audit_events_human_org_fkey"
  FOREIGN KEY ("accountableHumanPersonId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_execution_audit_events"
  ADD CONSTRAINT "ai_execution_audit_events_recorder_org_fkey"
  FOREIGN KEY ("recordedById", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
