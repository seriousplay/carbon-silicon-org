-- V6-M3-B: Business Loop persistence skeleton.
-- Adds independent Business Loop storage without replacing Circle or CircleInterface.

CREATE TYPE "BusinessLoopStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "BusinessLoopVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED');
CREATE TYPE "BusinessLoopActivityType" AS ENUM ('WORK', 'DECISION', 'HANDOFF', 'SIGNAL');
CREATE TYPE "BusinessLoopEdgeType" AS ENUM ('VALUE', 'DATA', 'DECISION_SIGNAL', 'EVIDENCE');
CREATE TYPE "BusinessLoopEvidenceKind" AS ENUM ('CIRCLE', 'ROLE', 'CIRCLE_INTERFACE', 'GOAL', 'METRIC', 'PROJECT', 'ACTION', 'TENSION', 'MEETING', 'EXTERNAL_NOTE');

CREATE TABLE "business_loops" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "purpose" TEXT,
  "status" "BusinessLoopStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "business_loops_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_loop_versions" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "businessLoopId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "BusinessLoopVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "summary" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "business_loop_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_loop_activities" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "businessLoopId" TEXT NOT NULL,
  "versionId" TEXT,
  "circleId" TEXT,
  "ownerRoleId" TEXT,
  "name" TEXT NOT NULL,
  "activityType" "BusinessLoopActivityType" NOT NULL DEFAULT 'WORK',
  "description" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "business_loop_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_loop_edges" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "businessLoopId" TEXT NOT NULL,
  "versionId" TEXT,
  "fromCircleId" TEXT,
  "toCircleId" TEXT,
  "interfaceId" TEXT,
  "edgeType" "BusinessLoopEdgeType" NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "business_loop_edges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_loop_evidence_refs" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "businessLoopId" TEXT NOT NULL,
  "versionId" TEXT,
  "kind" "BusinessLoopEvidenceKind" NOT NULL,
  "targetId" TEXT NOT NULL,
  "label" TEXT,
  "sourceUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "business_loop_evidence_refs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "business_loops_id_organizationId_key" ON "business_loops"("id", "organizationId");
CREATE INDEX "business_loops_organizationId_status_updatedAt_idx" ON "business_loops"("organizationId", "status", "updatedAt");

CREATE UNIQUE INDEX "business_loop_versions_id_organizationId_key" ON "business_loop_versions"("id", "organizationId");
CREATE UNIQUE INDEX "business_loop_versions_businessLoopId_organizationId_version_key" ON "business_loop_versions"("businessLoopId", "organizationId", "version");
CREATE INDEX "business_loop_versions_organizationId_businessLoopId_status_idx" ON "business_loop_versions"("organizationId", "businessLoopId", "status");

CREATE UNIQUE INDEX "business_loop_activities_id_organizationId_key" ON "business_loop_activities"("id", "organizationId");
CREATE INDEX "business_loop_activities_organizationId_businessLoopId_position_idx" ON "business_loop_activities"("organizationId", "businessLoopId", "position");
CREATE INDEX "business_loop_activities_organizationId_circleId_idx" ON "business_loop_activities"("organizationId", "circleId");
CREATE INDEX "business_loop_activities_organizationId_ownerRoleId_idx" ON "business_loop_activities"("organizationId", "ownerRoleId");

CREATE UNIQUE INDEX "business_loop_edges_id_organizationId_key" ON "business_loop_edges"("id", "organizationId");
CREATE INDEX "business_loop_edges_organizationId_businessLoopId_position_idx" ON "business_loop_edges"("organizationId", "businessLoopId", "position");
CREATE INDEX "business_loop_edges_organizationId_edgeType_idx" ON "business_loop_edges"("organizationId", "edgeType");
CREATE INDEX "business_loop_edges_organizationId_interfaceId_idx" ON "business_loop_edges"("organizationId", "interfaceId");

CREATE INDEX "business_loop_evidence_refs_organizationId_businessLoopId_kind_idx" ON "business_loop_evidence_refs"("organizationId", "businessLoopId", "kind");
CREATE INDEX "business_loop_evidence_refs_organizationId_kind_targetId_idx" ON "business_loop_evidence_refs"("organizationId", "kind", "targetId");

ALTER TABLE "business_loops"
  ADD CONSTRAINT "business_loops_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "business_loop_versions"
  ADD CONSTRAINT "business_loop_versions_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "business_loop_versions"
  ADD CONSTRAINT "business_loop_versions_businessLoopId_organizationId_fkey"
  FOREIGN KEY ("businessLoopId", "organizationId") REFERENCES "business_loops"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "business_loop_activities"
  ADD CONSTRAINT "business_loop_activities_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "business_loop_activities"
  ADD CONSTRAINT "business_loop_activities_businessLoopId_organizationId_fkey"
  FOREIGN KEY ("businessLoopId", "organizationId") REFERENCES "business_loops"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "business_loop_activities"
  ADD CONSTRAINT "business_loop_activities_versionId_organizationId_fkey"
  FOREIGN KEY ("versionId", "organizationId") REFERENCES "business_loop_versions"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_loop_activities"
  ADD CONSTRAINT "business_loop_activities_circleId_organizationId_fkey"
  FOREIGN KEY ("circleId", "organizationId") REFERENCES "circles"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_loop_activities"
  ADD CONSTRAINT "business_loop_activities_ownerRoleId_organizationId_fkey"
  FOREIGN KEY ("ownerRoleId", "organizationId") REFERENCES "role_defs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_loop_edges"
  ADD CONSTRAINT "business_loop_edges_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "business_loop_edges"
  ADD CONSTRAINT "business_loop_edges_businessLoopId_organizationId_fkey"
  FOREIGN KEY ("businessLoopId", "organizationId") REFERENCES "business_loops"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "business_loop_edges"
  ADD CONSTRAINT "business_loop_edges_versionId_organizationId_fkey"
  FOREIGN KEY ("versionId", "organizationId") REFERENCES "business_loop_versions"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_loop_edges"
  ADD CONSTRAINT "business_loop_edges_fromCircleId_organizationId_fkey"
  FOREIGN KEY ("fromCircleId", "organizationId") REFERENCES "circles"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_loop_edges"
  ADD CONSTRAINT "business_loop_edges_toCircleId_organizationId_fkey"
  FOREIGN KEY ("toCircleId", "organizationId") REFERENCES "circles"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_loop_edges"
  ADD CONSTRAINT "business_loop_edges_interfaceId_organizationId_fkey"
  FOREIGN KEY ("interfaceId", "organizationId") REFERENCES "circle_interfaces"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_loop_evidence_refs"
  ADD CONSTRAINT "business_loop_evidence_refs_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "business_loop_evidence_refs"
  ADD CONSTRAINT "business_loop_evidence_refs_businessLoopId_organizationId_fkey"
  FOREIGN KEY ("businessLoopId", "organizationId") REFERENCES "business_loops"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "business_loop_evidence_refs"
  ADD CONSTRAINT "business_loop_evidence_refs_versionId_organizationId_fkey"
  FOREIGN KEY ("versionId", "organizationId") REFERENCES "business_loop_versions"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
