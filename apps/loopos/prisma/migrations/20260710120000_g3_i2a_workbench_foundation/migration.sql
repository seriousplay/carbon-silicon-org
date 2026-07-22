-- AlterTable
ALTER TABLE "people" ADD CONSTRAINT "people_id_organizationId_key" UNIQUE ("id", "organizationId");

-- AlterTable
ALTER TABLE "circle_interfaces" ADD CONSTRAINT "circle_interfaces_id_organizationId_key" UNIQUE ("id", "organizationId");

-- CreateTable
CREATE TABLE "interface_workbenches" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "interfaceId" TEXT NOT NULL,
    "draft" JSONB NOT NULL,
    "draftHash" TEXT NOT NULL,
    "draftRevision" INTEGER NOT NULL DEFAULT 0,
    "activeVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interface_workbenches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interface_workbench_versions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workbenchId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "parentVersionId" TEXT,
    "publisherId" TEXT NOT NULL,
    "sourceSnapshot" JSONB NOT NULL,
    "compiledSnapshot" JSONB NOT NULL,
    "validationResult" JSONB NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "compiledHash" TEXT NOT NULL,
    "definitionSchemaVersion" INTEGER NOT NULL,
    "compilerVersion" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interface_workbench_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "interface_workbenches_interfaceId_key" ON "interface_workbenches"("interfaceId");
CREATE UNIQUE INDEX "interface_workbenches_id_organizationId_key" ON "interface_workbenches"("id", "organizationId");
CREATE UNIQUE INDEX "interface_workbenches_activeVersionId_id_organizationId_key" ON "interface_workbenches"("activeVersionId", "id", "organizationId");
CREATE INDEX "interface_workbenches_organizationId_idx" ON "interface_workbenches"("organizationId");
CREATE INDEX "interface_workbenches_activeVersionId_idx" ON "interface_workbenches"("activeVersionId");
CREATE UNIQUE INDEX "interface_workbench_versions_workbenchId_version_key" ON "interface_workbench_versions"("workbenchId", "version");
CREATE UNIQUE INDEX "interface_workbench_versions_workbenchId_sourceHash_key" ON "interface_workbench_versions"("workbenchId", "sourceHash");
CREATE UNIQUE INDEX "interface_workbench_versions_id_workbenchId_organizationId_key" ON "interface_workbench_versions"("id", "workbenchId", "organizationId");
CREATE INDEX "interface_workbench_versions_organizationId_workbenchId_idx" ON "interface_workbench_versions"("organizationId", "workbenchId");
CREATE INDEX "interface_workbench_versions_publisherId_organizationId_idx" ON "interface_workbench_versions"("publisherId", "organizationId");
CREATE INDEX "interface_workbench_versions_parentVersionId_idx" ON "interface_workbench_versions"("parentVersionId");

-- AddForeignKey
ALTER TABLE "interface_workbenches" ADD CONSTRAINT "interface_workbenches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interface_workbenches" ADD CONSTRAINT "interface_workbenches_interfaceId_organizationId_fkey" FOREIGN KEY ("interfaceId", "organizationId") REFERENCES "circle_interfaces"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interface_workbench_versions" ADD CONSTRAINT "interface_workbench_versions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interface_workbench_versions" ADD CONSTRAINT "interface_workbench_versions_workbenchId_organizationId_fkey" FOREIGN KEY ("workbenchId", "organizationId") REFERENCES "interface_workbenches"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interface_workbench_versions" ADD CONSTRAINT "interface_workbench_versions_publisherId_organizationId_fkey" FOREIGN KEY ("publisherId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interface_workbench_versions" ADD CONSTRAINT "interface_workbench_versions_parentVersionId_workbenchId_organizationId_fkey" FOREIGN KEY ("parentVersionId", "workbenchId", "organizationId") REFERENCES "interface_workbench_versions"("id", "workbenchId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interface_workbenches" ADD CONSTRAINT "interface_workbenches_activeVersionId_id_organizationId_fkey" FOREIGN KEY ("activeVersionId", "id", "organizationId") REFERENCES "interface_workbench_versions"("id", "workbenchId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Published versions are immutable audit records: neither updates nor deletes are allowed.
CREATE OR REPLACE FUNCTION reject_interface_workbench_version_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'interface_workbench_versions are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "interface_workbench_versions_reject_mutation"
BEFORE UPDATE OR DELETE ON "interface_workbench_versions"
FOR EACH ROW EXECUTE FUNCTION reject_interface_workbench_version_mutation();
