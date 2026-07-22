-- CreateTable
CREATE TABLE "governance_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "patterns" TEXT NOT NULL,
    "risks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "credibilityScore" DOUBLE PRECISION DEFAULT 0.5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "governance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charters" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "changeSummary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "ratifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "previousVersionId" TEXT,

    CONSTRAINT "charters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "governance_logs_organizationId_status_idx" ON "governance_logs"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "governance_logs_organizationId_period_key" ON "governance_logs"("organizationId", "period");

-- CreateIndex
CREATE INDEX "charters_organizationId_status_idx" ON "charters"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "charters_organizationId_version_key" ON "charters"("organizationId", "version");

-- AddForeignKey
ALTER TABLE "governance_logs" ADD CONSTRAINT "governance_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charters" ADD CONSTRAINT "charters_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "charters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charters" ADD CONSTRAINT "charters_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
