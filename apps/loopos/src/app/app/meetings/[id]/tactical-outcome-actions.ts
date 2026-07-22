"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { DomainOperationError, submitTacticalOutcomeProposal } from "@/lib/domain-operations";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { notifyOutcomeAssignment, type NotificationClient } from "@/lib/notifications";
import { evaluateMeetingLifecycle } from "@/lib/organization-setup/meeting-lifecycle-policy";
import { assertTacticalFacilitationGate } from "@/lib/meeting-facilitation/domain-gates";
import {
  authorizeDecisionMutation,
  readAuthorizedMutationReplay,
  storedMutationEnvelope,
} from "./tactical-outcome-authority";
import { currentTacticalOutcomeActionDependencies } from "./tactical-outcome-action-dependencies";

export type TacticalOutcomeActionState = {
  error?: string;
  ok?: boolean;
  proposalId?: string;
  revision?: number;
  status?: "PROPOSED" | "RETURNED" | "REJECTED" | "APPROVED";
  outcomeKind?: "PROJECT" | "ACTION";
  outcomeId?: string;
} | null;

type Tx = Prisma.TransactionClient;
type Route = {
  runId: string;
  sourceTensionArtifactId: string;
  routeArtifactId: string;
  nodeId: string;
  nodeVisit: number;
  commandId: string;
};
type ProposalProvenance = { kind: "INTERFACE_RUN"; route: Route } | { kind: "ORDINARY_TENSION"; route: null };

const productionDecisionDependencies = {
  prisma,
  getCurrentOrgId,
  getCurrentPerson,
  revalidatePath,
};

function text(formData: FormData, key: string): string {
  return ((formData.get(key) as string | null) ?? "").trim();
}

function optionalDate(formData: FormData, key: string): Date | null {
  const value = text(formData, key);
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("日期格式无效");
  return date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mutationResult(value: unknown): Exclude<TacticalOutcomeActionState, null> | null {
  if (!isRecord(value) || value.ok !== true || typeof value.proposalId !== "string") return null;
  return {
    ok: true,
    proposalId: value.proposalId,
    revision: typeof value.revision === "number" ? value.revision : undefined,
    status: ["PROPOSED", "RETURNED", "REJECTED", "APPROVED"].includes(String(value.status)) ? value.status as never : undefined,
    outcomeKind: value.outcomeKind === "PROJECT" || value.outcomeKind === "ACTION" ? value.outcomeKind : undefined,
    outcomeId: typeof value.outcomeId === "string" ? value.outcomeId : undefined,
  };
}

function routeMetadata(value: unknown): { sourceTensionArtifactId: string; commandId: string; nodeId: string; nodeVisit: number } | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.meetingType !== "TACTICAL") return null;
  if (typeof value.sourceTensionArtifactId !== "string" || typeof value.commandId !== "string") return null;
  return {
    sourceTensionArtifactId: value.sourceTensionArtifactId,
    commandId: value.commandId,
    nodeId: typeof value.nodeId === "string" ? value.nodeId : "route_tactical_meeting",
    nodeVisit: typeof value.nodeVisit === "number" ? value.nodeVisit : 0,
  };
}

async function revalidateStoredRoute(tx: Tx, proposal: { organizationId: string; tensionId: string; runId: string; meetingId: string; sourceTensionArtifactId: string; routeArtifactId: string }): Promise<Route> {
  const source = await tx.interfaceWorkflowArtifact.findFirst({
    where: { id: proposal.sourceTensionArtifactId, organizationId: proposal.organizationId, runId: proposal.runId, artifactType: "TENSION", artifactId: proposal.tensionId, relation: "raised-tension" },
    select: { id: true },
  });
  const route = await tx.interfaceWorkflowArtifact.findFirst({
    where: { id: proposal.routeArtifactId, organizationId: proposal.organizationId, runId: proposal.runId, artifactType: "MEETING", artifactId: proposal.meetingId, relation: { startsWith: "tactical-route:" } },
    select: { id: true, relation: true, metadata: true },
  });
  const metadata = routeMetadata(route?.metadata);
  if (!source || !route || metadata?.sourceTensionArtifactId !== source.id || route.relation !== `tactical-route:${metadata.commandId}`) {
    throw new Error("提案来源路由已失效");
  }
  return { runId: proposal.runId, sourceTensionArtifactId: source.id, routeArtifactId: route.id, nodeId: metadata.nodeId, nodeVisit: metadata.nodeVisit, commandId: metadata.commandId };
}

async function revalidateProposalProvenance(tx: Tx, proposal: { provenanceKind: string; organizationId: string; tensionId: string; runId: string | null; meetingId: string; sourceTensionArtifactId: string | null; routeArtifactId: string | null }, handlingMode: string): Promise<ProposalProvenance> {
  if (proposal.provenanceKind === "ORDINARY_TENSION") {
    if (handlingMode !== "TACTICAL" || proposal.runId || proposal.sourceTensionArtifactId || proposal.routeArtifactId) throw new Error("普通张力来源已失效");
    return { kind: "ORDINARY_TENSION", route: null };
  }
  if (!proposal.runId || !proposal.sourceTensionArtifactId || !proposal.routeArtifactId) throw new Error("接口运行来源不完整");
  return { kind: "INTERFACE_RUN", route: await revalidateStoredRoute(tx, { ...proposal, runId: proposal.runId, sourceTensionArtifactId: proposal.sourceTensionArtifactId, routeArtifactId: proposal.routeArtifactId }) };
}

async function appendEvents(tx: Tx, input: { organizationId: string; runId: string; actorId: string; nodeId: string; nodeVisit: number; events: Array<{ type: string; payload: Record<string, unknown> }> }) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "interface_workflow_runs" WHERE "id" = ${input.runId} AND "organizationId" = ${input.organizationId} FOR UPDATE`);
  const last = await tx.interfaceWorkflowRunEvent.aggregate({ where: { runId: input.runId }, _max: { sequence: true } });
  const first = (last._max.sequence ?? 0) + 1;
  await tx.interfaceWorkflowRunEvent.createMany({
    data: input.events.map((event, index) => ({
      organizationId: input.organizationId,
      runId: input.runId,
      sequence: first + index,
      type: event.type,
      nodeId: input.nodeId,
      nodeVisit: input.nodeVisit,
      actorId: input.actorId,
      payload: event.payload as Prisma.InputJsonValue,
    })),
  });
}

export async function submitTacticalOutcomeProposalAction(
  tensionId: string,
  meetingId: string,
  _previous: TacticalOutcomeActionState,
  formData: FormData,
): Promise<TacticalOutcomeActionState> {
  const [organizationId, actor] = await Promise.all([getCurrentOrgId(), getCurrentPerson()]);
  if (!actor || actor.organizationId !== organizationId) return { error: "当前账号没有组织内人员身份" };

  const kind = text(formData, "kind");
  const title = text(formData, "title");
  const expectedResult = kind === "PROJECT" ? text(formData, "expectedResult") : null;
  const acceptanceCriteria = kind === "ACTION" ? text(formData, "acceptanceCriteria") : null;
  const circleId = text(formData, "circleId");
  const responsiblePersonId = text(formData, "responsiblePersonId");
  const expectedRevision = Number(text(formData, "expectedRevision") || "0");
  const expectedFacilitationRevision = optionalInteger(formData, "facilitationRevision");
  const mutationKey = text(formData, "mutationKey");
  let deadline: Date | null = null;
  try { deadline = kind === "ACTION" ? optionalDate(formData, "deadline") : null; } catch { return { error: "截止日期格式无效" }; }

  if ((kind !== "PROJECT" && kind !== "ACTION") || !title || !circleId || !responsiblePersonId || !mutationKey) return { error: "请完整填写提案" };
  if (kind === "PROJECT" && !expectedResult) return { error: "请填写项目预期结果" };
  if (kind === "ACTION" && !acceptanceCriteria) return { error: "请填写行动验收标准" };

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await assertTacticalFacilitationGate(tx, {
          organizationId,
          meetingId,
          actorPersonId: actor.id,
          tensionId,
          operation: "SUBMIT_CANDIDATE",
          expectedFacilitationRevision,
        });
        return submitTacticalOutcomeProposal(tx, {
        organizationId,
        actorId: actor.id,
        tensionId,
        meetingId,
        expectedRevision,
        mutationKey,
        kind: kind as "PROJECT" | "ACTION",
        title,
        description: kind === "PROJECT" ? expectedResult! : acceptanceCriteria!,
        circleId,
        responsiblePersonId,
        deadline,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    revalidateOutcomePaths(meetingId, tensionId);
    return result;
  } catch (error) {
    return { error: actionErrorMessage(error, "提交提案失败，请重试") };
  }
}

export async function recordTacticalOutcomeDecisionAction(
  proposalId: string,
  meetingId: string,
  _previous: TacticalOutcomeActionState,
  formData: FormData,
): Promise<TacticalOutcomeActionState> {
  const dependencies = currentTacticalOutcomeActionDependencies(productionDecisionDependencies);
  const [organizationId, actor] = await Promise.all([dependencies.getCurrentOrgId(), dependencies.getCurrentPerson()]);
  if (!actor || actor.organizationId !== organizationId) return { error: "当前账号没有组织内人员身份" };
  const decision = text(formData, "decision");
  const note = text(formData, "note");
  const mutationKey = text(formData, "mutationKey");
  const expectedRevision = Number(text(formData, "expectedRevision"));
  const expectedFacilitationRevision = optionalInteger(formData, "facilitationRevision");
  if (!["APPROVED", "RETURNED", "REJECTED"].includes(decision) || !mutationKey || !Number.isInteger(expectedRevision)) return { error: "会议结果参数无效" };
  if ((decision === "RETURNED" || decision === "REJECTED") && !note) return { error: "退回修改或不采纳必须填写会议说明" };

  try {
    const result = await dependencies.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { lifecycleStatus: true },
      });
      if (!evaluateMeetingLifecycle(organization?.lifecycleStatus).allowed) {
        throw new Error("组织尚未启用，不能进行会议操作");
      }
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "tactical_outcome_proposals" WHERE "id" = ${proposalId} AND "organizationId" = ${organizationId} FOR UPDATE`);
      const proposal = await tx.tacticalOutcomeProposal.findFirst({ where: { id: proposalId, organizationId } });
      if (!proposal) throw new Error("提案不存在或不属于当前组织");
      await assertTacticalFacilitationGate(tx, {
        organizationId,
        meetingId,
        actorPersonId: actor.id,
        tensionId: proposal.tensionId,
        operation: "CONFIRM_OUTPUT",
        expectedFacilitationRevision,
        responsiblePersonId: proposal.responsiblePersonId,
      });
      const meeting = await tx.meeting.findFirst({ where: { id: meetingId, organizationId, type: "TACTICAL", participants: { some: { id: actor.id } } }, select: { id: true } });
      const sourceTension = await tx.tension.findFirst({ where: { id: proposal.tensionId, organizationId }, select: { id: true, raiserId: true, status: true, handlingMode: true } });
      if (!sourceTension) throw new Error("提案来源已失效");
      const provenance = await revalidateProposalProvenance(tx, proposal, sourceTension.handlingMode);
      const [run, circle, responsiblePerson] = await Promise.all([
        proposal.runId ? tx.interfaceWorkflowRun.findFirst({ where: { id: proposal.runId, organizationId }, select: { id: true } }) : Promise.resolve(null),
        tx.circle.findFirst({ where: { id: proposal.circleId, organizationId, status: { not: "ARCHIVED" } }, select: { id: true } }),
        tx.person.findFirst({ where: { id: proposal.responsiblePersonId, organizationId }, select: { id: true } }),
      ]);
      if ((proposal.provenanceKind === "INTERFACE_RUN" && !run) || !circle || !responsiblePerson || sourceTension.raiserId !== proposal.proposerId) throw new Error("提案来源、目标或责任人已失效");
      const authorization = authorizeDecisionMutation({
        organizationId, actorId: actor.id, meetingId, subjectId: proposal.id, expectedRevision, mutationKey,
        payload: { decision, note }, proposalMeetingId: proposal.meetingId,
        isSelectedTacticalMeetingParticipant: meeting !== null,
      });

      const duplicate = await tx.tacticalOutcomeProposal.findUnique({ where: { organizationId_lastMutationKey: { organizationId, lastMutationKey: mutationKey } }, select: { id: true, lastMutationKey: true, lastMutationResult: true } });
      if (duplicate) {
        if (duplicate.id !== proposal.id) throw new Error("幂等键已被当前组织的其他提案使用");
        const prior = mutationResult(readAuthorizedMutationReplay(authorization, duplicate.lastMutationKey, duplicate.lastMutationResult));
        if (!prior) throw new Error("幂等结果无效");
        return prior;
      }

      if (proposal.status !== "PROPOSED" || proposal.revision !== expectedRevision || proposal.outcomeProjectId || proposal.outcomeActionId || sourceTension.status !== "OPEN") throw new Error("提案状态或版本已变化，请刷新后重试");

      const claimed = await tx.tacticalOutcomeProposal.updateMany({
        where: { id: proposal.id, organizationId, status: "PROPOSED", revision: expectedRevision, outcomeProjectId: null, outcomeActionId: null },
        data: { lastMutationKey: mutationKey, lastMutationResult: storedMutationEnvelope(authorization, { status: "PROCESSING" }) as Prisma.InputJsonValue },
      });
      if (claimed.count !== 1) throw new Error("提案已被其他会议结果处理");
      const now = new Date();

      if (decision === "RETURNED" || decision === "REJECTED") {
        const response = { ok: true, proposalId: proposal.id, revision: proposal.revision, status: decision as "RETURNED" | "REJECTED" };
        await tx.tacticalOutcomeProposal.update({ where: { id: proposal.id }, data: { status: decision, recordedById: actor.id, recordedAt: now, meetingDecisionNote: note, lastMutationResult: storedMutationEnvelope(authorization, response) as Prisma.InputJsonValue } });
        if (provenance.route) await appendEvents(tx, { organizationId, runId: provenance.route.runId, actorId: actor.id, nodeId: provenance.route.nodeId, nodeVisit: provenance.route.nodeVisit, events: [{ type: "TACTICAL_OUTCOME_MEETING_DECISION", payload: { proposalId: proposal.id, revision: proposal.revision, meetingId, decision, recordedById: actor.id, note } }] });
        return response;
      }

      let outcomeId: string;
      if (proposal.kind === "PROJECT") {
        const project = await tx.project.create({ data: { organizationId, name: proposal.title, goal: proposal.expectedResult!, expectedResult: proposal.expectedResult!, circleId: proposal.circleId, bearerId: proposal.responsiblePersonId, sourceTensionId: proposal.tensionId }, select: { id: true } });
        const resolved = await tx.tension.updateMany({ where: { id: proposal.tensionId, organizationId, status: "OPEN" }, data: { status: "RESOLVED", resolvedAt: now } });
        if (resolved.count !== 1) throw new Error("来源张力已被其他路径处理");
        outcomeId = project.id;
      } else {
        const assigned = await tx.tension.updateMany({ where: { id: proposal.tensionId, organizationId, status: "OPEN" }, data: { title: proposal.title, acceptanceCriteria: proposal.acceptanceCriteria!, deadline: proposal.deadline, status: "ASSIGNED", ownerId: proposal.responsiblePersonId, circleId: proposal.circleId, resolvedAt: null } });
        if (assigned.count !== 1) throw new Error("来源张力已被其他路径处理");
        outcomeId = proposal.tensionId;
      }

      const artifact = provenance.route ? await tx.interfaceWorkflowArtifact.create({ data: {
        organizationId, runId: provenance.route.runId, artifactType: proposal.kind, artifactId: outcomeId,
        relation: `tactical-outcome:${proposal.id}`,
        metadata: { schemaVersion: 1, commandId: provenance.route.commandId, nodeId: provenance.route.nodeId, nodeVisit: provenance.route.nodeVisit, proposalId: proposal.id, revision: proposal.revision, meetingId, proposerId: proposal.proposerId, recordedById: actor.id, sourceTensionArtifactId: proposal.sourceTensionArtifactId, routeArtifactId: proposal.routeArtifactId, routeRelation: `tactical-route:${provenance.route.commandId}`, outcomeKind: proposal.kind } as Prisma.InputJsonValue,
      }, select: { id: true } }) : null;
      const response = { ok: true, proposalId: proposal.id, revision: proposal.revision, status: "APPROVED" as const, outcomeKind: proposal.kind, outcomeId };
      await tx.tacticalOutcomeProposal.update({ where: { id: proposal.id }, data: { status: "APPROVED", recordedById: actor.id, recordedAt: now, meetingDecisionNote: note || null, outcomeProjectId: proposal.kind === "PROJECT" ? outcomeId : null, outcomeActionId: proposal.kind === "ACTION" ? outcomeId : null, lastMutationResult: storedMutationEnvelope(authorization, response) as Prisma.InputJsonValue } });
      await notifyOutcomeAssignment({
        organizationId,
        proposalId: proposal.id,
        outcomeKind: proposal.kind,
        outcomeId,
        title: proposal.title,
        recipientId: proposal.responsiblePersonId,
        client: tx as unknown as NotificationClient,
      });
      if (provenance.route && artifact) await appendEvents(tx, { organizationId, runId: provenance.route.runId, actorId: actor.id, nodeId: provenance.route.nodeId, nodeVisit: provenance.route.nodeVisit, events: [
        { type: "TACTICAL_OUTCOME_MEETING_DECISION", payload: { proposalId: proposal.id, revision: proposal.revision, meetingId, decision: "APPROVED", recordedById: actor.id, note: note || null } },
        { type: "TACTICAL_OUTCOME_CREATED", payload: { proposalId: proposal.id, revision: proposal.revision, outcomeKind: proposal.kind, outcomeId } },
        { type: "ARTIFACT_CREATED", payload: { artifactLinkId: artifact.id, artifactType: proposal.kind, artifactId: outcomeId, relation: `tactical-outcome:${proposal.id}` } },
      ] });
      return response;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const proposal = await dependencies.prisma.tacticalOutcomeProposal.findFirst({ where: { id: proposalId, organizationId }, select: { tensionId: true } });
    revalidateOutcomePaths(meetingId, proposal?.tensionId, "outcomeId" in result ? result.outcomeId : undefined, dependencies.revalidatePath);
    return result;
  } catch (error) {
    return { error: actionErrorMessage(error, "记录会议结果失败，请重试") };
  }
}

function actionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof DomainOperationError) {
    switch (error.code) {
      case "INVALID_TACTICAL_OUTCOME_PROPOSAL":
        return "请完整填写提案";
      case "TACTICAL_TENSION_NOT_AVAILABLE":
        return "张力不存在、已处理或不属于当前组织";
      case "TACTICAL_PROPOSER_REQUIRED":
      case "TACTICAL_OUTCOME_ACCESS_DENIED":
        return "只有张力提出人可以提交或修改提案";
      case "TACTICAL_MEETING_PARTICIPANT_REQUIRED":
        return "必须在精确选定的战术会提交";
      case "TACTICAL_TARGET_NOT_AVAILABLE":
        return "回路或负责人不属于当前组织";
      case "EXACT_TACTICAL_ROUTE_REQUIRED":
        return "该张力没有精确路由到本次战术会";
      case "TACTICAL_TENSION_ROUTE_REQUIRED":
        return "普通张力必须先由提出人确认为战术处理";
      case "TACTICAL_PROPOSAL_STALE":
        return "提案状态或版本已变化，请刷新后重试";
      case "TACTICAL_PROVENANCE_STALE":
        return "提案来源或会议已变化";
      case "MUTATION_KEY_CONFLICT":
        return "幂等键已被当前组织的其他提案使用";
    }
  }
  if (!(error instanceof Error)) return fallback;
  const message = error.message;
  if (/could not serialize|concurrent update|Unique constraint|P2002|Invalid `prisma/i.test(message)) {
    return "提案已由另一位参会人记录，请刷新查看结果";
  }
  return /[\u3400-\u9fff]/.test(message) ? message : fallback;
}

function optionalInteger(formData: FormData, key: string): number | undefined {
  const value = text(formData, key);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function revalidateOutcomePaths(meetingId: string, tensionId?: string, outcomeId?: string, revalidate = revalidatePath) {
  revalidate(`/app/meetings/${meetingId}`);
  revalidate("/app/projects");
  revalidate("/app/tracker");
  revalidate("/app/interfaces/runs");
  if (tensionId) {
    revalidate(`/app/tensions/${tensionId}`);
    revalidate(`/app/tracker/${tensionId}`);
  }
  if (outcomeId) revalidate(`/app/projects/${outcomeId}`);
}
