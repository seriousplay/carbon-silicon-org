"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrgId, getCurrentPerson, requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getOrganizationGovernanceConfig } from "@/lib/organization-governance-config";

export type GovernanceRulesState = { error?: string; ok?: boolean } | undefined;

export async function saveGovernanceRulesAction(_previous: GovernanceRulesState, formData: FormData): Promise<GovernanceRulesState> {
  const session = await requireSession();
  const organizationId = await getCurrentOrgId();
  const person = await getCurrentPerson();
  if (!person) return { error: "无法确认当前组织身份。" };
  const membership = await prisma.membership.findUnique({ where: { userId_organizationId: { userId: session.user.id, organizationId } }, select: { role: true } });
  if (membership?.role !== "ORG_ADMIN") return { error: "只有组织管理员可以修改治理规则。" };

  const current = await getOrganizationGovernanceConfig(organizationId);
  const rules = {
    // Role changes are always proposer-led governance outcomes; this invariant is not configurable.
    roleAssignmentConfirmation: "GOVERNANCE_PROCESS",
    meetingParticipantScope: formData.get("meetingParticipantScope") === "on" ? "CIRCLE_SCOPE" : "OPEN_INVITE",
    proposerConfirmationAfterProcess: formData.get("proposerConfirmationAfterProcess") === "on",
  };
  await prisma.organizationGovernanceConfigVersion.create({
    data: {
      organizationId,
      version: current.version + 1,
      terminologyPreferences: current.terminology,
      governanceRules: rules,
      createdById: person.id,
    },
  });
  revalidatePath("/app/organization");
  revalidatePath("/app/setup");
  revalidatePath("/app");
  return { ok: true };
}
