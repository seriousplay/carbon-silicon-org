import "server-only";

import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getOrganizationModelSettingsSummary } from "@/lib/ai/organization-model-settings";

export type SetupWorkspaceStepKey =
  | "identity"
  | "structure"
  | "goals"
  | "roles"
  | "invitations"
  | "assignments"
  | "configuration";

export type SetupWorkspaceStep = Readonly<{
  key: SetupWorkspaceStepKey;
  index: number;
  label: string;
  href: string;
  done: boolean;
  summary: string;
}>;

export type SetupWorkspaceReadModel = Readonly<{
  organization: Readonly<{
    id: string;
    name: string;
    purpose: string | null;
    lifecycleStatus: "SETUP" | "ACTIVE";
  }>;
  counts: Readonly<{
    structures: number;
    rootStructures: number;
    roles: number;
    leadRoles: number;
    assignedLeadRoles: number;
    goalCycles: number;
    activeGoals: number;
    people: number;
    heldInvitations: number;
  }>;
  readiness: readonly Readonly<{ label: string; done: boolean }>[];
  steps: readonly SetupWorkspaceStep[];
  readyToActivate: boolean;
  modelConfigured: boolean;
}>;

type WorkspacePrisma = Pick<PrismaClient,
  "organization" | "circle" | "roleDef" | "goalCycle" | "goal" | "person"
> & {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
};

function statusText(done: boolean): string {
  return done ? "已就绪" : "待补齐";
}

export async function getSetupWorkspaceReadModel(
  organizationId: string,
  db: WorkspacePrisma = prisma,
): Promise<SetupWorkspaceReadModel> {
  const [
    organization,
    structureCount,
    rootStructureCount,
    roleCount,
    leadRoleCount,
    assignedLeadRoleCount,
    goalCycleCount,
    activeGoalCount,
    personCount,
    heldInvitationCount,
    modelSettings,
  ] = await Promise.all([
    db.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { id: true, name: true, purpose: true, lifecycleStatus: true },
    }),
    db.circle.count({ where: { organizationId, status: { not: "ARCHIVED" } } }),
    db.circle.count({ where: { organizationId, parentId: null, status: { not: "ARCHIVED" } } }),
    db.roleDef.count({ where: { organizationId, status: "ACTIVE" } }),
    db.roleDef.count({ where: { organizationId, status: "ACTIVE", category: "CIRCLE_LEAD" } }),
    db.roleDef.count({
      where: {
        organizationId,
        status: "ACTIVE",
        category: "CIRCLE_LEAD",
        assignees: { some: { organizationId, entityType: "HUMAN" } },
      },
    }),
    db.goalCycle.count({ where: { organizationId, status: { in: ["PLANNED", "ACTIVE"] } } }),
    db.goal.count({ where: { organizationId, status: "ACTIVE" } }),
    db.person.count({ where: { organizationId } }),
    db.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT count(*)::bigint AS count
      FROM "organization_invitations"
      WHERE "organizationId" = ${organizationId}
        AND "revokedAt" IS NULL
        AND "consumedAt" IS NULL
        AND "expiresAt" > now()
        AND "deliveryMode" = 'HELD'
    `),
    getOrganizationModelSettingsSummary(organizationId),
  ]);
  const modelConfigured = modelSettings.provider === "system"
    || Boolean(modelSettings.modelName.trim() && modelSettings.hasApiKey);
  const heldInvitations = Number(heldInvitationCount[0]?.count ?? 0);
  const counts = {
    structures: structureCount,
    rootStructures: rootStructureCount,
    roles: roleCount,
    leadRoles: leadRoleCount,
    assignedLeadRoles: assignedLeadRoleCount,
    goalCycles: goalCycleCount,
    activeGoals: activeGoalCount,
    people: personCount,
    heldInvitations,
  };
  const readiness = [
    { label: "组织目的", done: Boolean(organization.purpose?.trim()) },
    { label: "主结构", done: counts.structures > 0 && counts.rootStructures === 1 },
    { label: "活跃角色", done: counts.roles > 0 },
    { label: "组织大脑", done: modelConfigured },
  ] as const;
  const steps: readonly SetupWorkspaceStep[] = [
    {
      key: "identity",
      index: 1,
      label: "组织身份",
      href: "/app/organization#organization-identity",
      done: Boolean(organization.name.trim() && organization.purpose?.trim()),
      summary: organization.purpose?.trim() ? "名称和目的已填写" : "补齐组织名称和目的",
    },
    {
      key: "structure",
      index: 2,
      label: "组织结构",
      href: "/app/circles/map",
      done: counts.structures > 0 && counts.rootStructures === 1,
      summary: `${counts.structures} 个结构单元，${counts.rootStructures} 个根结构`,
    },
    {
      key: "goals",
      index: 3,
      label: "组织目标",
      href: "/app/goals",
      done: counts.goalCycles > 0 && counts.activeGoals > 0,
      summary: `${counts.goalCycles} 个目标周期，${counts.activeGoals} 个活跃目标`,
    },
    {
      key: "roles",
      index: 4,
      label: "角色定义",
      href: "/app/circles/map",
      done: counts.roles > 0,
      summary: `${counts.roles} 个活跃角色`,
    },
    {
      key: "invitations",
      index: 5,
      label: "成员邀请",
      href: "/app/people",
      done: counts.people > 0,
      summary: `${counts.people} 个成员，${counts.heldInvitations} 个待激活发送邀请`,
    },
    {
      key: "assignments",
      index: 6,
      label: "角色任命",
      href: "/app/roles/market",
      done: counts.assignedLeadRoles > 0,
      summary: `${counts.assignedLeadRoles} 个关键角色已有人员承担`,
    },
    {
      key: "configuration",
      index: 7,
      label: "系统配置",
      href: "/app/organization#system-configuration",
      done: modelConfigured,
      summary: modelConfigured ? "组织大脑模型可用" : "配置组织大脑模型",
    },
  ];

  return {
    organization,
    counts,
    readiness,
    steps,
    readyToActivate: readiness.every((item) => item.done),
    modelConfigured,
  };
}

export { statusText as setupWorkspaceStatusText };
