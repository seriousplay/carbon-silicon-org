-- CreateEnum
CREATE TYPE "RoleAssignmentHistoryEventType" AS ENUM ('ASSIGNED', 'RELEASED');

-- CreateTable
CREATE TABLE "role_assignment_history" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "eventType" "RoleAssignmentHistoryEventType" NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decisionId" TEXT,
    "changeLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_assignment_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "role_assignment_history_organizationId_roleId_effectiveAt_idx" ON "role_assignment_history"("organizationId", "roleId", "effectiveAt");
CREATE INDEX "role_assignment_history_organizationId_personId_effectiveAt_idx" ON "role_assignment_history"("organizationId", "personId", "effectiveAt");

-- AddForeignKey
ALTER TABLE "role_assignment_history" ADD CONSTRAINT "role_assignment_history_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_assignment_history" ADD CONSTRAINT "role_assignment_history_roleId_organizationId_fkey" FOREIGN KEY ("roleId", "organizationId") REFERENCES "role_defs"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_assignment_history" ADD CONSTRAINT "role_assignment_history_personId_organizationId_fkey" FOREIGN KEY ("personId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_assignment_history" ADD CONSTRAINT "role_assignment_history_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "decision_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "role_assignment_history" ADD CONSTRAINT "role_assignment_history_changeLogId_fkey" FOREIGN KEY ("changeLogId") REFERENCES "change_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
