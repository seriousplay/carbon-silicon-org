"use server";

/**
 * 组织初始化 Server Action
 *
 * 基于模板一键创建回路 + 角色 + 接口
 * 从企业管理员视角设计：选模板 → 预览 → 一键创建
 */
import { revalidatePath } from "next/cache";
import { getCurrentOrgId, getCurrentPerson, requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import {
  normalizeModelProvider,
  normalizeThinkingMode,
  saveOrganizationModelSettings,
  type OrganizationModelProvider,
} from "@/lib/ai/organization-model-settings";
import { allTemplates, type OrgTemplate } from "@/lib/org-templates";
import { Prisma } from "@/generated/prisma/client";
import {
  BOOTSTRAP_AUTHORITY_DENIAL,
  canApplyBootstrapTemplate,
  type BootstrapAuthoritySnapshot,
} from "@/lib/bootstrap-authority";
import {
  activateOrganization,
  createPrismaOrganizationActivationDependencies,
  OrganizationActivationError,
} from "@/lib/organization-setup/activation-service";
import { evaluateSetupAuthority } from "@/lib/organization-setup/setup-authority";
import { currentSetupActionDependencies } from "./action-dependencies";
import { createGoalCycle, createPrismaGoalDomainDependencies } from "@/lib/goals/domain-operations";

export type InitState = { error?: string; ok?: boolean } | undefined;
export type ModelSettingsState = { error?: string; ok?: boolean } | undefined;
export type ActivationState = { error?: string; ok?: boolean; status?: "ACTIVATED" | "ALREADY_ACTIVE" } | undefined;

type BootstrapStep =
  | "BEFORE_AUTHORITY_REFRESH"
  | "AUTHORITY_CONFIRMED"
  | "ROOT_WRITTEN";

const productionDependencies = {
  prisma,
  getCurrentOrgId,
  getCurrentPerson,
  requireSession,
  revalidatePath,
  onBootstrapStep: async (step: BootstrapStep): Promise<void> => { void step; },
};

async function getBootstrapAuthoritySnapshot(
  tx: Prisma.TransactionClient,
  organizationId: string
): Promise<BootstrapAuthoritySnapshot> {
  const [
    circleCount,
    rootCircleCount,
    roleCount,
    interfaceCount,
    charterCount,
    changeLogCount,
    meetingCount,
    decisionCount,
    governanceProposalCount,
    tacticalOutcomeProposalCount,
    projectCount,
    tensionCount,
  ] = await Promise.all([
    tx.circle.count({ where: { organizationId } }),
    tx.circle.count({ where: { organizationId, parentId: null } }),
    tx.roleDef.count({ where: { organizationId } }),
    tx.circleInterface.count({ where: { organizationId } }),
    tx.charter.count({ where: { organizationId } }),
    tx.changeLog.count({ where: { organizationId } }),
    tx.meeting.count({ where: { organizationId } }),
    tx.decisionRecord.count({ where: { organizationId } }),
    tx.governanceProposal.count({ where: { organizationId } }),
    tx.tacticalOutcomeProposal.count({ where: { organizationId } }),
    tx.project.count({ where: { organizationId } }),
    tx.tension.count({ where: { organizationId } }),
  ]);

  return {
    circleCount,
    rootCircleCount,
    roleCount,
    interfaceCount,
    charterCount,
    changeLogCount,
    meetingCount,
    decisionCount,
    governanceProposalCount,
    tacticalOutcomeProposalCount,
    projectCount,
    tensionCount,
  };
}

/**
 * 检查一次性初始化权限是否已关闭
 */
export async function isOrgInitialized(): Promise<boolean> {
  const dependencies = currentSetupActionDependencies(productionDependencies);
  const orgId = await dependencies.getCurrentOrgId();
  const snapshot = await dependencies.prisma.$transaction(
    (tx) => getBootstrapAuthoritySnapshot(tx, orgId),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
  return !canApplyBootstrapTemplate(snapshot);
}

/**
 * 获取所有可用模板
 */
export async function getTemplates(): Promise<OrgTemplate[]> {
  return allTemplates;
}

/**
 * 执行组织初始化
 * 基于选定模板创建回路 + 角色 + 接口
 */
export async function initializeOrgAction(
  _prev: InitState,
  formData: FormData
): Promise<InitState> {
  const dependencies = currentSetupActionDependencies(productionDependencies);
  const templateId = formData.get("templateId") as string;

  if (!templateId) {
    return { error: "请选择一个模板" };
  }

  const template = allTemplates.find((t) => t.id === templateId);
  if (!template) {
    return { error: "模板不存在" };
  }

  const session = await dependencies.requireSession();
  const orgId = await dependencies.getCurrentOrgId();
  const person = await dependencies.getCurrentPerson();
  if (!person) {
    return { error: "无法获取当前用户" };
  }
  const membership = await dependencies.prisma.membership.findUnique({
    where: { userId_organizationId: { userId: session.user.id, organizationId: orgId } },
    select: { role: true },
  });
  if (membership?.role !== "ORG_ADMIN") {
    return { error: "只有组织管理员可以初始化组织" };
  }

  try {
    const result = await dependencies.prisma.$transaction(async (tx) => {
      await dependencies.onBootstrapStep("BEFORE_AUTHORITY_REFRESH");
      const [organization, currentMembership, currentActor] = await Promise.all([
        tx.organization.findUnique({
          where: { id: orgId },
          select: { lifecycleStatus: true },
        }),
        tx.membership.findUnique({
          where: {
            userId_organizationId: {
              userId: session.user.id,
              organizationId: orgId,
            },
          },
          select: { role: true },
        }),
        tx.person.findFirst({
          where: {
            id: person.id,
            organizationId: orgId,
            userId: session.user.id,
          },
          select: { id: true, organizationId: true },
        }),
      ]);
      if (!organization) {
        return { error: BOOTSTRAP_AUTHORITY_DENIAL };
      }
      if (!currentActor) {
        return { error: "只有组织管理员可以初始化组织" };
      }

      const authority = evaluateSetupAuthority({
        lifecycleStatus: organization.lifecycleStatus,
        actorOrganizationId: currentActor.organizationId,
        actorMembershipRole: currentMembership?.role ?? null,
        actorPersonId: currentActor.id,
        ledStructureIds: [],
        target: { kind: "ORGANIZATION", organizationId: orgId },
      });
      if (!authority.allowed) {
        return {
          error: authority.reason === "LIFECYCLE_NOT_SETUP"
            ? BOOTSTRAP_AUTHORITY_DENIAL
            : "只有组织管理员可以初始化组织",
        };
      }

      const snapshot = await getBootstrapAuthoritySnapshot(tx, orgId);
      if (!canApplyBootstrapTemplate(snapshot)) {
        return { error: BOOTSTRAP_AUTHORITY_DENIAL };
      }
      await dependencies.onBootstrapStep("AUTHORITY_CONFIRMED");

      const existingRoot = await tx.circle.findFirst({
        where: { organizationId: orgId, parentId: null },
      });
      if (!existingRoot) {
        return { error: BOOTSTRAP_AUTHORITY_DENIAL };
      }

      // 用 key → circleId 映射建立关系
      const circleMap = new Map<string, string>();

      // 1. 如果模板有根回路，更新现有的主回路；否则新建
      const rootTemplate = template.circles.find((c) => c.isRoot);
      let rootId: string;

      if (rootTemplate && existingRoot) {
        // 更新现有主回路
        await tx.circle.update({
          where: { id: existingRoot.id },
          data: {
            name: rootTemplate.name,
            purpose: rootTemplate.purpose,
            domain: rootTemplate.domain,
            leadPersonId: currentActor.id,
          },
        });
        circleMap.set(rootTemplate.key, existingRoot.id);
        rootId = existingRoot.id;
      } else {
        // 新建根圈子
        const root = await tx.circle.create({
          data: {
            organizationId: orgId,
            name: rootTemplate?.name ?? "核心团队",
            number: rootTemplate?.number ?? "CUSTOM",
            type: rootTemplate?.type ?? "PRODUCTION",
            purpose: rootTemplate?.purpose ?? "组织根圈子",
            domain: rootTemplate?.domain,
            leadPersonId: currentActor.id,
          },
        });
        circleMap.set(rootTemplate?.key ?? "root", root.id);
        rootId = root.id;
      }
      await dependencies.onBootstrapStep("ROOT_WRITTEN");

      // 2. 创建非根回路，并为所有模板回路（包括根回路）创建角色
      for (const circleTemplate of template.circles.filter((c) => !c.isRoot)) {
        const parentId = circleTemplate.parentKey
          ? circleMap.get(circleTemplate.parentKey) ?? rootId
          : rootId;

        const circle = await tx.circle.create({
          data: {
            organizationId: orgId,
            name: circleTemplate.name,
            number: circleTemplate.number,
            type: circleTemplate.type,
            purpose: circleTemplate.purpose,
            domain: circleTemplate.domain,
            parentId,
            leadPersonId: currentActor.id, // 默认创建者为负责人
          },
        });
        circleMap.set(circleTemplate.key, circle.id);

      }

      for (const circleTemplate of template.circles) {
        const circleId = circleMap.get(circleTemplate.key);
        if (!circleId) continue;
        for (const roleTemplate of circleTemplate.roles) {
          await tx.roleDef.create({
            data: {
              organizationId: orgId,
              name: roleTemplate.name,
              purpose: roleTemplate.purpose,
              domain: roleTemplate.domain,
              accountabilities: roleTemplate.accountabilities,
              circleId,
              category: roleTemplate.category,
              ownershipType: "HOME",
              ...(circleTemplate.isRoot && roleTemplate.category === "CIRCLE_LEAD"
                ? { assignees: { connect: { id: currentActor.id } } }
                : {}),
            },
          });
        }
      }

      // 4. 创建回路间接口
      for (const intf of template.interfaces) {
        const fromCircleId = circleMap.get(intf.fromKey);
        const toCircleId = circleMap.get(intf.toKey);
        if (!fromCircleId || !toCircleId) continue;

        await tx.circleInterface.create({
          data: {
            organizationId: orgId,
            name: intf.name,
            fromCircleId,
            toCircleId,
            contractContent: intf.contractContent,
            sla: intf.sla,
            acceptanceCriteria: intf.acceptanceCriteria,
            status: "READY",
            ownerId: currentActor.id,
          },
        });
      }

      await tx.changeLog.create({
        data: {
          organizationId: orgId,
          type: "CIRCLE_CREATED",
          objectDesc: "组织初始模板",
          beforeValue: "注册初始结构",
          afterValue: template.id,
          impactAssessment: "一次性应用组织初始回路、角色与接口模板",
          effectiveAt: new Date(),
          initiatorId: currentActor.id,
        },
      });
      return { ok: true as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if ("error" in result) {
      return result;
    }

    const existingCycle = await dependencies.prisma.goalCycle.findFirst({
      where: { organizationId: orgId, status: { in: ["PLANNED", "ACTIVE"] } },
      select: { id: true },
    });
    if (!existingCycle) {
      const startAt = new Date();
      const endAt = new Date(startAt);
      endAt.setDate(endAt.getDate() + 28);
      await createGoalCycle({
        organizationId: orgId,
        actor: { organizationId: orgId, userId: session.user.id, personId: person.id },
        name: "首个组织目标周期",
        startAt,
        endAt,
        checkInCadenceDays: 7,
      }, createPrismaGoalDomainDependencies(dependencies.prisma));
    }

    dependencies.revalidatePath("/app");
    dependencies.revalidatePath("/app/circles");
    dependencies.revalidatePath("/app/circles/map");
    dependencies.revalidatePath("/app/goals");
    return result;
  } catch (e) {
    console.error("组织初始化失败:", e);
    return { error: "初始化失败，请重试" };
  }
}

export async function saveModelSettingsAction(
  _prev: ModelSettingsState,
  formData: FormData,
): Promise<ModelSettingsState> {
  const dependencies = currentSetupActionDependencies(productionDependencies);
  const session = await dependencies.requireSession();
  const orgId = await dependencies.getCurrentOrgId();
  const person = await dependencies.getCurrentPerson();
  if (!person) return { error: "无法获取当前用户" };

  const membership = await dependencies.prisma.membership.findUnique({
    where: { userId_organizationId: { userId: session.user.id, organizationId: orgId } },
    select: { role: true },
  });
  if (membership?.role !== "ORG_ADMIN") {
    return { error: "只有组织管理员可以配置模型" };
  }

  const provider = normalizeModelProvider(formData.get("provider"));
  if (!provider) return { error: "不支持的模型服务商" };

  try {
    await saveOrganizationModelSettings({
      organizationId: orgId,
      configuredById: person.id,
      provider: provider as OrganizationModelProvider,
      modelName: String(formData.get("modelName") ?? ""),
      baseUrl: String(formData.get("baseUrl") ?? ""),
      thinkingMode: normalizeThinkingMode(formData.get("thinkingMode")),
      apiKey: String(formData.get("apiKey") ?? ""),
    });
    dependencies.revalidatePath("/app/organization");
    dependencies.revalidatePath("/app/setup");
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "模型配置保存失败",
    };
  }
}

export async function activateOrganizationAction(
  _prevState?: ActivationState,
  _formData?: FormData,
): Promise<ActivationState> {
  void _prevState;
  void _formData;
  const dependencies = currentSetupActionDependencies(productionDependencies);
  const session = await dependencies.requireSession();
  const orgId = await dependencies.getCurrentOrgId();
  const person = await dependencies.getCurrentPerson();
  if (!person) return { error: "当前账号没有人员档案" };

  try {
    const result = await activateOrganization({
      organizationId: orgId,
      userId: session.user.id,
      personId: person.id,
    }, createPrismaOrganizationActivationDependencies(dependencies.prisma));
    dependencies.revalidatePath("/app");
    dependencies.revalidatePath("/app/organization");
    dependencies.revalidatePath("/app/setup");
    dependencies.revalidatePath("/app/meetings");
    dependencies.revalidatePath("/app/meetings/new");
    return { ok: true, status: result.status };
  } catch (error) {
    if (error instanceof OrganizationActivationError) {
      if (error.code === "READINESS_FAILED") {
        return { error: "组织尚未达到最低启用条件，请先设定组织目的、建立根回路结构并创建角色定义。" };
      }
      if (error.code === "ACCESS_DENIED") {
        return { error: "只有组织管理员可以启用组织" };
      }
      if (error.code === "ACTIVE_EVIDENCE_INVALID") {
        return { error: "组织启用证据异常，请先联系管理员检查数据" };
      }
    }
    return { error: "组织启用失败，请稍后重试" };
  }
}
