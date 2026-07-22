"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function submitRoleAssignmentToGovernance(formData: FormData): Promise<void> {
  const organizationId = await getCurrentOrgId();
  const person = await getCurrentPerson();
  const applicationId = String(formData.get("applicationId") ?? "");
  const meetingId = String(formData.get("meetingId") ?? "");
  const tensionId = String(formData.get("tensionId") ?? "");
  if (!person || person.organizationId !== organizationId || !applicationId || !meetingId || !tensionId) return;
  const application = await prisma.roleAssignmentApplication.findFirst({ where: { id: applicationId, organizationId, applicantId: person.id, status: { in: ["PENDING", "NOMINATED"] } }, select: { id: true, roleId: true, applicantId: true, role: { select: { name: true } } } });
  const meeting = await prisma.meeting.findFirst({ where: { id: meetingId, organizationId, type: "GOVERNANCE", endedAt: null }, select: { id: true } });
  const tension = await prisma.tension.findFirst({ where: { id: tensionId, organizationId, status: "OPEN" }, select: { id: true } });
  if (!application || !meeting || !tension) return;
  const existing = await prisma.governanceProposal.findFirst({ where: { organizationId, type: "ROLE_ASSIGNMENT", targetId: application.roleId, status: { in: ["CANDIDATE", "PROPOSED"] }, proposedChange: { contains: application.id } }, select: { id: true } });
  if (existing) {
    redirect(`/app/meetings/${meeting.id}?proposal=${existing.id}`);
  }
  await prisma.tension.update({ where: { id: tension.id }, data: { handlingMode: "GOVERNANCE" } });
  const proposal = await prisma.governanceProposal.create({ data: { organizationId, type: "ROLE_ASSIGNMENT", targetId: application.roleId, proposedChange: JSON.stringify({ schemaVersion: 1, operation: "ROLE_ASSIGNMENT", applicationId: application.id, personId: application.applicantId, roleId: application.roleId }), rationale: `申请承担角色：${application.role.name}`, status: "CANDIDATE", tensionId: tension.id, meetingId: meeting.id }, select: { id: true } });
  redirect(`/app/meetings/${meeting.id}?proposal=${proposal.id}`);
}

export async function nominateRoleApplicationAction(formData: FormData): Promise<void> {
  const organizationId = await getCurrentOrgId();
  const person = await getCurrentPerson();
  const roleId = String(formData.get("roleId") ?? "");
  const nomineeId = String(formData.get("nomineeId") ?? "");
  if (!person || person.organizationId !== organizationId || !roleId || !nomineeId || !person.userId) return;
  const membership = await prisma.membership.findUnique({ where: { userId_organizationId: { userId: person.userId, organizationId } }, select: { role: true } });
  if (membership?.role !== "ORG_ADMIN") return;
  const [role, nominee] = await Promise.all([
    prisma.roleDef.findFirst({ where: { id: roleId, organizationId, status: "ACTIVE", assignees: { none: {} } }, select: { id: true } }),
    prisma.person.findFirst({ where: { id: nomineeId, organizationId }, select: { id: true } }),
  ]);
  if (!role || !nominee) return;
  await prisma.roleAssignmentApplication.create({ data: { organizationId, roleId, applicantId: nominee.id, motivation: `由 ${person.name} 提名，待本人确认。`, capabilitySummary: "待被提名人补充", commitment: "待被提名人确认", status: "NOMINATED", nominatedAt: new Date(), nominatedById: person.id } });
  revalidatePath("/app/roles/applications");
  revalidatePath("/app/roles/market");
}

export async function acceptRoleNominationAction(formData: FormData): Promise<void> {
  const organizationId = await getCurrentOrgId();
  const person = await getCurrentPerson();
  const applicationId = String(formData.get("applicationId") ?? "");
  if (!person || person.organizationId !== organizationId || !applicationId) return;
  await prisma.roleAssignmentApplication.updateMany({ where: { id: applicationId, organizationId, applicantId: person.id, status: "NOMINATED" }, data: { status: "PENDING", motivation: "本人接受组织提名，待治理会议审核。", capabilitySummary: "待本人补充", commitment: "待本人确认" } });
  revalidatePath("/app/roles/applications");
  revalidatePath("/app/roles/market");
}
