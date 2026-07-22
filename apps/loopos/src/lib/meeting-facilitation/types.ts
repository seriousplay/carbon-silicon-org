export type MeetingEngineType = "TACTICAL" | "GOVERNANCE";

export type TacticalMeetingPhase =
  | "ENTRY"
  | "CHECK_IN"
  | "CHECKLIST_REVIEW"
  | "METRICS_REVIEW"
  | "PROJECT_UPDATES"
  | "BUILD_AGENDA"
  | "TRIAGE_ITEM"
  | "CLOSING_ROUND"
  | "COMPLETED";

export type GovernanceMeetingPhase =
  | "ENTRY"
  | "CHECK_IN"
  | "BUILD_AGENDA"
  | "PRESENT_PROPOSAL"
  | "CLARIFYING_QUESTIONS"
  | "REACTION_ROUND"
  | "AMEND_OR_CLARIFY"
  | "OBJECTION_ROUND"
  | "AI_ASSESSMENT"
  | "DISTRIBUTED_REVIEW"
  | "INTEGRATION"
  | "ADOPTION_CONFIRMATION"
  | "CLOSING_ROUND"
  | "COMPLETED";

export type MeetingAgendaStatus = "PENDING" | "ACTIVE" | "COMPLETED";

export type TacticalOutputCandidate = Readonly<{
  proposalId: string;
  proposalRevision: number;
  kind: "PROJECT" | "ACTION";
  title: string;
  responsibleParticipantId: string;
  responsiblePersonId: string;
}>;

export type MeetingAgendaState = Readonly<{
  id: string;
  ownerParticipantId: string;
  ownerRoleId: string;
  label: string;
  status: MeetingAgendaStatus;
  linkedTensionId?: string;
  linkedProposalId?: string;
  need?: string;
  candidateOutput?: TacticalOutputCandidate;
  outputConfirmed?: boolean;
  needMet?: boolean;
}>;

export type MeetingEngineEvent = Readonly<{
  type: string;
  payload?: Readonly<Record<string, unknown>>;
}>;

export type MeetingEngineEffect = Readonly<{
  type:
    | "REQUEST_COACH_INTERVENTION"
    | "REQUEST_HUMAN_CONFIRMATION"
    | "CREATE_TACTICAL_OUTPUT"
    | "ADOPT_GOVERNANCE_PROPOSAL"
    | "END_MEETING";
  payload?: Readonly<Record<string, unknown>>;
}>;

export type MeetingTransitionResult<State> = Readonly<{
  state: State;
  events: readonly MeetingEngineEvent[];
  effects: readonly MeetingEngineEffect[];
}>;

export class MeetingEngineError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "MeetingEngineError";
  }
}

export function assertExpectedRevision(actual: number, expected: number): void {
  if (!Number.isInteger(expected) || expected !== actual) {
    throw new MeetingEngineError("STALE_MEETING_REVISION");
  }
}

export function assertParticipant(participantIds: readonly string[], actorId: string): void {
  if (!participantIds.includes(actorId)) throw new MeetingEngineError("ACTOR_NOT_PARTICIPANT");
}

export function completedTurn(
  requiredParticipantIds: readonly string[],
  completedParticipantIds: readonly string[],
): boolean {
  return requiredParticipantIds.every((participantId) => completedParticipantIds.includes(participantId));
}

export function replaceAgendaItem(
  agenda: readonly MeetingAgendaState[],
  itemId: string,
  update: (item: MeetingAgendaState) => MeetingAgendaState,
): readonly MeetingAgendaState[] {
  let found = false;
  const next = agenda.map((item) => {
    if (item.id !== itemId) return item;
    found = true;
    return update(item);
  });
  if (!found) throw new MeetingEngineError("AGENDA_ITEM_NOT_FOUND");
  return next;
}

export function nextPendingAgendaItem(agenda: readonly MeetingAgendaState[]): MeetingAgendaState | null {
  return agenda.find((item) => item.status === "PENDING") ?? null;
}
