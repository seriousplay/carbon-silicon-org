import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { withBasePath } from "@/lib/base-path";
import {
  deriveGoalHealth,
  type GoalCheckInSnapshot,
  type GoalHealthStatus,
  type GoalTargetSnapshot,
} from "@/lib/goals/domain-operations";

type PersonDto = { id: string; name: string };
type MeetingDto = {
  id: string;
  title: string;
  type: "TACTICAL";
  endedAt: Date | null;
  url: string;
  viewerIsParticipant: boolean;
  canAppendEvidence: boolean;
  canManageWorkLinks: boolean;
};

export type TacticalGoalEvidence = {
  id: string;
  fact: string;
  evidenceSummary: string;
  currentValue: string | null;
  milestoneCompleted: boolean | null;
  acceptanceEvidence: string | null;
  assessment: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "ACHIEVED";
  recorder: PersonDto;
  meetingTitle: string | null;
  meetingUrl: string | null;
  sourceUrl: string | null;
  supersedesCheckInId: string | null;
  isSuperseded: boolean;
  recordedAt: Date;
  ageLabel: string;
};

export type TacticalGoalTarget = {
  id: string;
  position: number;
  label: string;
  kind: "NUMERIC" | "MILESTONE";
  baselineValue: string | null;
  desiredValue: string | null;
  unit: string | null;
  acceptanceCriteria: string | null;
  metricId: string | null;
  effectiveEvidence: TacticalGoalEvidence | null;
  evidenceIsStale: boolean;
  evidence: TacticalGoalEvidence[];
  evidenceHasMore: boolean;
};

type WorkObjectDto = { id: string; title: string; url: string | null };
type WorkLinkDto = {
  id: string;
  kind: "PROJECT" | "ACTION" | "BLOCKING_TENSION";
  status: "ACTIVE" | "REMOVED";
  work: WorkObjectDto;
  createdBy: PersonDto;
  createdMeetingTitle: string | null;
  createdMeetingUrl: string | null;
  createdAt: Date;
  removedBy: PersonDto | null;
  removedMeetingTitle: string | null;
  removedMeetingUrl: string | null;
  removedAt: Date | null;
  removalReason: string | null;
};

type ApprovedWorkCandidate = WorkObjectDto & {
  kind: "PROJECT" | "ACTION";
  proposalTitle: string;
  sourceTension: WorkObjectDto;
};

type BlockingTensionCandidate = WorkObjectDto & {
  kind: "BLOCKING_TENSION";
  status: string;
};

export type TacticalGoalMeetingProjection =
  | { status: "NOT_AVAILABLE" }
  | { status: "NO_CIRCLE"; meeting: MeetingDto }
  | {
      status: "NO_ACTIVE_GOAL";
      meeting: MeetingDto & { circle: { id: string; name: string; url: string } };
    }
  | {
      status: "READY";
      meeting: MeetingDto & { circle: { id: string; name: string; url: string } };
      cycle: {
        id: string;
        name: string;
        startAt: Date;
        endAt: Date;
        checkInCadenceDays: number;
        url: string;
      };
      goal: {
        id: string;
        title: string;
        intendedOutcome: string;
        url: string;
        health: GoalHealthStatus;
        ownerRole: {
          id: string;
          name: string;
          status: "ACTIVE" | "PAUSED" | "ARCHIVED";
          url: string;
          assignees: PersonDto[];
          assigneeCount: number;
          assigneesHasMore: boolean;
          factTime: "CURRENT";
        };
        viewerIsOwnerRoleAssignee: boolean;
        targets: TacticalGoalTarget[];
        workLinks: WorkLinkDto[];
        workLinksHasMore: boolean;
      };
      candidates: {
        projects: ApprovedWorkCandidate[];
        actions: ApprovedWorkCandidate[];
        blockingTensions: BlockingTensionCandidate[];
        approvedOutcomesHasMore: boolean;
        blockingTensionsHasMore: boolean;
      };
    };

export type QueryTacticalGoalMeetingInput = {
  organizationId: string;
  meetingId: string;
  viewerPersonId: string;
};

export type TacticalGoalMeetingReadDependencies = {
  prisma: PrismaClient;
  now?: () => Date;
};

const PAGE_SIZE = 50;
const PROBE_SIZE = PAGE_SIZE + 1;
const OWNER_ASSIGNEE_PREVIEW_SIZE = 5;
const OWNER_ASSIGNEE_PROBE_SIZE = OWNER_ASSIGNEE_PREVIEW_SIZE + 1;

export async function queryTacticalGoalMeeting(
  input: QueryTacticalGoalMeetingInput,
  dependencies: TacticalGoalMeetingReadDependencies,
): Promise<TacticalGoalMeetingProjection> {
  const organizationId = input.organizationId.trim();
  const meetingId = input.meetingId.trim();
  const viewerPersonId = input.viewerPersonId.trim();
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
    },
  });
  if (!meeting || meeting.type !== "TACTICAL") return { status: "NOT_AVAILABLE" };

  const viewerIsParticipant = meeting.participants.length === 1;
  const meetingProjection: MeetingDto = {
    id: meeting.id,
    title: meeting.title,
    type: "TACTICAL",
    endedAt: meeting.endedAt,
    url: entityUrl("meetings", meeting.id),
    viewerIsParticipant,
    canAppendEvidence: false,
    canManageWorkLinks: false,
  };
  if (!meeting.circleId || !meeting.circle) return { status: "NO_CIRCLE", meeting: meetingProjection };

  const circle = {
    id: meeting.circle.id,
    name: meeting.circle.name,
    url: entityUrl("circles", meeting.circle.id),
  };
  const goal = await dependencies.prisma.goal.findFirst({
    where: {
      organizationId,
      circleId: meeting.circleId,
      status: "ACTIVE",
      cycle: { status: "ACTIVE" },
    },
    select: {
      id: true,
      cycleId: true,
      circleId: true,
      title: true,
      intendedOutcome: true,
      ownerRoleId: true,
      parentGoalId: true,
      status: true,
      adoptedDecisionId: true,
      terminalDecisionId: true,
      createdAt: true,
      terminalAt: true,
      cycle: {
        select: {
          id: true,
          name: true,
          status: true,
          startAt: true,
          endAt: true,
          checkInCadenceDays: true,
        },
      },
      ownerRole: {
        select: {
          id: true,
          name: true,
          status: true,
          assignees: {
            where: { organizationId },
            orderBy: [{ name: "asc" }, { id: "asc" }],
            take: OWNER_ASSIGNEE_PROBE_SIZE,
            select: { id: true, name: true },
          },
          _count: {
            select: { assignees: { where: { organizationId } } },
          },
        },
      },
      targets: {
        where: { organizationId },
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: {
          id: true,
          sourceProposalTargetId: true,
          position: true,
          label: true,
          kind: true,
          baselineValue: true,
          desiredValue: true,
          unit: true,
          acceptanceCriteria: true,
          metricId: true,
          checkIns: {
            where: { organizationId },
            orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
            take: PROBE_SIZE,
            select: {
              id: true,
              fact: true,
              evidenceSummary: true,
              currentValue: true,
              milestoneCompleted: true,
              acceptanceEvidence: true,
              assessment: true,
              recorderId: true,
              recorder: { select: { id: true, name: true } },
              meetingId: true,
              meeting: { select: { id: true, title: true } },
              sourceUrl: true,
              supersedesCheckInId: true,
              recordedAt: true,
            },
          },
        },
      },
      workLinks: {
        where: { organizationId },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }, { id: "desc" }],
        take: PROBE_SIZE,
        select: {
          id: true,
          kind: true,
          status: true,
          projectId: true,
          tensionId: true,
          project: { select: { id: true, name: true } },
          tension: { select: { id: true, title: true } },
          createdBy: { select: { id: true, name: true } },
          createdMeeting: { select: { id: true, title: true } },
          createdAt: true,
          removedBy: { select: { id: true, name: true } },
          removedMeeting: { select: { id: true, title: true } },
          removedAt: true,
          removalReason: true,
        },
      },
    },
  });

  if (!goal) return { status: "NO_ACTIVE_GOAL", meeting: { ...meetingProjection, circle } };

  const viewerOwnerRoleMembership = goal.ownerRole.status === "ACTIVE"
    ? await dependencies.prisma.roleDef.findFirst({
        where: {
          id: goal.ownerRole.id,
          organizationId,
          status: "ACTIVE",
          assignees: { some: { id: viewerPersonId, organizationId } },
          ownedGoals: { some: { id: goal.id, organizationId, status: "ACTIVE" } },
        },
        select: { id: true },
      })
    : null;
  const viewerIsOwnerRoleAssignee = viewerOwnerRoleMembership !== null;

  const targetSnapshots: GoalTargetSnapshot[] = goal.targets.map((target) => ({
    id: target.id,
    goalId: goal.id,
    sourceProposalTargetId: target.sourceProposalTargetId,
    position: target.position,
    label: target.label,
    kind: target.kind,
    baselineValue: decimalText(target.baselineValue),
    desiredValue: decimalText(target.desiredValue),
    unit: target.unit,
    acceptanceCriteria: target.acceptanceCriteria,
    metricId: target.metricId,
  }));
  const checkInSnapshots: GoalCheckInSnapshot[] = goal.targets.flatMap((target) => target.checkIns.map((row) => ({
    id: row.id,
    organizationId,
    goalId: goal.id,
    targetId: target.id,
    fact: row.fact,
    evidenceSummary: row.evidenceSummary,
    currentValue: decimalText(row.currentValue),
    milestoneCompleted: row.milestoneCompleted,
    acceptanceEvidence: row.acceptanceEvidence,
    assessment: row.assessment,
    recorderId: row.recorderId,
    meetingId: row.meetingId,
    sourceUrl: row.sourceUrl,
    supersedesCheckInId: row.supersedesCheckInId,
    recordedAt: row.recordedAt,
  })));
  const now = dependencies.now?.() ?? new Date();
  const health = deriveGoalHealth({
    goal: { id: goal.id, status: goal.status },
    cycle: { endAt: goal.cycle.endAt, checkInCadenceDays: goal.cycle.checkInCadenceDays },
    targets: targetSnapshots,
    checkIns: checkInSnapshots,
    now,
  });
  const evidenceById = new Map<string, TacticalGoalEvidence>();
  const supersededIds = new Set(checkInSnapshots.flatMap((row) => row.supersedesCheckInId ? [row.supersedesCheckInId] : []));
  for (const target of goal.targets) {
    for (const row of target.checkIns) {
      evidenceById.set(row.id, {
        id: row.id,
        fact: row.fact,
        evidenceSummary: row.evidenceSummary,
        currentValue: decimalText(row.currentValue),
        milestoneCompleted: row.milestoneCompleted,
        acceptanceEvidence: row.acceptanceEvidence,
        assessment: row.assessment,
        recorder: row.recorder,
        meetingTitle: row.meeting?.title ?? null,
        meetingUrl: row.meeting ? entityUrl("meetings", row.meeting.id) : null,
        sourceUrl: row.sourceUrl,
        supersedesCheckInId: row.supersedesCheckInId,
        isSuperseded: supersededIds.has(row.id),
        recordedAt: row.recordedAt,
        ageLabel: evidenceAgeLabel(row.recordedAt, now),
      });
    }
  }

  const [outcomeCandidates, blockingCandidates] = await Promise.all([
    dependencies.prisma.tacticalOutcomeProposal.findMany({
      where: {
        organizationId,
        meetingId: meeting.id,
        circleId: meeting.circleId,
        status: "APPROVED",
        OR: [
          {
            outcomeProjectId: { not: null },
            outcomeProject: { goalWorkLinks: { none: { organizationId, goalId: goal.id, status: "ACTIVE" } } },
          },
          {
            outcomeActionId: { not: null },
            outcomeAction: { goalWorkLinks: { none: { organizationId, goalId: goal.id, status: "ACTIVE" } } },
          },
        ],
      },
      orderBy: [{ recordedAt: "desc" }, { id: "asc" }],
      take: PROBE_SIZE,
      select: {
        id: true,
        kind: true,
        title: true,
        sourceTension: { select: { id: true, title: true } },
        outcomeProject: { select: { id: true, name: true } },
        outcomeAction: { select: { id: true, title: true } },
      },
    }),
    dependencies.prisma.tension.findMany({
      where: {
        organizationId,
        status: { notIn: ["RESOLVED", "REJECTED"] },
        circles: { some: { id: meeting.circleId, organizationId } },
        goalWorkLinks: { none: { organizationId, goalId: goal.id, status: "ACTIVE" } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: PROBE_SIZE,
      select: { id: true, title: true, status: true },
    }),
  ]);

  const projects: ApprovedWorkCandidate[] = [];
  const actions: ApprovedWorkCandidate[] = [];
  for (const candidate of outcomeCandidates.slice(0, PAGE_SIZE)) {
    const sourceTension = {
      id: candidate.sourceTension.id,
      title: candidate.sourceTension.title,
      url: entityUrl("tensions", candidate.sourceTension.id),
    };
    if (candidate.kind === "PROJECT" && candidate.outcomeProject) {
      projects.push({
        id: candidate.outcomeProject.id,
        title: candidate.outcomeProject.name,
        url: entityUrl("projects", candidate.outcomeProject.id),
        kind: "PROJECT",
        proposalTitle: candidate.title,
        sourceTension,
      });
    }
    if (candidate.kind === "ACTION" && candidate.outcomeAction) {
      actions.push({
        id: candidate.outcomeAction.id,
        title: candidate.outcomeAction.title,
        url: entityUrl("tracker", candidate.outcomeAction.id),
        kind: "ACTION",
        proposalTitle: candidate.title,
        sourceTension,
      });
    }
  }

  return {
    status: "READY",
    meeting: {
      ...meetingProjection,
      circle,
      canAppendEvidence: viewerIsOwnerRoleAssignee || (meeting.endedAt === null && viewerIsParticipant),
      canManageWorkLinks: meeting.endedAt === null && viewerIsParticipant,
    },
    cycle: {
      id: goal.cycle.id,
      name: goal.cycle.name,
      startAt: goal.cycle.startAt,
      endAt: goal.cycle.endAt,
      checkInCadenceDays: goal.cycle.checkInCadenceDays,
      url: goalUrl(goal.cycle.id),
    },
    goal: {
      id: goal.id,
      title: goal.title,
      intendedOutcome: goal.intendedOutcome,
      url: goalUrl(goal.cycle.id, goal.id),
      health: health.status,
      ownerRole: {
        id: goal.ownerRole.id,
        name: goal.ownerRole.name,
        status: goal.ownerRole.status,
        url: entityUrl("roles", goal.ownerRole.id),
        assignees: goal.ownerRole.status === "ACTIVE"
          ? goal.ownerRole.assignees.slice(0, OWNER_ASSIGNEE_PREVIEW_SIZE)
          : [],
        assigneeCount: goal.ownerRole.status === "ACTIVE" ? goal.ownerRole._count.assignees : 0,
        assigneesHasMore: goal.ownerRole.status === "ACTIVE"
          && goal.ownerRole._count.assignees > OWNER_ASSIGNEE_PREVIEW_SIZE,
        factTime: "CURRENT",
      },
      viewerIsOwnerRoleAssignee,
      targets: goal.targets.map((target, index) => {
        const targetHealth = health.targets[index];
        return {
          ...targetSnapshots[index],
          effectiveEvidence: targetHealth.effectiveCheckIn
            ? evidenceById.get(targetHealth.effectiveCheckIn.id) ?? null
            : null,
          evidenceIsStale: targetHealth.stale,
          evidence: target.checkIns.slice(0, PAGE_SIZE).map((row) => evidenceById.get(row.id)).filter(isDefined),
          evidenceHasMore: target.checkIns.length > PAGE_SIZE,
        };
      }),
      workLinks: goal.workLinks.slice(0, PAGE_SIZE).map((link) => {
        const object = link.kind === "PROJECT" ? link.project : link.tension;
        const route = link.kind === "PROJECT" ? "projects" : link.kind === "ACTION" ? "tracker" : "tensions";
        return {
          id: link.id,
          kind: link.kind,
          status: link.status,
          work: {
            id: object?.id ?? "unavailable",
            title: object ? ("name" in object ? object.name : object.title) : "关联工作不可用",
            url: object ? entityUrl(route, object.id) : null,
          },
          createdBy: link.createdBy,
          createdMeetingTitle: link.createdMeeting?.title ?? null,
          createdMeetingUrl: link.createdMeeting ? entityUrl("meetings", link.createdMeeting.id) : null,
          createdAt: link.createdAt,
          removedBy: link.removedBy,
          removedMeetingTitle: link.removedMeeting?.title ?? null,
          removedMeetingUrl: link.removedMeeting ? entityUrl("meetings", link.removedMeeting.id) : null,
          removedAt: link.removedAt,
          removalReason: link.removalReason,
        };
      }),
      workLinksHasMore: goal.workLinks.length > PAGE_SIZE,
    },
    candidates: {
      projects,
      actions,
      blockingTensions: blockingCandidates
        .slice(0, PAGE_SIZE)
        .map((candidate) => ({
          id: candidate.id,
          title: candidate.title,
          url: entityUrl("tensions", candidate.id),
          kind: "BLOCKING_TENSION",
          status: candidate.status,
        })),
      approvedOutcomesHasMore: outcomeCandidates.length > PAGE_SIZE,
      blockingTensionsHasMore: blockingCandidates.length > PAGE_SIZE,
    },
  };
}

function decimalText(value: { toString(): string } | string | number | null): string | null {
  return value === null ? null : value.toString();
}

function entityUrl(route: string, id: string): string {
  return withBasePath(`/app/${route}/${encodeURIComponent(id)}`);
}

function goalUrl(cycleId: string, goalId?: string): string {
  const params = new URLSearchParams({ cycle: cycleId });
  if (goalId) params.set("goal", goalId);
  return `${withBasePath("/app/goals")}?${params.toString()}`;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function evidenceAgeLabel(value: Date, now: Date): string {
  const elapsed = Math.max(0, now.getTime() - value.getTime());
  const hours = Math.floor(elapsed / 3_600_000);
  if (hours < 1) return "刚刚更新";
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}
