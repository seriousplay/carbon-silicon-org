-- AlterTable
ALTER TABLE "people" ADD COLUMN     "agentAbilities" TEXT,
ADD COLUMN     "agentConfig" TEXT,
ADD COLUMN     "agentEndpoint" TEXT,
ADD COLUMN     "agentModel" TEXT,
ADD COLUMN     "entityType" TEXT NOT NULL DEFAULT 'HUMAN';

-- AlterTable
ALTER TABLE "tensions" ADD COLUMN     "projectId" TEXT;

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "circleId" TEXT NOT NULL,
    "sourceTensionId" TEXT,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance_proposals" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetId" TEXT,
    "proposedChange" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "adoptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tensionId" TEXT NOT NULL,
    "meetingId" TEXT,
    "decisionId" TEXT,

    CONSTRAINT "governance_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_sourceTensionId_key" ON "projects"("sourceTensionId");

-- CreateIndex
CREATE INDEX "projects_organizationId_status_idx" ON "projects"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "governance_proposals_decisionId_key" ON "governance_proposals"("decisionId");

-- CreateIndex
CREATE INDEX "governance_proposals_organizationId_status_idx" ON "governance_proposals"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "tensions" ADD CONSTRAINT "tensions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "circles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_sourceTensionId_fkey" FOREIGN KEY ("sourceTensionId") REFERENCES "tensions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_proposals" ADD CONSTRAINT "governance_proposals_tensionId_fkey" FOREIGN KEY ("tensionId") REFERENCES "tensions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_proposals" ADD CONSTRAINT "governance_proposals_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_proposals" ADD CONSTRAINT "governance_proposals_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "decision_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_proposals" ADD CONSTRAINT "governance_proposals_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
