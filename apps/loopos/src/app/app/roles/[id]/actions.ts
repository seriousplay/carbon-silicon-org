"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";
import { requireOrgAdmin } from "@/lib/permissions";
import {
  isAiCapabilityRiskLevel,
  saveAiCoAssigneePolicy,
  type AiCoAssigneePolicyStore,
} from "@/lib/ai-coassignees/policy";

export async function submitRoleExitToGovernance(formData: FormData): Promise<void> {
  const organizationId = await getCurrentOrgId();
  const person = await getCurrentPerson();
  const roleId = String(formData.get("roleId") ?? "");
  const meetingId = String(formData.get("meetingId") ?? "");
  const tensionId = String(formData.get("tensionId") ?? "");
  if (!person || person.organizationId !== organizationId || !roleId || !meetingId || !tensionId) return;
  const role = await prisma.roleDef.findFirst({ where: { id: roleId, organizationId, status: "ACTIVE", assignees: { some: { id: person.id } } }, select: { id: true, name: true } });
  const meeting = await prisma.meeting.findFirst({ where: { id: meetingId, organizationId, type: "GOVERNANCE", endedAt: null }, select: { id: true } });
  const tension = await prisma.tension.findFirst({ where: { id: tensionId, organizationId, status: "OPEN" }, select: { id: true } });
  if (!role || !meeting || !tension) return;
  const existing = await prisma.governanceProposal.findFirst({ where: { organizationId, type: "ROLE_UNASSIGNMENT", targetId: role.id, status: { in: ["CANDIDATE", "PROPOSED"] }, proposedChange: { contains: person.id } }, select: { id: true, meetingId: true } });
  if (existing) redirect(`/app/meetings/${existing.meetingId}?proposal=${existing.id}`);
  await prisma.tension.update({ where: { id: tension.id }, data: { handlingMode: "GOVERNANCE" } });
  const proposal = await prisma.governanceProposal.create({ data: { organizationId, type: "ROLE_UNASSIGNMENT", targetId: role.id, proposedChange: JSON.stringify({ schemaVersion: 1, operation: "ROLE_UNASSIGNMENT", personId: person.id, roleId: role.id }), rationale: `申请退出角色：${role.name}`, status: "CANDIDATE", tensionId: tension.id, meetingId: meeting.id }, select: { id: true } });
  redirect(`/app/meetings/${meeting.id}?proposal=${proposal.id}`);
}

export async function saveRoleAiCoAssigneePolicy(formData: FormData): Promise<void> {
  const person = await requireOrgAdmin();
  const organizationId = person.organizationId;
  const roleId = String(formData.get("roleId") ?? "");
  const aiPersonId = String(formData.get("aiPersonId") ?? "");
  const accountableHumanPersonId = String(formData.get("accountableHumanPersonId") ?? "");
  const maxRiskLevel = String(formData.get("maxRiskLevel") ?? "");
  if (!isAiCapabilityRiskLevel(maxRiskLevel)) throw new Error("UNSUPPORTED_RISK_LEVEL");

  const existingPolicy = await prisma.aiRoleCoAssignmentPolicy.findUnique({
    where: { organizationId_roleId_aiPersonId: { organizationId, roleId, aiPersonId } },
    select: { status: true },
  });
  if (existingPolicy && existingPolicy.status !== "PROPOSED") {
    throw new Error("AI_CO_ASSIGNMENT_POLICY_NOT_PROPOSED");
  }

  await saveAiCoAssigneePolicy(prisma as unknown as AiCoAssigneePolicyStore, {
    organizationId,
    roleId,
    aiPersonId,
    accountableHumanPersonId,
    maxRiskLevel,
    status: "PROPOSED",
    createdById: person.id,
  });

  revalidatePath(`/app/roles/${roleId}`);
}

export async function approveRoleAiCoAssigneePolicy(formData: FormData): Promise<void> {
  const person = await requireOrgAdmin();
  const policyId = String(formData.get("policyId") ?? "");
  const roleId = String(formData.get("roleId") ?? "");
  if (!policyId || !roleId) throw new Error("AI_CO_ASSIGNMENT_POLICY_REQUIRED");

  const result = await prisma.aiRoleCoAssignmentPolicy.updateMany({
    where: { id: policyId, organizationId: person.organizationId, roleId, status: "PROPOSED" },
    data: { status: "APPROVED", approvedAt: new Date(), suspendedAt: null, revokedAt: null, revocationReason: null },
  });
  if (result.count !== 1) throw new Error("AI_CO_ASSIGNMENT_POLICY_NOT_PROPOSED");
  revalidatePath(`/app/roles/${roleId}`);
}

export async function suspendRoleAiCoAssigneePolicy(formData: FormData): Promise<void> {
  const person = await requireOrgAdmin();
  const policyId = String(formData.get("policyId") ?? "");
  const roleId = String(formData.get("roleId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  if (!policyId || !roleId) throw new Error("AI_CO_ASSIGNMENT_POLICY_REQUIRED");

  const result = await prisma.aiRoleCoAssignmentPolicy.updateMany({
    where: { id: policyId, organizationId: person.organizationId, roleId, status: "APPROVED" },
    data: { status: "SUSPENDED", suspendedAt: new Date(), revocationReason: reason || null },
  });
  if (result.count !== 1) throw new Error("AI_CO_ASSIGNMENT_POLICY_NOT_APPROVED");
  revalidatePath(`/app/roles/${roleId}`);
}

export async function revokeRoleAiCoAssigneePolicy(formData: FormData): Promise<void> {
  const person = await requireOrgAdmin();
  const policyId = String(formData.get("policyId") ?? "");
  const roleId = String(formData.get("roleId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  if (!policyId || !roleId) throw new Error("AI_CO_ASSIGNMENT_POLICY_REQUIRED");

  const result = await prisma.aiRoleCoAssignmentPolicy.updateMany({
    where: { id: policyId, organizationId: person.organizationId, roleId, status: { in: ["PROPOSED", "APPROVED", "SUSPENDED"] } },
    data: { status: "REVOKED", revokedAt: new Date(), revocationReason: reason || null },
  });
  if (result.count !== 1) throw new Error("AI_CO_ASSIGNMENT_POLICY_CANNOT_REVOKE");
  revalidatePath(`/app/roles/${roleId}`);
}
