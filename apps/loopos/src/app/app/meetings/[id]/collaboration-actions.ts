"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";
import { notifyMeetingParticipants, type NotificationClient } from "@/lib/notifications";
import { DomainOperationError, raiseTension, updateMeetingNotes } from "@/lib/domain-operations";
import { getOrganizationGovernanceConfig } from "@/lib/organization-governance-config";
import { evaluateMeetingLifecycle } from "@/lib/organization-setup/meeting-lifecycle-policy";
import {
  confirmMemoryCandidate,
  createDraftMemoryCandidate,
  submitMemoryCandidate,
} from "@/lib/organization-brain/memory-candidate-lifecycle";
import { createPrismaMemoryCandidateStore } from "@/lib/organization-brain/memory-candidate-service";
import type { MemoryCandidateActor, MemoryCandidateSourceRef } from "@/lib/organization-brain/memory-candidate-types";
import { currentCollaborationActionDependencies } from "./collaboration-action-dependencies";

export type CollaborationState = { error?: string; ok?: boolean } | undefined;

const productionEndMeetingDependencies = {
  prisma,
  getCurrentOrgId,
  getCurrentPerson,
  revalidatePath,
};

export async function createTacticalMeetingTensionAction(
  meetingId: string,
  circleId: string,
  _previous: CollaborationState,
  formData: FormData,
): Promise<CollaborationState> {
  try {
    const { orgId, personId, meeting } = await requireParticipant(meetingId);
    if (meeting.endedAt || meeting.type !== "TACTICAL") return { error: "当前会议不能新增战术张力" };
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { error: "请填写张力名称" };
    await raiseTension(prisma, {
      organizationId: orgId,
      raiserId: personId,
      title,
      description: "现场记录，待提出者补充背景。",
      type: "PROBLEMATIC",
      source: "TACTICAL_MEETING",
      circleIds: circleId ? [circleId] : [],
      handlingMode: "TACTICAL",
    });
    revalidatePath(`/app/meetings/${meetingId}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "现场生成张力失败" };
  }
}

export async function createGovernanceMeetingTensionAction(
  meetingId: string,
  circleId: string,
  _previous: CollaborationState,
  formData: FormData,
): Promise<CollaborationState> {
  try {
    const { orgId, personId, meeting } = await requireParticipant(meetingId);
    if (meeting.endedAt || meeting.type !== "GOVERNANCE") return { error: "当前会议不能新增治理张力" };
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { error: "请填写治理张力名称" };
    await raiseTension(prisma, {
      organizationId: orgId,
      raiserId: personId,
      title,
      description: "治理会议现场记录，待提出者补充提案。",
      type: "PROBLEMATIC",
      source: "GOVERNANCE_MEETING",
      circleIds: circleId ? [circleId] : [],
      handlingMode: "GOVERNANCE",
    });
    revalidatePath(`/app/meetings/${meetingId}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "现场生成治理张力失败" };
  }
}

export async function archiveTacticalHealthReviewAction(
  meetingId: string,
  _previous: CollaborationState,
  formData: FormData,
): Promise<CollaborationState> {
  try {
    const { orgId, personId, meeting } = await requireParticipant(meetingId);
    if (meeting.endedAt || meeting.type !== "TACTICAL") return { error: "当前会议不能记录运营健康度" };
    const summary = cleanMultiline(formData.get("summary"), 1200);
    const goalInput = cleanMultiline(formData.get("goalInput"), 800);
    const metricInput = cleanMultiline(formData.get("metricInput"), 800);
    const checklistInput = cleanMultiline(formData.get("checklistInput"), 800);
    const projectInput = cleanMultiline(formData.get("projectInput"), 800);
    const riskInput = cleanMultiline(formData.get("riskInput"), 800);
    if (![summary, goalInput, metricInput, checklistInput, projectInput, riskInput].some(Boolean)) {
      return { error: "请至少填写一项运营健康度输入" };
    }

    const person = await prisma.person.findFirst({
      where: { id: personId, organizationId: orgId },
      select: { name: true },
    });
    const archivedAt = new Date();
    const memoryClaim = buildTacticalHealthMemoryClaim({
      circleName: meeting.circle?.name ?? "本回路",
      summary,
      goalInput,
      metricInput,
      checklistInput,
      projectInput,
      riskInput,
    });
    const section = [
      `## 运营健康度回顾 · ${archivedAt.toLocaleString("zh-CN", { hour12: false })}`,
      `记录人：${person?.name ?? personId}`,
      "",
      ...healthLine("综合判断", summary),
      ...healthLine("目标回顾", goalInput),
      ...healthLine("指标回顾", metricInput),
      ...healthLine("检查项", checklistInput),
      ...healthLine("关键项目/行动", projectInput),
      ...healthLine("风险与张力线索", riskInput),
    ].join("\n");

    await prisma.meeting.update({
      where: { id_organizationId: { id: meetingId, organizationId: orgId } },
      data: {
        notes: meeting.notes ? `${meeting.notes.trim()}\n\n${section}` : section,
        notesRevision: { increment: 1 },
      },
    });
    await persistConfirmedMeetingMemory({
      organizationId: orgId,
      ownerPersonId: personId,
      ownerName: person?.name ?? "会议参与人",
      meetingId,
      meetingTitle: meeting.title,
      claim: memoryClaim,
      rationale: section,
      observedAt: archivedAt,
    });
    revalidatePath(`/app/meetings/${meetingId}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "记录运营健康度失败" };
  }
}

export async function updateMeetingParticipantsAction(
  meetingId: string,
  _prev: CollaborationState,
  formData: FormData
): Promise<CollaborationState> {
  try {
    const { orgId, personId, meeting } = await requireParticipant(meetingId);
    const participantIds = [...new Set(formData.getAll("participantIds").map(String).filter(Boolean))];
    if (!participantIds.includes(personId)) participantIds.push(personId);

    const people = await prisma.person.findMany({
      where: { id: { in: participantIds }, organizationId: orgId },
      select: { id: true, name: true, homeCircleId: true, roles: { where: { circleId: meeting.circleId ?? "", status: "ACTIVE" }, select: { id: true }, take: 1 } },
    });
    if (people.length !== participantIds.length) return { error: "参与人必须属于当前组织" };
    if (meeting.endedAt) return { error: "会议已结束，不能修改参与人" };
    const governanceConfig = await getOrganizationGovernanceConfig(orgId);
    if (governanceConfig.rules.meetingParticipantScope === "CIRCLE_SCOPE" && meeting.circleId) {
      const outsideCircle = people.find((person) => person.homeCircleId !== meeting.circleId && person.roles.length === 0);
      if (outsideCircle) return { error: `回路范围规则不允许添加 ${outsideCircle.name}` };
    }

    const currentIds = new Set(meeting.participants.map((participant) => participant.id));
    const newlyAddedIds = participantIds.filter((id) => !currentIds.has(id));
    await prisma.$transaction(async (tx) => {
      await tx.meeting.update({
        where: { id_organizationId: { id: meetingId, organizationId: orgId } },
        data: { participants: { set: participantIds.map((id) => ({ id })) } },
      });
      await notifyMeetingParticipants({
        organizationId: orgId,
        meetingId,
        meetingTitle: meeting.title,
        startedAt: meeting.startedAt,
        recipientIds: newlyAddedIds,
        actorId: personId,
        client: tx as unknown as NotificationClient,
      });
    });

    revalidatePath(`/app/meetings/${meetingId}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "更新参与人失败" };
  }
}

export async function updateMeetingNotesAction(
  meetingId: string,
  _prev: CollaborationState,
  formData: FormData
): Promise<CollaborationState> {
  try {
    const [orgId, person] = await Promise.all([getCurrentOrgId(), getCurrentPerson()]);
    if (!person) return { error: "当前账号没有人员档案" };
    const expectedRevision = Number(formData.get("notesRevision"));
    const notes = ((formData.get("notes") as string) ?? "").trim();

    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) return { error: "纪要版本无效" };

    await prisma.$transaction((tx) => updateMeetingNotes(tx, {
      organizationId: orgId,
      actorId: person.id,
      meetingId,
      expectedNotesRevision: expectedRevision,
      notes,
    }), {
      isolationLevel: "Serializable",
    });

    revalidatePath(`/app/meetings/${meetingId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof DomainOperationError) return { error: meetingNotesErrorMessage(e.code) };
    return { error: e instanceof Error ? e.message : "更新纪要失败" };
  }
}

function meetingNotesErrorMessage(code: string): string {
  switch (code) {
    case "INVALID_MEETING_NOTES":
      return "纪要版本无效";
    case "MEETING_NOT_AVAILABLE":
      return "会议不存在";
    case "MEETING_PARTICIPANT_REQUIRED":
      return "只有当前会议参与人可以执行此操作";
    case "MEETING_ENDED":
      return "会议已结束，不能修改纪要";
    case "MEETING_NOTES_STALE":
      return "纪要已被其他参与人更新，请刷新后重试";
    default:
      return "更新纪要失败";
  }
}

export async function endMeetingAction(
  meetingId: string,
  _prevState: CollaborationState,
): Promise<CollaborationState> {
  void _prevState;
  try {
    const dependencies = currentCollaborationActionDependencies(productionEndMeetingDependencies);
    const { orgId, personId, meeting } = await requireParticipant(meetingId, dependencies);

    await dependencies.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.findUnique({
        where: { id: orgId },
        select: { lifecycleStatus: true },
      });
      if (!evaluateMeetingLifecycle(organization?.lifecycleStatus).allowed) {
        throw new Error("组织尚未启用，不能进行会议操作");
      }
      if (meeting.endedAt) return;

      const notes = meeting.type === "TACTICAL" ? await buildTacticalMeetingNotes(tx, orgId, meetingId) : null;
      const mergedNotes = notes && meeting.notes ? `${meeting.notes.trim()}\n\n${notes}` : notes;
      await tx.meeting.update({
        where: { id_organizationId: { id: meetingId, organizationId: orgId } },
        data: { endedAt: new Date(), endedById: personId, ...(mergedNotes ? { notes: mergedNotes, notesRevision: { increment: 1 } } : {}) },
      });
    }, { isolationLevel: "Serializable" });

    dependencies.revalidatePath(`/app/meetings/${meetingId}`);
    dependencies.revalidatePath("/app/meetings");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "结束会议失败" };
  }
}

function cleanMultiline(value: FormDataEntryValue | null, maxLength: number): string {
  return String(value ?? "").replace(/\r\n/g, "\n").trim().slice(0, maxLength);
}

function healthLine(label: string, value: string): string[] {
  return value ? [`### ${label}`, value, ""] : [];
}

function buildTacticalHealthMemoryClaim(input: {
  circleName: string;
  summary: string;
  goalInput: string;
  metricInput: string;
  checklistInput: string;
  projectInput: string;
  riskInput: string;
}): string {
  const content = [
    input.summary,
    input.goalInput ? `目标：${input.goalInput}` : "",
    input.metricInput ? `指标：${input.metricInput}` : "",
    input.checklistInput ? `检查项：${input.checklistInput}` : "",
    input.projectInput ? `项目/行动：${input.projectInput}` : "",
    input.riskInput ? `风险/张力：${input.riskInput}` : "",
  ].filter(Boolean).join("；");
  return `${input.circleName} 运营健康度回顾：${content}`.slice(0, 560);
}

async function persistConfirmedMeetingMemory(input: {
  organizationId: string;
  ownerPersonId: string;
  ownerName: string;
  meetingId: string;
  meetingTitle: string;
  claim: string;
  rationale: string;
  observedAt: Date;
}): Promise<void> {
  const existing = await prisma.memoryCandidate.findFirst({
    where: {
      organizationId: input.organizationId,
      claim: input.claim,
      sourceRefs: { path: ["0", "id"], equals: input.meetingId },
      status: { in: ["SUBMITTED", "CONFIRMED"] },
    },
    select: { id: true },
  });
  if (existing) return;

  const ownerActor: MemoryCandidateActor = {
    type: "person",
    id: input.ownerPersonId,
    label: input.ownerName,
  };
  const sourceRef: MemoryCandidateSourceRef = {
    type: "meeting",
    id: input.meetingId,
    label: input.meetingTitle,
    applicationUrl: `/app/meetings/${input.meetingId}`,
    observedAt: input.observedAt.toISOString(),
  };
  const draft = createDraftMemoryCandidate({
    id: randomUUID(),
    organizationId: input.organizationId,
    ownerPersonId: input.ownerPersonId,
    claim: input.claim,
    rationale: input.rationale.slice(0, 1100),
    sourceRefs: [sourceRef],
    actor: ownerActor,
    now: input.observedAt,
  });
  const submitted = submitMemoryCandidate(draft, {
    actor: ownerActor,
    now: input.observedAt,
    reason: "Submitted from tactical health review.",
  });
  const confirmed = confirmMemoryCandidate(submitted, {
    actor: {
      type: "process",
      id: `meeting:${input.ownerPersonId}`,
      label: "Official meeting record",
    },
    now: input.observedAt,
    validFrom: input.observedAt.toISOString(),
    reason: "Confirmed by tactical meeting record.",
  });
  const store = createPrismaMemoryCandidateStore(prisma);
  await store.create(draft);
  await store.update(submitted);
  await store.update(confirmed);
}

async function requireParticipant(meetingId: string, dependencies = productionEndMeetingDependencies) {
  const [orgId, person] = await Promise.all([dependencies.getCurrentOrgId(), dependencies.getCurrentPerson()]);
  if (!person) throw new Error("当前账号没有人员档案");

  const meeting = await dependencies.prisma.meeting.findFirst({
    where: { id: meetingId, organizationId: orgId },
    select: {
      id: true,
      title: true,
      startedAt: true,
      endedAt: true,
      notes: true,
      notesRevision: true,
      type: true,
      circleId: true,
      circle: { select: { name: true } },
      participants: { select: { id: true } },
    },
  });
  if (!meeting) throw new Error("会议不存在");
  if (!meeting.participants.some((participant) => participant.id === person.id)) {
    throw new Error("只有当前会议参与人可以执行此操作");
  }

  return { orgId, personId: person.id, meeting };
}

async function buildTacticalMeetingNotes(client: typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0], organizationId: string, meetingId: string): Promise<string> {
  const [meeting, tensions, proposals] = await Promise.all([
    client.meeting.findFirst({ where: { id: meetingId, organizationId }, select: { title: true, circle: { select: { name: true } } } }),
    client.tension.findMany({ where: { organizationId, tacticalOutcomeProposal: { meetingId } }, select: { title: true, status: true, role: { select: { name: true } }, raiser: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
    client.tacticalOutcomeProposal.findMany({ where: { organizationId, meetingId }, include: { sourceTension: { select: { title: true } }, responsiblePerson: { select: { name: true } }, outcomeProject: { select: { name: true } }, outcomeAction: { select: { title: true } } }, orderBy: { createdAt: "asc" } }),
  ]);
  const incomplete = proposals.filter((proposal) => proposal.status === "APPROVED" && (!proposal.responsiblePerson || (proposal.kind === "PROJECT" ? !proposal.outcomeProject : !proposal.outcomeAction)));
  if (incomplete.length > 0) throw new Error("存在已通过但尚未完成承担者或结果归属的提案，请先补齐后再结束会议");
  const lines = [`# ${meeting?.circle?.name ?? "本回路"} · 战术会议自动纪要`, `会议：${meeting?.title ?? meetingId}`, "", "## 张力处理清单"];
  if (tensions.length === 0) lines.push("本次没有形成张力处理结果。");
  for (const tension of tensions) lines.push(`- ${tension.title}（提出角色：${tension.role?.name ?? tension.raiser.name}；状态：${tension.status}）`);
  lines.push("", "## 会议形成的项目与行动");
  if (proposals.length === 0) lines.push("本次没有形成项目或行动提案。");
  for (const proposal of proposals) {
    const result = proposal.kind === "PROJECT" ? proposal.outcomeProject?.name : proposal.outcomeAction?.title;
    lines.push(`- ${proposal.kind === "PROJECT" ? "项目" : "行动"}：${result ?? "待落实"}；来源张力：${proposal.sourceTension.title}；状态：${proposal.status}${proposal.responsiblePerson ? `；承担者：${proposal.responsiblePerson.name}` : ""}${proposal.meetingDecisionNote ? `；说明：${proposal.meetingDecisionNote}` : ""}`);
  }
  lines.push("", "## 后续跟踪", "- 下次战术会回顾仍未闭环的张力、项目和行动。");
  return lines.join("\n");
}
