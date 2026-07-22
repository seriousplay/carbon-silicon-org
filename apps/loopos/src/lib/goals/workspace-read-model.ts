import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  deriveGoalHealth,
  type GoalCheckInSnapshot,
  type GoalHealthStatus,
  type GoalTargetSnapshot,
} from "@/lib/goals/domain-operations";

const WORKSPACE_GOAL_LIMIT = 6;
const MEETING_PREVIEW_LIMIT = 3;
const TARGET_PREVIEW_LIMIT = 2;
const WORK_LINK_PREVIEW_LIMIT = 3;

export type WorkspaceGoalCycle = {
  id: string;
  name: string;
  startAt: Date;
  endAt: Date;
  checkInCadenceDays: number;
  url: string;
};

export type WorkspaceGoalEvidence = {
  fact: string;
  evidenceSummary: string;
  currentValue: string | null;
  milestoneCompleted: boolean | null;
  assessment: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "ACHIEVED";
  recordedAt: Date;
  meetingUrl: string | null;
  sourceUrl: string | null;
};

export type WorkspaceGoalTarget = {
  id: string;
  position: number;
  label: string;
  kind: "NUMERIC" | "MILESTONE";
  baselineValue: string | null;
  desiredValue: string | null;
  unit: string | null;
  acceptanceCriteria: string | null;
  effectiveEvidence: WorkspaceGoalEvidence | null;
  evidenceAgeDays: number | null;
  evidenceIsStale: boolean;
};

export type WorkspaceGoalWorkLink = {
  id: string;
  kind: "PROJECT" | "ACTION" | "BLOCKING_TENSION";
  label: string;
  url: string;
  createdAt: Date;
};

export type WorkspaceGoalItem = {
  id: string;
  title: string;
  intendedOutcome: string;
  health: GoalHealthStatus;
  url: string;
  circle: { id: string; name: string; url: string };
  ownerRole: {
    id: string;
    name: string;
    status: "ACTIVE" | "PAUSED" | "ARCHIVED";
    assigneeCount: number;
    viewerAssigned: boolean;
    url: string;
  };
  meetings: Array<{ id: string; title: string; startedAt: Date; url: string }>;
  meetingCount: number;
  meetingsHasMore: boolean;
  meetingsUrl: string;
  targets: WorkspaceGoalTarget[];
  targetCount: number;
  targetsHasMore: boolean;
  workLinks: WorkspaceGoalWorkLink[];
  workLinkCount: number;
  workLinksHasMore: boolean;
};

export type WorkspaceGoalProjection =
  | {
      status: "NOT_AVAILABLE";
      reason: "VIEWER_NOT_FOUND" | "ACTIVE_CYCLE_NOT_FOUND" | "READ_FAILED";
      allGoalsUrl: string;
    }
  | {
      status: "EMPTY";
      cycle: WorkspaceGoalCycle;
      allGoalsUrl: string;
    }
  | {
      status: "READY";
      cycle: WorkspaceGoalCycle;
      goals: WorkspaceGoalItem[];
      hasMore: boolean;
      allGoalsUrl: string;
    };

export type QueryWorkspaceGoalContextInput = {
  organizationId: string;
  viewerPersonId: string;
};

export type WorkspaceGoalReadDependencies = {
  prisma: PrismaClient;
  now: Date;
};

export async function queryWorkspaceGoalContext(
  input: QueryWorkspaceGoalContextInput,
  dependencies: WorkspaceGoalReadDependencies,
): Promise<WorkspaceGoalProjection> {
  const organizationId = input.organizationId.trim();
  const viewerPersonId = input.viewerPersonId.trim();
  const fallbackUrl = goalUrl();
  if (!organizationId || !viewerPersonId || !isValidDate(dependencies.now)) {
    return { status: "NOT_AVAILABLE", reason: "VIEWER_NOT_FOUND", allGoalsUrl: fallbackUrl };
  }

  try {
    const [viewer, cycleRow] = await Promise.all([
      dependencies.prisma.person.findFirst({
        where: { id: viewerPersonId, organizationId },
        select: { id: true },
      }),
      dependencies.prisma.goalCycle.findFirst({
        where: { organizationId, status: "ACTIVE" },
        orderBy: [{ startAt: "desc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          status: true,
          startAt: true,
          endAt: true,
          checkInCadenceDays: true,
        },
      }),
    ]);

    if (!viewer) {
      return { status: "NOT_AVAILABLE", reason: "VIEWER_NOT_FOUND", allGoalsUrl: fallbackUrl };
    }
    if (!cycleRow) {
      return { status: "NOT_AVAILABLE", reason: "ACTIVE_CYCLE_NOT_FOUND", allGoalsUrl: fallbackUrl };
    }

    const cycle = toCycle(cycleRow);
    const allGoalsUrl = cycle.url;
    const goalRows = await dependencies.prisma.goal.findMany({
      where: {
        organizationId,
        cycleId: cycleRow.id,
        status: "ACTIVE",
        circle: { organizationId, status: { not: "ARCHIVED" } },
        OR: [{
          ownerRole: {
            organizationId,
            status: "ACTIVE",
            assignees: { some: { id: viewerPersonId, organizationId } },
          },
        }, {
          circle: {
            organizationId,
            meetings: {
              some: {
                organizationId,
                type: "TACTICAL",
                endedAt: null,
                circleId: { not: null },
                participants: { some: { id: viewerPersonId, organizationId } },
              },
            },
          },
        }],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: WORKSPACE_GOAL_LIMIT + 1,
      select: {
        id: true,
        organizationId: true,
        cycleId: true,
        circleId: true,
        title: true,
        intendedOutcome: true,
        ownerRoleId: true,
        status: true,
        createdAt: true,
        circle: {
          select: {
            id: true,
            name: true,
            status: true,
            meetings: {
              where: {
                organizationId,
                type: "TACTICAL",
                endedAt: null,
                circleId: { not: null },
                participants: { some: { id: viewerPersonId, organizationId } },
              },
              orderBy: [{ startedAt: "asc" }, { id: "asc" }],
              take: MEETING_PREVIEW_LIMIT + 1,
              select: { id: true, title: true, startedAt: true },
            },
            _count: {
              select: {
                meetings: {
                  where: {
                    organizationId,
                    type: "TACTICAL",
                    endedAt: null,
                    circleId: { not: null },
                    participants: { some: { id: viewerPersonId, organizationId } },
                  },
                },
              },
            },
          },
        },
        ownerRole: {
          select: {
            id: true,
            name: true,
            status: true,
            assignees: {
              where: { id: viewerPersonId, organizationId },
              orderBy: { id: "asc" },
              take: 1,
              select: { id: true, name: true },
            },
            _count: {
              select: { assignees: { where: { organizationId } } },
            },
          },
        },
        targets: {
          orderBy: [{ position: "asc" }, { id: "asc" }],
          take: TARGET_PREVIEW_LIMIT + 1,
          select: {
            id: true,
            goalId: true,
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
              where: { organizationId, supersededBy: null },
              orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
              take: 1,
              select: {
                id: true,
                goalId: true,
                targetId: true,
                fact: true,
                evidenceSummary: true,
                currentValue: true,
                milestoneCompleted: true,
                acceptanceEvidence: true,
                assessment: true,
                recorderId: true,
                meetingId: true,
                sourceUrl: true,
                supersedesCheckInId: true,
                recordedAt: true,
              },
            },
          },
        },
        workLinks: {
          where: { organizationId, status: "ACTIVE" },
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          take: WORK_LINK_PREVIEW_LIMIT + 1,
          select: {
            id: true,
            kind: true,
            createdAt: true,
            project: { select: { id: true, name: true, status: true } },
            tension: { select: { id: true, title: true, status: true } },
          },
        },
        _count: {
          select: {
            targets: true,
            workLinks: { where: { organizationId, status: "ACTIVE" } },
          },
        },
      },
    });

    const distinctRows = deduplicateGoalRows(goalRows);
    if (distinctRows.length === 0) return { status: "EMPTY", cycle, allGoalsUrl };
    const visibleRows = distinctRows.slice(0, WORKSPACE_GOAL_LIMIT);
    const healthRows = await loadGoalHealthAggregates({
      prisma: dependencies.prisma,
      organizationId,
      goalIds: visibleRows.map((row) => row.id),
      staleBefore: new Date(
        dependencies.now.getTime() - cycleRow.checkInCadenceDays * 86_400_000,
      ),
    });
    const healthByGoal = new Map(healthRows.map((row) => [row.goalId, row]));
    if (visibleRows.some((row) => !healthByGoal.has(row.id))) throw new Error("Goal health unavailable");

    return {
      status: "READY",
      cycle,
      goals: visibleRows.map((row) => projectGoal(
        row,
        cycleRow,
        viewerPersonId,
        dependencies.now,
        healthByGoal.get(row.id)!,
      )),
      hasMore: distinctRows.length > WORKSPACE_GOAL_LIMIT,
      allGoalsUrl,
    };
  } catch {
    return { status: "NOT_AVAILABLE", reason: "READ_FAILED", allGoalsUrl: fallbackUrl };
  }
}

function projectGoal<TRow extends {
  id: string;
  circleId: string;
  title: string;
  intendedOutcome: string;
  status: "ACTIVE" | "SUPERSEDED" | "ACHIEVED" | "NOT_ACHIEVED";
  ownerRole: {
    id: string;
    name: string;
    status: "ACTIVE" | "PAUSED" | "ARCHIVED";
    assignees: Array<{ id: string; name: string }>;
    _count: { assignees: number };
  };
  circle: {
    id: string;
    name: string;
    meetings: Array<{ id: string; title: string; startedAt: Date }>;
    _count: { meetings: number };
  };
  targets: Array<{
    id: string;
    goalId: string;
    sourceProposalTargetId: string;
    position: number;
    label: string;
    kind: "NUMERIC" | "MILESTONE";
    baselineValue: unknown;
    desiredValue: unknown;
    unit: string | null;
    acceptanceCriteria: string | null;
    metricId: string | null;
    checkIns: Array<{
      id: string;
      goalId: string;
      targetId: string;
      fact: string;
      evidenceSummary: string;
      currentValue: unknown;
      milestoneCompleted: boolean | null;
      acceptanceEvidence: string | null;
      assessment: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "ACHIEVED";
      recorderId: string;
      meetingId: string | null;
      sourceUrl: string | null;
      supersedesCheckInId: string | null;
      recordedAt: Date;
    }>;
  }>;
  workLinks: Array<{
    id: string;
    kind: "PROJECT" | "ACTION" | "BLOCKING_TENSION";
    createdAt: Date;
    project: { id: string; name: string } | null;
    tension: { id: string; title: string } | null;
  }>;
  _count: { targets: number; workLinks: number };
}>(
  row: TRow,
  cycle: { id: string; endAt: Date; checkInCadenceDays: number },
  viewerPersonId: string,
  now: Date,
  aggregate: GoalHealthAggregateRow,
): WorkspaceGoalItem {
  const targetSnapshots = row.targets.map(toTargetSnapshot);
  const checkIns = row.targets.flatMap((target) => target.checkIns.map(toCheckInSnapshot));
  const previewHealth = deriveGoalHealth({
    goal: { id: row.id, status: "ACTIVE" },
    cycle,
    targets: targetSnapshots,
    checkIns,
    now,
  });
  const evidenceByTarget = new Map(previewHealth.targets.map((target) => [target.targetId, target]));

  return {
    id: row.id,
    title: row.title,
    intendedOutcome: row.intendedOutcome,
    health: deriveAggregateHealth(aggregate, cycle, now),
    url: goalUrl(cycle.id, row.id),
    circle: {
      id: row.circle.id,
      name: row.circle.name,
      url: entityUrl("circles", row.circle.id),
    },
    ownerRole: {
      id: row.ownerRole.id,
      name: row.ownerRole.name,
      status: row.ownerRole.status,
      assigneeCount: row.ownerRole._count.assignees,
      viewerAssigned: row.ownerRole.assignees.some((person) => person.id === viewerPersonId),
      url: entityUrl("roles", row.ownerRole.id),
    },
    meetings: row.circle.meetings.slice(0, MEETING_PREVIEW_LIMIT).map((meeting) => ({
      ...meeting,
      url: entityUrl("meetings", meeting.id),
    })),
    meetingCount: row.circle._count.meetings,
    meetingsHasMore: row.circle._count.meetings > MEETING_PREVIEW_LIMIT,
    meetingsUrl: entityCollectionUrl("meetings"),
    targets: row.targets.slice(0, TARGET_PREVIEW_LIMIT).map((target): WorkspaceGoalTarget => {
      const targetHealth = evidenceByTarget.get(target.id);
      const evidence = targetHealth?.effectiveCheckIn ?? null;
      return {
        id: target.id,
        position: target.position,
        label: target.label,
        kind: target.kind,
        baselineValue: decimalText(target.baselineValue),
        desiredValue: decimalText(target.desiredValue),
        unit: target.unit,
        acceptanceCriteria: target.acceptanceCriteria,
        effectiveEvidence: evidence ? {
          fact: evidence.fact,
          evidenceSummary: evidence.evidenceSummary,
          currentValue: evidence.currentValue,
          milestoneCompleted: evidence.milestoneCompleted,
          assessment: evidence.assessment,
          recordedAt: evidence.recordedAt,
          meetingUrl: evidence.meetingId ? entityUrl("meetings", evidence.meetingId) : null,
          sourceUrl: evidence.sourceUrl,
        } : null,
        evidenceAgeDays: evidence ? ageInDays(evidence.recordedAt, now) : null,
        evidenceIsStale: targetHealth?.stale ?? false,
      };
    }),
    targetCount: row._count.targets,
    targetsHasMore: row._count.targets > TARGET_PREVIEW_LIMIT,
    workLinks: row.workLinks.slice(0, WORK_LINK_PREVIEW_LIMIT).flatMap((work): WorkspaceGoalWorkLink[] => {
      if (work.kind === "PROJECT" && work.project) {
        return [{
          id: work.id,
          kind: work.kind,
          label: work.project.name,
          url: entityUrl("projects", work.project.id),
          createdAt: work.createdAt,
        }];
      }
      if (!work.tension) return [];
      return [{
        id: work.id,
        kind: work.kind,
        label: work.tension.title,
        url: entityUrl(work.kind === "ACTION" ? "tracker" : "tensions", work.tension.id),
        createdAt: work.createdAt,
      }];
    }),
    workLinkCount: row._count.workLinks,
    workLinksHasMore: row._count.workLinks > WORK_LINK_PREVIEW_LIMIT,
  };
}

type GoalHealthAggregateRow = {
  goalId: string;
  targetCount: number | bigint;
  evidenceCount: number | bigint;
  achievedCount: number | bigint;
  offTrackCount: number | bigint;
  atRiskCount: number | bigint;
  staleCount: number | bigint;
};

async function loadGoalHealthAggregates(input: {
  prisma: PrismaClient;
  organizationId: string;
  goalIds: string[];
  staleBefore: Date;
}): Promise<GoalHealthAggregateRow[]> {
  if (input.goalIds.length === 0) return [];
  return input.prisma.$queryRaw<GoalHealthAggregateRow[]>(Prisma.sql`
    WITH effective_check_ins AS (
      SELECT DISTINCT ON (check_in."goalId", check_in."targetId")
        check_in."goalId",
        check_in."targetId",
        check_in."assessment",
        check_in."recordedAt"
      FROM "goal_check_ins" AS check_in
      WHERE check_in."organizationId" = ${input.organizationId}
        AND check_in."goalId" IN (${Prisma.join(input.goalIds)})
        AND NOT EXISTS (
          SELECT 1
          FROM "goal_check_ins" AS successor
          WHERE successor."organizationId" = check_in."organizationId"
            AND successor."goalId" = check_in."goalId"
            AND successor."targetId" = check_in."targetId"
            AND successor."supersedesCheckInId" = check_in."id"
        )
      ORDER BY check_in."goalId", check_in."targetId", check_in."recordedAt" DESC, check_in."id" DESC
    )
    SELECT
      target."goalId" AS "goalId",
      COUNT(*)::integer AS "targetCount",
      COUNT(effective."targetId")::integer AS "evidenceCount",
      COUNT(*) FILTER (WHERE effective."assessment" = 'ACHIEVED')::integer AS "achievedCount",
      COUNT(*) FILTER (WHERE effective."assessment" = 'OFF_TRACK')::integer AS "offTrackCount",
      COUNT(*) FILTER (WHERE effective."assessment" = 'AT_RISK')::integer AS "atRiskCount",
      COUNT(*) FILTER (
        WHERE effective."assessment" <> 'ACHIEVED'
          AND effective."recordedAt" < ${input.staleBefore}
      )::integer AS "staleCount"
    FROM "goal_targets" AS target
    LEFT JOIN effective_check_ins AS effective
      ON effective."goalId" = target."goalId"
      AND effective."targetId" = target."id"
    WHERE target."organizationId" = ${input.organizationId}
      AND target."goalId" IN (${Prisma.join(input.goalIds)})
    GROUP BY target."goalId"
    ORDER BY target."goalId" ASC
    LIMIT ${WORKSPACE_GOAL_LIMIT}
  `);
}

function deriveAggregateHealth(
  row: GoalHealthAggregateRow,
  cycle: { id: string; endAt: Date; checkInCadenceDays: number },
  now: Date,
): GoalHealthStatus {
  const targetCount = countValue(row.targetCount);
  const evidenceCount = countValue(row.evidenceCount);
  const achievedCount = countValue(row.achievedCount);
  const offTrackCount = countValue(row.offTrackCount);
  const atRiskCount = countValue(row.atRiskCount);
  const staleCount = countValue(row.staleCount);
  if (targetCount < 1 || evidenceCount > targetCount
    || achievedCount + offTrackCount + atRiskCount > evidenceCount
    || staleCount > evidenceCount - achievedCount) {
    throw new Error("Invalid Goal health aggregate");
  }

  const targets: GoalTargetSnapshot[] = [];
  const checkIns: GoalCheckInSnapshot[] = [];
  const addTarget = (assessment?: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "ACHIEVED", stale = false) => {
    const id = `aggregate-target-${targets.length + 1}`;
    targets.push({
      id,
      goalId: row.goalId,
      sourceProposalTargetId: `aggregate-source-${targets.length + 1}`,
      position: targets.length,
      label: "aggregate",
      kind: "MILESTONE",
      baselineValue: null,
      desiredValue: null,
      unit: null,
      acceptanceCriteria: "aggregate",
      metricId: null,
    });
    if (!assessment) return;
    checkIns.push({
      id: `aggregate-check-in-${checkIns.length + 1}`,
      organizationId: "",
      goalId: row.goalId,
      targetId: id,
      fact: "aggregate",
      evidenceSummary: "aggregate",
      currentValue: null,
      milestoneCompleted: assessment === "ACHIEVED",
      acceptanceEvidence: assessment === "ACHIEVED" ? "aggregate" : null,
      assessment,
      recorderId: "aggregate",
      meetingId: null,
      sourceUrl: null,
      supersedesCheckInId: null,
      recordedAt: stale
        ? new Date(now.getTime() - (cycle.checkInCadenceDays + 1) * 86_400_000)
        : now,
    });
  };

  if (evidenceCount === 0) addTarget();
  else if (achievedCount === targetCount) addTarget("ACHIEVED");
  else if (offTrackCount > 0) addTarget("OFF_TRACK");
  else if (evidenceCount < targetCount) {
    addTarget("ON_TRACK");
    addTarget();
  } else if (atRiskCount > 0) addTarget("AT_RISK");
  else if (staleCount > 0) addTarget("ON_TRACK", true);
  else addTarget("ON_TRACK");

  return deriveGoalHealth({
    goal: { id: row.goalId, status: "ACTIVE" },
    cycle,
    targets,
    checkIns,
    now,
  }).status;
}

function countValue(value: number | bigint): number {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid aggregate count");
  return count;
}

function deduplicateGoalRows<TRow extends {
  id: string;
  circle: { meetings: Array<{ id: string; startedAt: Date }> };
}>(rows: TRow[]): TRow[] {
  const uniqueRows = new Map<string, TRow>();
  for (const row of rows) {
    const existing = uniqueRows.get(row.id);
    if (!existing) {
      uniqueRows.set(row.id, row);
      continue;
    }
    const meetings = new Map(existing.circle.meetings.map((meeting) => [meeting.id, meeting]));
    for (const meeting of row.circle.meetings) meetings.set(meeting.id, meeting);
    existing.circle.meetings = [...meetings.values()].sort((left, right) => (
      left.startedAt.getTime() - right.startedAt.getTime() || compareText(left.id, right.id)
    ));
  }
  return [...uniqueRows.values()];
}

function toTargetSnapshot(row: {
  id: string;
  goalId: string;
  sourceProposalTargetId: string;
  position: number;
  label: string;
  kind: "NUMERIC" | "MILESTONE";
  baselineValue: unknown;
  desiredValue: unknown;
  unit: string | null;
  acceptanceCriteria: string | null;
  metricId: string | null;
}): GoalTargetSnapshot {
  return {
    ...row,
    baselineValue: decimalText(row.baselineValue),
    desiredValue: decimalText(row.desiredValue),
  };
}

function toCheckInSnapshot(row: {
  id: string;
  goalId: string;
  targetId: string;
  fact: string;
  evidenceSummary: string;
  currentValue: unknown;
  milestoneCompleted: boolean | null;
  acceptanceEvidence: string | null;
  assessment: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "ACHIEVED";
  recorderId: string;
  meetingId: string | null;
  sourceUrl: string | null;
  supersedesCheckInId: string | null;
  recordedAt: Date;
}): GoalCheckInSnapshot {
  return {
    organizationId: "",
    ...row,
    currentValue: decimalText(row.currentValue),
  };
}

function toCycle(row: {
  id: string;
  name: string;
  startAt: Date;
  endAt: Date;
  checkInCadenceDays: number;
}): WorkspaceGoalCycle {
  return { ...row, url: goalUrl(row.id) };
}

function goalUrl(cycleId?: string, goalId?: string): string {
  if (!cycleId) return "/app/goals";
  const goal = goalId ? `&goal=${encodeURIComponent(goalId)}` : "";
  return `/app/goals?cycle=${encodeURIComponent(cycleId)}${goal}`;
}

function entityUrl(
  kind: "circles" | "meetings" | "projects" | "roles" | "tensions" | "tracker",
  id: string,
): string {
  return `/app/${kind}/${encodeURIComponent(id)}`;
}

function entityCollectionUrl(kind: "meetings"): string {
  return `/app/${kind}`;
}

function decimalText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "object" && "toString" in value
    ? String((value as { toString(): string }).toString())
    : String(value);
}

function ageInDays(recordedAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - recordedAt.getTime()) / 86_400_000));
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
