-- V6-M4-A: AI co-assignee policy foundation.
-- Adds policy metadata only; it does not assign roles or execute AI work.

CREATE TYPE "AiCoAssigneeStatus" AS ENUM ('PROPOSED', 'APPROVED', 'SUSPENDED', 'REVOKED');

CREATE TYPE "AiCapabilityRiskLevel" AS ENUM ('L0', 'L1', 'L2', 'L3', 'L4');

CREATE TABLE "ai_role_co_assignment_policies" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "aiPersonId" TEXT NOT NULL,
  "accountableHumanPersonId" TEXT NOT NULL,
  "maxRiskLevel" "AiCapabilityRiskLevel" NOT NULL DEFAULT 'L1',
  "status" "AiCoAssigneeStatus" NOT NULL DEFAULT 'PROPOSED',
  "capabilityScope" JSONB NOT NULL DEFAULT '{}',
  "revocationReason" TEXT,
  "createdById" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ai_role_co_assignment_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_coassign_policy_org_role_agent_key"
  ON "ai_role_co_assignment_policies"("organizationId", "roleId", "aiPersonId");

CREATE INDEX "ai_coassign_policy_org_status_risk_idx"
  ON "ai_role_co_assignment_policies"("organizationId", "status", "maxRiskLevel");

CREATE INDEX "ai_coassign_policy_org_human_idx"
  ON "ai_role_co_assignment_policies"("organizationId", "accountableHumanPersonId");

ALTER TABLE "ai_role_co_assignment_policies"
  ADD CONSTRAINT "ai_coassign_policy_org_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_role_co_assignment_policies"
  ADD CONSTRAINT "ai_coassign_policy_role_org_fkey"
  FOREIGN KEY ("roleId", "organizationId") REFERENCES "role_defs"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_role_co_assignment_policies"
  ADD CONSTRAINT "ai_coassign_policy_agent_org_fkey"
  FOREIGN KEY ("aiPersonId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_role_co_assignment_policies"
  ADD CONSTRAINT "ai_coassign_policy_human_org_fkey"
  FOREIGN KEY ("accountableHumanPersonId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_role_co_assignment_policies"
  ADD CONSTRAINT "ai_coassign_policy_creator_org_fkey"
  FOREIGN KEY ("createdById", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_role_co_assignment_policies"
  ADD CONSTRAINT "ai_coassign_policy_distinct_people_check"
  CHECK ("aiPersonId" <> "accountableHumanPersonId");
