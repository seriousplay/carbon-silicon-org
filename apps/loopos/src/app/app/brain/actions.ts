"use server";

import {
  createOrganizationBrainConversation,
  executeOrganizationBrainTurn,
  listOrganizationBrainConversations,
  loadOrganizationBrainConversation,
  OrganizationBrainTurnServiceError,
  type OrganizationBrainTurnResult,
} from "@/lib/organization-brain/turn-service";
import type {
  OrganizationBrainConversationDetail,
  OrganizationBrainConversationList,
  OrganizationBrainConversationSummary,
} from "@/lib/organization-brain/conversation-store";
import {
  BrainCommandPreviewServiceError,
  confirmBrainCommandPreview,
  listBrainCommandPreviews,
  createGovernanceProposalPreview,
  createTensionRaisePreview,
  listGovernanceProposalContext,
  listTensionRaiseContext,
  createRoleApplicationPreview,
  listRoleApplicationContext,
  createTacticalOutcomePreview,
  listTacticalOutcomeContext,
  type BrainCommandPreviewConfirmOutput,
  type BrainCommandPreviewList,
} from "@/lib/organization-brain/command-preview-service";
import {
  getPrivateBrief,
  PrivateBriefServiceError,
} from "@/lib/organization-brain/private-brief-service";
import type { PrivateBrief } from "@/lib/organization-brain/private-brief-types";
import {
  confirmMemoryCandidate,
  createMemoryCandidateDraft,
  listReviewableMemoryCandidates,
  MemoryCandidateServiceError,
  rejectMemoryCandidate,
  submitMemoryCandidate,
} from "@/lib/organization-brain/memory-candidate-service";
import type { MemoryCandidate, MemoryCandidateSourceRef } from "@/lib/organization-brain/memory-candidate-types";

export type BrainActionErrorCode =
  | "INVALID_INPUT"
  | "NOT_AVAILABLE"
  | "RETRY_CONFLICT"
  | "TEMPORARY_FAILURE";

export type BrainActionResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; code: BrainActionErrorCode; message: string }>;

const PUBLIC_ERRORS = Object.freeze({
  INVALID_INPUT: "请求内容不符合要求。",
  NOT_AVAILABLE: "无法访问该组织大脑会话。",
  RETRY_CONFLICT: "该请求标识已用于不同内容，请重新提交。",
  TEMPORARY_FAILURE: "组织大脑暂时不可用，请稍后重试。",
} as const);

type InputRecord = Readonly<Record<string, unknown>>;

function inputRecord(input: unknown): InputRecord | null {
  try {
    return typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as InputRecord)
      : null;
  } catch {
    return null;
  }
}

function failure(error: unknown): Readonly<{
  ok: false;
  code: BrainActionErrorCode;
  message: string;
}> {
  let code: BrainActionErrorCode = "TEMPORARY_FAILURE";
  if (error instanceof OrganizationBrainTurnServiceError) {
    if (error.code === "INVALID_INPUT") code = "INVALID_INPUT";
    if (error.code === "ACCESS_DENIED") code = "NOT_AVAILABLE";
    if (error.code === "IDEMPOTENCY_CONFLICT") code = "RETRY_CONFLICT";
  }
  if (error instanceof BrainCommandPreviewServiceError) {
    if (error.code === "INVALID_INPUT") code = "INVALID_INPUT";
    if (error.code === "ACCESS_DENIED") code = "NOT_AVAILABLE";
  }
  if (error instanceof PrivateBriefServiceError) {
    if (error.code === "INVALID_INPUT") code = "INVALID_INPUT";
    if (error.code === "ACCESS_DENIED") code = "NOT_AVAILABLE";
  }
  if (error instanceof MemoryCandidateServiceError) {
    if (error.code === "INVALID_INPUT" || error.code === "INVALID_STATE") code = "INVALID_INPUT";
    if (error.code === "ACCESS_DENIED" || error.code === "NOT_AVAILABLE") code = "NOT_AVAILABLE";
  }
  return { ok: false, code, message: PUBLIC_ERRORS[code] };
}

export async function createBrainConversation(
  input: Readonly<{ clientConversationId: string }>,
): Promise<BrainActionResult<OrganizationBrainConversationSummary>> {
  const value = inputRecord(input);
  try {
    const data = await createOrganizationBrainConversation({
      schemaVersion: 1,
      clientConversationId: value?.clientConversationId as string,
    });
    return { ok: true, data };
  } catch (error) {
    return failure(error);
  }
}

export async function listBrainConversations(
  input: Readonly<{ limit?: number }>,
): Promise<BrainActionResult<OrganizationBrainConversationList>> {
  const value = inputRecord(input);
  try {
    const data = await listOrganizationBrainConversations({
      schemaVersion: 1,
      limit: value ? (value.limit as number | undefined) : 0,
    });
    return { ok: true, data };
  } catch (error) {
    console.error("[brain governance proposal preview]", error);
    return failure(error);
  }
}

export async function loadBrainConversation(
  input: Readonly<{ conversationId: string; messageLimit?: number }>,
): Promise<BrainActionResult<OrganizationBrainConversationDetail>> {
  const value = inputRecord(input);
  try {
    const data = await loadOrganizationBrainConversation({
      schemaVersion: 1,
      conversationId: value?.conversationId as string,
      messageLimit: value?.messageLimit as number | undefined,
    });
    return { ok: true, data };
  } catch (error) {
    return failure(error);
  }
}

export async function submitBrainTurn(
  input: Readonly<{
    conversationId: string;
    clientTurnId: string;
    question: string;
  }>,
): Promise<BrainActionResult<OrganizationBrainTurnResult>> {
  const value = inputRecord(input);
  try {
    const data = await executeOrganizationBrainTurn({
      schemaVersion: 1,
      conversationId: value?.conversationId as string,
      clientTurnId: value?.clientTurnId as string,
      question: value?.question as string,
    });
    return { ok: true, data };
  } catch (error) {
    return failure(error);
  }
}

export async function listBrainCommandPreviewCards(
  input: Readonly<{ conversationId?: string; limit?: number }>,
): Promise<BrainActionResult<BrainCommandPreviewList>> {
  const value = inputRecord(input);
  try {
    const data = await listBrainCommandPreviews({
      schemaVersion: 1,
      conversationId: value?.conversationId as string | undefined,
      limit: value?.limit as number | undefined,
    });
    return { ok: true, data };
  } catch (error) {
    return failure(error);
  }
}

export async function confirmBrainCommandPreviewCard(
  input: Readonly<{ previewId: string; mutationKey: string }>,
): Promise<BrainActionResult<BrainCommandPreviewConfirmOutput>> {
  const value = inputRecord(input);
  try {
    const data = await confirmBrainCommandPreview({
      schemaVersion: 1,
      previewId: value?.previewId as string,
      mutationKey: value?.mutationKey as string,
    });
    return { ok: true, data };
  } catch (error) {
    return failure(error);
  }
}

export async function createBrainGovernanceProposalPreview(
  input: Readonly<{
    conversationId: string;
    userMessageId: string;
    tensionId: string;
    meetingId: string;
    currentStructure: string;
    proposedStructure: string;
    rationale: string;
    expectedImpact: string;
    structuralChange: unknown;
  }>,
): Promise<BrainActionResult<import("@/lib/organization-brain/command-preview-types").BrainCommandPreviewSummary>> {
  const value = inputRecord(input);
  try {
    const data = await createGovernanceProposalPreview({
      conversationId: value?.conversationId as string,
      userMessageId: value?.userMessageId as string,
      tensionId: value?.tensionId as string,
      meetingId: value?.meetingId as string,
      currentStructure: value?.currentStructure as string,
      proposedStructure: value?.proposedStructure as string,
      rationale: value?.rationale as string,
      expectedImpact: value?.expectedImpact as string,
      structuralChange: value?.structuralChange,
    });
    return { ok: true, data };
  } catch (error) {
    return failure(error);
  }
}

export async function loadBrainGovernanceProposalContext(): Promise<BrainActionResult<import("@/lib/organization-brain/command-preview-service").GovernanceProposalContext>> {
  try {
    return { ok: true, data: await listGovernanceProposalContext() };
  } catch (error) {
    return failure(error);
  }
}

export async function loadBrainTensionRaiseContext(): Promise<BrainActionResult<import("@/lib/organization-brain/command-preview-service").TensionRaiseContext>> {
  try { return { ok: true, data: await listTensionRaiseContext() }; } catch (error) { return failure(error); }
}

export async function createBrainTensionRaisePreview(input: Readonly<{ conversationId: string; userMessageId: string; title: string; description: string; type: "PROBLEMATIC" | "CONSTRUCTIVE" | "CLARIFYING"; circleIds: readonly string[]; handlingMode: "UNROUTED" | "TACTICAL" | "GOVERNANCE" }>): Promise<BrainActionResult<import("@/lib/organization-brain/command-preview-types").BrainCommandPreviewSummary>> {
  const value = inputRecord(input);
  try { return { ok: true, data: await createTensionRaisePreview({ conversationId: value?.conversationId as string, userMessageId: value?.userMessageId as string, title: value?.title as string, description: value?.description as string, type: value?.type as "PROBLEMATIC" | "CONSTRUCTIVE" | "CLARIFYING", circleIds: value?.circleIds as string[], handlingMode: value?.handlingMode as "UNROUTED" | "TACTICAL" | "GOVERNANCE" }) }; } catch (error) { return failure(error); }
}

export async function createBrainRoleApplicationPreview(
  input: Readonly<{ conversationId: string; userMessageId: string; roleId: string; motivation: string; capabilitySummary: string; commitment: string }>,
): Promise<BrainActionResult<import("@/lib/organization-brain/command-preview-types").BrainCommandPreviewSummary>> {
  const value = inputRecord(input);
  try {
    return { ok: true, data: await createRoleApplicationPreview({ conversationId: value?.conversationId as string, userMessageId: value?.userMessageId as string, roleId: value?.roleId as string, motivation: value?.motivation as string, capabilitySummary: value?.capabilitySummary as string, commitment: value?.commitment as string }) };
  } catch (error) {
    return failure(error);
  }
}

export async function loadBrainRoleApplicationContext(): Promise<BrainActionResult<import("@/lib/organization-brain/command-preview-service").RoleApplicationContext>> {
  try {
    return { ok: true, data: await listRoleApplicationContext() };
  } catch (error) {
    return failure(error);
  }
}

export async function loadBrainTacticalOutcomeContext(): Promise<BrainActionResult<import("@/lib/organization-brain/command-preview-service").TacticalOutcomeContext>> {
  try { return { ok: true, data: await listTacticalOutcomeContext() }; } catch (error) { return failure(error); }
}

export async function createBrainTacticalOutcomePreview(input: Readonly<{
  conversationId: string;
  userMessageId: string;
  tensionId: string;
  meetingId: string;
  expectedRevision: number;
  kind: "PROJECT" | "ACTION";
  title: string;
  description: string;
  circleId: string;
  responsiblePersonId: string;
  dueDate?: string;
}>): Promise<BrainActionResult<import("@/lib/organization-brain/command-preview-service").BrainCommandPreviewSummary>> {
  const value = inputRecord(input);
  try {
    return { ok: true, data: await createTacticalOutcomePreview({
      conversationId: value?.conversationId as string,
      userMessageId: value?.userMessageId as string,
      tensionId: value?.tensionId as string,
      meetingId: value?.meetingId as string,
      expectedRevision: value?.expectedRevision as number,
      kind: value?.kind as "PROJECT" | "ACTION",
      title: value?.title as string,
      description: value?.description as string,
      circleId: value?.circleId as string,
      responsiblePersonId: value?.responsiblePersonId as string,
      dueDate: value?.dueDate as string | undefined,
    }) };
  } catch (error) { return failure(error); }
}

export async function loadBrainPrivateBrief(
  input: Readonly<{ windowDays?: number; maxSignals?: number }>,
): Promise<BrainActionResult<PrivateBrief>> {
  const value = inputRecord(input);
  try {
    const data = await getPrivateBrief({
      schemaVersion: 1,
      windowDays: value?.windowDays as number | undefined,
      maxSignals: value?.maxSignals as number | undefined,
    });
    return { ok: true, data };
  } catch (error) {
    return failure(error);
  }
}

export async function submitBrainMemoryCandidate(
  input: Readonly<{
    claim: string;
    rationale: string;
    sourceRefs: readonly MemoryCandidateSourceRef[];
  }>,
): Promise<BrainActionResult<MemoryCandidate>> {
  const value = inputRecord(input);
  try {
    const draft = await createMemoryCandidateDraft({
      schemaVersion: 1,
      claim: value?.claim as string,
      rationale: value?.rationale as string,
      sourceRefs: value?.sourceRefs as readonly MemoryCandidateSourceRef[],
    });
    const data = await submitMemoryCandidate({
      schemaVersion: 1,
      candidateId: draft.id,
      reason: "Submitted from private Organization Brain brief.",
    });
    return { ok: true, data };
  } catch (error) {
    return failure(error);
  }
}

export async function listBrainReviewableMemoryCandidates(
  input: Readonly<{ limit?: number }>,
): Promise<BrainActionResult<readonly MemoryCandidate[]>> {
  const value = inputRecord(input);
  try {
    const data = await listReviewableMemoryCandidates({
      schemaVersion: 1,
      limit: value?.limit as number | undefined,
    });
    return { ok: true, data };
  } catch (error) {
    return failure(error);
  }
}

export async function confirmBrainMemoryCandidate(
  input: Readonly<{ candidateId: string; reason?: string | null }>,
): Promise<BrainActionResult<MemoryCandidate>> {
  const value = inputRecord(input);
  try {
    const data = await confirmMemoryCandidate({
      schemaVersion: 1,
      candidateId: value?.candidateId as string,
      validFrom: new Date().toISOString(),
      reason: value?.reason as string | null | undefined,
    });
    return { ok: true, data };
  } catch (error) {
    return failure(error);
  }
}

export async function rejectBrainMemoryCandidate(
  input: Readonly<{ candidateId: string; reason?: string | null }>,
): Promise<BrainActionResult<MemoryCandidate>> {
  const value = inputRecord(input);
  try {
    const data = await rejectMemoryCandidate({
      schemaVersion: 1,
      candidateId: value?.candidateId as string,
      reason: value?.reason as string | null | undefined,
    });
    return { ok: true, data };
  } catch (error) {
    return failure(error);
  }
}
