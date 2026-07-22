-- CreateEnum
CREATE TYPE "InterfaceValidationStatus" AS ENUM ('TO_SUBMIT', 'AWAITING_SMOKE_RUN', 'PASSED', 'FAILED', 'OVERDUE', 'DEFERRED', 'CLOSED');

-- CreateEnum
CREATE TYPE "InterfaceSmokeRunResult" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "InterfaceValidationSlaResult" AS ENUM ('ACHIEVED', 'MISSED');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "bearerId" TEXT,
ADD COLUMN     "expectedResult" TEXT,
ADD COLUMN     "linkedDataVersion" TEXT;

-- CreateTable
CREATE TABLE "interface_validation_runs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "interfaceId" TEXT NOT NULL,
    "dataVersion" TEXT NOT NULL,
    "dataLocation" TEXT NOT NULL,
    "changeSummary" TEXT NOT NULL,
    "dataScopeScale" TEXT NOT NULL,
    "knownRisks" TEXT,
    "suggestedSmokeRunConfig" TEXT,
    "submittedAt" TIMESTAMP(3),
    "status" "InterfaceValidationStatus" NOT NULL DEFAULT 'TO_SUBMIT',
    "smokeRunResult" "InterfaceSmokeRunResult",
    "lossSummary" TEXT,
    "throughputSummary" TEXT,
    "abnormalSampleRate" DOUBLE PRECISION,
    "representativeSampleTrace" TEXT,
    "trainingScheduleImpact" TEXT,
    "slaResult" "InterfaceValidationSlaResult",
    "closedAt" TIMESTAMP(3),
    "deferReason" TEXT,
    "sourceTensionId" TEXT,
    "createdTensionId" TEXT,
    "sourceProjectId" TEXT,
    "createdProjectId" TEXT,
    "sourceActionId" TEXT,
    "createdActionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interface_validation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_organizationId_bearerId_idx" ON "projects"("organizationId", "bearerId");

-- CreateIndex
CREATE INDEX "interface_validation_runs_organizationId_status_idx" ON "interface_validation_runs"("organizationId", "status");

-- CreateIndex
CREATE INDEX "interface_validation_runs_interfaceId_status_idx" ON "interface_validation_runs"("interfaceId", "status");

-- CreateIndex
CREATE INDEX "interface_validation_runs_dataVersion_idx" ON "interface_validation_runs"("dataVersion");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_bearerId_fkey" FOREIGN KEY ("bearerId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interface_validation_runs" ADD CONSTRAINT "interface_validation_runs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interface_validation_runs" ADD CONSTRAINT "interface_validation_runs_interfaceId_fkey" FOREIGN KEY ("interfaceId") REFERENCES "circle_interfaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interface_validation_runs" ADD CONSTRAINT "interface_validation_runs_sourceTensionId_fkey" FOREIGN KEY ("sourceTensionId") REFERENCES "tensions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interface_validation_runs" ADD CONSTRAINT "interface_validation_runs_createdTensionId_fkey" FOREIGN KEY ("createdTensionId") REFERENCES "tensions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interface_validation_runs" ADD CONSTRAINT "interface_validation_runs_sourceProjectId_fkey" FOREIGN KEY ("sourceProjectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interface_validation_runs" ADD CONSTRAINT "interface_validation_runs_createdProjectId_fkey" FOREIGN KEY ("createdProjectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interface_validation_runs" ADD CONSTRAINT "interface_validation_runs_sourceActionId_fkey" FOREIGN KEY ("sourceActionId") REFERENCES "tensions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interface_validation_runs" ADD CONSTRAINT "interface_validation_runs_createdActionId_fkey" FOREIGN KEY ("createdActionId") REFERENCES "tensions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
