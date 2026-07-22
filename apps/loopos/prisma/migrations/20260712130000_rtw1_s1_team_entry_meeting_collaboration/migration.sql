-- AlterTable
ALTER TABLE "meetings" ADD COLUMN "notesRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "meetings" ADD COLUMN "endedAt" TIMESTAMP(3);
ALTER TABLE "meetings" ADD COLUMN "endedById" TEXT;

-- CreateTable
CREATE TABLE "organization_invitations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ORG_MEMBER',
    "homeCircleId" TEXT,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "consumedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "organization_invitations_terminal_state_check" CHECK (NOT ("revokedAt" IS NOT NULL AND "consumedAt" IS NOT NULL)),
    CONSTRAINT "organization_invitations_role_check" CHECK ("role" = 'ORG_MEMBER')
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_invitations_tokenHash_key" ON "organization_invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "organization_invitations_organizationId_email_consumedAt_re_idx" ON "organization_invitations"("organizationId", "email", "consumedAt", "revokedAt");

-- CreateIndex
CREATE INDEX "organization_invitations_expiresAt_idx" ON "organization_invitations"("expiresAt");

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_endedById_organizationId_fkey" FOREIGN KEY ("endedById", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_homeCircleId_organizationId_fkey" FOREIGN KEY ("homeCircleId", "organizationId") REFERENCES "circles"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_createdById_organizationId_fkey" FOREIGN KEY ("createdById", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_consumedById_fkey" FOREIGN KEY ("consumedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
