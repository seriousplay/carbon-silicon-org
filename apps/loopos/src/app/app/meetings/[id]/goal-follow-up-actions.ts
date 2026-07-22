"use server";

import { revalidatePath } from "next/cache";

import { resolveActorContext } from "@/lib/authorization/actor-context";
import { prisma } from "@/lib/db";
import {
  appendGoalCheckIns,
  createGoalWorkLink,
  createPrismaGoalDomainDependencies,
  GoalDomainError,
  removeGoalWorkLink,
  type GoalCheckInAssessment,
  type GoalDomainActor,
  type GoalWorkLinkKind,
} from "@/lib/goals/domain-operations";
import { currentGoalFollowUpActionDependencies } from "./goal-follow-up-action-dependencies";

type PublicErrorCode = "INVALID_INPUT" | "NOT_AVAILABLE" | "CONFLICT" | "TEMPORARY_FAILURE";
type GoalFollowUpActionState =
  | Readonly<{ status: "SUCCESS"; operation: "CHECK_IN" | "LINK" | "REMOVE" }>
  | Readonly<{ status: "ERROR"; code: PublicErrorCode }>
  | undefined;

const productionDependencies = {
  prisma,
  resolveActorContext,
  revalidatePath,
  appendGoalCheckIns,
  createGoalWorkLink,
  removeGoalWorkLink,
  createPrismaGoalDomainDependencies,
};

const checkInFields = new Set([
  "targetId",
  "assessment",
  "fact",
  "evidenceSummary",
  "currentValue",
  "milestoneCompleted",
  "acceptanceEvidence",
  "sourceUrl",
  "supersedesCheckInId",
]);
const createLinkFields = new Set(["kind", "workObjectId"]);
const removeLinkFields = new Set(["linkId", "reason"]);

function invalidInput(): never {
  throw new GoalDomainError("INVALID_INPUT");
}

function validateFields(formData: FormData, allowed: Set<string>): void {
  if (!(formData instanceof FormData)) invalidInput();
  for (const name of formData.keys()) {
    if (!name.startsWith("$ACTION_") && !allowed.has(name)) invalidInput();
  }
  for (const name of allowed) {
    if (formData.getAll(name).length > 1) invalidInput();
  }
}

function singleText(formData: FormData, name: string, required = false): string | undefined {
  const values = formData.getAll(name);
  if (values.length === 0 && !required) return undefined;
  if (values.length !== 1 || typeof values[0] !== "string") invalidInput();
  return values[0];
}

function requiredText(value: unknown, maxBytes: number): string {
  if (typeof value !== "string") invalidInput();
  const normalized = value.trim();
  if (!normalized || Buffer.byteLength(normalized, "utf8") > maxBytes) invalidInput();
  return normalized;
}

function optionalText(value: unknown, maxBytes: number): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") invalidInput();
  const normalized = value.trim();
  if (Buffer.byteLength(normalized, "utf8") > maxBytes) invalidInput();
  return normalized || undefined;
}

function parseAssessment(value: unknown): GoalCheckInAssessment {
  if (value === "ON_TRACK" || value === "AT_RISK" || value === "OFF_TRACK" || value === "ACHIEVED") return value;
  return invalidInput();
}

function parseKind(value: unknown): GoalWorkLinkKind {
  if (value === "PROJECT" || value === "ACTION" || value === "BLOCKING_TENSION") return value;
  return invalidInput();
}

function parseCheckIn(formData: FormData) {
  validateFields(formData, checkInFields);
  for (const field of ["targetId", "assessment", "fact", "evidenceSummary"]) {
    if (formData.getAll(field).length !== 1) invalidInput();
  }
  const targetId = requiredText(singleText(formData, "targetId", true), 200);
  const assessment = parseAssessment(singleText(formData, "assessment", true));
  const fact = requiredText(singleText(formData, "fact", true), 4_000);
  const evidenceSummary = requiredText(singleText(formData, "evidenceSummary", true), 4_000);
  const currentValue = optionalText(singleText(formData, "currentValue"), 200);
  const milestoneValue = optionalText(singleText(formData, "milestoneCompleted"), 5);
  const acceptanceEvidence = optionalText(singleText(formData, "acceptanceEvidence"), 4_000);
  const sourceUrl = optionalText(singleText(formData, "sourceUrl"), 2_000);
  const supersedesCheckInId = optionalText(singleText(formData, "supersedesCheckInId"), 200);

  if ((currentValue === undefined) === (milestoneValue === undefined)) invalidInput();
  if (currentValue !== undefined) {
    if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(currentValue) || acceptanceEvidence !== undefined) invalidInput();
  }
  let milestoneCompleted: boolean | undefined;
  if (milestoneValue !== undefined) {
    if (milestoneValue !== "true" && milestoneValue !== "false") invalidInput();
    milestoneCompleted = milestoneValue === "true";
    if (assessment === "ACHIEVED" && (!milestoneCompleted || !acceptanceEvidence)) invalidInput();
  }
  if (sourceUrl !== undefined) {
    try {
      const parsed = new URL(sourceUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") invalidInput();
    } catch {
      invalidInput();
    }
  }

  return {
    targetId,
    assessment,
    fact,
    evidenceSummary,
    ...(currentValue === undefined ? {} : { currentValue }),
    ...(milestoneCompleted === undefined ? {} : { milestoneCompleted }),
    ...(acceptanceEvidence === undefined ? {} : { acceptanceEvidence }),
    ...(sourceUrl === undefined ? {} : { sourceUrl }),
    ...(supersedesCheckInId === undefined ? {} : { supersedesCheckInId }),
  };
}

function parseCreateLink(formData: FormData) {
  validateFields(formData, createLinkFields);
  if (formData.getAll("kind").length !== 1 || formData.getAll("workObjectId").length !== 1) invalidInput();
  return {
    kind: parseKind(singleText(formData, "kind", true)),
    workObjectId: requiredText(singleText(formData, "workObjectId", true), 200),
  };
}

function parseRemoveLink(formData: FormData) {
  validateFields(formData, removeLinkFields);
  if (formData.getAll("linkId").length !== 1 || formData.getAll("reason").length !== 1) invalidInput();
  return {
    linkId: requiredText(singleText(formData, "linkId", true), 200),
    reason: requiredText(singleText(formData, "reason", true), 2_000),
  };
}

function actorFromContext(context: Awaited<ReturnType<typeof resolveActorContext>>): GoalDomainActor {
  return {
    organizationId: context.organizationId,
    userId: context.userId,
    personId: context.personId,
  };
}

async function resolveGoalCapabilities(
  dependencies: typeof productionDependencies,
  actor: GoalDomainActor,
  meetingId: string,
  goalId: string,
): Promise<{ circleId: string; canAppendEvidence: boolean; canManageWorkLinks: boolean }> {
  const meeting = await dependencies.prisma.meeting.findFirst({
    where: {
      id: meetingId,
      organizationId: actor.organizationId,
      type: "TACTICAL",
      circleId: { not: null },
    },
    select: {
      id: true,
      circleId: true,
      endedAt: true,
      participants: {
        where: { id: actor.personId, organizationId: actor.organizationId },
        select: { id: true },
      },
    },
  });
  if (!meeting?.circleId) throw new GoalDomainError("MEETING_NOT_FOUND");
  const goal = await dependencies.prisma.goal.findFirst({
    where: {
      id: goalId,
      organizationId: actor.organizationId,
      circleId: meeting.circleId,
      status: "ACTIVE",
      cycle: { status: "ACTIVE" },
    },
    select: {
      id: true,
      circleId: true,
      ownerRole: {
        select: {
          status: true,
          assignees: {
            where: { id: actor.personId, organizationId: actor.organizationId },
            select: { id: true },
          },
        },
      },
    },
  });
  if (!goal || goal.circleId !== meeting.circleId) throw new GoalDomainError("GOAL_NOT_FOUND");
  const canManageWorkLinks = meeting.endedAt === null && meeting.participants.some((person) => person.id === actor.personId);
  const canAppendEvidence = canManageWorkLinks
    || (goal.ownerRole.status === "ACTIVE" && goal.ownerRole.assignees.some((person) => person.id === actor.personId));
  return { circleId: meeting.circleId, canAppendEvidence, canManageWorkLinks };
}

function publicFailure(error: unknown): Exclude<GoalFollowUpActionState, undefined | { status: "SUCCESS" }> {
  if (!(error instanceof GoalDomainError)) return { status: "ERROR", code: "TEMPORARY_FAILURE" };
  if (["INVALID_INPUT", "CHECK_IN_INVALID", "SOURCE_URL_INVALID"].includes(error.code)) {
    return { status: "ERROR", code: "INVALID_INPUT" };
  }
  if ([
    "ACTOR_CONTEXT_MISMATCH",
    "FORBIDDEN",
    "GOAL_NOT_FOUND",
    "GOAL_NOT_ACTIVE",
    "TARGET_NOT_FOUND",
    "MEETING_NOT_FOUND",
    "MEETING_INVALID",
    "RECORDER_NOT_PARTICIPANT",
    "FOLLOW_UP_AUTHORITY_REQUIRED",
    "WORK_OBJECT_NOT_FOUND",
    "ACTION_NOT_APPROVED",
    "WORK_LINK_NOT_FOUND",
  ].includes(error.code)) return { status: "ERROR", code: "NOT_AVAILABLE" };
  if ([
    "CORRECTION_INVALID",
    "CORRECTION_CONFLICT",
    "WORK_LINK_ALREADY_ACTIVE",
    "WORK_LINK_STATE_CONFLICT",
    "SERIALIZATION_CONFLICT",
    "CONSTRAINT_VIOLATION",
  ].includes(error.code)) return { status: "ERROR", code: "CONFLICT" };
  return { status: "ERROR", code: "TEMPORARY_FAILURE" };
}

function revalidateSuccess(dependencies: typeof productionDependencies, meetingId: string): void {
  dependencies.revalidatePath(`/app/meetings/${meetingId}`);
  dependencies.revalidatePath("/app/goals");
  dependencies.revalidatePath("/app");
}

export async function appendGoalCheckInAction(
  meetingIdValue: string,
  goalIdValue: string,
  _previousState: GoalFollowUpActionState,
  formData: FormData,
): Promise<GoalFollowUpActionState> {
  try {
    const entry = parseCheckIn(formData);
    const meetingId = requiredText(meetingIdValue, 200);
    const goalId = requiredText(goalIdValue, 200);
    const dependencies = currentGoalFollowUpActionDependencies(productionDependencies);
    const actor = actorFromContext(await dependencies.resolveActorContext());
    const capability = await resolveGoalCapabilities(dependencies, actor, meetingId, goalId);
    if (!capability.canAppendEvidence) throw new GoalDomainError("FOLLOW_UP_AUTHORITY_REQUIRED");
    await dependencies.appendGoalCheckIns({
      organizationId: actor.organizationId,
      goalId,
      actor,
      ...(capability.canManageWorkLinks ? { meetingId } : {}),
      entries: [entry],
    }, dependencies.createPrismaGoalDomainDependencies(dependencies.prisma));
    revalidateSuccess(dependencies, meetingId);
    return { status: "SUCCESS", operation: "CHECK_IN" };
  } catch (error) {
    return publicFailure(error);
  }
}

export async function createGoalWorkLinkAction(
  meetingIdValue: string,
  goalIdValue: string,
  _previousState: GoalFollowUpActionState,
  formData: FormData,
): Promise<GoalFollowUpActionState> {
  try {
    const input = parseCreateLink(formData);
    const meetingId = requiredText(meetingIdValue, 200);
    const goalId = requiredText(goalIdValue, 200);
    const dependencies = currentGoalFollowUpActionDependencies(productionDependencies);
    const actor = actorFromContext(await dependencies.resolveActorContext());
    const capability = await resolveGoalCapabilities(dependencies, actor, meetingId, goalId);
    if (!capability.canManageWorkLinks) throw new GoalDomainError("FOLLOW_UP_AUTHORITY_REQUIRED");
    await dependencies.createGoalWorkLink({
      organizationId: actor.organizationId,
      goalId,
      actor,
      meetingId,
      ...input,
    }, dependencies.createPrismaGoalDomainDependencies(dependencies.prisma));
    revalidateSuccess(dependencies, meetingId);
    return { status: "SUCCESS", operation: "LINK" };
  } catch (error) {
    return publicFailure(error);
  }
}

export async function removeGoalWorkLinkAction(
  meetingIdValue: string,
  goalIdValue: string,
  _previousState: GoalFollowUpActionState,
  formData: FormData,
): Promise<GoalFollowUpActionState> {
  try {
    const input = parseRemoveLink(formData);
    const meetingId = requiredText(meetingIdValue, 200);
    const goalId = requiredText(goalIdValue, 200);
    const dependencies = currentGoalFollowUpActionDependencies(productionDependencies);
    const actor = actorFromContext(await dependencies.resolveActorContext());
    const capability = await resolveGoalCapabilities(dependencies, actor, meetingId, goalId);
    if (!capability.canManageWorkLinks) throw new GoalDomainError("FOLLOW_UP_AUTHORITY_REQUIRED");
    await dependencies.removeGoalWorkLink({
      organizationId: actor.organizationId,
      goalId,
      actor,
      meetingId,
      ...input,
    }, dependencies.createPrismaGoalDomainDependencies(dependencies.prisma));
    revalidateSuccess(dependencies, meetingId);
    return { status: "SUCCESS", operation: "REMOVE" };
  } catch (error) {
    return publicFailure(error);
  }
}
