/**
 * 权限 helper
 *
 * 基于 review/v1 工程 P0-1：Server Actions 权限校验缺失
 * 基于 docs/07 技术架构第八节权限模型
 *
 * 三层权限：组织 admin / 回路负责人 / 普通成员
 */
import { getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";

export type PilotInterfacePermission =
  | "submit-validation"
  | "record-smoke-run"
  | "create-failure-tension"
  | "claim-tactical-outcome";

/** 要求当前用户是组织 admin */
export async function requireOrgAdmin() {
  const person = await getCurrentPerson();
  if (!person) throw new Error("未找到人员档案");

  const userId = person.userId;
  if (!userId) throw new Error("无用户关联");

  const membership = await prisma.membership.findFirst({
    where: { userId, organizationId: person.organizationId },
  });
  if (membership?.role !== "ORG_ADMIN") {
    throw new Error("需要组织管理员权限");
  }
  return person;
}

/** 要求当前用户是指定回路的负责人 */
export async function requireCircleLead(circleId: string) {
  const person = await getCurrentPerson();
  if (!person) throw new Error("未找到人员档案");

  const circle = await prisma.circle.findUnique({
    where: { id: circleId },
    select: { leadPersonId: true, organizationId: true },
  });
  if (!circle) throw new Error("回路不存在");
  if (circle.leadPersonId !== person.id) {
    throw new Error("需要回路负责人权限");
  }
  return person;
}

/**
 * 检查当前用户是否可操作某阻塞点
 * 规则：负责人本人 或 所属回路负责人 或 组织 admin
 */
export async function canManageTension(tensionId: string): Promise<boolean> {
  const person = await getCurrentPerson();
  if (!person) return false;

  const tension = await prisma.tension.findUnique({
    where: { id: tensionId },
    include: { circle: { select: { leadPersonId: true } } },
  });
  if (!tension) return false;

  // 负责人本人
  if (tension.ownerId === person.id) return true;
  // 所属回路负责人
  if (tension.circle?.leadPersonId === person.id) return true;
  // 组织 admin
  const membership = await prisma.membership.findFirst({
    where: { userId: person.userId ?? "", organizationId: person.organizationId },
  });
  return membership?.role === "ORG_ADMIN";
}

/** 要求当前用户可管理某张力，否则抛错 */
export async function requireManageTension(tensionId: string) {
  if (!(await canManageTension(tensionId))) {
    throw new Error("无权操作此张力");
  }
  return getCurrentPerson();
}

export async function requirePilotInterfacePermission(
  interfaceId: string,
  organizationId: string,
  permission: PilotInterfacePermission
) {
  const person = await getCurrentPerson();
  if (!person || person.organizationId !== organizationId) {
    throw new Error("用户不属于当前组织");
  }

  const intf = await prisma.circleInterface.findFirst({
    where: { id: interfaceId, organizationId, status: { not: "ARCHIVED" } },
    select: {
      id: true,
      ownerId: true,
      fromCircle: { select: { leadPersonId: true } },
      toCircle: { select: { leadPersonId: true } },
    },
  });

  if (!intf) {
    throw new Error("接口不存在或不属于当前组织");
  }

  const membership = person.userId
    ? await prisma.membership.findFirst({
        where: { userId: person.userId, organizationId },
        select: { role: true },
      })
    : null;

  if (membership?.role === "ORG_ADMIN") {
    return { person, interface: intf };
  }

  const allowedPersonIds = new Set<string>();

  if (permission === "submit-validation") {
    if (intf.ownerId) allowedPersonIds.add(intf.ownerId);
    if (intf.fromCircle.leadPersonId) allowedPersonIds.add(intf.fromCircle.leadPersonId);
  }

  if (permission === "record-smoke-run" || permission === "create-failure-tension") {
    if (intf.ownerId) allowedPersonIds.add(intf.ownerId);
    if (intf.toCircle.leadPersonId) allowedPersonIds.add(intf.toCircle.leadPersonId);
  }

  if (permission === "claim-tactical-outcome") {
    if (intf.ownerId) allowedPersonIds.add(intf.ownerId);
    if (intf.fromCircle.leadPersonId) allowedPersonIds.add(intf.fromCircle.leadPersonId);
    if (intf.toCircle.leadPersonId) allowedPersonIds.add(intf.toCircle.leadPersonId);
  }

  if (!allowedPersonIds.has(person.id)) {
    throw new Error("无权执行该试点操作");
  }

  return { person, interface: intf };
}
