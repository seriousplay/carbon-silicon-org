DROP TABLE "governance_objection_stances";
DROP TABLE "governance_objection_reviews";
DROP TABLE "role_checklist_items";
DROP TABLE "meeting_role_representations";
DROP TABLE "meeting_agenda_items";
DROP TABLE "meeting_facilitation_events";
DROP TABLE "meeting_facilitation_sessions";

DROP INDEX "meeting_participants_id_organizationId_key";

DROP TYPE "GovernanceObjectionStanceValue";
DROP TYPE "GovernanceObjectionReviewStatus";
DROP TYPE "GovernanceObjectionValidity";
DROP TYPE "MeetingAgendaStatus";
DROP TYPE "MeetingFacilitationEngine";
