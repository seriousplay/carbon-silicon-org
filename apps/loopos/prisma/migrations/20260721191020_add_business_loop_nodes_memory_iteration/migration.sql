-- AlterTable: extend BusinessLoop
ALTER TABLE "business_loops" 
  ADD COLUMN "parentId" TEXT,
  ADD COLUMN "coreMetrics" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "cadence" TEXT,
  ADD COLUMN "cadenceDetail" TEXT,
  ADD COLUMN "inputs" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "outputs" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "acceptanceCriteria" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "leadPersonId" TEXT,
  ADD COLUMN "leadRoleLabel" TEXT;

-- AlterTable: extend BusinessLoopEdge
ALTER TABLE "business_loop_edges" 
  ADD COLUMN "fromNodeId" TEXT,
  ADD COLUMN "toNodeId" TEXT,
  ADD COLUMN "cadence" TEXT,
  ADD COLUMN "volume" TEXT,
  ADD COLUMN "sla" TEXT;

-- CreateTable: BusinessLoopNode
CREATE TABLE "business_loop_nodes" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "loopId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nodeType" TEXT NOT NULL DEFAULT 'HUMAN_ROLE',
  "roleId" TEXT,
  "personId" TEXT,
  "agentModel" TEXT,
  "agentPrompt" TEXT,
  "agentCapabilities" TEXT,
  "responsibility" TEXT NOT NULL DEFAULT '',
  "deliverables" JSONB NOT NULL DEFAULT '[]',
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_loop_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BusinessLoopIteration
CREATE TABLE "business_loop_iterations" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "loopId" TEXT NOT NULL,
  "iterationNumber" INTEGER NOT NULL,
  "whatChanged" TEXT NOT NULL DEFAULT '',
  "whyChanged" TEXT NOT NULL DEFAULT '',
  "expectedOutcome" TEXT NOT NULL DEFAULT '',
  "actualOutcome" TEXT,
  "metricsDelta" JSONB,
  "lessonsLearned" TEXT,
  "aiSummary" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "business_loop_iterations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BusinessLoopMemory
CREATE TABLE "business_loop_memories" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "loopId" TEXT NOT NULL,
  "entryType" TEXT NOT NULL DEFAULT 'INSIGHT',
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL DEFAULT '',
  "sourceIterationId" TEXT,
  "sourceTensionId" TEXT,
  "sourceMeetingId" TEXT,
  "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
  "aiConfidence" DOUBLE PRECISION,
  "humanReviewed" BOOLEAN NOT NULL DEFAULT false,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_loop_memories_pkey" PRIMARY KEY ("id")
);

-- Indexes (must be created BEFORE foreign keys that reference composite unique)
CREATE UNIQUE INDEX "business_loop_nodes_id_org_key" ON "business_loop_nodes"("id", "organizationId");
CREATE INDEX "business_loop_nodes_org_loop_position_idx" ON "business_loop_nodes"("organizationId", "loopId", "position");
CREATE UNIQUE INDEX "business_loop_iterations_id_org_key" ON "business_loop_iterations"("id", "organizationId");
CREATE INDEX "business_loop_iterations_org_loop_iteration_idx" ON "business_loop_iterations"("organizationId", "loopId", "iterationNumber");
CREATE INDEX "business_loop_memories_org_loop_type_idx" ON "business_loop_memories"("organizationId", "loopId", "entryType");
CREATE INDEX "business_loop_memories_org_tags_idx" ON "business_loop_memories"("organizationId", "tags");
CREATE INDEX "business_loops_parent_idx" ON "business_loops"("organizationId", "parentId");

-- Foreign Keys for BusinessLoop
ALTER TABLE "business_loops" ADD CONSTRAINT "business_loops_parentId_fkey" 
  FOREIGN KEY ("parentId", "organizationId") REFERENCES "business_loops"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "business_loops" ADD CONSTRAINT "business_loops_leadPersonId_fkey" 
  FOREIGN KEY ("leadPersonId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign Keys for BusinessLoopEdge
ALTER TABLE "business_loop_edges" ADD CONSTRAINT "business_loop_edges_fromNodeId_fkey" 
  FOREIGN KEY ("fromNodeId", "organizationId") REFERENCES "business_loop_nodes"("id", "organizationId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "business_loop_edges" ADD CONSTRAINT "business_loop_edges_toNodeId_fkey" 
  FOREIGN KEY ("toNodeId", "organizationId") REFERENCES "business_loop_nodes"("id", "organizationId") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign Keys for BusinessLoopNode
ALTER TABLE "business_loop_nodes" ADD CONSTRAINT "business_loop_nodes_loopId_fkey" 
  FOREIGN KEY ("loopId", "organizationId") REFERENCES "business_loops"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_loop_nodes" ADD CONSTRAINT "business_loop_nodes_roleId_fkey" 
  FOREIGN KEY ("roleId", "organizationId") REFERENCES "role_defs"("id", "organizationId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "business_loop_nodes" ADD CONSTRAINT "business_loop_nodes_personId_fkey" 
  FOREIGN KEY ("personId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "business_loop_nodes" ADD CONSTRAINT "business_loop_nodes_organizationId_fkey" 
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign Keys for BusinessLoopIteration
ALTER TABLE "business_loop_iterations" ADD CONSTRAINT "business_loop_iterations_loopId_fkey" 
  FOREIGN KEY ("loopId", "organizationId") REFERENCES "business_loops"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_loop_iterations" ADD CONSTRAINT "business_loop_iterations_organizationId_fkey" 
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign Keys for BusinessLoopMemory
ALTER TABLE "business_loop_memories" ADD CONSTRAINT "business_loop_memories_loopId_fkey" 
  FOREIGN KEY ("loopId", "organizationId") REFERENCES "business_loops"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_loop_memories" ADD CONSTRAINT "business_loop_memories_organizationId_fkey" 
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
