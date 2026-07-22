CREATE TYPE "MeetingFacilitationEngine" AS ENUM ('TACTICAL', 'GOVERNANCE');
CREATE TYPE "MeetingAgendaStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED');
CREATE TYPE "GovernanceObjectionValidity" AS ENUM ('VALID', 'INVALID', 'INSUFFICIENT_INFO');
CREATE TYPE "GovernanceObjectionReviewStatus" AS ENUM ('ACTIVE', 'INTEGRATED', 'DISMISSED');
CREATE TYPE "GovernanceObjectionStanceValue" AS ENUM ('VALID', 'INVALID');

CREATE UNIQUE INDEX "meeting_participants_id_organizationId_key"
  ON "meeting_participants"("id", "organizationId");

CREATE TABLE "meeting_facilitation_sessions" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "engineType" "MeetingFacilitationEngine" NOT NULL,
  "phase" TEXT NOT NULL,
  "phaseState" JSONB NOT NULL DEFAULT '{}',
  "activeAgendaItemId" TEXT,
  "paused" BOOLEAN NOT NULL DEFAULT false,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "lastEventSequence" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "meeting_facilitation_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "meeting_facilitation_events" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "stateRevision" INTEGER NOT NULL,
  "actorId" TEXT,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meeting_facilitation_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "meeting_agenda_items" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "engineType" "MeetingFacilitationEngine" NOT NULL,
  "ownerParticipantId" TEXT NOT NULL,
  "ownerRoleId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "status" "MeetingAgendaStatus" NOT NULL DEFAULT 'PENDING',
  "linkedTensionId" TEXT,
  "linkedProposalId" TEXT,
  "need" TEXT,
  "candidateOutput" JSONB,
  "confirmedOutputType" TEXT,
  "confirmedOutputId" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "meeting_agenda_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "meeting_role_representations" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meeting_role_representations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_checklist_items" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "cadence" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "role_checklist_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "governance_objection_reviews" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "agendaItemId" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "processId" TEXT,
  "proposalRevision" INTEGER NOT NULL,
  "sequence" INTEGER NOT NULL,
  "objectorParticipantId" TEXT NOT NULL,
  "objectorRoleId" TEXT NOT NULL,
  "statement" TEXT NOT NULL,
  "criteria" JSONB NOT NULL DEFAULT '{}',
  "aiValidity" "GovernanceObjectionValidity",
  "aiRationale" TEXT,
  "aiConfidence" DOUBLE PRECISION,
  "aiEvidenceRefs" JSONB,
  "status" "GovernanceObjectionReviewStatus" NOT NULL DEFAULT 'ACTIVE',
  "integratedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "governance_objection_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "governance_objection_stances" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "objectionId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "validity" "GovernanceObjectionStanceValue" NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "governance_objection_stances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meeting_facilitation_sessions_meetingId_organizationId_key" ON "meeting_facilitation_sessions"("meetingId", "organizationId");
CREATE UNIQUE INDEX "meeting_facilitation_sessions_id_organizationId_key" ON "meeting_facilitation_sessions"("id", "organizationId");
CREATE INDEX "meeting_facilitation_sessions_organizationId_engineType_phase_idx" ON "meeting_facilitation_sessions"("organizationId", "engineType", "phase");

CREATE UNIQUE INDEX "meeting_facilitation_events_sessionId_sequence_key" ON "meeting_facilitation_events"("sessionId", "sequence");
CREATE INDEX "meeting_facilitation_events_organizationId_meetingId_sequence_idx" ON "meeting_facilitation_events"("organizationId", "meetingId", "sequence");
CREATE INDEX "meeting_facilitation_events_actorId_organizationId_idx" ON "meeting_facilitation_events"("actorId", "organizationId");

CREATE UNIQUE INDEX "meeting_agenda_items_id_organizationId_key" ON "meeting_agenda_items"("id", "organizationId");
CREATE UNIQUE INDEX "meeting_agenda_items_sessionId_position_key" ON "meeting_agenda_items"("sessionId", "position");
CREATE INDEX "meeting_agenda_items_organizationId_meetingId_status_position_idx" ON "meeting_agenda_items"("organizationId", "meetingId", "status", "position");
CREATE INDEX "meeting_agenda_items_ownerParticipantId_organizationId_idx" ON "meeting_agenda_items"("ownerParticipantId", "organizationId");
CREATE INDEX "meeting_agenda_items_ownerRoleId_organizationId_idx" ON "meeting_agenda_items"("ownerRoleId", "organizationId");
CREATE INDEX "meeting_agenda_items_linkedTensionId_organizationId_idx" ON "meeting_agenda_items"("linkedTensionId", "organizationId");
CREATE INDEX "meeting_agenda_items_linkedProposalId_organizationId_idx" ON "meeting_agenda_items"("linkedProposalId", "organizationId");

CREATE UNIQUE INDEX "meeting_role_representations_organizationId_meetingId_participantId_roleId_key" ON "meeting_role_representations"("organizationId", "meetingId", "participantId", "roleId");
CREATE INDEX "meeting_role_representations_participantId_organizationId_idx" ON "meeting_role_representations"("participantId", "organizationId");
CREATE INDEX "meeting_role_representations_roleId_organizationId_idx" ON "meeting_role_representations"("roleId", "organizationId");

CREATE UNIQUE INDEX "role_checklist_items_roleId_label_key" ON "role_checklist_items"("roleId", "label");
CREATE INDEX "role_checklist_items_organizationId_roleId_active_position_idx" ON "role_checklist_items"("organizationId", "roleId", "active", "position");

CREATE UNIQUE INDEX "governance_objection_reviews_id_organizationId_key" ON "governance_objection_reviews"("id", "organizationId");
CREATE UNIQUE INDEX "governance_objection_reviews_sessionId_proposalId_proposalRevision_sequence_key" ON "governance_objection_reviews"("sessionId", "proposalId", "proposalRevision", "sequence");
CREATE INDEX "governance_objection_reviews_organizationId_meetingId_status_idx" ON "governance_objection_reviews"("organizationId", "meetingId", "status");
CREATE INDEX "governance_objection_reviews_agendaItemId_organizationId_idx" ON "governance_objection_reviews"("agendaItemId", "organizationId");
CREATE INDEX "governance_objection_reviews_objectorParticipantId_organizationId_idx" ON "governance_objection_reviews"("objectorParticipantId", "organizationId");
CREATE INDEX "governance_objection_reviews_objectorRoleId_organizationId_idx" ON "governance_objection_reviews"("objectorRoleId", "organizationId");
CREATE INDEX "governance_objection_reviews_processId_proposalId_organizationId_idx" ON "governance_objection_reviews"("processId", "proposalId", "organizationId");

CREATE UNIQUE INDEX "governance_objection_stances_objectionId_participantId_key" ON "governance_objection_stances"("objectionId", "participantId");
CREATE INDEX "governance_objection_stances_organizationId_objectionId_validity_idx" ON "governance_objection_stances"("organizationId", "objectionId", "validity");
CREATE INDEX "governance_objection_stances_participantId_organizationId_idx" ON "governance_objection_stances"("participantId", "organizationId");

ALTER TABLE "meeting_facilitation_sessions" ADD CONSTRAINT "meeting_facilitation_sessions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_facilitation_sessions" ADD CONSTRAINT "meeting_facilitation_sessions_meetingId_organizationId_fkey" FOREIGN KEY ("meetingId", "organizationId") REFERENCES "meetings"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meeting_facilitation_events" ADD CONSTRAINT "meeting_facilitation_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_facilitation_events" ADD CONSTRAINT "meeting_facilitation_events_meetingId_organizationId_fkey" FOREIGN KEY ("meetingId", "organizationId") REFERENCES "meetings"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_facilitation_events" ADD CONSTRAINT "meeting_facilitation_events_sessionId_organizationId_fkey" FOREIGN KEY ("sessionId", "organizationId") REFERENCES "meeting_facilitation_sessions"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_facilitation_events" ADD CONSTRAINT "meeting_facilitation_events_actorId_organizationId_fkey" FOREIGN KEY ("actorId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "meeting_agenda_items" ADD CONSTRAINT "meeting_agenda_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_agenda_items" ADD CONSTRAINT "meeting_agenda_items_meetingId_organizationId_fkey" FOREIGN KEY ("meetingId", "organizationId") REFERENCES "meetings"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_agenda_items" ADD CONSTRAINT "meeting_agenda_items_sessionId_organizationId_fkey" FOREIGN KEY ("sessionId", "organizationId") REFERENCES "meeting_facilitation_sessions"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_agenda_items" ADD CONSTRAINT "meeting_agenda_items_ownerParticipantId_organizationId_fkey" FOREIGN KEY ("ownerParticipantId", "organizationId") REFERENCES "meeting_participants"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "meeting_agenda_items" ADD CONSTRAINT "meeting_agenda_items_ownerRoleId_organizationId_fkey" FOREIGN KEY ("ownerRoleId", "organizationId") REFERENCES "role_defs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "meeting_agenda_items" ADD CONSTRAINT "meeting_agenda_items_linkedTensionId_organizationId_fkey" FOREIGN KEY ("linkedTensionId", "organizationId") REFERENCES "tensions"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "meeting_agenda_items" ADD CONSTRAINT "meeting_agenda_items_linkedProposalId_organizationId_fkey" FOREIGN KEY ("linkedProposalId", "organizationId") REFERENCES "governance_proposals"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "meeting_role_representations" ADD CONSTRAINT "meeting_role_representations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_role_representations" ADD CONSTRAINT "meeting_role_representations_meetingId_organizationId_fkey" FOREIGN KEY ("meetingId", "organizationId") REFERENCES "meetings"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_role_representations" ADD CONSTRAINT "meeting_role_representations_participantId_organizationId_fkey" FOREIGN KEY ("participantId", "organizationId") REFERENCES "meeting_participants"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_role_representations" ADD CONSTRAINT "meeting_role_representations_roleId_organizationId_fkey" FOREIGN KEY ("roleId", "organizationId") REFERENCES "role_defs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "role_checklist_items" ADD CONSTRAINT "role_checklist_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_checklist_items" ADD CONSTRAINT "role_checklist_items_roleId_organizationId_fkey" FOREIGN KEY ("roleId", "organizationId") REFERENCES "role_defs"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "governance_objection_reviews" ADD CONSTRAINT "governance_objection_reviews_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "governance_objection_reviews" ADD CONSTRAINT "governance_objection_reviews_meetingId_organizationId_fkey" FOREIGN KEY ("meetingId", "organizationId") REFERENCES "meetings"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "governance_objection_reviews" ADD CONSTRAINT "governance_objection_reviews_sessionId_organizationId_fkey" FOREIGN KEY ("sessionId", "organizationId") REFERENCES "meeting_facilitation_sessions"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "governance_objection_reviews" ADD CONSTRAINT "governance_objection_reviews_agendaItemId_organizationId_fkey" FOREIGN KEY ("agendaItemId", "organizationId") REFERENCES "meeting_agenda_items"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "governance_objection_reviews" ADD CONSTRAINT "governance_objection_reviews_proposalId_organizationId_fkey" FOREIGN KEY ("proposalId", "organizationId") REFERENCES "governance_proposals"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "governance_objection_reviews" ADD CONSTRAINT "governance_objection_reviews_processId_proposalId_organizationId_fkey" FOREIGN KEY ("processId", "proposalId", "organizationId") REFERENCES "governance_decision_processes"("id", "proposalId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "governance_objection_reviews" ADD CONSTRAINT "governance_objection_reviews_objectorParticipantId_organizationId_fkey" FOREIGN KEY ("objectorParticipantId", "organizationId") REFERENCES "meeting_participants"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "governance_objection_reviews" ADD CONSTRAINT "governance_objection_reviews_objectorRoleId_organizationId_fkey" FOREIGN KEY ("objectorRoleId", "organizationId") REFERENCES "role_defs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "governance_objection_stances" ADD CONSTRAINT "governance_objection_stances_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "governance_objection_stances" ADD CONSTRAINT "governance_objection_stances_objectionId_organizationId_fkey" FOREIGN KEY ("objectionId", "organizationId") REFERENCES "governance_objection_reviews"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "governance_objection_stances" ADD CONSTRAINT "governance_objection_stances_participantId_organizationId_fkey" FOREIGN KEY ("participantId", "organizationId") REFERENCES "meeting_participants"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
