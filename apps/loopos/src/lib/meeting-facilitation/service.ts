import { randomUUID } from "node:crypto";

import {
  initialGovernanceMeetingState,
  transitionGovernanceMeeting,
  type GovernanceMeetingAction,
} from "./governance-engine";
import type {
  MeetingFacilitationCommand,
  MeetingFacilitationRepository,
  MeetingFacilitationState,
  PersistedFacilitationEvent,
  PersistedFacilitationSession,
  RoleRepresentationInput,
} from "./repository";
import {
  initialTacticalMeetingState,
  transitionTacticalMeeting,
  type TacticalMeetingAction,
} from "./tactical-engine";
import { MeetingEngineError, type MeetingTransitionResult } from "./types";

export type InitializeMeetingFacilitationInput = Readonly<{
  organizationId: string;
  meetingId: string;
  actorPersonId: string;
  representations: readonly RoleRepresentationInput[];
}>;

export type ExecuteMeetingFacilitationInput = Readonly<{
  organizationId: string;
  meetingId: string;
  actorPersonId: string;
  expectedRevision: number;
  command: MeetingFacilitationCommand;
}>;

export function createMeetingFacilitationService(repository: MeetingFacilitationRepository) {
  return {
    async initialize(input: InitializeMeetingFacilitationInput): Promise<PersistedFacilitationSession> {
      const context = await repository.getInitializationContext(input);
      const representedRoleIdsByParticipant = normalizeRepresentations(
        context.participantIds,
        input.representations,
      );
      const state = context.meetingType === "TACTICAL"
        ? initialTacticalMeetingState({
            participantIds: context.participantIds,
            representedRoleIdsByParticipant,
          })
        : initialGovernanceMeetingState({
            participantIds: context.participantIds,
            representedRoleIdsByParticipant,
          });
      return repository.createSession({ ...input, state });
    },

    async execute(input: ExecuteMeetingFacilitationInput): Promise<PersistedFacilitationSession> {
      const current = await repository.loadForActor(input);
      if (current.state.revision !== input.expectedRevision) {
        throw new MeetingEngineError("STALE_MEETING_REVISION");
      }
      const transitionResult = transition(current.state, current.actorParticipantId, input.command);
      return repository.commitTransition({
        ...input,
        sessionId: current.id,
        actorParticipantId: current.actorParticipantId,
        previousState: current.state,
        nextState: transitionResult.state,
        previousLastEventSequence: current.lastEventSequence,
        events: transitionResult.events,
      });
    },

    getSnapshot(input: {
      organizationId: string;
      meetingId: string;
      actorPersonId: string;
    }): Promise<PersistedFacilitationSession> {
      return repository.getSnapshot(input);
    },

    appendEvent(input: {
      organizationId: string;
      meetingId: string;
      actorPersonId: string;
      expectedRevision: number;
      type: string;
      payload: Readonly<Record<string, unknown>>;
    }): Promise<PersistedFacilitationSession> {
      if (!input.type.trim()) throw new MeetingEngineError("EVENT_TYPE_REQUIRED");
      return repository.appendEvent({ ...input, type: input.type.trim() });
    },

    listEvents(input: {
      organizationId: string;
      meetingId: string;
      actorPersonId: string;
      after: number;
      limit?: number;
    }): Promise<readonly PersistedFacilitationEvent[]> {
      if (!Number.isInteger(input.after) || input.after < 0) {
        throw new MeetingEngineError("INVALID_EVENT_CURSOR");
      }
      const limit = input.limit ?? 100;
      if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
        throw new MeetingEngineError("INVALID_EVENT_LIMIT");
      }
      return repository.listEvents({ ...input, limit });
    },
  };
}

function normalizeRepresentations(
  participantIds: readonly string[],
  representations: readonly RoleRepresentationInput[],
): Readonly<Record<string, readonly string[]>> {
  const participantSet = new Set(participantIds);
  const result: Record<string, string[]> = {};
  for (const representation of representations) {
    if (!participantSet.has(representation.participantId)) {
      throw new MeetingEngineError("REPRESENTATION_PARTICIPANT_NOT_IN_MEETING");
    }
    const roleIds = [...new Set(representation.roleIds.map((roleId) => roleId.trim()).filter(Boolean))];
    if (roleIds.length === 0) throw new MeetingEngineError("REPRESENTED_ROLE_REQUIRED");
    if (result[representation.participantId]) {
      throw new MeetingEngineError("DUPLICATE_PARTICIPANT_REPRESENTATION");
    }
    result[representation.participantId] = roleIds;
  }
  if (participantIds.some((participantId) => !result[participantId])) {
    throw new MeetingEngineError("REPRESENTED_ROLE_REQUIRED");
  }
  return result;
}

function transition(
  state: MeetingFacilitationState,
  actorParticipantId: string,
  command: MeetingFacilitationCommand,
): MeetingTransitionResult<MeetingFacilitationState> {
  if (state.engine === "TACTICAL") {
    const action = toTacticalAction(state.revision, actorParticipantId, command);
    return transitionTacticalMeeting(state, action);
  }
  const action = toGovernanceAction(state, actorParticipantId, command);
  return transitionGovernanceMeeting(state, action);
}

function toTacticalAction(
  expectedRevision: number,
  actorId: string,
  command: MeetingFacilitationCommand,
): TacticalMeetingAction {
  const version = { expectedRevision, actorId };
  switch (command.type) {
    case "START":
    case "COMPLETE_TURN":
    case "RESUME":
    case "BACK":
    case "CONFIRM_END":
      return { ...version, type: command.type };
    case "ADD_AGENDA_ITEM":
      return {
        ...version,
        type: "ADD_AGENDA_ITEM",
        item: {
          id: randomUUID(),
          ownerParticipantId: actorId,
          ownerRoleId: command.roleId,
          label: command.label,
          status: "PENDING",
          ...(command.linkedTensionId ? { linkedTensionId: command.linkedTensionId } : {}),
        },
      };
    case "CONFIRM_NEED":
      return { ...version, type: command.type, itemId: command.itemId, need: command.need };
    case "CONFIRM_OUTPUT":
    case "CONFIRM_NEED_MET":
      return { ...version, type: command.type, itemId: command.itemId };
    case "PAUSE":
      return { ...version, type: command.type, reason: command.reason };
    default:
      throw new MeetingEngineError("COMMAND_NOT_ALLOWED_FOR_TACTICAL_MEETING");
  }
}

function toGovernanceAction(
  state: Extract<MeetingFacilitationState, { engine: "GOVERNANCE" }>,
  actorId: string,
  command: MeetingFacilitationCommand,
): GovernanceMeetingAction {
  const expectedRevision = state.revision;
  const version = { expectedRevision, actorId };
  switch (command.type) {
    case "START":
    case "COMPLETE_TURN":
    case "CONFIRM_AI_ASSESSMENTS":
    case "CONFIRM_DISTRIBUTED_REVIEW":
    case "CONFIRM_ADOPTION":
    case "RESUME":
    case "BACK":
    case "CONFIRM_END":
      return { ...version, type: command.type };
    case "ADD_AGENDA_ITEM":
      if (!command.linkedProposalId) throw new MeetingEngineError("GOVERNANCE_PROPOSAL_REQUIRED");
      return {
        ...version,
        type: "ADD_AGENDA_ITEM",
        item: {
          id: randomUUID(),
          ownerParticipantId: actorId,
          ownerRoleId: command.roleId,
          label: command.label,
          status: "PENDING",
          linkedProposalId: command.linkedProposalId,
        },
      };
    case "PRESENT_PROPOSAL":
      return { ...version, type: command.type, itemId: command.itemId, proposalRevision: command.proposalRevision };
    case "PROPOSER_DECISION":
      return { ...version, type: command.type, amended: command.amended, proposalRevision: command.proposalRevision };
    case "RECORD_OBJECTION":
      if (!stateRoleIsRepresented(command.objectorRoleId, actorId)) {
        throw new MeetingEngineError("OBJECTION_ROLE_NOT_REPRESENTED");
      }
      return { ...version, type: command.type, objectionId: command.objectionId, statement: command.statement };
    case "RECORD_AI_ASSESSMENT":
      if (!command.assessment.rationale.trim()) throw new MeetingEngineError("AI_ASSESSMENT_RATIONALE_REQUIRED");
      if (
        !Number.isFinite(command.assessment.confidence)
        || command.assessment.confidence < 0
        || command.assessment.confidence > 1
      ) {
        throw new MeetingEngineError("AI_ASSESSMENT_CONFIDENCE_INVALID");
      }
      if (command.assessment.evidenceRefs.length === 0) {
        throw new MeetingEngineError("AI_ASSESSMENT_EVIDENCE_REQUIRED");
      }
      return { ...version, type: command.type, objectionId: command.objectionId, validity: command.assessment.validity };
    case "RECORD_HUMAN_STANCE":
      if (!command.reason.trim()) throw new MeetingEngineError("HUMAN_STANCE_REASON_REQUIRED");
      return { ...version, type: command.type, objectionId: command.objectionId, validity: command.validity };
    case "CONFIRM_INTEGRATION":
      return {
        ...version,
        type: command.type,
        objectionId: command.objectionId,
        capacity: command.capacity,
        proposalRevision: command.proposalRevision,
      };
    case "PAUSE":
      return { ...version, type: command.type, reason: command.reason };
    default:
      throw new MeetingEngineError("COMMAND_NOT_ALLOWED_FOR_GOVERNANCE_MEETING");
  }

  function stateRoleIsRepresented(roleId: string, participantId: string): boolean {
    return state.representedRoleIdsByParticipant[participantId]?.includes(roleId) ?? false;
  }
}
