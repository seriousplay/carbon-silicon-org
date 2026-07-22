-- AlterTable
ALTER TABLE "blockers" ADD COLUMN     "actionContext" TEXT,
ADD COLUMN     "roleId" TEXT;

-- AddForeignKey
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role_defs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
