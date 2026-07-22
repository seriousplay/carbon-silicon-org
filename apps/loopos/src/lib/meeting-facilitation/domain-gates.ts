import type { Prisma } from "@/generated/prisma/client";

import type { GovernanceDecisionOperation } from "@/lib/governance-decision";

import { effectiveObjectionValidity, type GovernanceMeetingState } from "./governance-engine";
import type { TacticalMeetingState } from "./tactical-engine";

type DomainGateClient = Pick<
  Prisma.TransactionClient,
  "meetingFacilitationSession" | "meetingParticipant" | "meetingAgendaItem"
>;

export class MeetingFacilitationDomainGateError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "MeetingFacilitationDomainGateError";
  }
}

export async function assertTacticalFacilitationGate(
  client: DomainGateClient,
  input: {
    organizationId: string;
    meetingId: string;
    actorPersonId: string;
    tensionId: string;
    operation: "SUBMIT_CANDIDATE" | "CONFIRM_OUTPUT";
    expectedFacilitationRevision?: number;
    responsiblePersonId?: string;
  },
): Promise<void> {
  const session = await client.meetingFacilitationSession.findFirst({
    where: { organizationId: input.organizationId, meetingId: input.meetingId },
    select: { revision: true, phaseState: true, activeAgendaItemId: true, engineType: true },
  });
  if (!session) return;
  if (session.engineType !== "TACTICAL") throw new MeetingFacilitationDomainGateError("TACTICAL_SESSION_REQUIRED");
  if (input.expectedFacilitationRevision === undefined || session.revision !== input.expectedFacilitationRevision) {
    throw new MeetingFacilitationDomainGateError("STALE_FACILITATION_REVISION");
  }
  const state = parseTacticalState(session.phaseState);
  if (state.phase !== "TRIAGE_ITEM" || !state.activeAgendaItemId || state.activeAgendaItemId !== session.activeAgendaItemId) {
    throw new MeetingFacilitationDomainGateError("TACTICAL_OUTPUT_NOT_IN_ACTIVE_TRIAGE");
  }
  const [participant, agendaItem] = await Promise.all([
    client.meetingParticipant.findFirst({
      where: {
        organizationId: input.organizationId,
        meetingId: input.meetingId,
        personId: input.actorPersonId,
        status: "ONLINE",
      },
      select: { id: true },
    }),
    client.meetingAgendaItem.findFirst({
      where: {
        id: state.activeAgendaItemId,
        organizationId: input.organizationId,
        meetingId: input.meetingId,
        status: "ACTIVE",
        linkedTensionId: input.tensionId,
      },
      select: { ownerParticipantId: true },
    }),
  ]);
  if (!participant || !agendaItem) throw new MeetingFacilitationDomainGateError("TACTICAL_OUTPUT_CONTEXT_MISMATCH");
  if (input.operation === "SUBMIT_CANDIDATE" && agendaItem.ownerParticipantId !== participant.id) {
    throw new MeetingFacilitationDomainGateError("ONLY_AGENDA_OWNER_CAN_SUBMIT_OUTPUT");
  }
  if (input.operation === "CONFIRM_OUTPUT" && input.responsiblePersonId !== input.actorPersonId) {
    throw new MeetingFacilitationDomainGateError("ONLY_OUTPUT_RECEIVER_CAN_CONFIRM");
  }
}

export async function assertGovernanceFacilitationGate(
  client: DomainGateClient,
  input: {
    organizationId: string;
    meetingId: string;
    actorPersonId: string;
    proposalId: string;
    proposalRevision: number;
    operation: GovernanceDecisionOperation;
    expectedFacilitationRevision?: number;
  },
): Promise<void> {
  const session = await client.meetingFacilitationSession.findFirst({
    where: { organizationId: input.organizationId, meetingId: input.meetingId },
    select: { revision: true, phaseState: true, activeAgendaItemId: true, engineType: true },
  });
  if (!session) return;
  if (session.engineType !== "GOVERNANCE") throw new MeetingFacilitationDomainGateError("GOVERNANCE_SESSION_REQUIRED");
  if (input.expectedFacilitationRevision === undefined || session.revision !== input.expectedFacilitationRevision) {
    throw new MeetingFacilitationDomainGateError("STALE_FACILITATION_REVISION");
  }
  const state = parseGovernanceState(session.phaseState);
  const participant = await client.meetingParticipant.findFirst({
    where: {
      organizationId: input.organizationId,
      meetingId: input.meetingId,
      personId: input.actorPersonId,
      status: "ONLINE",
    },
    select: { id: true },
  });
  if (!participant) throw new MeetingFacilitationDomainGateError("ACTOR_NOT_ACTIVE_PARTICIPANT");
  if (!state.activeAgendaItemId || state.activeAgendaItemId !== session.activeAgendaItemId) {
    throw new MeetingFacilitationDomainGateError("GOVERNANCE_AGENDA_ITEM_NOT_ACTIVE");
  }
  const agendaItem = await client.meetingAgendaItem.findFirst({
    where: {
      id: state.activeAgendaItemId,
      organizationId: input.organizationId,
      meetingId: input.meetingId,
      status: "ACTIVE",
      linkedProposalId: input.proposalId,
    },
    select: { id: true },
  });
  if (!agendaItem) throw new MeetingFacilitationDomainGateError("GOVERNANCE_PROPOSAL_CONTEXT_MISMATCH");

  const allowedPhase = operationPhase(input.operation);
  if (!allowedPhase.includes(state.phase)) {
    throw new MeetingFacilitationDomainGateError("GOVERNANCE_OPERATION_NOT_ALLOWED_IN_PHASE");
  }
  if (input.operation !== "INITIALIZE" && state.proposalRevision !== input.proposalRevision) {
    throw new MeetingFacilitationDomainGateError("GOVERNANCE_PROPOSAL_REVISION_MISMATCH");
  }
  if (input.operation === "ADOPT_ROLE" && state.objections.some(effectiveObjectionValidity)) {
    throw new MeetingFacilitationDomainGateError("VALID_OBJECTION_REMAINS");
  }
}

function operationPhase(operation: GovernanceDecisionOperation): readonly GovernanceMeetingState["phase"][] {
  switch (operation) {
    case "INITIALIZE":
      return ["PRESENT_PROPOSAL"];
    case "REQUEST_CLARIFICATION":
      return ["CLARIFYING_QUESTIONS"];
    case "RAISE_OBJECTION":
    case "ASSESS_OBJECTION_VALID":
    case "ASSESS_OBJECTION_INVALID":
      return ["DISTRIBUTED_REVIEW"];
    case "SUBMIT_REVISION":
      return ["INTEGRATION"];
    case "ADOPT_ROLE":
      return ["ADOPTION_CONFIRMATION"];
    case "RECORD_NON_ADOPTION":
      return ["ADOPTION_CONFIRMATION"];
  }
}

function parseTacticalState(value: Prisma.JsonValue): TacticalMeetingState {
  if (!isRecord(value) || value.engine !== "TACTICAL") {
    throw new MeetingFacilitationDomainGateError("FACILITATION_STATE_CORRUPT");
  }
  return value as unknown as TacticalMeetingState;
}

function parseGovernanceState(value: Prisma.JsonValue): GovernanceMeetingState {
  if (!isRecord(value) || value.engine !== "GOVERNANCE") {
    throw new MeetingFacilitationDomainGateError("FACILITATION_STATE_CORRUPT");
  }
  return value as unknown as GovernanceMeetingState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
