-- AlterTable
ALTER TABLE "interface_validation_runs" ADD COLUMN "resolutionMeetingId" TEXT;

-- CreateIndex
CREATE INDEX "interface_validation_runs_resolutionMeetingId_idx" ON "interface_validation_runs"("resolutionMeetingId");

-- AddForeignKey
ALTER TABLE "interface_validation_runs" ADD CONSTRAINT "interface_validation_runs_resolutionMeetingId_fkey" FOREIGN KEY ("resolutionMeetingId") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
