import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

const activeActionStatuses = [
  "ASSIGNED",
  "IN_PROGRESS",
  "BLOCKED",
  "ESCALATED_L0_5",
  "ESCALATED_L2",
  "ESCALATED_L3",
  "ESCALATED_L4",
] as const;

const proposerRevisionStates = [
  "CLARIFICATION_REQUIRED",
  "AMENDMENT_REQUIRED",
  "NOT_ADOPTED",
] as const;

export type WeeklyRhythmItem = {
  id: string;
  kind: "MEETING" | "TENSION" | "ACTION" | "PROJECT";
  title: string;
  context: string;
  href: string;
  priority: number;
};

type WeeklyRhythmClient = Pick<
  PrismaClient,
  | "meeting"
  | "tension"
  | "tacticalOutcomeProposal"
  | "governanceDecisionProcess"
  | "project"
>;

export async function getWeeklyRhythm(
  organizationId: string,
  personId: string,
  client: WeeklyRhythmClient = prisma,
): Promise<WeeklyRhythmItem[]> {
  const now = new Date();
  const [meetings, unroutedTensions, tacticalFollowUps, governanceFollowUps, actions, projects] =
    await Promise.all([
      client.meeting.findMany({
        where: {
          organizationId,
          endedAt: null,
          participants: { some: { id: personId } },
        },
        select: { id: true, title: true, type: true, startedAt: true },
        orderBy: { startedAt: "asc" },
        take: 6,
      }),
      client.tension.findMany({
        where: {
          organizationId,
          raiserId: personId,
          status: "OPEN",
          handlingMode: "UNROUTED",
        },
        select: { id: true, title: true, updatedAt: true },
        orderBy: { updatedAt: "asc" },
        take: 6,
      }),
      client.tacticalOutcomeProposal.findMany({
        where: {
          organizationId,
          proposerId: personId,
          status: { in: ["RETURNED", "REJECTED"] },
        },
        select: {
          id: true,
          status: true,
          updatedAt: true,
          sourceTension: { select: { title: true } },
          meeting: { select: { id: true, title: true } },
        },
        orderBy: { updatedAt: "asc" },
        take: 6,
      }),
      client.governanceDecisionProcess.findMany({
        where: {
          organizationId,
          proposerId: personId,
          state: { in: [...proposerRevisionStates] },
        },
        select: {
          id: true,
          state: true,
          updatedAt: true,
          sourceTension: { select: { title: true } },
          meeting: { select: { id: true, title: true } },
        },
        orderBy: { updatedAt: "asc" },
        take: 6,
      }),
      client.tension.findMany({
        where: {
          organizationId,
          ownerId: personId,
          status: { in: [...activeActionStatuses] },
          tacticalOutcomeActionProposal: {
            is: { status: "APPROVED", kind: "ACTION" },
          },
        },
        select: { id: true, title: true, status: true, deadline: true, updatedAt: true },
        orderBy: [{ deadline: "asc" }, { updatedAt: "asc" }],
        take: 8,
      }),
      client.project.findMany({
        where: {
          organizationId,
          bearerId: personId,
          status: { not: "COMPLETED" },
        },
        select: { id: true, name: true, status: true, updatedAt: true },
        orderBy: { updatedAt: "asc" },
        take: 6,
      }),
    ]);

  const items: WeeklyRhythmItem[] = [
    ...meetings.map((meeting) => ({
      id: `meeting:${meeting.id}`,
      kind: "MEETING" as const,
      title: meeting.title,
      context: `${meeting.type === "GOVERNANCE" ? "治理会" : meeting.type === "TACTICAL" ? "战术会" : "战略会"} · 参加会议`,
      href: `/app/meetings/${meeting.id}`,
      priority: 20 + meeting.startedAt.getTime() / 1e15,
    })),
    ...unroutedTensions.map((tension) => ({
      id: `tension:${tension.id}`,
      kind: "TENSION" as const,
      title: tension.title,
      context: "选择战术或治理处理方式",
      href: `/app/tensions/${tension.id}`,
      priority: 30 + tension.updatedAt.getTime() / 1e15,
    })),
    ...tacticalFollowUps.map((proposal) => ({
      id: `tactical-follow-up:${proposal.id}`,
      kind: "TENSION" as const,
      title: proposal.sourceTension.title,
      context: `${proposal.meeting.title} · 修改战术提案`,
      href: `/app/meetings/${proposal.meeting.id}`,
      priority: 30 + proposal.updatedAt.getTime() / 1e15,
    })),
    ...governanceFollowUps.map((process) => ({
      id: `governance-follow-up:${process.id}`,
      kind: "TENSION" as const,
      title: process.sourceTension.title,
      context: `${process.meeting.title} · 补充治理提案`,
      href: `/app/meetings/${process.meeting.id}`,
      priority: 30 + process.updatedAt.getTime() / 1e15,
    })),
    ...actions.map((action) => {
      const overdue = action.deadline !== null && action.deadline < now;
      return {
        id: `action:${action.id}`,
        kind: "ACTION" as const,
        title: action.title,
        context: overdue ? "Action · 已超过承诺时间" : action.status === "BLOCKED" ? "Action · 已阻塞" : "推进 Action",
        href: `/app/tracker/${action.id}`,
        priority: overdue ? 10 : action.status === "BLOCKED" ? 15 : 40,
      };
    }),
    ...projects.map((project) => ({
      id: `project:${project.id}`,
      kind: "PROJECT" as const,
      title: project.name,
      context: project.status === "PAUSED" ? "Project · 恢复或完成" : "推进 Project",
      href: `/app/projects/${project.id}`,
      priority: 50 + project.updatedAt.getTime() / 1e15,
    })),
  ];

  return items.sort((left, right) => left.priority - right.priority).slice(0, 8);
}
