"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrgId, getCurrentPerson, requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getOrganizationGovernanceConfig, type OrganizationProfile } from "@/lib/organization-governance-config";

export type OrganizationProfileState = { error?: string; ok?: boolean } | undefined;

const allowedTypes = new Set<OrganizationProfile["organizationType"]>(["FOUNDATION_MODEL", "LEAN", "PROFESSIONAL_SERVICES", "FUNCTIONAL", "CUSTOM"]);
const allowedCadences = new Set<OrganizationProfile["meetingCadence"]>(["WEEKLY", "BIWEEKLY", "MONTHLY", "CUSTOM"]);

export async function saveOrganizationProfileAction(_previous: OrganizationProfileState, formData: FormData): Promise<OrganizationProfileState> {
  const session = await requireSession();
  const organizationId = await getCurrentOrgId();
  const person = await getCurrentPerson();
  if (!person) return { error: "无法确认当前组织身份。" };
  const membership = await prisma.membership.findUnique({ where: { userId_organizationId: { userId: session.user.id, organizationId } }, select: { role: true } });
  if (membership?.role !== "ORG_ADMIN") return { error: "只有组织管理员可以修改组织配置。" };

  const name = String(formData.get("organizationName") ?? "").trim().slice(0, 120);
  const purpose = String(formData.get("organizationPurpose") ?? "").trim().slice(0, 240);
  const organizationType = String(formData.get("organizationType") ?? "CUSTOM") as OrganizationProfile["organizationType"];
  const meetingCadence = String(formData.get("meetingCadence") ?? "WEEKLY") as OrganizationProfile["meetingCadence"];
  const roleCategories = String(formData.get("roleCategories") ?? "")
    .split(",")
    .map((item) => item.trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 12);
  // 如果角色分类为空，使用默认值（AI 可在后续提供建议）
  const finalRoleCategories = roleCategories.length > 0 ? roleCategories : ["负责人", "专家", "运营", "教练"];
  if (!name) return { error: "组织名称不能为空。" };
  if (!purpose) return { error: "组织目的不能为空。" };
  if (!allowedTypes.has(organizationType) || !allowedCadences.has(meetingCadence)) return { error: "组织类型或会议节奏无效。" };

  const current = await getOrganizationGovernanceConfig(organizationId);
  const rules = { ...current.rules, organizationProfile: { organizationType, meetingCadence, roleCategories: finalRoleCategories } };
  await prisma.$transaction([
    prisma.organization.update({ where: { id: organizationId }, data: { name, purpose } }),
    prisma.organizationGovernanceConfigVersion.create({ data: { organizationId, version: current.version + 1, terminologyPreferences: current.terminology, governanceRules: rules, createdById: person.id } }),
    prisma.organizationBrainProfile.updateMany({ where: { organizationId }, data: { name } }),
  ]);
  revalidatePath("/app/organization");
  revalidatePath("/app/setup");
  revalidatePath("/app");
  return { ok: true };
}
