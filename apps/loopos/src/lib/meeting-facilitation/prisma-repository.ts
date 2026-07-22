import { Prisma, type PrismaClient } from "@/generated/prisma/client";

import { effectiveObjectionValidity } from "./governance-engine";
import type {
  MeetingFacilitationRepository,
  MeetingFacilitationState,
  PersistedFacilitationEvent,
  PersistedFacilitationSession,
  RoleRepresentationInput,
  TransitionCommit,
} from "./repository";
import { MeetingFacilitationRepositoryError } from "./repository";

type TransactionClient = Prisma.TransactionClient;

export function createPrismaMeetingFacilitationRepository(
  client: PrismaClient,
): MeetingFacilitationRepository {
  return {
    async getInitializationContext(input) {
      const meeting = await client.meeting.findFirst({
        where: {
          id: input.meetingId,
          organizationId: input.organizationId,
          endedAt: null,
          type: { in: ["TACTICAL", "GOVERNANCE"] },
          meetingParticipants: {
            some: {
              organizationId: input.organizationId,
              personId: input.actorPersonId,
              status: "ONLINE",
            },
          },
        },
        select: {
          type: true,
          meetingParticipants: {
            where: { organizationId: input.organizationId, status: "ONLINE" },
            select: { id: true },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (!meeting || (meeting.type !== "TACTICAL" && meeting.type !== "GOVERNANCE")) {
        throw new MeetingFacilitationRepositoryError("MEETING_NOT_AVAILABLE_TO_ACTOR");
      }
      if (meeting.meetingParticipants.length === 0) {
        throw new MeetingFacilitationRepositoryError("MEETING_REQUIRES_PARTICIPANT");
      }
      return {
        meetingType: meeting.type,
        participantIds: meeting.meetingParticipants.map((participant) => participant.id),
      };
    },

    async createSession(input) {
      try {
        return await client.$transaction(async (tx) => {
          const participants = await assertInitializationAccess(tx, input);
          const actor = participants.find((participant) => participant.personId === input.actorPersonId);
          if (!actor) throw new MeetingFacilitationRepositoryError("ACTOR_NOT_PARTICIPANT");

          const session = await tx.meetingFacilitationSession.create({
            data: {
              organizationId: input.organizationId,
              meetingId: input.meetingId,
              engineType: input.state.engine,
              phase: input.state.phase,
              phaseState: toJson(input.state),
              activeAgendaItemId: input.state.activeAgendaItemId,
              paused: input.state.paused,
              revision: input.state.revision,
              lastEventSequence: 1,
            },
          });
          await tx.meetingRoleRepresentation.createMany({
            data: flattenRepresentations(input),
          });
          await tx.meetingFacilitationEvent.create({
            data: {
              organizationId: input.organizationId,
              meetingId: input.meetingId,
              sessionId: session.id,
              sequence: 1,
              stateRevision: input.state.revision,
              actorId: input.actorPersonId,
              type: "SESSION_INITIALIZED",
              payload: toJson({ engine: input.state.engine }),
            },
          });
          await tx.meeting.update({
            where: { id_organizationId: { id: input.meetingId, organizationId: input.organizationId } },
            data: { currentPhase: input.state.phase },
          });
          return persistedSession(session, actor.id, input.state, 1);
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new MeetingFacilitationRepositoryError("SESSION_ALREADY_INITIALIZED");
        }
        throw error;
      }
    },

    async loadForActor(input) {
      return loadForActor(client, input);
    },

    async commitTransition(input) {
      return client.$transaction(async (tx) => commitTransition(tx, input));
    },

    async appendEvent(input) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          return await client.$transaction(async (tx) => {
            const loaded = await loadForActorTransaction(tx, input);
            if (loaded.state.revision !== input.expectedRevision) {
              throw new MeetingFacilitationRepositoryError("STALE_MEETING_REVISION");
            }
            const nextSequence = loaded.lastEventSequence + 1;
            const updated = await tx.meetingFacilitationSession.updateMany({
              where: {
                id: loaded.id,
                organizationId: input.organizationId,
                meetingId: input.meetingId,
                revision: input.expectedRevision,
                lastEventSequence: loaded.lastEventSequence,
              },
              data: { lastEventSequence: nextSequence },
            });
            if (updated.count !== 1) throw new MeetingFacilitationRepositoryError("EVENT_SEQUENCE_CONFLICT");
            await tx.meetingFacilitationEvent.create({
              data: {
                organizationId: input.organizationId,
                meetingId: input.meetingId,
                sessionId: loaded.id,
                sequence: nextSequence,
                stateRevision: input.expectedRevision,
                actorId: input.actorPersonId,
                type: input.type,
                payload: toJson(input.payload),
              },
            });
            return { ...loaded, lastEventSequence: nextSequence };
          });
        } catch (error) {
          if (!(error instanceof MeetingFacilitationRepositoryError) || error.code !== "EVENT_SEQUENCE_CONFLICT" || attempt === 2) {
            throw error;
          }
        }
      }
      throw new MeetingFacilitationRepositoryError("EVENT_SEQUENCE_CONFLICT");
    },

    async getSnapshot(input) {
      return loadForActor(client, input);
    },

    async listEvents(input) {
      await loadForActor(client, input);
      const rows = await client.meetingFacilitationEvent.findMany({
        where: {
          organizationId: input.organizationId,
          meetingId: input.meetingId,
          sequence: { gt: input.after },
        },
        orderBy: { sequence: "asc" },
        take: input.limit,
        select: {
          sequence: true,
          stateRevision: true,
          actorId: true,
          type: true,
          payload: true,
          createdAt: true,
        },
      });
      return rows.map((row): PersistedFacilitationEvent => ({
        sequence: row.sequence,
        stateRevision: row.stateRevision,
        actorPersonId: row.actorId,
        type: row.type,
        payload: asRecord(row.payload),
        createdAt: row.createdAt,
      }));
    },
  };
}

async function loadForActor(
  client: PrismaClient,
  input: { organizationId: string; meetingId: string; actorPersonId: string },
): Promise<PersistedFacilitationSession> {
  const participant = await client.meetingParticipant.findFirst({
    where: {
      organizationId: input.organizationId,
      meetingId: input.meetingId,
      personId: input.actorPersonId,
      status: "ONLINE",
    },
    select: { id: true },
  });
  if (!participant) throw new MeetingFacilitationRepositoryError("ACTOR_NOT_ACTIVE_PARTICIPANT");
  const session = await client.meetingFacilitationSession.findFirst({
    where: { organizationId: input.organizationId, meetingId: input.meetingId },
  });
  if (!session) throw new MeetingFacilitationRepositoryError("FACILITATION_SESSION_NOT_FOUND");
  const state = parseState(session.phaseState);
  if (state.revision !== session.revision || state.phase !== session.phase || state.engine !== session.engineType) {
    throw new MeetingFacilitationRepositoryError("FACILITATION_STATE_CORRUPT");
  }
  return persistedSession(session, participant.id, state, session.lastEventSequence);
}

async function loadForActorTransaction(
  tx: TransactionClient,
  input: { organizationId: string; meetingId: string; actorPersonId: string },
): Promise<PersistedFacilitationSession> {
  const participant = await tx.meetingParticipant.findFirst({
    where: {
      organizationId: input.organizationId,
      meetingId: input.meetingId,
      personId: input.actorPersonId,
      status: "ONLINE",
    },
    select: { id: true },
  });
  if (!participant) throw new MeetingFacilitationRepositoryError("ACTOR_NOT_ACTIVE_PARTICIPANT");
  const session = await tx.meetingFacilitationSession.findFirst({
    where: { organizationId: input.organizationId, meetingId: input.meetingId },
  });
  if (!session) throw new MeetingFacilitationRepositoryError("FACILITATION_SESSION_NOT_FOUND");
  const state = parseState(session.phaseState);
  if (state.revision !== session.revision || state.phase !== session.phase || state.engine !== session.engineType) {
    throw new MeetingFacilitationRepositoryError("FACILITATION_STATE_CORRUPT");
  }
  return persistedSession(session, participant.id, state, session.lastEventSequence);
}

async function commitTransition(
  tx: TransactionClient,
  input: TransitionCommit,
): Promise<PersistedFacilitationSession> {
  const participant = await tx.meetingParticipant.findFirst({
    where: {
      id: input.actorParticipantId,
      organizationId: input.organizationId,
      meetingId: input.meetingId,
      personId: input.actorPersonId,
      status: "ONLINE",
      meeting: { endedAt: null },
    },
    select: { id: true },
  });
  if (!participant) throw new MeetingFacilitationRepositoryError("ACTOR_NOT_ACTIVE_PARTICIPANT");
  if (input.nextState.revision !== input.expectedRevision + 1) {
    throw new MeetingFacilitationRepositoryError("INVALID_NEXT_REVISION");
  }
  if (input.previousState.engine !== input.nextState.engine) {
    throw new MeetingFacilitationRepositoryError("MEETING_ENGINE_CHANGED");
  }

  const nextEventSequence = input.previousLastEventSequence + input.events.length;
  const updated = await tx.meetingFacilitationSession.updateMany({
    where: {
      id: input.sessionId,
      organizationId: input.organizationId,
      meetingId: input.meetingId,
      revision: input.expectedRevision,
      lastEventSequence: input.previousLastEventSequence,
    },
    data: {
      phase: input.nextState.phase,
      phaseState: toJson(input.nextState),
      activeAgendaItemId: input.nextState.activeAgendaItemId,
      paused: input.nextState.paused,
      revision: input.nextState.revision,
      lastEventSequence: nextEventSequence,
      completedAt: input.nextState.phase === "COMPLETED" ? new Date() : null,
    },
  });
  if (updated.count !== 1) throw new MeetingFacilitationRepositoryError("STALE_MEETING_REVISION");

  if (input.events.length > 0) {
    await tx.meetingFacilitationEvent.createMany({
      data: input.events.map((event, index) => ({
        organizationId: input.organizationId,
        meetingId: input.meetingId,
        sessionId: input.sessionId,
        sequence: input.previousLastEventSequence + index + 1,
        stateRevision: input.nextState.revision,
        actorId: input.actorPersonId,
        type: event.type,
        payload: toJson({ ...(event.payload ?? {}), command: input.command }),
      })),
    });
  }

  await syncAgenda(tx, input);
  await syncGovernanceReview(tx, input);
  await tx.meeting.update({
    where: { id_organizationId: { id: input.meetingId, organizationId: input.organizationId } },
    data: {
      currentPhase: input.nextState.phase,
      ...(input.nextState.phase === "COMPLETED"
        ? { endedAt: new Date(), endedById: input.actorPersonId }
        : {}),
    },
  });

  return {
    id: input.sessionId,
    organizationId: input.organizationId,
    meetingId: input.meetingId,
    actorParticipantId: input.actorParticipantId,
    state: input.nextState,
    lastEventSequence: nextEventSequence,
  };
}

async function syncAgenda(tx: TransactionClient, input: TransitionCommit): Promise<void> {
  const previousIds = new Set(input.previousState.agenda.map((item) => item.id));
  for (const [position, item] of input.nextState.agenda.entries()) {
    const isNew = !previousIds.has(item.id);
    const addCommand = isNew && input.command.type === "ADD_AGENDA_ITEM" ? input.command : null;
    await tx.meetingAgendaItem.upsert({
      where: { id_organizationId: { id: item.id, organizationId: input.organizationId } },
      create: {
        id: item.id,
        organizationId: input.organizationId,
        meetingId: input.meetingId,
        sessionId: input.sessionId,
        engineType: input.nextState.engine,
        ownerParticipantId: item.ownerParticipantId,
        ownerRoleId: item.ownerRoleId,
        label: item.label,
        position,
        status: item.status,
        linkedTensionId: addCommand?.linkedTensionId,
        linkedProposalId: addCommand?.linkedProposalId,
        need: item.need,
        candidateOutput: input.command.type === "CONFIRM_OUTPUT" && input.command.itemId === item.id
          ? toJson(input.command.candidateOutput ?? {})
          : undefined,
        startedAt: item.status === "ACTIVE" ? new Date() : null,
        completedAt: item.status === "COMPLETED" ? new Date() : null,
      },
      update: {
        position,
        status: item.status,
        need: item.need,
        ...(input.command.type === "CONFIRM_OUTPUT" && input.command.itemId === item.id
          ? { candidateOutput: toJson(input.command.candidateOutput ?? {}) }
          : {}),
      },
    });
    if (item.status === "ACTIVE") {
      await tx.meetingAgendaItem.updateMany({
        where: { id: item.id, organizationId: input.organizationId, startedAt: null },
        data: { startedAt: new Date() },
      });
    }
    if (item.status === "COMPLETED") {
      await tx.meetingAgendaItem.updateMany({
        where: { id: item.id, organizationId: input.organizationId, completedAt: null },
        data: { completedAt: new Date() },
      });
    }
  }
}

async function syncGovernanceReview(tx: TransactionClient, input: TransitionCommit): Promise<void> {
  if (input.previousState.engine !== "GOVERNANCE" || input.nextState.engine !== "GOVERNANCE") return;
  const command = input.command;
  if (command.type === "RECORD_OBJECTION") {
    const agendaItemId = input.previousState.activeAgendaItemId;
    if (!agendaItemId) throw new MeetingFacilitationRepositoryError("AGENDA_ITEM_NOT_ACTIVE");
    const agendaItem = await tx.meetingAgendaItem.findFirst({
      where: { id: agendaItemId, organizationId: input.organizationId, sessionId: input.sessionId },
      select: { linkedProposalId: true },
    });
    if (!agendaItem?.linkedProposalId) {
      throw new MeetingFacilitationRepositoryError("GOVERNANCE_PROPOSAL_REQUIRED");
    }
    const represented = await tx.meetingRoleRepresentation.findFirst({
      where: {
        organizationId: input.organizationId,
        meetingId: input.meetingId,
        participantId: input.actorParticipantId,
        roleId: command.objectorRoleId,
      },
      select: { id: true },
    });
    if (!represented) throw new MeetingFacilitationRepositoryError("OBJECTION_ROLE_NOT_REPRESENTED");
    const sequence = await tx.governanceObjectionReview.count({
      where: {
        sessionId: input.sessionId,
        proposalId: agendaItem.linkedProposalId,
        proposalRevision: input.previousState.proposalRevision,
      },
    });
    await tx.governanceObjectionReview.create({
      data: {
        id: command.objectionId,
        organizationId: input.organizationId,
        meetingId: input.meetingId,
        sessionId: input.sessionId,
        agendaItemId,
        proposalId: agendaItem.linkedProposalId,
        proposalRevision: input.previousState.proposalRevision,
        sequence: sequence + 1,
        objectorParticipantId: input.actorParticipantId,
        objectorRoleId: command.objectorRoleId,
        statement: command.statement.trim(),
        criteria: toJson(command.criteria),
      },
    });
  }
  if (command.type === "RECORD_AI_ASSESSMENT") {
    const updated = await tx.governanceObjectionReview.updateMany({
      where: {
        id: command.objectionId,
        organizationId: input.organizationId,
        sessionId: input.sessionId,
        status: "ACTIVE",
      },
      data: {
        aiValidity: command.assessment.validity,
        aiRationale: command.assessment.rationale.trim(),
        aiConfidence: command.assessment.confidence,
        aiEvidenceRefs: toJson(command.assessment.evidenceRefs),
        criteria: toJson(command.assessment.criteria),
      },
    });
    if (updated.count !== 1) throw new MeetingFacilitationRepositoryError("OBJECTION_NOT_FOUND");
  }
  if (command.type === "RECORD_HUMAN_STANCE") {
    await tx.governanceObjectionStance.upsert({
      where: {
        objectionId_participantId: {
          objectionId: command.objectionId,
          participantId: input.actorParticipantId,
        },
      },
      create: {
        organizationId: input.organizationId,
        objectionId: command.objectionId,
        participantId: input.actorParticipantId,
        validity: command.validity,
        reason: command.reason.trim(),
      },
      update: { validity: command.validity, reason: command.reason.trim() },
    });
  }
  if (command.type === "CONFIRM_INTEGRATION") {
    const integrated = input.nextState.engine === "GOVERNANCE"
      && input.nextState.objections.some((objection) => objection.id === command.objectionId && objection.integrated);
    if (!integrated) return;
    const updated = await tx.governanceObjectionReview.updateMany({
      where: { id: command.objectionId, organizationId: input.organizationId, sessionId: input.sessionId },
      data: { status: "INTEGRATED", integratedAt: new Date() },
    });
    if (updated.count !== 1) throw new MeetingFacilitationRepositoryError("OBJECTION_NOT_FOUND");
  }
  if (command.type === "CONFIRM_DISTRIBUTED_REVIEW") {
    const dismissedIds = input.nextState.objections
      .filter((objection) => !effectiveObjectionValidity(objection))
      .map((objection) => objection.id);
    if (dismissedIds.length > 0) {
      await tx.governanceObjectionReview.updateMany({
        where: { id: { in: dismissedIds }, organizationId: input.organizationId, sessionId: input.sessionId },
        data: { status: "DISMISSED" },
      });
    }
  }
}

async function assertInitializationAccess(
  tx: TransactionClient,
  input: {
    organizationId: string;
    meetingId: string;
    actorPersonId: string;
    state: MeetingFacilitationState;
    representations: readonly RoleRepresentationInput[];
  },
) {
  const meeting = await tx.meeting.findFirst({
    where: {
      id: input.meetingId,
      organizationId: input.organizationId,
      endedAt: null,
      type: input.state.engine,
    },
    select: {
      meetingParticipants: {
        where: { organizationId: input.organizationId, status: "ONLINE" },
        select: {
          id: true,
          personId: true,
          person: { select: { roles: { where: { organizationId: input.organizationId }, select: { id: true } } } },
        },
      },
    },
  });
  if (!meeting) throw new MeetingFacilitationRepositoryError("MEETING_NOT_AVAILABLE_TO_ACTOR");
  const expectedIds = [...input.state.participantIds].sort();
  const actualIds = meeting.meetingParticipants.map((participant) => participant.id).sort();
  if (expectedIds.join("\0") !== actualIds.join("\0")) {
    throw new MeetingFacilitationRepositoryError("MEETING_PARTICIPANTS_CHANGED");
  }
  const byParticipant = new Map(input.representations.map((item) => [item.participantId, new Set(item.roleIds)]));
  for (const participant of meeting.meetingParticipants) {
    const represented = byParticipant.get(participant.id);
    if (!represented || represented.size === 0) {
      throw new MeetingFacilitationRepositoryError("REPRESENTED_ROLE_REQUIRED");
    }
    const assigned = new Set(participant.person.roles.map((role) => role.id));
    for (const roleId of represented) {
      if (!assigned.has(roleId)) throw new MeetingFacilitationRepositoryError("ROLE_NOT_ASSIGNED_TO_PARTICIPANT");
    }
  }
  return meeting.meetingParticipants;
}

function flattenRepresentations(
  input: {
    organizationId: string;
    meetingId: string;
    representations: readonly RoleRepresentationInput[];
  },
) {
  return input.representations.flatMap((representation) =>
    [...new Set(representation.roleIds)].map((roleId) => ({
      organizationId: input.organizationId,
      meetingId: input.meetingId,
      participantId: representation.participantId,
      roleId,
    })),
  );
}

function persistedSession(
  session: { id: string; organizationId: string; meetingId: string },
  actorParticipantId: string,
  state: MeetingFacilitationState,
  lastEventSequence: number,
): PersistedFacilitationSession {
  return {
    id: session.id,
    organizationId: session.organizationId,
    meetingId: session.meetingId,
    actorParticipantId,
    state,
    lastEventSequence,
  };
}

function parseState(value: Prisma.JsonValue): MeetingFacilitationState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new MeetingFacilitationRepositoryError("FACILITATION_STATE_CORRUPT");
  }
  const record = value as Record<string, unknown>;
  if ((record.engine !== "TACTICAL" && record.engine !== "GOVERNANCE") || !Number.isInteger(record.revision)) {
    throw new MeetingFacilitationRepositoryError("FACILITATION_STATE_CORRUPT");
  }
  return value as unknown as MeetingFacilitationState;
}

function asRecord(value: Prisma.JsonValue): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Readonly<Record<string, unknown>>;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
