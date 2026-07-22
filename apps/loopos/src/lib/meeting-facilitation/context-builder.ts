import type { PrismaClient } from "@/generated/prisma/client";

import { MeetingFacilitationRepositoryError } from "./repository";
import type { MeetingEngineType } from "./types";

export type MeetingContextFact = Readonly<{
  ref: string;
  category:
    | "MEETING"
    | "AGENDA"
    | "EVENT"
    | "MESSAGE"
    | "ROLE"
    | "CHECKLIST"
    | "METRIC"
    | "GOAL"
    | "PROJECT"
    | "ACTION"
    | "TENSION"
    | "PROPOSAL"
    | "OBJECTION";
  label: string;
  value: Readonly<Record<string, unknown>>;
}>;

export type MeetingContextSnapshot = Readonly<{
  organizationId: string;
  meetingId: string;
  engine: MeetingEngineType;
  title: string;
  phase: string;
  revision: number;
  paused: boolean;
  activeAgendaItemId: string | null;
  participantRoleIds: Readonly<Record<string, readonly string[]>>;
  agenda: readonly Readonly<Record<string, unknown>>[];
  recentEvents: readonly Readonly<{
    sequence: number;
    type: string;
    payload: Readonly<Record<string, unknown>>;
  }>[];
  recentMessages: readonly Readonly<{
    id: string;
    participantId: string | null;
    roleId: string | null;
    phase: string;
    content: string;
  }>[];
  facts: readonly MeetingContextFact[];
}>;

export type BuildMeetingContextInput = Readonly<{
  organizationId: string;
  meetingId: string;
  actorPersonId: string;
}>;

export interface MeetingContextLoader {
  load(input: BuildMeetingContextInput): Promise<MeetingContextSnapshot | null>;
}

export async function buildMeetingContext(
  input: BuildMeetingContextInput,
  loader: MeetingContextLoader,
): Promise<MeetingContextSnapshot> {
  const snapshot = await loader.load(input);
  if (!snapshot) throw new MeetingFacilitationRepositoryError("MEETING_CONTEXT_NOT_AVAILABLE");
  if (snapshot.organizationId !== input.organizationId || snapshot.meetingId !== input.meetingId) {
    throw new MeetingFacilitationRepositoryError("MEETING_CONTEXT_TENANT_MISMATCH");
  }
  const refs = new Set<string>();
  for (const fact of snapshot.facts) {
    if (!fact.ref || refs.has(fact.ref)) {
      throw new MeetingFacilitationRepositoryError("MEETING_CONTEXT_EVIDENCE_REF_INVALID");
    }
    refs.add(fact.ref);
  }
  return snapshot;
}

export function createPrismaMeetingContextLoader(client: PrismaClient): MeetingContextLoader {
  return {
    async load(input) {
      const meeting = await client.meeting.findFirst({
        where: {
          id: input.meetingId,
          organizationId: input.organizationId,
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
          id: true,
          title: true,
          type: true,
          durationMin: true,
          startedAt: true,
          circleId: true,
          facilitationSession: {
            select: {
              phase: true,
              revision: true,
              paused: true,
              activeAgendaItemId: true,
              agendaItems: {
                orderBy: { position: "asc" },
                select: {
                  id: true,
                  label: true,
                  ownerParticipantId: true,
                  ownerRoleId: true,
                  status: true,
                  need: true,
                  linkedTensionId: true,
                  linkedProposalId: true,
                  candidateOutput: true,
                  confirmedOutputType: true,
                  confirmedOutputId: true,
                },
              },
              events: {
                orderBy: { sequence: "desc" },
                take: 50,
                select: { sequence: true, type: true, payload: true },
              },
            },
          },
          roleRepresentations: {
            select: {
              participantId: true,
              roleId: true,
              role: {
                select: {
                  name: true,
                  purpose: true,
                  domain: true,
                  accountabilities: true,
                  circleId: true,
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 30,
            select: { id: true, senderId: true, senderRole: true, phase: true, content: true },
          },
        },
      });
      if (!meeting?.facilitationSession || (meeting.type !== "TACTICAL" && meeting.type !== "GOVERNANCE")) {
        return null;
      }

      const roleIds = [...new Set(meeting.roleRepresentations.map((item) => item.roleId))];
      const circleIds = [...new Set([
        ...(meeting.circleId ? [meeting.circleId] : []),
        ...meeting.roleRepresentations.map((item) => item.role.circleId),
      ])];
      const proposalIds = meeting.facilitationSession.agendaItems
        .map((item) => item.linkedProposalId)
        .filter((id): id is string => id !== null);
      const participantRoleIds: Record<string, string[]> = {};
      for (const representation of meeting.roleRepresentations) {
        (participantRoleIds[representation.participantId] ??= []).push(representation.roleId);
      }
      const senderParticipant = new Map(
        await client.meetingParticipant.findMany({
          where: { organizationId: input.organizationId, meetingId: input.meetingId },
          select: { id: true, personId: true },
        }).then((items) => items.map((item) => [item.personId, item.id] as const)),
      );
      const agenda = meeting.facilitationSession.agendaItems.map((item) => jsonRecord(item));
      const recentEvents = meeting.facilitationSession.events.reverse().map((event) => ({
        sequence: event.sequence,
        type: event.type,
        payload: jsonRecord(event.payload),
      }));
      const recentMessages = meeting.messages.reverse().map((message) => ({
        id: message.id,
        participantId: message.senderId ? senderParticipant.get(message.senderId) ?? null : null,
        roleId: roleIdForLabel(meeting.roleRepresentations, message.senderRole),
        phase: message.phase,
        content: message.content,
      }));
      const facts = [
        meetingFact(meeting),
        ...meeting.roleRepresentations.map(roleFact),
        ...agenda.map((item) => agendaFact(item)),
        ...recentEvents.map((event) => eventFact(meeting.id, event)),
        ...recentMessages.map(messageFact),
        ...(meeting.type === "TACTICAL"
          ? await loadTacticalFacts(client, input.organizationId, input.meetingId, roleIds, circleIds)
          : await loadGovernanceFacts(client, input.organizationId, input.meetingId, proposalIds, circleIds)),
      ];

      return {
        organizationId: input.organizationId,
        meetingId: input.meetingId,
        engine: meeting.type,
        title: meeting.title,
        phase: meeting.facilitationSession.phase,
        revision: meeting.facilitationSession.revision,
        paused: meeting.facilitationSession.paused,
        activeAgendaItemId: meeting.facilitationSession.activeAgendaItemId,
        participantRoleIds,
        agenda,
        recentEvents,
        recentMessages,
        facts,
      };
    },
  };
}

async function loadTacticalFacts(
  client: PrismaClient,
  organizationId: string,
  meetingId: string,
  roleIds: readonly string[],
  circleIds: readonly string[],
): Promise<MeetingContextFact[]> {
  const [checklists, metrics, goals, projects, tensions, outcomes] = await Promise.all([
    client.roleChecklistItem.findMany({
      where: { organizationId, roleId: { in: [...roleIds] }, active: true },
      orderBy: [{ roleId: "asc" }, { position: "asc" }],
      take: 100,
    }),
    client.metric.findMany({
      where: { organizationId, circleId: { in: [...circleIds] } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    client.goal.findMany({
      where: { organizationId, circleId: { in: [...circleIds] }, status: "ACTIVE" },
      include: {
        targets: {
          include: { checkIns: { orderBy: { recordedAt: "desc" }, take: 1 } },
          orderBy: { position: "asc" },
        },
      },
      take: 30,
    }),
    client.project.findMany({
      where: { organizationId, circleId: { in: [...circleIds] }, status: { not: "COMPLETED" } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    client.tension.findMany({
      where: {
        organizationId,
        circleId: { in: [...circleIds] },
        status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "BLOCKED", "ESCALATED_L0_5", "ESCALATED_L2", "ESCALATED_L3", "ESCALATED_L4"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 80,
    }),
    client.tacticalOutcomeProposal.findMany({
      where: { organizationId, meetingId },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
  ]);
  return [
    ...checklists.map((item): MeetingContextFact => ({
      ref: `checklist:${item.id}`,
      category: "CHECKLIST",
      label: item.label,
      value: jsonRecord({ roleId: item.roleId, cadence: item.cadence, position: item.position }),
    })),
    ...metrics.map((item): MeetingContextFact => ({
      ref: `metric:${item.id}`,
      category: "METRIC",
      label: item.name,
      value: jsonRecord({ targetValue: item.targetValue, actualValue: item.actualValue, status: item.status, updatedAt: item.updatedAt }),
    })),
    ...goals.map((item): MeetingContextFact => ({
      ref: `goal:${item.id}`,
      category: "GOAL",
      label: item.title,
      value: jsonRecord({ intendedOutcome: item.intendedOutcome, ownerRoleId: item.ownerRoleId, targets: item.targets }),
    })),
    ...projects.map((item): MeetingContextFact => ({
      ref: `project:${item.id}`,
      category: "PROJECT",
      label: item.name,
      value: jsonRecord({ expectedResult: item.expectedResult, status: item.status, bearerId: item.bearerId, updatedAt: item.updatedAt }),
    })),
    ...tensions.map((item): MeetingContextFact => ({
      ref: `tension:${item.id}`,
      category: item.roleId ? "ACTION" : "TENSION",
      label: item.title,
      value: jsonRecord({ description: item.description, status: item.status, roleId: item.roleId, ownerId: item.ownerId, deadline: item.deadline, acceptanceCriteria: item.acceptanceCriteria }),
    })),
    ...outcomes.map((item): MeetingContextFact => ({
      ref: `tactical-output:${item.id}`,
      category: item.kind === "ACTION" ? "ACTION" : "PROJECT",
      label: item.title,
      value: jsonRecord({ kind: item.kind, status: item.status, revision: item.revision, responsiblePersonId: item.responsiblePersonId, deadline: item.deadline }),
    })),
  ];
}

async function loadGovernanceFacts(
  client: PrismaClient,
  organizationId: string,
  meetingId: string,
  proposalIds: readonly string[],
  circleIds: readonly string[],
): Promise<MeetingContextFact[]> {
  const [roles, proposals, objections] = await Promise.all([
    client.roleDef.findMany({
      where: { organizationId, circleId: { in: [...circleIds] }, status: { not: "ARCHIVED" } },
      orderBy: { name: "asc" },
      take: 100,
    }),
    client.governanceProposal.findMany({
      where: {
        organizationId,
        OR: [{ meetingId }, ...(proposalIds.length > 0 ? [{ id: { in: [...proposalIds] } }] : [])],
      },
      include: {
        governanceDecisionProcess: true,
        governanceProposalRevisions: { orderBy: { revision: "asc" } },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    client.governanceObjectionReview.findMany({
      where: { organizationId, meetingId },
      include: { stances: true },
      orderBy: [{ proposalRevision: "asc" }, { sequence: "asc" }],
      take: 100,
    }),
  ]);
  return [
    ...roles.map((item): MeetingContextFact => ({
      ref: `role-structure:${item.id}`,
      category: "ROLE",
      label: item.name,
      value: jsonRecord({ purpose: item.purpose, domain: item.domain, accountabilities: item.accountabilities, status: item.status }),
    })),
    ...proposals.map((item): MeetingContextFact => ({
      ref: `proposal:${item.id}`,
      category: "PROPOSAL",
      label: item.type,
      value: jsonRecord({
        proposedChange: item.proposedChange,
        rationale: item.rationale,
        status: item.status,
        process: item.governanceDecisionProcess,
        revisions: item.governanceProposalRevisions,
      }),
    })),
    ...objections.map((item): MeetingContextFact => ({
      ref: `objection:${item.id}:r${item.proposalRevision}`,
      category: "OBJECTION",
      label: item.statement,
      value: jsonRecord({
        proposalId: item.proposalId,
        proposalRevision: item.proposalRevision,
        objectorRoleId: item.objectorRoleId,
        criteria: item.criteria,
        aiValidity: item.aiValidity,
        aiRationale: item.aiRationale,
        status: item.status,
        stances: item.stances,
      }),
    })),
  ];
}

function meetingFact(meeting: {
  id: string;
  title: string;
  type: string;
  durationMin: number;
  startedAt: Date;
  circleId: string | null;
}): MeetingContextFact {
  return {
    ref: `meeting:${meeting.id}`,
    category: "MEETING",
    label: meeting.title,
    value: jsonRecord({ type: meeting.type, durationMin: meeting.durationMin, startedAt: meeting.startedAt, circleId: meeting.circleId }),
  };
}

function agendaFact(item: Readonly<Record<string, unknown>>): MeetingContextFact {
  return {
    ref: `agenda:${String(item.id)}`,
    category: "AGENDA",
    label: String(item.label ?? "Agenda item"),
    value: item,
  };
}

function eventFact(
  meetingId: string,
  event: { sequence: number; type: string; payload: Readonly<Record<string, unknown>> },
): MeetingContextFact {
  return {
    ref: `event:${meetingId}:${event.sequence}`,
    category: "EVENT",
    label: event.type,
    value: jsonRecord(event),
  };
}

function messageFact(message: {
  id: string;
  participantId: string | null;
  roleId: string | null;
  phase: string;
  content: string;
}): MeetingContextFact {
  return {
    ref: `message:${message.id}`,
    category: "MESSAGE",
    label: message.phase,
    value: jsonRecord(message),
  };
}

function roleFact(item: {
  participantId: string;
  roleId: string;
  role: { name: string; purpose: string; domain: string | null; accountabilities: string; circleId: string };
}): MeetingContextFact {
  return {
    ref: `represented-role:${item.participantId}:${item.roleId}`,
    category: "ROLE",
    label: item.role.name,
    value: jsonRecord({ participantId: item.participantId, roleId: item.roleId, ...item.role }),
  };
}

function roleIdForLabel(
  representations: readonly { roleId: string; role: { name: string } }[],
  label: string | null,
): string | null {
  if (!label) return null;
  return representations.find((item) => item.role.name === label)?.roleId ?? null;
}

function jsonRecord(value: unknown): Readonly<Record<string, unknown>> {
  const serialized = JSON.parse(JSON.stringify(value)) as unknown;
  if (!serialized || typeof serialized !== "object" || Array.isArray(serialized)) return {};
  return serialized as Readonly<Record<string, unknown>>;
}
