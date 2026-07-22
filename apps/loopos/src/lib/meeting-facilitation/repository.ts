import type { GovernanceMeetingState, ObjectionValidity } from "./governance-engine";
import type { TacticalMeetingState } from "./tactical-engine";
import type { MeetingEngineEvent } from "./types";
import type { TacticalOutputCandidate } from "./types";

export type MeetingFacilitationState = TacticalMeetingState | GovernanceMeetingState;

export type RoleRepresentationInput = Readonly<{
  participantId: string;
  roleIds: readonly string[];
}>;

export type MeetingInitializationContext = Readonly<{
  meetingType: "TACTICAL" | "GOVERNANCE";
  participantIds: readonly string[];
}>;

export type PersistedFacilitationSession = Readonly<{
  id: string;
  organizationId: string;
  meetingId: string;
  actorParticipantId: string;
  state: MeetingFacilitationState;
  lastEventSequence: number;
}>;

export type PersistedFacilitationEvent = Readonly<{
  sequence: number;
  stateRevision: number;
  actorPersonId: string | null;
  type: string;
  payload: Readonly<Record<string, unknown>>;
  createdAt: Date;
}>;

export type ObjectionAssessmentDetails = Readonly<{
  validity: ObjectionValidity;
  rationale: string;
  confidence: number;
  criteria: Readonly<Record<string, unknown>>;
  evidenceRefs: readonly string[];
}>;

export type MeetingFacilitationCommand =
  | Readonly<{ type: "START" }>
  | Readonly<{ type: "COMPLETE_TURN"; content?: string }>
  | Readonly<{
      type: "ADD_AGENDA_ITEM";
      roleId: string;
      label: string;
      linkedTensionId?: string;
      linkedProposalId?: string;
    }>
  | Readonly<{ type: "CONFIRM_NEED"; itemId: string; need: string }>
  | Readonly<{ type: "PROPOSE_OUTPUT"; itemId: string; candidateOutput: TacticalOutputCandidate }>
  | Readonly<{ type: "CONFIRM_OUTPUT"; itemId: string }>
  | Readonly<{ type: "CONFIRM_NEED_MET"; itemId: string }>
  | Readonly<{ type: "PRESENT_PROPOSAL"; itemId: string; proposalRevision: number }>
  | Readonly<{ type: "PROPOSER_DECISION"; amended: boolean; proposalRevision: number }>
  | Readonly<{
      type: "RECORD_OBJECTION";
      objectionId: string;
      objectorRoleId: string;
      statement: string;
      criteria: Readonly<Record<string, unknown>>;
    }>
  | Readonly<{ type: "RECORD_AI_ASSESSMENT"; objectionId: string; assessment: ObjectionAssessmentDetails }>
  | Readonly<{ type: "CONFIRM_AI_ASSESSMENTS" }>
  | Readonly<{
      type: "RECORD_HUMAN_STANCE";
      objectionId: string;
      validity: "VALID" | "INVALID";
      reason: string;
    }>
  | Readonly<{ type: "CONFIRM_DISTRIBUTED_REVIEW" }>
  | Readonly<{
      type: "CONFIRM_INTEGRATION";
      objectionId: string;
      capacity: "OBJECTOR" | "PROPOSER";
      proposalRevision: number;
    }>
  | Readonly<{ type: "CONFIRM_ADOPTION" }>
  | Readonly<{ type: "PAUSE"; reason: string }>
  | Readonly<{ type: "RESUME" }>
  | Readonly<{ type: "BACK" }>
  | Readonly<{ type: "CONFIRM_END" }>;

export type TransitionCommit = Readonly<{
  organizationId: string;
  meetingId: string;
  sessionId: string;
  actorPersonId: string;
  actorParticipantId: string;
  expectedRevision: number;
  previousState: MeetingFacilitationState;
  nextState: MeetingFacilitationState;
  previousLastEventSequence: number;
  events: readonly MeetingEngineEvent[];
  command: MeetingFacilitationCommand;
}>;

export interface MeetingFacilitationRepository {
  getInitializationContext(input: {
    organizationId: string;
    meetingId: string;
    actorPersonId: string;
  }): Promise<MeetingInitializationContext>;

  createSession(input: {
    organizationId: string;
    meetingId: string;
    actorPersonId: string;
    state: MeetingFacilitationState;
    representations: readonly RoleRepresentationInput[];
  }): Promise<PersistedFacilitationSession>;

  loadForActor(input: {
    organizationId: string;
    meetingId: string;
    actorPersonId: string;
  }): Promise<PersistedFacilitationSession>;

  commitTransition(input: TransitionCommit): Promise<PersistedFacilitationSession>;

  appendEvent(input: {
    organizationId: string;
    meetingId: string;
    actorPersonId: string;
    expectedRevision: number;
    type: string;
    payload: Readonly<Record<string, unknown>>;
  }): Promise<PersistedFacilitationSession>;

  getSnapshot(input: {
    organizationId: string;
    meetingId: string;
    actorPersonId: string;
  }): Promise<PersistedFacilitationSession>;

  listEvents(input: {
    organizationId: string;
    meetingId: string;
    actorPersonId: string;
    after: number;
    limit: number;
  }): Promise<readonly PersistedFacilitationEvent[]>;
}

export class MeetingFacilitationRepositoryError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "MeetingFacilitationRepositoryError";
  }
}
