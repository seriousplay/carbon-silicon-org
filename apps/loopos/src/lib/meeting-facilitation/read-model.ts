import { effectiveObjectionValidity } from "./governance-engine";
import type { PersistedFacilitationSession } from "./repository";

export type MeetingFacilitationReadModel = Readonly<{
  engine: "TACTICAL" | "GOVERNANCE";
  phase: string;
  revision: number;
  paused: boolean;
  activeAgendaItemId: string | null;
  proposerParticipantId: string | null;
  proposalRevision: number | null;
  completedParticipantIds: readonly string[];
  pendingParticipantIds: readonly string[];
  agenda: readonly Readonly<{
    id: string;
    label: string;
    ownerParticipantId: string;
    ownerRoleId: string;
    status: "PENDING" | "ACTIVE" | "COMPLETED";
    linkedTensionId?: string;
    linkedProposalId?: string;
    need?: string;
    outputConfirmed: boolean;
    needMet: boolean;
  }>[];
  objections: readonly Readonly<{
    id: string;
    objectorParticipantId: string;
    statement: string;
    aiValidity: "VALID" | "INVALID" | "INSUFFICIENT_INFO" | null;
    effectiveValidity: boolean;
    humanStanceCount: number;
    objectorConfirmed: boolean;
    proposerConfirmed: boolean;
    integrated: boolean;
  }>[];
  nextEventCursor: number;
}>;

export function buildMeetingFacilitationReadModel(
  session: PersistedFacilitationSession,
): MeetingFacilitationReadModel {
  const state = session.state;
  const completed = new Set(state.completedParticipantIds);
  return {
    engine: state.engine,
    phase: state.phase,
    revision: state.revision,
    paused: state.paused,
    activeAgendaItemId: state.activeAgendaItemId,
    proposerParticipantId: state.engine === "GOVERNANCE" ? state.proposerParticipantId : null,
    proposalRevision: state.engine === "GOVERNANCE" ? state.proposalRevision : null,
    completedParticipantIds: [...state.completedParticipantIds],
    pendingParticipantIds: state.participantIds.filter((participantId) => !completed.has(participantId)),
    agenda: state.agenda.map((item) => ({
      id: item.id,
      label: item.label,
      ownerParticipantId: item.ownerParticipantId,
      ownerRoleId: item.ownerRoleId,
      status: item.status,
      ...(item.linkedTensionId ? { linkedTensionId: item.linkedTensionId } : {}),
      ...(item.linkedProposalId ? { linkedProposalId: item.linkedProposalId } : {}),
      ...(item.need ? { need: item.need } : {}),
      outputConfirmed: item.outputConfirmed === true,
      needMet: item.needMet === true,
    })),
    objections: state.engine === "GOVERNANCE"
      ? state.objections.map((objection) => ({
          id: objection.id,
          objectorParticipantId: objection.objectorParticipantId,
          statement: objection.statement,
          aiValidity: objection.aiValidity,
          effectiveValidity: effectiveObjectionValidity(objection),
          humanStanceCount: Object.keys(objection.humanStances).length,
          objectorConfirmed: objection.objectorConfirmed,
          proposerConfirmed: objection.proposerConfirmed,
          integrated: objection.integrated,
        }))
      : [],
    nextEventCursor: session.lastEventSequence,
  };
}
