CREATE TABLE "organization_governance_config_versions" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "terminologyPreferences" JSONB NOT NULL,
  "governanceRules" JSONB NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  CONSTRAINT "organization_governance_config_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organization_governance_config_versions_organizationId_version_key" ON "organization_governance_config_versions"("organizationId", "version");
CREATE INDEX "organization_governance_config_versions_organizationId_effectiveAt_idx" ON "organization_governance_config_versions"("organizationId", "effectiveAt");
ALTER TABLE "organization_governance_config_versions" ADD CONSTRAINT "organization_governance_config_versions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_governance_config_versions" ADD CONSTRAINT "organization_governance_config_versions_createdById_organizationId_fkey" FOREIGN KEY ("createdById", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
