import {
  MeetingEngineError,
  assertExpectedRevision,
  assertParticipant,
  completedTurn,
  nextPendingAgendaItem,
  replaceAgendaItem,
  type GovernanceMeetingPhase,
  type MeetingAgendaState,
  type MeetingTransitionResult,
} from "./types";

export type ObjectionValidity = "VALID" | "INVALID" | "INSUFFICIENT_INFO";

export type GovernanceObjectionState = Readonly<{
  id: string;
  objectorParticipantId: string;
  proposalRevision: number;
  statement: string;
  aiValidity: ObjectionValidity | null;
  humanStances: Readonly<Record<string, Exclude<ObjectionValidity, "INSUFFICIENT_INFO">>>;
  integrationRevision: number | null;
  objectorConfirmed: boolean;
  proposerConfirmed: boolean;
  integrated: boolean;
}>;

export type GovernanceMeetingState = Readonly<{
  engine: "GOVERNANCE";
  phase: GovernanceMeetingPhase;
  revision: number;
  paused: boolean;
  participantIds: readonly string[];
  representedRoleIdsByParticipant: Readonly<Record<string, readonly string[]>>;
  completedParticipantIds: readonly string[];
  agenda: readonly MeetingAgendaState[];
  activeAgendaItemId: string | null;
  proposerParticipantId: string | null;
  proposalRevision: number;
  objections: readonly GovernanceObjectionState[];
}>;

type VersionedAction = Readonly<{ actorId: string; expectedRevision: number }>;

export type GovernanceMeetingAction =
  | (VersionedAction & { type: "START" })
  | (VersionedAction & { type: "COMPLETE_TURN" })
  | (VersionedAction & { type: "ADD_AGENDA_ITEM"; item: MeetingAgendaState })
  | (VersionedAction & { type: "PRESENT_PROPOSAL"; itemId: string; proposalRevision: number })
  | (VersionedAction & { type: "PROPOSER_DECISION"; amended: boolean; proposalRevision: number })
  | (VersionedAction & { type: "RECORD_OBJECTION"; objectionId: string; statement: string })
  | (VersionedAction & { type: "RECORD_AI_ASSESSMENT"; objectionId: string; validity: ObjectionValidity })
  | (VersionedAction & { type: "CONFIRM_AI_ASSESSMENTS" })
  | (VersionedAction & { type: "RECORD_HUMAN_STANCE"; objectionId: string; validity: "VALID" | "INVALID" })
  | (VersionedAction & { type: "CONFIRM_DISTRIBUTED_REVIEW" })
  | (VersionedAction & { type: "CONFIRM_INTEGRATION"; objectionId: string; capacity: "OBJECTOR" | "PROPOSER"; proposalRevision: number })
  | (VersionedAction & { type: "CONFIRM_ADOPTION" })
  | (VersionedAction & { type: "PAUSE"; reason: string })
  | (VersionedAction & { type: "RESUME" })
  | (VersionedAction & { type: "BACK" })
  | (VersionedAction & { type: "CONFIRM_END" });

export function initialGovernanceMeetingState(input: {
  participantIds: readonly string[];
  representedRoleIdsByParticipant: Readonly<Record<string, readonly string[]>>;
}): GovernanceMeetingState {
  if (input.participantIds.length === 0) throw new MeetingEngineError("MEETING_REQUIRES_PARTICIPANT");
  for (const participantId of input.participantIds) {
    if ((input.representedRoleIdsByParticipant[participantId]?.length ?? 0) === 0) {
      throw new MeetingEngineError("REPRESENTED_ROLE_REQUIRED");
    }
  }
  return {
    engine: "GOVERNANCE",
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
    proposerParticipantId: null,
    proposalRevision: 0,
    objections: [],
  };
}

export function transitionGovernanceMeeting(
  state: GovernanceMeetingState,
  action: GovernanceMeetingAction,
): MeetingTransitionResult<GovernanceMeetingState> {
  if (state.engine !== "GOVERNANCE") throw new MeetingEngineError("WRONG_MEETING_ENGINE");
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
    case "PRESENT_PROPOSAL":
      return presentProposal(state, action.actorId, action.itemId, action.proposalRevision);
    case "PROPOSER_DECISION":
      return proposerDecision(state, action.actorId, action.amended, action.proposalRevision);
    case "RECORD_OBJECTION":
      return recordObjection(state, action.actorId, action.objectionId, action.statement);
    case "RECORD_AI_ASSESSMENT":
      return recordAiAssessment(state, action.objectionId, action.validity);
    case "CONFIRM_AI_ASSESSMENTS":
      return confirmAiAssessments(state);
    case "RECORD_HUMAN_STANCE":
      return recordHumanStance(state, action.actorId, action.objectionId, action.validity);
    case "CONFIRM_DISTRIBUTED_REVIEW":
      return confirmDistributedReview(state);
    case "CONFIRM_INTEGRATION":
      return confirmIntegration(state, action.actorId, action.objectionId, action.capacity, action.proposalRevision);
    case "CONFIRM_ADOPTION":
      return confirmAdoption(state);
    case "BACK":
      return back(state);
    case "CONFIRM_END":
      requirePhase(state.phase, "CLOSING_ROUND");
      if (!completedTurn(state.participantIds, state.completedParticipantIds)) throw new MeetingEngineError("CLOSING_ROUND_INCOMPLETE");
      return {
        state: { ...state, phase: "COMPLETED", revision: state.revision + 1 },
        events: [{ type: "MEETING_COMPLETED" }],
        effects: [{ type: "END_MEETING" }],
      };
  }
}

function completeTurn(state: GovernanceMeetingState, actorId: string): MeetingTransitionResult<GovernanceMeetingState> {
  const allowed = ["CHECK_IN", "BUILD_AGENDA", "CLARIFYING_QUESTIONS", "REACTION_ROUND", "OBJECTION_ROUND", "CLOSING_ROUND"];
  if (!allowed.includes(state.phase)) throw new MeetingEngineError("TURN_NOT_ALLOWED_IN_PHASE");
  const required = requiredTurnParticipants(state);
  if (!required.includes(actorId)) throw new MeetingEngineError("ACTOR_HAS_NO_TURN_IN_PHASE");
  if (state.completedParticipantIds.includes(actorId)) throw new MeetingEngineError("TURN_ALREADY_COMPLETED");
  const completedParticipantIds = [...state.completedParticipantIds, actorId];
  if (!completedTurn(required, completedParticipantIds)) {
    return result(state, { completedParticipantIds }, "PARTICIPANT_TURN_COMPLETED", { participantId: actorId });
  }

  if (state.phase === "CHECK_IN") return result(state, { phase: "BUILD_AGENDA", completedParticipantIds: [] }, "PHASE_CHANGED", { phase: "BUILD_AGENDA" });
  if (state.phase === "BUILD_AGENDA") return activateNextProposal(state);
  if (state.phase === "CLARIFYING_QUESTIONS") return result(state, { phase: "REACTION_ROUND", completedParticipantIds: [] }, "PHASE_CHANGED", { phase: "REACTION_ROUND" });
  if (state.phase === "REACTION_ROUND") return result(state, { phase: "AMEND_OR_CLARIFY", completedParticipantIds: [] }, "PHASE_CHANGED", { phase: "AMEND_OR_CLARIFY" });
  if (state.phase === "OBJECTION_ROUND") {
    const phase: GovernanceMeetingPhase = state.objections.length > 0 ? "AI_ASSESSMENT" : "ADOPTION_CONFIRMATION";
    return result(state, { phase, completedParticipantIds: [] }, "PHASE_CHANGED", { phase });
  }
  return result(state, { completedParticipantIds }, "CLOSING_ROUND_READY_FOR_CONFIRMATION");
}

function addAgendaItem(state: GovernanceMeetingState, item: MeetingAgendaState): MeetingTransitionResult<GovernanceMeetingState> {
  if (state.phase !== "BUILD_AGENDA") throw new MeetingEngineError("AGENDA_CLOSED");
  if (state.agenda.some((existing) => existing.id === item.id)) throw new MeetingEngineError("AGENDA_ITEM_EXISTS");
  if (!state.participantIds.includes(item.ownerParticipantId)) throw new MeetingEngineError("AGENDA_OWNER_NOT_PARTICIPANT");
  if (!state.representedRoleIdsByParticipant[item.ownerParticipantId]?.includes(item.ownerRoleId)) {
    throw new MeetingEngineError("AGENDA_ROLE_NOT_REPRESENTED");
  }
  const agenda = [...state.agenda, { ...item, label: requiredText(item.label, "AGENDA_LABEL_REQUIRED"), status: "PENDING" as const }];
  return result(state, { agenda }, "AGENDA_ITEM_ADDED", { itemId: item.id });
}

function activateNextProposal(state: GovernanceMeetingState): MeetingTransitionResult<GovernanceMeetingState> {
  const next = nextPendingAgendaItem(state.agenda);
  if (!next) return result(state, { phase: "CLOSING_ROUND", completedParticipantIds: [] }, "PHASE_CHANGED", { phase: "CLOSING_ROUND" });
  const agenda = replaceAgendaItem(state.agenda, next.id, (item) => ({ ...item, status: "ACTIVE" }));
  return result(state, {
    agenda,
    activeAgendaItemId: next.id,
    proposerParticipantId: next.ownerParticipantId,
    proposalRevision: 0,
    objections: [],
    completedParticipantIds: [],
    phase: "PRESENT_PROPOSAL",
  }, "PHASE_CHANGED", { phase: "PRESENT_PROPOSAL", itemId: next.id });
}

function presentProposal(state: GovernanceMeetingState, actorId: string, itemId: string, proposalRevision: number): MeetingTransitionResult<GovernanceMeetingState> {
  requirePhase(state.phase, "PRESENT_PROPOSAL");
  if (state.activeAgendaItemId !== itemId) throw new MeetingEngineError("AGENDA_ITEM_NOT_ACTIVE");
  if (state.proposerParticipantId !== actorId) throw new MeetingEngineError("ONLY_PROPOSER_CAN_PRESENT");
  if (!Number.isInteger(proposalRevision) || proposalRevision < 1) throw new MeetingEngineError("INVALID_PROPOSAL_REVISION");
  return result(state, { phase: "CLARIFYING_QUESTIONS", proposalRevision, completedParticipantIds: [] }, "PROPOSAL_PRESENTED", { itemId, proposalRevision });
}

function proposerDecision(state: GovernanceMeetingState, actorId: string, amended: boolean, proposalRevision: number): MeetingTransitionResult<GovernanceMeetingState> {
  requirePhase(state.phase, "AMEND_OR_CLARIFY");
  if (state.proposerParticipantId !== actorId) throw new MeetingEngineError("ONLY_PROPOSER_CAN_AMEND");
  const expected = amended ? state.proposalRevision + 1 : state.proposalRevision;
  if (proposalRevision !== expected) throw new MeetingEngineError("INVALID_PROPOSAL_REVISION");
  return result(state, { phase: "OBJECTION_ROUND", proposalRevision, objections: [], completedParticipantIds: [] }, "PROPOSER_DECISION_RECORDED", { amended, proposalRevision });
}

function recordObjection(state: GovernanceMeetingState, actorId: string, objectionId: string, statement: string): MeetingTransitionResult<GovernanceMeetingState> {
  requirePhase(state.phase, "OBJECTION_ROUND");
  if (state.completedParticipantIds.includes(actorId)) throw new MeetingEngineError("TURN_ALREADY_COMPLETED");
  if (state.objections.some((objection) => objection.id === objectionId)) throw new MeetingEngineError("OBJECTION_EXISTS");
  const objection: GovernanceObjectionState = {
    id: objectionId,
    objectorParticipantId: actorId,
    proposalRevision: state.proposalRevision,
    statement: requiredText(statement, "OBJECTION_STATEMENT_REQUIRED"),
    aiValidity: null,
    humanStances: {},
    integrationRevision: null,
    objectorConfirmed: false,
    proposerConfirmed: false,
    integrated: false,
  };
  return result(state, { objections: [...state.objections, objection] }, "OBJECTION_RECORDED", { objectionId, actorId });
}

function recordAiAssessment(state: GovernanceMeetingState, objectionId: string, validity: ObjectionValidity): MeetingTransitionResult<GovernanceMeetingState> {
  requirePhase(state.phase, "AI_ASSESSMENT");
  const objections = updateObjection(state.objections, objectionId, (objection) => {
    if (objection.aiValidity) throw new MeetingEngineError("AI_ASSESSMENT_ALREADY_RECORDED");
    return { ...objection, aiValidity: validity };
  });
  return result(state, { objections }, "AI_OBJECTION_ASSESSED", { objectionId, validity });
}

function confirmAiAssessments(state: GovernanceMeetingState): MeetingTransitionResult<GovernanceMeetingState> {
  requirePhase(state.phase, "AI_ASSESSMENT");
  if (state.objections.some((objection) => objection.aiValidity === null)) throw new MeetingEngineError("AI_ASSESSMENTS_INCOMPLETE");
  return result(state, { phase: "DISTRIBUTED_REVIEW" }, "PHASE_CHANGED", { phase: "DISTRIBUTED_REVIEW" });
}

function recordHumanStance(state: GovernanceMeetingState, actorId: string, objectionId: string, validity: "VALID" | "INVALID"): MeetingTransitionResult<GovernanceMeetingState> {
  requirePhase(state.phase, "DISTRIBUTED_REVIEW");
  const objections = updateObjection(state.objections, objectionId, (objection) => ({
    ...objection,
    humanStances: { ...objection.humanStances, [actorId]: validity },
  }));
  return result(state, { objections }, "HUMAN_OBJECTION_STANCE_RECORDED", { objectionId, actorId, validity });
}

function confirmDistributedReview(state: GovernanceMeetingState): MeetingTransitionResult<GovernanceMeetingState> {
  requirePhase(state.phase, "DISTRIBUTED_REVIEW");
  const validObjections = state.objections.filter(effectiveObjectionValidity);
  const phase: GovernanceMeetingPhase = validObjections.length > 0 ? "INTEGRATION" : "ADOPTION_CONFIRMATION";
  return result(state, { phase }, "DISTRIBUTED_REVIEW_CONFIRMED", { phase, validObjectionIds: validObjections.map((item) => item.id) });
}

export function effectiveObjectionValidity(objection: GovernanceObjectionState): boolean {
  const human = Object.values(objection.humanStances);
  if (human.includes("VALID")) return true;
  if (human.length > 0 && human.every((validity) => validity === "INVALID")) return false;
  return objection.aiValidity !== "INVALID";
}

function confirmIntegration(
  state: GovernanceMeetingState,
  actorId: string,
  objectionId: string,
  capacity: "OBJECTOR" | "PROPOSER",
  proposalRevision: number,
): MeetingTransitionResult<GovernanceMeetingState> {
  requirePhase(state.phase, "INTEGRATION");
  if (proposalRevision <= state.proposalRevision) throw new MeetingEngineError("INTEGRATION_REQUIRES_NEW_REVISION");
  const objections = updateObjection(state.objections, objectionId, (objection) => {
    if (!effectiveObjectionValidity(objection)) throw new MeetingEngineError("OBJECTION_NOT_VALID_FOR_INTEGRATION");
    if (capacity === "OBJECTOR" && objection.objectorParticipantId !== actorId) {
      throw new MeetingEngineError("ONLY_OBJECTOR_CAN_CONFIRM_INTEGRATION");
    }
    if (capacity === "PROPOSER" && state.proposerParticipantId !== actorId) {
      throw new MeetingEngineError("ONLY_PROPOSER_CAN_CONFIRM_INTEGRATION");
    }
    if (objection.integrationRevision !== null && objection.integrationRevision !== proposalRevision) {
      throw new MeetingEngineError("INTEGRATION_REVISION_CHANGED");
    }
    const next = {
      ...objection,
      integrationRevision: proposalRevision,
      objectorConfirmed: objection.objectorConfirmed || capacity === "OBJECTOR",
      proposerConfirmed: objection.proposerConfirmed || capacity === "PROPOSER",
    };
    return { ...next, integrated: next.objectorConfirmed && next.proposerConfirmed };
  });
  const current = objections.find((objection) => objection.id === objectionId)!;
  if (!current.integrated) {
    return result(state, { objections }, "INTEGRATION_CONFIRMATION_RECORDED", { objectionId, capacity, proposalRevision });
  }
  const remaining = objections.filter((objection) => effectiveObjectionValidity(objection) && !objection.integrated);
  if (remaining.length > 0) return result(state, { objections, proposalRevision }, "OBJECTION_INTEGRATED", { objectionId, proposalRevision });
  return result(state, {
    objections: [],
    proposalRevision,
    phase: "OBJECTION_ROUND",
    completedParticipantIds: [],
  }, "INTEGRATION_COMPLETED_RESTART_OBJECTION_ROUND", { proposalRevision });
}

function confirmAdoption(state: GovernanceMeetingState): MeetingTransitionResult<GovernanceMeetingState> {
  requirePhase(state.phase, "ADOPTION_CONFIRMATION");
  if (state.objections.some(effectiveObjectionValidity)) throw new MeetingEngineError("VALID_OBJECTION_REMAINS");
  if (!state.activeAgendaItemId) throw new MeetingEngineError("AGENDA_ITEM_NOT_ACTIVE");
  const completedAgenda = replaceAgendaItem(state.agenda, state.activeAgendaItemId, (item) => ({ ...item, status: "COMPLETED" }));
  const pending = nextPendingAgendaItem(completedAgenda);
  const nextState: Partial<GovernanceMeetingState> = pending
    ? {
        agenda: replaceAgendaItem(completedAgenda, pending.id, (item) => ({ ...item, status: "ACTIVE" })),
        activeAgendaItemId: pending.id,
        proposerParticipantId: pending.ownerParticipantId,
        proposalRevision: 0,
        objections: [],
        completedParticipantIds: [],
        phase: "PRESENT_PROPOSAL",
      }
    : {
        agenda: completedAgenda,
        activeAgendaItemId: null,
        proposerParticipantId: null,
        objections: [],
        completedParticipantIds: [],
        phase: "CLOSING_ROUND",
      };
  const next = result(state, nextState, "GOVERNANCE_PROPOSAL_ADOPTION_CONFIRMED", { nextItemId: pending?.id ?? null });
  return { ...next, effects: [{ type: "ADOPT_GOVERNANCE_PROPOSAL", payload: { proposalRevision: state.proposalRevision } }] };
}

function back(state: GovernanceMeetingState): MeetingTransitionResult<GovernanceMeetingState> {
  const previous: Partial<Record<GovernanceMeetingPhase, GovernanceMeetingPhase>> = {
    BUILD_AGENDA: "CHECK_IN",
    CLARIFYING_QUESTIONS: "PRESENT_PROPOSAL",
    REACTION_ROUND: "CLARIFYING_QUESTIONS",
    AMEND_OR_CLARIFY: "REACTION_ROUND",
    OBJECTION_ROUND: "AMEND_OR_CLARIFY",
    AI_ASSESSMENT: "OBJECTION_ROUND",
    DISTRIBUTED_REVIEW: "AI_ASSESSMENT",
  };
  const phase = previous[state.phase];
  if (!phase) throw new MeetingEngineError("PHASE_NOT_REVERSIBLE");
  return result(state, { phase, completedParticipantIds: [] }, "PHASE_REVERSED", { phase });
}

function requiredTurnParticipants(state: GovernanceMeetingState): readonly string[] {
  if (state.phase === "REACTION_ROUND") return state.participantIds.filter((participantId) => participantId !== state.proposerParticipantId);
  return state.participantIds;
}

function updateObjection(
  objections: readonly GovernanceObjectionState[],
  objectionId: string,
  update: (objection: GovernanceObjectionState) => GovernanceObjectionState,
): readonly GovernanceObjectionState[] {
  let found = false;
  const next = objections.map((objection) => {
    if (objection.id !== objectionId) return objection;
    found = true;
    return update(objection);
  });
  if (!found) throw new MeetingEngineError("OBJECTION_NOT_FOUND");
  return next;
}

function requirePhase(actual: GovernanceMeetingPhase, expected: GovernanceMeetingPhase): void {
  if (actual !== expected) throw new MeetingEngineError("GOVERNANCE_ACTION_NOT_ALLOWED_IN_PHASE");
}

function requiredText(value: string, code: string): string {
  const text = value.trim();
  if (!text) throw new MeetingEngineError(code);
  return text;
}

function result(
  state: GovernanceMeetingState,
  patch: Partial<GovernanceMeetingState>,
  eventType: string,
  payload?: Readonly<Record<string, unknown>>,
): MeetingTransitionResult<GovernanceMeetingState> {
  return {
    state: { ...state, ...patch, revision: state.revision + 1 },
    events: [{ type: eventType, ...(payload ? { payload } : {}) }],
    effects: [],
  };
}
