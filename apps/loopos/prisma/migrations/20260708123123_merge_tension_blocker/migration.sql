/*
  Warnings:

  - The `status` column on the `tensions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `_DecisionForBlocker` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `blockers` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_DecisionForBlocker" DROP CONSTRAINT "_DecisionForBlocker_A_fkey";

-- DropForeignKey
ALTER TABLE "_DecisionForBlocker" DROP CONSTRAINT "_DecisionForBlocker_B_fkey";

-- DropForeignKey
ALTER TABLE "blockers" DROP CONSTRAINT "blockers_circleId_fkey";

-- DropForeignKey
ALTER TABLE "blockers" DROP CONSTRAINT "blockers_interfaceDependencyId_fkey";

-- DropForeignKey
ALTER TABLE "blockers" DROP CONSTRAINT "blockers_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "blockers" DROP CONSTRAINT "blockers_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "blockers" DROP CONSTRAINT "blockers_roleId_fkey";

-- DropForeignKey
ALTER TABLE "blockers" DROP CONSTRAINT "blockers_sourceTensionId_fkey";

-- AlterTable
ALTER TABLE "tensions" ADD COLUMN     "acceptanceCriteria" TEXT,
ADD COLUMN     "actionContext" TEXT,
ADD COLUMN     "circleId" TEXT,
ADD COLUMN     "consecutiveMissed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deadline" TIMESTAMP(3),
ADD COLUMN     "interfaceDependencyId" TEXT,
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "roleId" TEXT,
ADD COLUMN     "rootCause" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "BlockerStatus" NOT NULL DEFAULT 'OPEN';

-- DropTable
DROP TABLE "_DecisionForBlocker";

-- DropTable
DROP TABLE "blockers";

-- DropEnum
DROP TYPE "TensionStatus";

-- CreateTable
CREATE TABLE "_DecisionForTension" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DecisionForTension_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_DecisionForTension_B_index" ON "_DecisionForTension"("B");

-- CreateIndex
CREATE INDEX "tensions_organizationId_status_idx" ON "tensions"("organizationId", "status");

-- CreateIndex
CREATE INDEX "tensions_organizationId_ownerId_idx" ON "tensions"("organizationId", "ownerId");

-- AddForeignKey
ALTER TABLE "tensions" ADD CONSTRAINT "tensions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tensions" ADD CONSTRAINT "tensions_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "circles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tensions" ADD CONSTRAINT "tensions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role_defs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tensions" ADD CONSTRAINT "tensions_interfaceDependencyId_fkey" FOREIGN KEY ("interfaceDependencyId") REFERENCES "circle_interfaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DecisionForTension" ADD CONSTRAINT "_DecisionForTension_A_fkey" FOREIGN KEY ("A") REFERENCES "decision_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DecisionForTension" ADD CONSTRAINT "_DecisionForTension_B_fkey" FOREIGN KEY ("B") REFERENCES "tensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
