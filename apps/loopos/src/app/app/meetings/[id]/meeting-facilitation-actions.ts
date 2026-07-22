"use server";

import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { createDefaultMeetingCoach, type MeetingCoachTrigger } from "@/lib/meeting-facilitation/coach";
import { parseMeetingFacilitationCommand } from "@/lib/meeting-facilitation/command-schema";
import { buildMeetingContext, createPrismaMeetingContextLoader } from "@/lib/meeting-facilitation/context-builder";
import { createPrismaMeetingFacilitationRepository } from "@/lib/meeting-facilitation/prisma-repository";
import { buildMeetingFacilitationReadModel, type MeetingFacilitationReadModel } from "@/lib/meeting-facilitation/read-model";
import { createMeetingFacilitationService } from "@/lib/meeting-facilitation/service";

type FacilitationActionResult =
  | { ok: true; snapshot: MeetingFacilitationReadModel }
  | { ok: false; errorCode: string };

const repository = createPrismaMeetingFacilitationRepository(prisma);
const facilitation = createMeetingFacilitationService(repository);

export async function confirmMeetingRoleRepresentationAction(
  meetingId: string,
  rawRoleIds: unknown,
): Promise<{ ok: true; roleIds: string[] } | { ok: false; errorCode: string }> {
  try {
    const actor = await authenticatedActor();
    const roleIds = parseRoleIds(rawRoleIds);
    await prisma.$transaction(async (tx) => {
      const participant = await tx.meetingParticipant.findFirst({
        where: {
          organizationId: actor.organizationId,
          meetingId,
          personId: actor.personId,
          status: "ONLINE",
          meeting: { endedAt: null, type: { in: ["TACTICAL", "GOVERNANCE"] } },
        },
        select: { id: true },
      });
      if (!participant) throw new Error("ACTOR_NOT_ACTIVE_PARTICIPANT");
      if (await tx.meetingFacilitationSession.count({ where: { organizationId: actor.organizationId, meetingId } })) {
        throw new Error("REPRESENTED_ROLES_LOCKED_AFTER_START");
      }
      const roles = await tx.roleDef.findMany({
        where: {
          organizationId: actor.organizationId,
          id: { in: roleIds },
          status: "ACTIVE",
          assignees: { some: { id: actor.personId, organizationId: actor.organizationId } },
        },
        select: { id: true },
      });
      if (roles.length !== roleIds.length) throw new Error("ROLE_NOT_ASSIGNED_TO_PARTICIPANT");
      await tx.meetingRoleRepresentation.deleteMany({
        where: { organizationId: actor.organizationId, meetingId, participantId: participant.id },
      });
      await tx.meetingRoleRepresentation.createMany({
        data: roleIds.map((roleId) => ({
          organizationId: actor.organizationId,
          meetingId,
          participantId: participant.id,
          roleId,
        })),
      });
      await tx.meetingParticipant.update({
        where: { id_organizationId: { id: participant.id, organizationId: actor.organizationId } },
        data: { lastActiveAt: new Date() },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { ok: true, roleIds };
  } catch (error) {
    return failure(error);
  }
}

export async function initializeMeetingFacilitationAction(
  meetingId: string,
): Promise<FacilitationActionResult> {
  try {
    const actor = await authenticatedActor();
    const participants = await prisma.meetingParticipant.findMany({
      where: { organizationId: actor.organizationId, meetingId, status: "ONLINE" },
      select: {
        id: true,
        representedRoles: { select: { roleId: true }, orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    });
    const session = await facilitation.initialize({
      organizationId: actor.organizationId,
      meetingId,
      actorPersonId: actor.personId,
      representations: participants.map((participant) => ({
        participantId: participant.id,
        roleIds: participant.representedRoles.map((item) => item.roleId),
      })),
    });
    return { ok: true, snapshot: buildMeetingFacilitationReadModel(session) };
  } catch (error) {
    return failure(error);
  }
}

export async function executeMeetingFacilitationAction(
  meetingId: string,
  expectedRevision: number,
  rawCommand: unknown,
): Promise<FacilitationActionResult> {
  try {
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new Error("INVALID_MEETING_REVISION");
    const actor = await authenticatedActor();
    const session = await facilitation.execute({
      organizationId: actor.organizationId,
      meetingId,
      actorPersonId: actor.personId,
      expectedRevision,
      command: parseMeetingFacilitationCommand(rawCommand),
    });
    return { ok: true, snapshot: buildMeetingFacilitationReadModel(session) };
  } catch (error) {
    return failure(error);
  }
}

export async function requestMeetingCoachSuggestionAction(
  meetingId: string,
  expectedRevision: number,
  rawTrigger: unknown,
) {
  try {
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new Error("INVALID_MEETING_REVISION");
    const actor = await authenticatedActor();
    const trigger = parseTrigger(rawTrigger);
    const context = await buildMeetingContext(
      { organizationId: actor.organizationId, meetingId, actorPersonId: actor.personId },
      createPrismaMeetingContextLoader(prisma),
    );
    if (context.revision !== expectedRevision) throw new Error("STALE_MEETING_REVISION");
    const coach = await createDefaultMeetingCoach();
    const suggestion = await coach.suggest(context, trigger);
    const session = await facilitation.appendEvent({
      organizationId: actor.organizationId,
      meetingId,
      actorPersonId: actor.personId,
      expectedRevision,
      type: "COACH_SUGGESTION",
      payload: { trigger, suggestion },
    });
    return { ok: true as const, suggestion, nextEventCursor: session.lastEventSequence };
  } catch (error) {
    return failure(error);
  }
}

async function authenticatedActor(): Promise<{ organizationId: string; personId: string }> {
  const [organizationId, person] = await Promise.all([getCurrentOrgId(), getCurrentPerson()]);
  if (!person || person.organizationId !== organizationId) throw new Error("CURRENT_PERSON_REQUIRED");
  return { organizationId, personId: person.id };
}

function parseRoleIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error("REPRESENTED_ROLE_REQUIRED");
  }
  return [...new Set(value.map((item) => (item as string).trim()))];
}

function parseTrigger(value: unknown): MeetingCoachTrigger {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("COACH_TRIGGER_INVALID");
  const input = value as Record<string, unknown>;
  const allowed: MeetingCoachTrigger["type"][] = [
    "PHASE_ENTERED",
    "TURN_NEEDED",
    "DRIFT_DETECTED",
    "NEED_UNCLEAR",
    "OUTPUT_CANDIDATE",
    "OBJECTION_RECORDED",
    "PROCESS_QUESTION",
  ];
  if (typeof input.type !== "string" || !allowed.includes(input.type as MeetingCoachTrigger["type"])) {
    throw new Error("COACH_TRIGGER_INVALID");
  }
  const detail = input.detail;
  if (detail !== undefined && (!detail || typeof detail !== "object" || Array.isArray(detail))) {
    throw new Error("COACH_TRIGGER_INVALID");
  }
  return {
    type: input.type as MeetingCoachTrigger["type"],
    ...(detail === undefined ? {} : { detail: detail as Readonly<Record<string, unknown>> }),
  };
}

function failure(error: unknown): { ok: false; errorCode: string } {
  if (error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)) {
    return { ok: false, errorCode: error.message };
  }
  return { ok: false, errorCode: "MEETING_FACILITATION_FAILED" };
}
