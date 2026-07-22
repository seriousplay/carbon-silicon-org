CREATE TYPE "BrainMessageRole" AS ENUM ('USER', 'BRAIN');
CREATE TYPE "BrainQueryAuditStatus" AS ENUM ('SUCCEEDED', 'REJECTED', 'FAILED');

CREATE TABLE "organization_brain_profiles" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "avatarUrl" TEXT,
  "tonePreferences" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "terminologyPreferences" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "enabledCapabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "organization_brain_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "brain_conversations" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "title" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "brain_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "brain_messages" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "role" "BrainMessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "brain_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "brain_query_audits" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "conversationId" TEXT,
  "messageId" TEXT,
  "purpose" TEXT NOT NULL,
  "scope" JSONB NOT NULL,
  "resultCount" INTEGER NOT NULL DEFAULT 0,
  "status" "BrainQueryAuditStatus" NOT NULL,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "brain_query_audits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "brain_query_audits_result_count_check" CHECK ("resultCount" >= 0),
  CONSTRAINT "brain_query_audits_message_conversation_check" CHECK ("messageId" IS NULL OR "conversationId" IS NOT NULL)
);

CREATE UNIQUE INDEX "organization_brain_profiles_organizationId_key" ON "organization_brain_profiles"("organizationId");
CREATE UNIQUE INDEX "brain_conversations_id_organizationId_key" ON "brain_conversations"("id", "organizationId");
CREATE INDEX "brain_conversations_organizationId_ownerId_updatedAt_idx" ON "brain_conversations"("organizationId", "ownerId", "updatedAt");
CREATE UNIQUE INDEX "brain_messages_id_conversationId_organizationId_key" ON "brain_messages"("id", "conversationId", "organizationId");
CREATE INDEX "brain_messages_organizationId_conversationId_createdAt_idx" ON "brain_messages"("organizationId", "conversationId", "createdAt");
CREATE INDEX "brain_query_audits_organizationId_actorId_createdAt_idx" ON "brain_query_audits"("organizationId", "actorId", "createdAt");
CREATE INDEX "brain_query_audits_organizationId_conversationId_createdAt_idx" ON "brain_query_audits"("organizationId", "conversationId", "createdAt");

ALTER TABLE "organization_brain_profiles" ADD CONSTRAINT "organization_brain_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brain_conversations" ADD CONSTRAINT "brain_conversations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brain_conversations" ADD CONSTRAINT "brain_conversations_ownerId_organizationId_fkey" FOREIGN KEY ("ownerId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "brain_messages" ADD CONSTRAINT "brain_messages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brain_messages" ADD CONSTRAINT "brain_messages_conversationId_organizationId_fkey" FOREIGN KEY ("conversationId", "organizationId") REFERENCES "brain_conversations"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brain_query_audits" ADD CONSTRAINT "brain_query_audits_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brain_query_audits" ADD CONSTRAINT "brain_query_audits_actorId_organizationId_fkey" FOREIGN KEY ("actorId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "brain_query_audits" ADD CONSTRAINT "brain_query_audits_conversationId_organizationId_fkey" FOREIGN KEY ("conversationId", "organizationId") REFERENCES "brain_conversations"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "brain_query_audits" ADD CONSTRAINT "brain_query_audits_messageId_conversationId_organizationId_fkey" FOREIGN KEY ("messageId", "conversationId", "organizationId") REFERENCES "brain_messages"("id", "conversationId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
