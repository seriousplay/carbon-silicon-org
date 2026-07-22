-- AlterTable: Meeting 新增 currentPhase
ALTER TABLE "meetings" ADD COLUMN "currentPhase" TEXT;

-- CreateTable: MeetingMessage
CREATE TABLE "meeting_messages" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "senderId" TEXT,
  "senderRole" TEXT,
  "role" TEXT NOT NULL DEFAULT 'USER',
  "content" TEXT NOT NULL,
  "phase" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meeting_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MeetingParticipant
CREATE TABLE "meeting_participants" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "roleLabel" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'INVITED',
  "joinedAt" TIMESTAMP(3),
  "voteStatus" TEXT,
  "voteReason" TEXT,
  "voteSuggestion" TEXT,
  "voteSubmittedAt" TIMESTAMP(3),
  "participationScore" DOUBLE PRECISION DEFAULT 0.5,
  "lastActiveAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meeting_participants_pkey" PRIMARY KEY ("id")
);

-- Foreign Keys
ALTER TABLE "meeting_messages" ADD CONSTRAINT "meeting_messages_meetingId_fkey"
  FOREIGN KEY ("meetingId", "organizationId") REFERENCES "meetings"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_messages" ADD CONSTRAINT "meeting_messages_senderId_fkey"
  FOREIGN KEY ("senderId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meeting_messages" ADD CONSTRAINT "meeting_messages_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_meetingId_fkey"
  FOREIGN KEY ("meetingId", "organizationId") REFERENCES "meetings"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_personId_fkey"
  FOREIGN KEY ("personId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "meeting_messages_org_meeting_created_idx" ON "meeting_messages"("organizationId", "meetingId", "createdAt");
CREATE INDEX "meeting_participants_org_meeting_status_idx" ON "meeting_participants"("organizationId", "meetingId", "status");
CREATE UNIQUE INDEX "meeting_participants_org_meeting_person_key" ON "meeting_participants"("organizationId", "meetingId", "personId");
