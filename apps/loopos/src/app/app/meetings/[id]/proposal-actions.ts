"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { createPrismaGovernanceDecisionDependencies, executeGovernanceDecisionOperation, type GovernanceDecisionInput, type GovernanceDecisionOperation, type GovernanceProposalRevisionInput } from "@/lib/governance-decision";
import { parseGovernanceStructuralChange } from "@/lib/governance-change";
import { createNotification } from "@/lib/notifications";
import { assertGovernanceFacilitationGate } from "@/lib/meeting-facilitation/domain-gates";

export type ProposalState = { error?: string; ok?: boolean; state?: string; proposalId?: string } | null;

const LEGACY_GOVERNANCE_DENIAL = "历史治理提案仅供查看；不能通过旧流程修改组织结构。";

function text(formData: FormData, key: string): string { return String(formData.get(key) ?? "").trim(); }

function revision(formData: FormData): GovernanceProposalRevisionInput {
  const changeType = text(formData, "changeType") || "ROLE_CREATED";
  const t = (k: string) => text(formData, k) || null;
  const tReq = (k: string) => text(formData, k);
  const body = text(formData, "proposalBody");

  // 修订场景：没有changeType字段，复用上次保存的typedChange
  const preservedChange = text(formData, "preserveTypedChange");
  const hasChangeType = formData.get("changeType") !== null;

  const fallback = body || (hasChangeType ? [
    `变更类型：${changeType}`,
    tReq("roleName") || tReq("circleName") || tReq("agentName") || "",
    tReq("purpose") ? `目的：${tReq("purpose")}` : "",
  ].filter(Boolean).join("、") : "修订后的提案");
  const currentStructure = fallback || "当前组织结构";
  const proposedStructure = fallback || "提议的组织变更";

  let typedChange: Record<string, unknown>;

  if (!hasChangeType && preservedChange) {
    // 修订：复用原typedChange
    typedChange = JSON.parse(preservedChange) as Record<string, unknown>;
  } else {
    switch (changeType) {
    case "ROLE_CREATED":
      typedChange = { schemaVersion: 1, operation: "ROLE_CREATED", circleId: tReq("circleId"), name: tReq("roleName"), purpose: tReq("purpose"), domain: t("domain"), accountabilities: tReq("accountabilities"), category: text(formData, "category") || "EXPERT", ownershipType: "HOME" };
      break;
    case "ROLE_MODIFIED":
      typedChange = { schemaVersion: 1, operation: "ROLE_MODIFIED", targetId: tReq("targetId"), name: tReq("roleName"), purpose: tReq("purpose"), domain: t("domain"), accountabilities: tReq("accountabilities") };
      break;
    case "ROLE_ARCHIVED":
      typedChange = { schemaVersion: 1, operation: "ROLE_ARCHIVED", targetId: tReq("targetId") };
      break;
    case "CIRCLE_CREATED":
      typedChange = { schemaVersion: 1, operation: "CIRCLE_CREATED", name: tReq("circleName"), purpose: tReq("purpose"), domain: t("domain"), number: text(formData, "number") || "CUSTOM", type: text(formData, "circleType") || "PRODUCTION", parentId: t("parentId") };
      break;
    case "CIRCLE_MODIFIED":
      typedChange = { schemaVersion: 1, operation: "CIRCLE_MODIFIED", targetId: tReq("targetId"), name: tReq("circleName"), purpose: tReq("purpose"), domain: t("domain") };
      break;
    case "HOME_CHANGE":
      typedChange = { schemaVersion: 1, operation: "HOME_CHANGE", targetId: tReq("targetId"), homeCircleId: tReq("homeCircleId") };
      break;
    case "AGENT_CREATED":
      typedChange = { schemaVersion: 1, operation: "AGENT_CREATED", name: tReq("agentName"), circleId: tReq("circleId"), agentModel: tReq("agentModel"), agentAbilities: tReq("agentAbilities"), agentEndpoint: t("agentEndpoint"), agentConfig: t("agentConfig"), guardianRoleId: t("guardianRoleId") };
      break;
    case "CHARTER_CREATED":
      typedChange = { schemaVersion: 1, operation: "CHARTER_CREATED", version: tReq("version"), content: tReq("content"), changeSummary: t("changeSummary") };
      break;
    case "CHARTER_AMENDED":
      typedChange = { schemaVersion: 1, operation: "CHARTER_AMENDED", targetId: tReq("targetId"), version: tReq("version"), content: tReq("content"), changeSummary: t("changeSummary") };
      break;
    default:
      typedChange = { schemaVersion: 1, operation: "ROLE_CREATED", circleId: tReq("circleId"), name: tReq("roleName"), purpose: tReq("purpose"), domain: t("domain"), accountabilities: tReq("accountabilities"), category: text(formData, "category") || "EXPERT", ownershipType: "HOME" };
  }
  }
  return { currentStructure, proposedStructure, typedChange: typedChange as GovernanceProposalRevisionInput["typedChange"] };
}

export async function initializeOrdinaryGovernanceAction(tensionId: string, meetingId: string, _previous: ProposalState, formData: FormData): Promise<ProposalState> {
  const [organizationId, actor] = await Promise.all([getCurrentOrgId(), getCurrentPerson()]);
  if (!actor || actor.organizationId !== organizationId) return { error: "当前账号没有组织内人员身份" };
  try {
    const proposalId = `ordinary-${createHash("sha256").update(`${organizationId}:${tensionId}`).digest("hex").slice(0, 32)}`;
    return await runCanonical({ provenanceKind: "ORDINARY_TENSION", sourceTensionId: tensionId, organizationId, proposalId, meetingId, actorId: actor.id, expectedRevision: 1, operation: "INITIALIZE", operationScope: "initialize", mutationKey: text(formData, "mutationKey"), revision: revision(formData) }, meetingId, optionalInteger(formData, "facilitationRevision"));
  } catch (error) { console.error("[governance candidate initialize]", error); return { error: message(error) }; }
}

export async function initializeRuntimeGovernanceAction(proposalId: string, meetingId: string, runId: string, proposalArtifactId: string, routeArtifactId: string, _previous: ProposalState, formData: FormData): Promise<ProposalState> {
  const [organizationId, actor] = await Promise.all([getCurrentOrgId(), getCurrentPerson()]);
  if (!actor || actor.organizationId !== organizationId) return { error: "当前账号没有组织内人员身份" };
  try {
    const proposal = await prisma.governanceProposal.findFirst({ where: { id: proposalId, organizationId, meetingId, status: "CANDIDATE" }, select: { id: true } });
    if (!proposal) throw new Error("该治理候选类型暂不支持规范结构应用");
    return await runCanonical({ provenanceKind: "INTERFACE_RUN", organizationId, proposalId, runId, meetingId, proposalArtifactId, routeArtifactId, actorId: actor.id, expectedRevision: 1, operation: "INITIALIZE", operationScope: "initialize", mutationKey: text(formData, "mutationKey"), revision: revision(formData) }, meetingId, optionalInteger(formData, "facilitationRevision"));
  } catch (error) { return { error: message(error) }; }
}

export async function initializeCandidateGovernanceAction(proposalId: string, meetingId: string, _previous: ProposalState, formData: FormData): Promise<ProposalState> {
  const [organizationId, actor] = await Promise.all([getCurrentOrgId(), getCurrentPerson()]);
  if (!actor || actor.organizationId !== organizationId) return { error: "当前账号没有组织内人员身份" };
  try {
    const proposal = await prisma.governanceProposal.findFirst({ where: { id: proposalId, organizationId, meetingId, status: "CANDIDATE" }, select: { id: true, tensionId: true, proposedChange: true, rationale: true } });
    if (!proposal) throw new Error("治理候选不存在或已变更");
    const rawValue = proposal.proposedChange as unknown;
    const rawChange = (typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue) as Record<string, unknown>;
    const normalizedChange = rawChange.operation === "CIRCLE_CREATED" ? Object.fromEntries(Object.entries(rawChange).filter(([key]) => key !== "targetId")) : rawChange;
    const typedChange = parseGovernanceStructuralChange(normalizedChange);
	    return await runCanonical({ provenanceKind: "ORDINARY_TENSION", sourceTensionId: proposal.tensionId, organizationId, proposalId: proposal.id, meetingId, actorId: actor.id, expectedRevision: 1, operation: "INITIALIZE", operationScope: "initialize", mutationKey: text(formData, "mutationKey"), revision: { currentStructure: "当前组织结构（来源张力待治理会议审核）", proposedStructure: JSON.stringify(typedChange), rationale: proposal.rationale || "待治理会议审核", expectedImpact: "按治理会议审核结果执行，后续可通过新张力回归", typedChange } }, meetingId, optionalInteger(formData, "facilitationRevision"));
  } catch (error) { console.error("[governance candidate initialize]", error); return { error: message(error) }; }
}

export async function executeCanonicalGovernanceAction(proposalId: string, meetingId: string, _previous: ProposalState, formData: FormData): Promise<ProposalState> {
  const [organizationId, actor] = await Promise.all([getCurrentOrgId(), getCurrentPerson()]);
  if (!actor || actor.organizationId !== organizationId) return { error: "当前账号没有组织内人员身份" };
  try {
    const process = await prisma.governanceDecisionProcess.findFirst({ where: { organizationId, proposalId, meetingId }, select: { provenanceKind: true, sourceTensionId: true, runId: true, proposalArtifactId: true, routeArtifactId: true } });
    if (!process) throw new Error("规范治理流程尚未初始化");
    const operation = text(formData, "operation") as GovernanceDecisionOperation;
    const common = { organizationId, proposalId, meetingId, actorId: actor.id, expectedRevision: Number(text(formData, "expectedRevision")), operation, operationScope: text(formData, "operationScope"), mutationKey: text(formData, "mutationKey") };
    const payload = operationPayload(operation, formData);
    const input: GovernanceDecisionInput = process.provenanceKind === "ORDINARY_TENSION"
      ? { ...common, provenanceKind: "ORDINARY_TENSION", sourceTensionId: process.sourceTensionId, ...payload } as GovernanceDecisionInput
      : { ...common, provenanceKind: "INTERFACE_RUN", runId: process.runId!, proposalArtifactId: process.proposalArtifactId!, routeArtifactId: process.routeArtifactId!, ...payload } as GovernanceDecisionInput;
    return await runCanonical(input, meetingId, optionalInteger(formData, "facilitationRevision"));
  } catch (error) { return { error: message(error) }; }
}

async function runCanonical(input: GovernanceDecisionInput, meetingId: string, expectedFacilitationRevision?: number): Promise<ProposalState> {
  await assertGovernanceFacilitationGate(prisma, {
    organizationId: input.organizationId,
    meetingId,
    actorPersonId: input.actorId,
    proposalId: input.proposalId,
    proposalRevision: input.expectedRevision,
    operation: input.operation,
    expectedFacilitationRevision,
  });
  const result = await executeGovernanceDecisionOperation(input, createPrismaGovernanceDecisionDependencies(prisma));
  if (input.operation === "ADOPT_ROLE") await notifyRoleAssignmentAccepted(input.organizationId, input.proposalId);
  revalidatePath(`/app/meetings/${meetingId}`);
  revalidatePath("/app/organization");
  revalidatePath("/app/circles/map");
  revalidatePath("/app/roles/market");
  revalidatePath("/app/governance");
  if (result.roleId) revalidatePath(`/app/roles/${result.roleId}`);
  return { ok: true, state: result.state, proposalId: result.proposalId };
}

async function notifyRoleAssignmentAccepted(organizationId: string, proposalId: string): Promise<void> {
  const process = await prisma.governanceDecisionProcess.findFirst({
    where: { organizationId, proposalId, state: "ADOPTED" },
    select: {
      id: true,
      meetingId: true,
      currentRevisionRecord: { select: { typedChange: true } },
    },
  });
  const typedChange = process?.currentRevisionRecord?.typedChange;
  if (!process || !typedChange || typeof typedChange !== "object" || Array.isArray(typedChange)) return;
  const change = typedChange as Record<string, unknown>;
  if (change.operation !== "ROLE_ASSIGNMENT" || typeof change.personId !== "string" || typeof change.roleId !== "string" || typeof change.applicationId !== "string") return;
  const [person, role] = await Promise.all([
    prisma.person.findFirst({ where: { id: change.personId, organizationId }, select: { id: true, name: true } }),
    prisma.roleDef.findFirst({ where: { id: change.roleId, organizationId }, select: { name: true } }),
  ]);
  if (!person || !role) return;
  await createNotification({
    organizationId,
    recipientId: person.id,
    type: "role_application_accepted",
    eventKey: `role-application:${change.applicationId}:accepted`,
    title: `角色任职已确认：${role.name}`,
    body: "治理会议已采纳你的角色申请，角色已加入你的任职关系。",
    targetUrl: `/app/roles/${change.roleId}`,
  });
}

function operationPayload(operation: GovernanceDecisionOperation, formData: FormData) {
  if (operation === "SUBMIT_REVISION") return { revision: revision(formData) };
  if (operation === "REQUEST_CLARIFICATION") return { clarification: { question: text(formData, "question"), reason: text(formData, "reason") } };
  const objection = { materialHarm: text(formData, "materialHarm"), factVsWorry: text(formData, "factVsWorry"), reversibility: text(formData, "reversibility"), safeToTry: text(formData, "safeToTry") };
  if (operation === "RAISE_OBJECTION") return { objection };
  if (operation === "ASSESS_OBJECTION_VALID" || operation === "ASSESS_OBJECTION_INVALID") return { assessment: { ...objection, validity: operation === "ASSESS_OBJECTION_VALID" ? "VALID" as const : "INVALID" as const, assessmentNote: text(formData, "assessmentNote") } };
  return { note: text(formData, "note") };
}

function message(error: unknown) { return error instanceof Error ? error.message : "治理操作失败"; }

function optionalInteger(formData: FormData, key: string): number | undefined {
  const value = text(formData, key);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

export async function createProposalAction(): Promise<ProposalState> { return { error: LEGACY_GOVERNANCE_DENIAL }; }
export async function clarifyProposalAction(): Promise<ProposalState> { return { error: LEGACY_GOVERNANCE_DENIAL }; }
export async function objectProposalAction(): Promise<ProposalState> { return { error: LEGACY_GOVERNANCE_DENIAL }; }
export async function adoptProposalAction(): Promise<ProposalState> { return { error: LEGACY_GOVERNANCE_DENIAL }; }
export async function withdrawProposalAction(): Promise<ProposalState> { return { error: LEGACY_GOVERNANCE_DENIAL }; }
