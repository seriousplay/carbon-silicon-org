"use server";

import { revalidatePath } from "next/cache";

import { resolveActorContext } from "@/lib/authorization/actor-context";
import { prisma } from "@/lib/db";
import {
  createPrismaGoalDomainDependencies,
  decideGoalProposal,
  GoalDomainError,
  type GoalDecisionOutcome,
  type GoalDecisionResult,
} from "@/lib/goals/domain-operations";
import { currentGoalDecisionActionDependencies } from "./goal-decision-action-dependencies";

type GoalDecisionActionErrorCode =
  | "INVALID_INPUT"
  | "NOT_AVAILABLE"
  | "STALE_REVISION"
  | "INVALID_STATE"
  | "RETRY_CONFLICT"
  | "TEMPORARY_FAILURE";

type GoalDecisionActionState =
  | Readonly<{
      decisionId: string;
      proposalId: string;
      revision: number;
      outcome: GoalDecisionOutcome;
      proposalStatus: GoalDecisionResult["proposal"]["status"];
      adoptedGoalId: string | null;
      terminalGoalId: string | null;
    }>
  | Readonly<{ code: GoalDecisionActionErrorCode }>
  | undefined;

const productionDependencies = {
  prisma,
  resolveActorContext,
  revalidatePath,
  decideGoalProposal,
  createPrismaGoalDomainDependencies,
};

const requiredFields = ["outcome", "expectedRevision", "mutationKey"] as const;
const allowedFields = new Set<string>([...requiredFields, "note"]);
const uuidLikePattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function invalidInput(): never {
  throw new GoalDomainError("INVALID_INPUT");
}

function singleText(formData: FormData, name: string, required: boolean): string | undefined {
  const values = formData.getAll(name);
  if (values.length === 0 && !required) return undefined;
  if (values.length !== 1 || typeof values[0] !== "string") invalidInput();
  return values[0];
}

function boundedText(value: unknown, maxBytes: number): string {
  if (typeof value !== "string") invalidInput();
  const normalized = value.trim();
  if (!normalized || Buffer.byteLength(normalized, "utf8") > maxBytes) invalidInput();
  return normalized;
}

function parseOutcome(formData: FormData): GoalDecisionOutcome {
  const value = singleText(formData, "outcome", true);
  if (value === "ADOPTED" || value === "RETURNED" || value === "DECLINED") return value;
  return invalidInput();
}

function parseExpectedRevision(formData: FormData): number {
  const value = singleText(formData, "expectedRevision", true);
  if (!value || !/^[1-9]\d*$/.test(value)) invalidInput();
  const revision = Number(value);
  if (!Number.isSafeInteger(revision)) invalidInput();
  return revision;
}

function parseMutationKey(formData: FormData): string {
  const value = boundedText(singleText(formData, "mutationKey", true), 200);
  if (!uuidLikePattern.test(value)) invalidInput();
  return value;
}

function parseNote(formData: FormData): string | undefined {
  const value = singleText(formData, "note", false);
  if (value === undefined) return undefined;
  const normalized = value.trim();
  if (Buffer.byteLength(normalized, "utf8") > 2_000) invalidInput();
  return normalized || undefined;
}

function parseFormData(formData: FormData) {
  for (const name of formData.keys()) {
    if (!name.startsWith("$ACTION_") && !allowedFields.has(name)) invalidInput();
  }
  for (const name of requiredFields) {
    if (formData.getAll(name).length !== 1) invalidInput();
  }
  if (formData.getAll("note").length > 1) invalidInput();

  return {
    outcome: parseOutcome(formData),
    expectedRevision: parseExpectedRevision(formData),
    mutationKey: parseMutationKey(formData),
    note: parseNote(formData),
  };
}

function publicFailure(error: unknown): Readonly<{ code: GoalDecisionActionErrorCode }> {
  if (!(error instanceof GoalDomainError)) return { code: "TEMPORARY_FAILURE" };
  if (error.code === "INVALID_INPUT") return { code: "INVALID_INPUT" };
  if (error.code === "STALE_REVISION") return { code: "STALE_REVISION" };
  if ([
    "ACTOR_CONTEXT_MISMATCH",
    "FORBIDDEN",
    "PROPOSAL_NOT_FOUND",
    "MEETING_NOT_FOUND",
    "MEETING_INVALID",
    "PROPOSER_NOT_PARTICIPANT",
    "RECORDER_NOT_PARTICIPANT",
  ].includes(error.code)) return { code: "NOT_AVAILABLE" };
  if ([
    "MUTATION_KEY_CONFLICT",
    "DECISION_ALREADY_RECORDED",
    "SERIALIZATION_CONFLICT",
    "CONSTRAINT_VIOLATION",
    "PERSISTENCE_FAILED",
  ].includes(error.code)) return { code: "RETRY_CONFLICT" };
  return { code: "INVALID_STATE" };
}

function publicSuccess(result: GoalDecisionResult): Exclude<
  GoalDecisionActionState,
  undefined | { code: GoalDecisionActionErrorCode }
> {
  return {
    decisionId: result.decision.id,
    proposalId: result.proposal.id,
    revision: result.decision.revision,
    outcome: result.decision.outcome,
    proposalStatus: result.proposal.status,
    adoptedGoalId: result.adoptedGoal?.id ?? null,
    terminalGoalId: result.terminalGoal?.id ?? null,
  };
}

export async function recordGoalDecisionAction(
  proposalId: string,
  meetingId: string,
  _previousState: GoalDecisionActionState,
  formData: FormData,
): Promise<GoalDecisionActionState> {
  try {
    const input = parseFormData(formData);
    const dependencies = currentGoalDecisionActionDependencies(productionDependencies);
    const context = await dependencies.resolveActorContext();
    const result = await dependencies.decideGoalProposal({
      organizationId: context.organizationId,
      proposalId: boundedText(proposalId, 200),
      expectedRevision: input.expectedRevision,
      actor: {
        organizationId: context.organizationId,
        userId: context.userId,
        personId: context.personId,
      },
      meetingId: boundedText(meetingId, 200),
      mutationKey: input.mutationKey,
      outcome: input.outcome,
      ...(input.note === undefined ? {} : { note: input.note }),
    }, dependencies.createPrismaGoalDomainDependencies(dependencies.prisma));
    dependencies.revalidatePath(`/app/meetings/${meetingId}`);
    dependencies.revalidatePath("/app/goals");
    return publicSuccess(result);
  } catch (error) {
    return publicFailure(error);
  }
}
