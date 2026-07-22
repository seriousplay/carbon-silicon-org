-- V6-M5-A: candidate tension data contract.
-- AI-detected items remain candidates until an authorized human confirms a
-- formal Tension through a later accepted flow.

CREATE TYPE "CandidateTensionStatus" AS ENUM (
  'DETECTED',
  'CONFIRMED',
  'DISMISSED',
  'MERGED',
  'FALSE_POSITIVE'
);

CREATE TYPE "CandidateTensionSourceKind" AS ENUM (
  'GOAL',
  'METRIC',
  'PROJECT',
  'ACTION',
  'ROLE',
  'BUSINESS_LOOP',
  'AI_EXECUTION_AUDIT',
  'MEMORY',
  'MEETING',
  'EXTERNAL_SIGNAL'
);

CREATE TYPE "CandidateTensionAuditEventType" AS ENUM (
  'DETECTED',
  'CONFIRMED',
  'DISMISSED',
  'MERGED',
  'MARKED_FALSE_POSITIVE'
);

CREATE TABLE "candidate_tensions" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "evidenceSummary" TEXT NOT NULL,
  "sourceKind" "CandidateTensionSourceKind" NOT NULL,
  "sourceRef" JSONB NOT NULL,
  "ownerRoleId" TEXT NOT NULL,
  "detectedById" TEXT NOT NULL,
  "status" "CandidateTensionStatus" NOT NULL DEFAULT 'DETECTED',
  "suggestedMode" "TensionHandlingMode",
  "confirmedTensionId" TEXT,
  "confirmedById" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "terminalReason" TEXT,
  "mergedIntoId" TEXT,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "candidate_tensions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "candidate_tensions"
  ADD CONSTRAINT "candidate_tensions_lifecycle_state_check"
  CHECK (
    (
      "status" = 'DETECTED'
      AND "confirmedTensionId" IS NULL
      AND "confirmedById" IS NULL
      AND "confirmedAt" IS NULL
      AND "terminalReason" IS NULL
      AND "mergedIntoId" IS NULL
    )
    OR (
      "status" = 'CONFIRMED'
      AND "confirmedTensionId" IS NOT NULL
      AND "confirmedById" IS NOT NULL
      AND "confirmedAt" IS NOT NULL
      AND "terminalReason" IS NULL
      AND "mergedIntoId" IS NULL
    )
    OR (
      "status" IN ('DISMISSED', 'FALSE_POSITIVE')
      AND "confirmedTensionId" IS NULL
      AND "confirmedById" IS NULL
      AND "confirmedAt" IS NULL
      AND "terminalReason" IS NOT NULL
      AND "mergedIntoId" IS NULL
    )
    OR (
      "status" = 'MERGED'
      AND "confirmedTensionId" IS NULL
      AND "confirmedById" IS NULL
      AND "confirmedAt" IS NULL
      AND "terminalReason" IS NOT NULL
      AND "mergedIntoId" IS NOT NULL
    )
  );

CREATE TABLE "candidate_tension_audit_events" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "type" "CandidateTensionAuditEventType" NOT NULL,
  "actorPersonId" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "candidate_tension_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "candidate_tensions_id_org_key"
  ON "candidate_tensions"("id", "organizationId");

CREATE UNIQUE INDEX "candidate_tensions_confirmed_tension_org_key"
  ON "candidate_tensions"("confirmedTensionId", "organizationId");

CREATE INDEX "candidate_tensions_org_status_detected_idx"
  ON "candidate_tensions"("organizationId", "status", "detectedAt");

CREATE INDEX "candidate_tensions_org_owner_status_idx"
  ON "candidate_tensions"("organizationId", "ownerRoleId", "status");

CREATE INDEX "candidate_tensions_org_source_kind_idx"
  ON "candidate_tensions"("organizationId", "sourceKind");

CREATE INDEX "candidate_tension_audit_events_org_candidate_time_idx"
  ON "candidate_tension_audit_events"("organizationId", "candidateId", "occurredAt");

ALTER TABLE "candidate_tensions"
  ADD CONSTRAINT "candidate_tensions_org_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidate_tensions"
  ADD CONSTRAINT "candidate_tensions_owner_role_org_fkey"
  FOREIGN KEY ("ownerRoleId", "organizationId") REFERENCES "role_defs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "candidate_tensions"
  ADD CONSTRAINT "candidate_tensions_detector_org_fkey"
  FOREIGN KEY ("detectedById", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "candidate_tensions"
  ADD CONSTRAINT "candidate_tensions_confirmer_org_fkey"
  FOREIGN KEY ("confirmedById", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "candidate_tensions"
  ADD CONSTRAINT "candidate_tensions_confirmed_tension_org_fkey"
  FOREIGN KEY ("confirmedTensionId", "organizationId") REFERENCES "tensions"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "candidate_tensions"
  ADD CONSTRAINT "candidate_tensions_merged_into_org_fkey"
  FOREIGN KEY ("mergedIntoId", "organizationId") REFERENCES "candidate_tensions"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "candidate_tension_audit_events"
  ADD CONSTRAINT "candidate_tension_audit_events_org_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidate_tension_audit_events"
  ADD CONSTRAINT "candidate_tension_audit_events_candidate_org_fkey"
  FOREIGN KEY ("candidateId", "organizationId") REFERENCES "candidate_tensions"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidate_tension_audit_events"
  ADD CONSTRAINT "candidate_tension_audit_events_actor_org_fkey"
  FOREIGN KEY ("actorPersonId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
