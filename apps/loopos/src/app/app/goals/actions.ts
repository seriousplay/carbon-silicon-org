"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { resolveActorContext } from "@/lib/authorization/actor-context";
import {
  appendGoalProposalRevision,
  createGoalCycle,
  createGoalProposal,
  createPrismaGoalDomainDependencies,
  GoalDomainError,
  submitGoalProposal,
  withdrawGoalProposal,
  type GoalProposalKind,
  type GoalProposalRevisionInput,
  type GoalProposalSnapshot,
  type GoalProposalTargetInput,
} from "@/lib/goals/domain-operations";
import { currentGoalActionDependencies } from "./action-dependencies";

type GoalActionErrorCode =
  | "INVALID_INPUT"
  | "NOT_AVAILABLE"
  | "STALE_REVISION"
  | "INVALID_STATE"
  | "INVALID_REFERENCE"
  | "RETRY_CONFLICT"
  | "TEMPORARY_FAILURE";

type GoalActionState =
  | Readonly<{
      proposalId: string;
      currentRevision: number;
      status: GoalProposalSnapshot["status"];
      meetingId?: string;
    }>
  | Readonly<{ code: GoalActionErrorCode }>
  | undefined;

export type GoalCycleActionState = { error?: string };

const productionDependencies = {
  prisma,
  resolveActorContext,
  revalidatePath,
  createGoalProposal,
  createGoalCycle,
  appendGoalProposalRevision,
  submitGoalProposal,
  withdrawGoalProposal,
  createPrismaGoalDomainDependencies,
};

export async function createGoalCycleAction(
  _previous: GoalCycleActionState,
  formData: FormData,
): Promise<GoalCycleActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const startAt = parseDate(formData.get("startAt"));
  const endAt = parseDate(formData.get("endAt"));
  if (!name || !startAt || !endAt || endAt <= startAt) return { error: "请填写有效的周期名称、开始日期和结束日期。" };
  try {
    const actor = await productionDependencies.resolveActorContext();
    await productionDependencies.createGoalCycle({
      organizationId: actor.organizationId,
      actor,
      name,
      startAt,
      endAt,
      checkInCadenceDays: 7,
    }, productionDependencies.createPrismaGoalDomainDependencies(productionDependencies.prisma));
    productionDependencies.revalidatePath("/app/goals");
    return {};
  } catch (error) {
    if (error instanceof GoalDomainError) return { error: "当前用户无权建立目标周期，或周期数据不符合规则。" };
    console.error("创建目标周期失败:", error);
    return { error: "目标周期暂时无法建立，请稍后重试。" };
  }
}

function parseDate(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const revisionActionFields = new Set([
  "proposalId",
  "expectedRevision",
  "cycleId",
  "circleId",
  "kind",
  "replacedGoalId",
  "targets",
  "parentGoalId",
  "title",
  "intendedOutcome",
  "ownerRoleId",
  "closeResult",
  "conclusion",
]);
const transitionActionFields = new Set([
  "proposalId",
  "expectedRevision",
  "cycleId",
  "circleId",
  "kind",
  "replacedGoalId",
  "targets",
]);

function validateFields(formData: FormData, allowed: ReadonlySet<string>): void {
  if (!(formData instanceof FormData)) throw new GoalDomainError("INVALID_INPUT");
  for (const name of formData.keys()) {
    if (!name.startsWith("$ACTION_") && !allowed.has(name)) throw new GoalDomainError("INVALID_INPUT");
  }
  for (const name of allowed) {
    if (formData.getAll(name).length > 1) throw new GoalDomainError("INVALID_INPUT");
  }
}

function singleText(formData: FormData, name: string, required = true): string | undefined {
  const values = formData.getAll(name);
  if (values.length === 0 && !required) return undefined;
  if (values.length !== 1 || typeof values[0] !== "string") throw new GoalDomainError("INVALID_INPUT");
  return values[0];
}

function proposalKind(formData: FormData): GoalProposalKind {
  const value = singleText(formData, "kind");
  if (value === "CREATE" || value === "REPLACE" || value === "CLOSE") return value;
  throw new GoalDomainError("INVALID_INPUT");
}

function expectedRevision(formData: FormData): number {
  const value = singleText(formData, "expectedRevision");
  if (!value || !/^[1-9]\d*$/.test(value)) throw new GoalDomainError("INVALID_INPUT");
  const revision = Number(value);
  if (!Number.isSafeInteger(revision)) throw new GoalDomainError("INVALID_INPUT");
  return revision;
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const keys = Object.keys(value);
  return required.every((key) => keys.includes(key))
    && keys.every((key) => required.includes(key) || optional.includes(key));
}

function parseTargets(formData: FormData): GoalProposalTargetInput[] {
  const raw = singleText(formData, "targets");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw ?? "");
  } catch {
    throw new GoalDomainError("INVALID_INPUT");
  }
  if (!Array.isArray(parsed) || parsed.length > 20) throw new GoalDomainError("INVALID_INPUT");

  return parsed.map((target): GoalProposalTargetInput => {
    if (!target || typeof target !== "object" || Array.isArray(target)) {
      throw new GoalDomainError("INVALID_INPUT");
    }
    const value = target as Record<string, unknown>;
    if (value.kind === "NUMERIC") {
      if (!exactKeys(value, ["kind", "label", "baselineValue", "desiredValue", "unit"], ["metricId"])
        || typeof value.label !== "string"
        || (typeof value.baselineValue !== "string" && typeof value.baselineValue !== "number")
        || (typeof value.desiredValue !== "string" && typeof value.desiredValue !== "number")
        || typeof value.unit !== "string"
        || (value.metricId !== undefined && typeof value.metricId !== "string")) {
        throw new GoalDomainError("INVALID_INPUT");
      }
      return {
        kind: "NUMERIC",
        label: value.label,
        baselineValue: value.baselineValue,
        desiredValue: value.desiredValue,
        unit: value.unit,
        ...(value.metricId === undefined ? {} : { metricId: value.metricId }),
      };
    }
    if (value.kind === "MILESTONE") {
      if (!exactKeys(value, ["kind", "label", "acceptanceCriteria"])
        || typeof value.label !== "string"
        || typeof value.acceptanceCriteria !== "string") {
        throw new GoalDomainError("INVALID_INPUT");
      }
      return {
        kind: "MILESTONE",
        label: value.label,
        acceptanceCriteria: value.acceptanceCriteria,
      };
    }
    throw new GoalDomainError("INVALID_INPUT");
  });
}

function revisionInput(formData: FormData, kind: GoalProposalKind): GoalProposalRevisionInput {
  if (kind === "CLOSE") {
    const closeResult = singleText(formData, "closeResult");
    if (closeResult !== "ACHIEVED" && closeResult !== "NOT_ACHIEVED") {
      throw new GoalDomainError("INVALID_INPUT");
    }
    return {
      closeResult,
      conclusion: singleText(formData, "conclusion"),
    };
  }
  return {
    title: singleText(formData, "title"),
    intendedOutcome: singleText(formData, "intendedOutcome"),
    ownerRoleId: singleText(formData, "ownerRoleId"),
    parentGoalId: singleText(formData, "parentGoalId", false) || null,
    targets: parseTargets(formData),
  };
}

function publicFailure(error: unknown): Readonly<{ code: GoalActionErrorCode }> {
  if (!(error instanceof GoalDomainError)) return { code: "TEMPORARY_FAILURE" };
  if (error.code === "INVALID_INPUT") return { code: "INVALID_INPUT" };
  if (error.code === "STALE_REVISION") return { code: "STALE_REVISION" };
  if (["CYCLE_NOT_FOUND", "CYCLE_NOT_AVAILABLE", "CIRCLE_NOT_FOUND", "PROPOSAL_NOT_FOUND", "GOAL_NOT_FOUND", "FORBIDDEN", "ACTOR_CONTEXT_MISMATCH"].includes(error.code)) {
    return { code: "NOT_AVAILABLE" };
  }
  if (["OWNER_ROLE_INVALID", "PARENT_GOAL_INVALID", "METRIC_INVALID", "ACTIVE_GOAL_REQUIRED", "ACTIVE_GOAL_EXISTS"].includes(error.code)) {
    return { code: "INVALID_REFERENCE" };
  }
  if (["SERIALIZATION_CONFLICT", "CONSTRAINT_VIOLATION", "PERSISTENCE_FAILED"].includes(error.code)) {
    return { code: "RETRY_CONFLICT" };
  }
  return { code: "INVALID_STATE" };
}

function publicSuccess(proposal: GoalProposalSnapshot): Exclude<GoalActionState, undefined | { code: GoalActionErrorCode }> {
  return {
    proposalId: proposal.id,
    currentRevision: proposal.currentRevision,
    status: proposal.status,
  };
}

async function actorAndDependencies() {
  const dependencies = currentGoalActionDependencies(productionDependencies);
  const context = await dependencies.resolveActorContext();
  return {
    dependencies,
    organizationId: context.organizationId,
    actor: {
      userId: context.userId,
      personId: context.personId,
      organizationId: context.organizationId,
    },
    domain: dependencies.createPrismaGoalDomainDependencies(dependencies.prisma),
  };
}

export async function createGoalProposalAction(
  _previousState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  try {
    validateFields(formData, revisionActionFields);
    const kind = proposalKind(formData);
    const context = await actorAndDependencies();
    const proposal = await context.dependencies.createGoalProposal({
      organizationId: context.organizationId,
      cycleId: singleText(formData, "cycleId") ?? "",
      circleId: singleText(formData, "circleId") ?? "",
      actor: context.actor,
      kind,
      ...(kind === "CREATE" ? {} : { replacedGoalId: singleText(formData, "replacedGoalId") }),
      revision: revisionInput(formData, kind),
    }, context.domain);
    context.dependencies.revalidatePath("/app/goals");
    return publicSuccess(proposal);
  } catch (error) {
    return publicFailure(error);
  }
}

export async function appendGoalProposalRevisionAction(
  _previousState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  try {
    validateFields(formData, revisionActionFields);
    const kind = proposalKind(formData);
    const context = await actorAndDependencies();
    const proposal = await context.dependencies.appendGoalProposalRevision({
      organizationId: context.organizationId,
      proposalId: singleText(formData, "proposalId") ?? "",
      expectedRevision: expectedRevision(formData),
      actor: context.actor,
      revision: revisionInput(formData, kind),
    }, context.domain);
    context.dependencies.revalidatePath("/app/goals");
    return publicSuccess(proposal);
  } catch (error) {
    return publicFailure(error);
  }
}

export async function submitGoalProposalAction(
  _previousState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  try {
    validateFields(formData, transitionActionFields);
    const context = await actorAndDependencies();
    const proposal = await context.dependencies.submitGoalProposal({
      organizationId: context.organizationId,
      proposalId: singleText(formData, "proposalId") ?? "",
      expectedRevision: expectedRevision(formData),
      actor: context.actor,
    }, context.domain);
    const meetingClient = context.dependencies.prisma.meeting;
    const meeting = meetingClient
      ? await (async () => {
        const agenda = `审议目标提案 ${proposal.id}`;
        const existing = await meetingClient.findFirst({
          where: { organizationId: context.organizationId, type: "STRATEGY", agenda },
          select: { id: true },
        });
        return existing ?? meetingClient.create({
          data: {
            organizationId: context.organizationId,
            title: `目标审议：${proposal.revision.title ?? "本回路主目标"}`,
            type: "STRATEGY",
            durationMin: 60,
            startedAt: new Date(),
            circleId: proposal.circleId,
            agenda,
            participants: { connect: [{ id: context.actor.personId }] },
          },
          select: { id: true },
        });
      })()
      : null;
    context.dependencies.revalidatePath("/app/goals");
    if (meeting) context.dependencies.revalidatePath(`/app/meetings/${meeting.id}`);
    return meeting ? { ...publicSuccess(proposal), meetingId: meeting.id } : publicSuccess(proposal);
  } catch (error) {
    return publicFailure(error);
  }
}

export async function withdrawGoalProposalAction(
  _previousState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  try {
    validateFields(formData, transitionActionFields);
    const context = await actorAndDependencies();
    const proposal = await context.dependencies.withdrawGoalProposal({
      organizationId: context.organizationId,
      proposalId: singleText(formData, "proposalId") ?? "",
      expectedRevision: expectedRevision(formData),
      actor: context.actor,
    }, context.domain);
    context.dependencies.revalidatePath("/app/goals");
    return publicSuccess(proposal);
  } catch (error) {
    return publicFailure(error);
  }
}

/**
 * 直接设定目标（运营决策，不走会议流程）
 *
 * 管理员/回路负责人有权直接设定本圈子的目标。
 * 每个角色可以自己设定自己的目标。
 * 系统负责记录和跟踪，不需要专门走战术会议。
 *
 * 内部实现：创建提案 → 直接标记为 ADOPTED → 创建 Goal 记录，
 * 全部在一个事务中完成。
 */
export async function directAdoptGoalProposalAction(
  _previousState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  try {
    validateFields(formData, revisionActionFields);
    const kind = proposalKind(formData);
    const context = await actorAndDependencies();

    // 1. 创建提案草稿
    const proposal = await context.dependencies.createGoalProposal({
      organizationId: context.organizationId,
      cycleId: singleText(formData, "cycleId") ?? "",
      circleId: singleText(formData, "circleId") ?? "",
      actor: context.actor,
      kind,
      ...(kind === "CREATE" ? {} : { replacedGoalId: singleText(formData, "replacedGoalId") }),
      revision: revisionInput(formData, kind),
    }, context.domain);

    // 2. 直接采纳（跳过会议流程）
    //    使用 domain-operations 的 decideGoalProposal，但传入一个特殊的 "direct" meetingId
    //    为了不修改 domain-operations 的签名，我们用 prisma 直接操作：
    //    proposal.status DRAFT → ADOPTED + 创建 goal + goal_targets
    const prisma = context.dependencies.prisma;
    const { randomUUID } = await import("node:crypto");

    await prisma.$transaction(async (tx) => {
      // 锁定 proposal 行
      await tx.$queryRaw`SELECT "id" FROM "goal_proposals" WHERE "id" = ${proposal.id} FOR UPDATE`;

      // 验证状态
      const current = await tx.goalProposal.findUnique({
        where: { id: proposal.id },
        select: { status: true, currentRevision: true, organizationId: true },
      });
      if (!current || current.status !== "DRAFT") throw new GoalDomainError("PROPOSAL_STATE_CONFLICT");

      // 标记为 ADOPTED
      await tx.goalProposal.update({
        where: { id: proposal.id },
        data: {
          status: "ADOPTED",
          terminalAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // 如果不是 CLOSE，创建 Goal + GoalDecision + GoalTargets
      if (kind !== "CLOSE") {
        const goalId = randomUUID();
        const decisionId = randomUUID();
        const revision = proposal.revision as { title?: string; intendedOutcome?: string; ownerRoleId?: string; targets?: { kind: string; label: string; baselineValue?: string; desiredValue?: string; unit?: string; acceptanceCriteria?: string; metricId?: string }[] };

        // 创建一个轻量 meeting 记录（GoalDecision.meetingId 是必填外键）
        const meetingId = randomUUID();
        await tx.meeting.create({
          data: {
            id: meetingId,
            organizationId: context.organizationId,
            title: `目标设定：${revision.title ?? "本回路主目标"}`,
            type: "STRATEGY",
            durationMin: 0,
            startedAt: new Date(),
            circleId: singleText(formData, "circleId")!,
            agenda: `运营决策直接设定目标 ${proposal.id}`,
            participants: { connect: [{ id: context.actor.personId }] },
          },
        });

        // 先创建 GoalDecision（Goal.adoptedDecisionId 要求 @unique 且非空）
        await tx.goalDecision.create({
          data: {
            id: decisionId,
            organizationId: context.organizationId,
            proposalId: proposal.id,
            revision: proposal.currentRevision,
            outcome: "ADOPTED",
            meetingId,
            recorderId: context.actor.personId,
            mutationKey: `direct-${randomUUID()}`,
            note: "运营决策直接设定",
            decidedAt: new Date(),
          },
        });

        await tx.goal.create({
          data: {
            id: goalId,
            organizationId: context.organizationId,
            cycleId: singleText(formData, "cycleId")!,
            circleId: singleText(formData, "circleId")!,
            title: revision.title ?? "",
            intendedOutcome: revision.intendedOutcome ?? "",
            ownerRoleId: revision.ownerRoleId ?? "",
            parentGoalId: (singleText(formData, "parentGoalId", false) || null) as string | null,
            status: "ACTIVE",
            adoptedDecisionId: decisionId,
          },
        });

        // 创建 goal_targets
        if (revision.targets && revision.targets.length > 0) {
          const proposalTargets = await tx.goalProposalTarget.findMany({
            where: { organizationId: context.organizationId, proposalId: proposal.id },
            orderBy: { position: "asc" },
            select: { id: true, position: true },
          });

          await tx.goalTarget.createMany({
            data: revision.targets.map((t, idx) => ({
              id: randomUUID(),
              organizationId: context.organizationId,
              goalId,
              sourceProposalTargetId: proposalTargets[idx]?.id ?? proposalTargets[0]?.id ?? "",
              position: proposalTargets[idx]?.position ?? idx,
              kind: t.kind as "NUMERIC" | "MILESTONE",
              label: t.label,
              baselineValue: t.baselineValue ?? null,
              desiredValue: t.desiredValue ?? null,
              unit: t.unit ?? null,
              acceptanceCriteria: t.acceptanceCriteria ?? null,
              metricId: t.metricId ?? null,
              createdAt: new Date(),
            })),
          });
        }
      }
    });

    context.dependencies.revalidatePath("/app/goals");
    return { proposalId: proposal.id, currentRevision: proposal.currentRevision, status: "ADOPTED" };
  } catch (error) {
    return publicFailure(error);
  }
}
