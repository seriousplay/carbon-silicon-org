"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

export type RoleMarketState = { error?: string; success?: string };

function requiredText(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string" || value.trim().length < 2 || value.length > 2000) {
    throw new Error("请完整填写申请信息。");
  }
  return value.trim();
}

export async function applyForRoleAction(
  _previous: RoleMarketState,
  formData: FormData,
): Promise<RoleMarketState> {
  try {
    const person = await getCurrentPerson();
    const organizationId = await getCurrentOrgId();
    if (!person || person.organizationId !== organizationId) return { error: "无法确认当前组织身份。" };
    const roleId = formData.get("roleId");
    if (typeof roleId !== "string" || !roleId) return { error: "请选择角色。" };

    const application = await prisma.roleAssignmentApplication.create({
      data: {
        organizationId,
        roleId,
        applicantId: person.id,
        motivation: requiredText(formData, "motivation"),
        capabilitySummary: requiredText(formData, "capabilitySummary"),
        commitment: requiredText(formData, "commitment"),
      },
      select: { id: true, role: { select: { name: true } } },
    });
    const reviewers = await prisma.person.findMany({
      where: {
        organizationId,
        id: { not: person.id },
        user: { memberships: { some: { organizationId, role: "ORG_ADMIN" } } },
      },
      select: { id: true },
    });
    try {
      for (const reviewer of reviewers) {
        await createNotification({
          organizationId,
          recipientId: reviewer.id,
          type: "role_application_submitted",
          eventKey: `role-application:${application.id}:submitted:${reviewer.id}`,
          title: `新的角色申请：${application.role.name}`,
          body: `${person.name} 申请承担该角色，请进入任职申请收件箱处理。`,
          targetUrl: "/app/roles/applications",
        });
      }
    } catch (error) {
      console.error("[role application notification]", error);
    }
    revalidatePath("/app/roles/market");
    revalidatePath("/app/roles/applications");
    revalidatePath(`/app/roles/${roleId}`);
    return { success: "申请已提交，当前任职关系不会在申请时改变。" };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return { error: "你已经提交过这个角色的待处理申请。" };
    }
    return { error: error instanceof Error ? error.message : "申请提交失败，请稍后重试。" };
  }
}

export async function withdrawRoleApplicationAction(formData: FormData): Promise<void> {
  const person = await getCurrentPerson();
  const organizationId = await getCurrentOrgId();
  const applicationId = formData.get("applicationId");
  if (!person || person.organizationId !== organizationId || typeof applicationId !== "string") {
    return;
  }
  await prisma.roleAssignmentApplication.updateMany({
    where: { id: applicationId, organizationId, applicantId: person.id, status: "PENDING" },
    data: { status: "WITHDRAWN", withdrawnAt: new Date() },
  });
  revalidatePath("/app/roles/market");
}
