"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";
import { generateMeetingAgenda, generateGuardReport } from "@/lib/ai/meeting-assistant";
import { isAIAvailable } from "@/lib/ai/provider";

export type MeetingAIState = { error?: string; ok?: boolean; draft?: string; notesRevision?: number } | undefined;

// AI 生成会议议程
export async function generateAgendaAction(meetingId: string): Promise<MeetingAIState> {
  const orgId = await getCurrentOrgId();

  if (!isAIAvailable()) {
    return { error: "AI 未配置" };
  }

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, organizationId: orgId },
    select: { id: true, type: true, circleId: true },
  });
  if (!meeting) return { error: "会议不存在" };

  const agenda = await generateMeetingAgenda(orgId, meeting.type, meeting.circleId ?? undefined);
  if (!agenda) return { error: "AI 生成失败" };

  await prisma.meeting.update({
    where: { id: meetingId },
    data: { agenda },
  });

  revalidatePath(`/app/meetings/${meetingId}`);
  return { ok: true };
}

// AI 生成守护者报告
export async function generateGuardReportAction(meetingId: string): Promise<MeetingAIState> {
  const [orgId, person] = await Promise.all([getCurrentOrgId(), getCurrentPerson()]);

  if (!isAIAvailable()) {
    return { error: "AI 未配置" };
  }

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, organizationId: orgId },
    select: { id: true, notes: true, notesRevision: true, participants: { select: { id: true } } },
  });
  if (!meeting) return { error: "会议不存在" };
  if (!person || !meeting.participants.some((participant) => participant.id === person.id)) return { error: "只有会议参与人可以生成报告" };
  if (!meeting.notes?.trim()) return { error: "请先填写会议纪要" };

  const report = await generateGuardReport(meeting.notes);
  if (!report) return { error: "AI 分析失败" };

  return { draft: report, notesRevision: meeting.notesRevision };
}

export async function confirmGuardReportAction(meetingId: string, report: string, notesRevision: number): Promise<MeetingAIState> {
  const [orgId, person] = await Promise.all([getCurrentOrgId(), getCurrentPerson()]);
  if (!person || !report.trim() || report.length > 12000 || !Number.isInteger(notesRevision)) return { error: "报告内容或纪要版本无效" };

  const updated = await prisma.meeting.updateMany({
    where: {
      id: meetingId,
      organizationId: orgId,
      notesRevision,
      participants: { some: { id: person.id } },
    },
    data: { aiGuardReport: report.trim() },
  });
  if (updated.count !== 1) return { error: "纪要已更新或你不再是参与人，请重新生成" };

  revalidatePath(`/app/meetings/${meetingId}`);
  return { ok: true };
}
