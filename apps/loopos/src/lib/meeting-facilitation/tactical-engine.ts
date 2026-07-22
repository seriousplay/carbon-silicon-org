import {
  MeetingEngineError,
  assertExpectedRevision,
  assertParticipant,
  completedTurn,
  nextPendingAgendaItem,
  replaceAgendaItem,
  type MeetingAgendaState,
  type MeetingTransitionResult,
  type TacticalMeetingPhase,
} from "./types";

export type TacticalMeetingState = Readonly<{
  engine: "TACTICAL";
  phase: TacticalMeetingPhase;
  revision: number;
  paused: boolean;
  participantIds: readonly string[];
  representedRoleIdsByParticipant: Readonly<Record<string, readonly string[]>>;
  completedParticipantIds: readonly string[];
  agenda: readonly MeetingAgendaState[];
  activeAgendaItemId: string | null;
}>;

type VersionedAction = Readonly<{ actorId: string; expectedRevision: number }>;

export type TacticalMeetingAction =
  | (VersionedAction & { type: "START" })
  | (VersionedAction & { type: "COMPLETE_TURN" })
  | (VersionedAction & { type: "ADD_AGENDA_ITEM"; item: MeetingAgendaState })
  | (VersionedAction & { type: "CONFIRM_NEED"; itemId: string; need: string })
  | (VersionedAction & { type: "CONFIRM_OUTPUT"; itemId: string })
  | (VersionedAction & { type: "CONFIRM_NEED_MET"; itemId: string })
  | (VersionedAction & { type: "PAUSE"; reason: string })
  | (VersionedAction & { type: "RESUME" })
  | (VersionedAction & { type: "BACK" })
  | (VersionedAction & { type: "CONFIRM_END" });

const TURN_PHASES: readonly TacticalMeetingPhase[] = [
  "CHECK_IN",
  "CHECKLIST_REVIEW",
  "METRICS_REVIEW",
  "PROJECT_UPDATES",
  "BUILD_AGENDA",
  "CLOSING_ROUND",
];

const NEXT_TURN_PHASE: Partial<Record<TacticalMeetingPhase, TacticalMeetingPhase>> = {
  CHECK_IN: "CHECKLIST_REVIEW",
  CHECKLIST_REVIEW: "METRICS_REVIEW",
  METRICS_REVIEW: "PROJECT_UPDATES",
  PROJECT_UPDATES: "BUILD_AGENDA",
};

export function initialTacticalMeetingState(input: {
  participantIds: readonly string[];
  representedRoleIdsByParticipant: Readonly<Record<string, readonly string[]>>;
}): TacticalMeetingState {
  if (input.participantIds.length === 0) throw new MeetingEngineError("MEETING_REQUIRES_PARTICIPANT");
  for (const participantId of input.participantIds) {
    if ((input.representedRoleIdsByParticipant[participantId]?.length ?? 0) === 0) {
      throw new MeetingEngineError("REPRESENTED_ROLE_REQUIRED");
    }
  }
  return {
    engine: "TACTICAL",
    phase: "ENTRY",
    revision: 0,
    paused: false,
    participantIds: [...input.participantIds],
    representedRoleIdsByParticipant: Object.fromEntries(
      Object.entries(input.representedRoleIdsByParticipant).map(([participantId, roleIds]) => [
        participantId,
        [...roleIds],
      ]),
    ),
    completedParticipantIds: [],
    agenda: [],
    activeAgendaItemId: null,
  };
}

export function transitionTacticalMeeting(
  state: TacticalMeetingState,
  action: TacticalMeetingAction,
): MeetingTransitionResult<TacticalMeetingState> {
  if (state.engine !== "TACTICAL") throw new MeetingEngineError("WRONG_MEETING_ENGINE");
  assertExpectedRevision(state.revision, action.expectedRevision);
  assertParticipant(state.participantIds, action.actorId);

  if (state.paused && action.type !== "RESUME") throw new MeetingEngineError("MEETING_PAUSED");
  if (!state.paused && action.type === "RESUME") throw new MeetingEngineError("MEETING_NOT_PAUSED");

  if (action.type === "PAUSE") {
    if (state.phase === "COMPLETED") throw new MeetingEngineError("MEETING_COMPLETED");
    return result(state, { paused: true }, "MEETING_PAUSED", { reason: requiredText(action.reason, "PAUSE_REASON_REQUIRED") });
  }
  if (action.type === "RESUME") return result(state, { paused: false }, "MEETING_RESUMED");

  switch (action.type) {
    case "START":
      requirePhase(state.phase, "ENTRY");
      return result(state, { phase: "CHECK_IN", completedParticipantIds: [] }, "PHASE_CHANGED", { phase: "CHECK_IN" });
    case "COMPLETE_TURN":
      return completeTurn(state, action.actorId);
    case "ADD_AGENDA_ITEM":
      return addAgendaItem(state, action.item);
    case "CONFIRM_NEED":
      return confirmNeed(state, action.actorId, action.itemId, action.need);
    case "CONFIRM_OUTPUT":
      return confirmOutput(state, action.itemId);
    case "CONFIRM_NEED_MET":
      return confirmNeedMet(state, action.actorId, action.itemId);
    case "BACK":
      return back(state);
    case "CONFIRM_END":
      requirePhase(state.phase, "CLOSING_ROUND");
      if (!completedTurn(state.participantIds, state.completedParticipantIds)) {
        throw new MeetingEngineError("CLOSING_ROUND_INCOMPLETE");
      }
      return {
        state: { ...state, phase: "COMPLETED", revision: state.revision + 1 },
        events: [{ type: "MEETING_COMPLETED" }],
        effects: [{ type: "END_MEETING" }],
      };
  }
}

function completeTurn(
  state: TacticalMeetingState,
  actorId: string,
): MeetingTransitionResult<TacticalMeetingState> {
  if (!TURN_PHASES.includes(state.phase)) throw new MeetingEngineError("TURN_NOT_ALLOWED_IN_PHASE");
  if (state.completedParticipantIds.includes(actorId)) throw new MeetingEngineError("TURN_ALREADY_COMPLETED");
  const completedParticipantIds = [...state.completedParticipantIds, actorId];
  if (!completedTurn(state.participantIds, completedParticipantIds)) {
    return result(state, { completedParticipantIds }, "PARTICIPANT_TURN_COMPLETED", { participantId: actorId });
  }
  if (state.phase === "BUILD_AGENDA") {
    const first = nextPendingAgendaItem(state.agenda);
    const phase: TacticalMeetingPhase = first ? "TRIAGE_ITEM" : "CLOSING_ROUND";
    const agenda = first
      ? replaceAgendaItem(state.agenda, first.id, (item) => ({ ...item, status: "ACTIVE" }))
      : state.agenda;
    return result(
      state,
      { phase, completedParticipantIds: [], activeAgendaItemId: first?.id ?? null, agenda },
      "PHASE_CHANGED",
      { phase },
    );
  }
  if (state.phase === "CLOSING_ROUND") {
    return result(state, { completedParticipantIds }, "CLOSING_ROUND_READY_FOR_CONFIRMATION");
  }
  const phase = NEXT_TURN_PHASE[state.phase];
  if (!phase) throw new MeetingEngineError("NEXT_PHASE_NOT_DEFINED");
  return result(state, { phase, completedParticipantIds: [] }, "PHASE_CHANGED", { phase });
}

function addAgendaItem(
  state: TacticalMeetingState,
  item: MeetingAgendaState,
): MeetingTransitionResult<TacticalMeetingState> {
  if (!["BUILD_AGENDA", "TRIAGE_ITEM"].includes(state.phase)) throw new MeetingEngineError("AGENDA_CLOSED");
  if (state.agenda.some((existing) => existing.id === item.id)) throw new MeetingEngineError("AGENDA_ITEM_EXISTS");
  if (!state.participantIds.includes(item.ownerParticipantId)) throw new MeetingEngineError("AGENDA_OWNER_NOT_PARTICIPANT");
  if (!state.representedRoleIdsByParticipant[item.ownerParticipantId]?.includes(item.ownerRoleId)) {
    throw new MeetingEngineError("AGENDA_ROLE_NOT_REPRESENTED");
  }
  const label = requiredText(item.label, "AGENDA_LABEL_REQUIRED");
  return result(state, { agenda: [...state.agenda, { ...item, label, status: "PENDING" }] }, "AGENDA_ITEM_ADDED", { itemId: item.id });
}

function confirmNeed(
  state: TacticalMeetingState,
  actorId: string,
  itemId: string,
  need: string,
): MeetingTransitionResult<TacticalMeetingState> {
  requirePhase(state.phase, "TRIAGE_ITEM");
  const item = activeItem(state, itemId);
  if (item.ownerParticipantId !== actorId) throw new MeetingEngineError("ONLY_AGENDA_OWNER_CAN_CONFIRM_NEED");
  const agenda = replaceAgendaItem(state.agenda, itemId, (current) => ({
    ...current,
    need: requiredText(need, "AGENDA_NEED_REQUIRED"),
  }));
  return result(state, { agenda }, "AGENDA_NEED_CONFIRMED", { itemId });
}

function confirmOutput(
  state: TacticalMeetingState,
  itemId: string,
): MeetingTransitionResult<TacticalMeetingState> {
  requirePhase(state.phase, "TRIAGE_ITEM");
  const item = activeItem(state, itemId);
  if (!item.need) throw new MeetingEngineError("AGENDA_NEED_NOT_CONFIRMED");
  const agenda = replaceAgendaItem(state.agenda, itemId, (current) => ({ ...current, outputConfirmed: true }));
  return {
    state: { ...state, agenda, revision: state.revision + 1 },
    events: [{ type: "TACTICAL_OUTPUT_CONFIRMED", payload: { itemId } }],
    effects: [{ type: "CREATE_TACTICAL_OUTPUT", payload: { itemId } }],
  };
}

function confirmNeedMet(
  state: TacticalMeetingState,
  actorId: string,
  itemId: string,
): MeetingTransitionResult<TacticalMeetingState> {
  requirePhase(state.phase, "TRIAGE_ITEM");
  const item = activeItem(state, itemId);
  if (item.ownerParticipantId !== actorId) throw new MeetingEngineError("ONLY_AGENDA_OWNER_CAN_CLOSE_ITEM");
  if (!item.need) throw new MeetingEngineError("AGENDA_NEED_NOT_CONFIRMED");
  const completedAgenda = replaceAgendaItem(state.agenda, itemId, (current) => ({
    ...current,
    status: "COMPLETED",
    needMet: true,
  }));
  const next = nextPendingAgendaItem(completedAgenda);
  const agenda = next
    ? replaceAgendaItem(completedAgenda, next.id, (current) => ({ ...current, status: "ACTIVE" }))
    : completedAgenda;
  const phase: TacticalMeetingPhase = next ? "TRIAGE_ITEM" : "CLOSING_ROUND";
  return result(
    state,
    { agenda, phase, activeAgendaItemId: next?.id ?? null, completedParticipantIds: [] },
    "AGENDA_ITEM_COMPLETED",
    { itemId, nextItemId: next?.id ?? null },
  );
}

function back(state: TacticalMeetingState): MeetingTransitionResult<TacticalMeetingState> {
  const previous: Partial<Record<TacticalMeetingPhase, TacticalMeetingPhase>> = {
    CHECKLIST_REVIEW: "CHECK_IN",
    METRICS_REVIEW: "CHECKLIST_REVIEW",
    PROJECT_UPDATES: "METRICS_REVIEW",
    BUILD_AGENDA: "PROJECT_UPDATES",
    CLOSING_ROUND: state.agenda.length > 0 ? "TRIAGE_ITEM" : "BUILD_AGENDA",
  };
  const phase = previous[state.phase];
  if (!phase) throw new MeetingEngineError("PHASE_NOT_REVERSIBLE");
  if (state.phase === "CLOSING_ROUND" && state.agenda.some((item) => item.outputConfirmed)) {
    throw new MeetingEngineError("COMMITTED_OUTPUT_REQUIRES_CORRECTION");
  }
  return result(state, { phase, completedParticipantIds: [] }, "PHASE_REVERSED", { phase });
}

function activeItem(state: TacticalMeetingState, itemId: string): MeetingAgendaState {
  if (state.activeAgendaItemId !== itemId) throw new MeetingEngineError("AGENDA_ITEM_NOT_ACTIVE");
  const item = state.agenda.find((candidate) => candidate.id === itemId);
  if (!item || item.status !== "ACTIVE") throw new MeetingEngineError("AGENDA_ITEM_NOT_ACTIVE");
  return item;
}

function requirePhase(actual: TacticalMeetingPhase, expected: TacticalMeetingPhase): void {
  if (actual !== expected) throw new MeetingEngineError("TACTICAL_ACTION_NOT_ALLOWED_IN_PHASE");
}

function requiredText(value: string, code: string): string {
  const text = value.trim();
  if (!text) throw new MeetingEngineError(code);
  return text;
}

function result(
  state: TacticalMeetingState,
  patch: Partial<TacticalMeetingState>,
  eventType: string,
  payload?: Readonly<Record<string, unknown>>,
): MeetingTransitionResult<TacticalMeetingState> {
  return {
    state: { ...state, ...patch, revision: state.revision + 1 },
    events: [{ type: eventType, ...(payload ? { payload } : {}) }],
    effects: [],
  };
}
