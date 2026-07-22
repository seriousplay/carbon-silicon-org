-- CreateEnum
CREATE TYPE "InterfaceTacticalResolution" AS ENUM ('CREATE_PROJECT', 'CREATE_ACTION', 'GOVERNANCE_CANDIDATE', 'DEFERRED');

-- AlterTable
ALTER TABLE "interface_validation_runs" ADD COLUMN "tacticalResolution" "InterfaceTacticalResolution";
