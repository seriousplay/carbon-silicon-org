import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { withBasePath } from "@/lib/base-path";

type PersonDto = { id: string; name: string };
type GoalStatus = "ACTIVE" | "SUPERSEDED" | "ACHIEVED" | "NOT_ACHIEVED";
type GoalSourceDto = {
  id: string;
  title: string;
  intendedOutcome: string;
  status: GoalStatus;
  url: string;
};

export type QueryStrategicGoalMeetingInput = {
  organizationId: string;
  meetingId: string;
  viewerPersonId: string;
  proposalPage?: number;
  decisionPage?: number;
};

export type StrategicGoalMeetingReadDependencies = {
  prisma: PrismaClient;
};

type PaginationDto = {
  page: number;
  pageSize: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

const PAGE_SIZE = 50;
const MAX_PAGE = 42_949_673;
const TARGET_LIMIT = 20;
const TARGET_PROBE_SIZE = TARGET_LIMIT + 1;

export type StrategicGoalMeetingProjection =
  | { status: "NOT_AVAILABLE" }
  | { status: "TRUNCATED"; reason: "PROPOSAL_TARGET_LIMIT_EXCEEDED" }
  | {
      status: "READY";
      meeting: {
        id: string;
        title: string;
        type: "STRATEGY";
        endedAt: Date | null;
        url: string;
        circle: { id: string; name: string; url: string };
        participantCount: number;
        viewerIsParticipant: boolean;
      };
      proposals: Array<{
        id: string;
        kind: "CREATE" | "REPLACE" | "CLOSE";
        submittedAt: Date | null;
        url: string;
        proposer: PersonDto;
        proposerIsParticipant: boolean;
        canRecord: boolean;
        canAdopt: boolean;
        cycle: {
          id: string;
          name: string;
          status: "PLANNED" | "ACTIVE" | "CLOSED" | "CANCELLED";
          url: string;
        };
        replacedGoal: GoalSourceDto | null;
        currentRevision: {
          revision: number;
          title: string | null;
          intendedOutcome: string | null;
          closeResult: "ACHIEVED" | "NOT_ACHIEVED" | null;
          conclusion: string | null;
          ownerRole: {
            id: string;
            circleId: string;
            name: string;
            status: "ACTIVE" | "PAUSED" | "ARCHIVED";
            url: string;
          } | null;
          parentGoal: GoalSourceDto | null;
          targets: Array<{
            id: string;
            position: number;
            label: string;
            kind: "NUMERIC" | "MILESTONE";
            baselineValue: string | null;
            desiredValue: string | null;
            unit: string | null;
            acceptanceCriteria: string | null;
            metricId: string | null;
            metric: { id: string; name: string } | null;
          }>;
        };
      }>;
      decisions: Array<{
        id: string;
        proposalId: string;
        proposalKind: "CREATE" | "REPLACE" | "CLOSE";
        proposalUrl: string;
        revision: number;
        revisionTitle: string | null;
        recorder: PersonDto;
        note: string | null;
        outcome: "ADOPTED" | "RETURNED" | "DECLINED";
        decidedAt: Date;
        adoptedGoal: GoalSourceDto | null;
        terminalGoal: GoalSourceDto | null;
      }>;
      proposalPagination: PaginationDto;
      decisionPagination: PaginationDto;
    };

export async function queryStrategicGoalMeeting(
  input: QueryStrategicGoalMeetingInput,
  dependencies: StrategicGoalMeetingReadDependencies,
): Promise<StrategicGoalMeetingProjection> {
  const organizationId = input.organizationId.trim();
  const meetingId = input.meetingId.trim();
  const viewerPersonId = input.viewerPersonId.trim();
  const proposalPage = normalizePage(input.proposalPage);
  const decisionPage = normalizePage(input.decisionPage);
  if (!organizationId || !meetingId || !viewerPersonId) return { status: "NOT_AVAILABLE" };

  const meeting = await dependencies.prisma.meeting.findFirst({
    where: { id: meetingId, organizationId },
    select: {
      id: true,
      title: true,
      type: true,
      endedAt: true,
      circleId: true,
      circle: { select: { id: true, name: true } },
      participants: {
        where: { organizationId, id: viewerPersonId },
        take: 1,
        select: { id: true },
      },
      _count: { select: { participants: { where: { organizationId } } } },
    },
  });
  if (!meeting || meeting.type !== "STRATEGY" || !meeting.circleId || !meeting.circle) {
    return { status: "NOT_AVAILABLE" };
  }

  const [proposalRows, decisionRows] = await Promise.all([
    dependencies.prisma.goalProposal.findMany({
      where: { organizationId, circleId: meeting.circleId, status: "SUBMITTED" },
      orderBy: [{ submittedAt: "desc" }, { id: "asc" }],
      skip: (proposalPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      select: {
        id: true,
        kind: true,
        submittedAt: true,
        proposer: {
          select: {
            id: true,
            name: true,
            meetingsParticipated: {
              where: { id: meeting.id, organizationId },
              take: 1,
              select: { id: true },
            },
          },
        },
        cycle: { select: { id: true, name: true, status: true } },
        replacedGoal: {
          select: { id: true, cycleId: true, title: true, intendedOutcome: true, status: true },
        },
        currentRevisionRecord: {
          select: {
            revision: true,
            title: true,
            intendedOutcome: true,
            closeResult: true,
            conclusion: true,
            ownerRole: { select: { id: true, circleId: true, name: true, status: true } },
            parentGoal: {
              select: { id: true, cycleId: true, title: true, intendedOutcome: true, status: true },
            },
            targets: {
              where: { organizationId },
              orderBy: [{ position: "asc" }, { id: "asc" }],
              take: TARGET_PROBE_SIZE,
              select: {
                id: true,
                position: true,
                label: true,
                kind: true,
                baselineValue: true,
                desiredValue: true,
                unit: true,
                acceptanceCriteria: true,
                metricId: true,
                metric: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    }),
    dependencies.prisma.goalDecision.findMany({
      where: { organizationId, meetingId: meeting.id },
      orderBy: [{ decidedAt: "desc" }, { id: "asc" }],
      skip: (decisionPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      select: {
        id: true,
        proposalId: true,
        revision: true,
        outcome: true,
        note: true,
        decidedAt: true,
        proposal: { select: { id: true, kind: true, cycleId: true } },
        revisionRecord: { select: { revision: true, title: true } },
        recorder: { select: { id: true, name: true } },
        adoptedGoal: {
          select: { id: true, cycleId: true, title: true, intendedOutcome: true, status: true },
        },
        terminalGoal: {
          select: { id: true, cycleId: true, title: true, intendedOutcome: true, status: true },
        },
      },
    }),
  ]);

  if (proposalRows.some((proposal) => proposal.currentRevisionRecord.targets.length > TARGET_LIMIT)) {
    return { status: "TRUNCATED", reason: "PROPOSAL_TARGET_LIMIT_EXCEEDED" };
  }

  const viewerIsParticipant = meeting.participants.length === 1;
  const canRecordInMeeting = meeting.endedAt === null && viewerIsParticipant;

  return {
    status: "READY",
    meeting: {
      id: meeting.id,
      title: meeting.title,
      type: "STRATEGY",
      endedAt: meeting.endedAt,
      url: entityUrl("meetings", meeting.id),
      circle: {
        id: meeting.circle.id,
        name: meeting.circle.name,
        url: entityUrl("circles", meeting.circle.id),
      },
      participantCount: meeting._count.participants,
      viewerIsParticipant,
    },
    proposals: proposalRows.slice(0, PAGE_SIZE).map((proposal) => {
      const proposerIsParticipant = proposal.proposer.meetingsParticipated.length === 1;
      const revision = proposal.currentRevisionRecord;
      return {
        id: proposal.id,
        kind: proposal.kind,
        submittedAt: proposal.submittedAt,
        url: goalUrl(proposal.cycle.id),
        proposer: { id: proposal.proposer.id, name: proposal.proposer.name },
        proposerIsParticipant,
        canRecord: canRecordInMeeting
          && proposerIsParticipant
          && (proposal.cycle.status === "PLANNED" || proposal.cycle.status === "ACTIVE"),
        canAdopt: canRecordInMeeting && proposerIsParticipant && proposal.cycle.status === "ACTIVE",
        cycle: { ...proposal.cycle, url: goalUrl(proposal.cycle.id) },
        replacedGoal: proposal.replacedGoal ? toGoalSource(proposal.replacedGoal) : null,
        currentRevision: {
          revision: revision.revision,
          title: revision.title,
          intendedOutcome: revision.intendedOutcome,
          closeResult: revision.closeResult,
          conclusion: revision.conclusion,
          ownerRole: revision.ownerRole
            ? { ...revision.ownerRole, url: entityUrl("roles", revision.ownerRole.id) }
            : null,
          parentGoal: revision.parentGoal ? toGoalSource(revision.parentGoal) : null,
          targets: revision.targets.map((target) => ({
            ...target,
            baselineValue: decimalText(target.baselineValue),
            desiredValue: decimalText(target.desiredValue),
          })),
        },
      };
    }),
    decisions: decisionRows.slice(0, PAGE_SIZE).map((decision) => ({
      id: decision.id,
      proposalId: decision.proposalId,
      proposalKind: decision.proposal.kind,
      proposalUrl: goalUrl(decision.proposal.cycleId),
      revision: decision.revision,
      revisionTitle: decision.revisionRecord.title,
      recorder: decision.recorder,
      note: decision.note,
      outcome: decision.outcome,
      decidedAt: decision.decidedAt,
      adoptedGoal: decision.adoptedGoal ? toGoalSource(decision.adoptedGoal) : null,
      terminalGoal: decision.terminalGoal ? toGoalSource(decision.terminalGoal) : null,
    })),
    proposalPagination: pagination(proposalPage, proposalRows.length),
    decisionPagination: pagination(decisionPage, decisionRows.length),
  };
}

function normalizePage(value: number | undefined): number {
  return Number.isSafeInteger(value) && value !== undefined && value > 0 && value <= MAX_PAGE
    ? value
    : 1;
}

function pagination(page: number, rowCount: number): PaginationDto {
  return {
    page,
    pageSize: PAGE_SIZE,
    hasPrevious: page > 1,
    hasNext: rowCount > PAGE_SIZE,
  };
}

function toGoalSource(row: {
  id: string;
  cycleId: string;
  title: string;
  intendedOutcome: string;
  status: GoalStatus;
}): GoalSourceDto {
  return {
    id: row.id,
    title: row.title,
    intendedOutcome: row.intendedOutcome,
    status: row.status,
    url: goalUrl(row.cycleId, row.id),
  };
}

function goalUrl(cycleId: string, goalId?: string): string {
  const cycle = encodeURIComponent(cycleId);
  const goal = goalId ? `&goal=${encodeURIComponent(goalId)}` : "";
  return withBasePath(`/app/goals?cycle=${cycle}${goal}` as `/${string}`);
}

function entityUrl(kind: "circles" | "meetings" | "roles", id: string): string {
  return withBasePath(`/app/${kind}/${encodeURIComponent(id)}` as `/${string}`);
}

function decimalText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "object" && "toString" in value
    ? String(value.toString())
    : String(value);
}
