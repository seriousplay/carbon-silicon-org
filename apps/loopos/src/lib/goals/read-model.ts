import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { withBasePath } from "@/lib/base-path";
import {
  deriveGoalHealth,
  type GoalCheckInSnapshot,
  type GoalHealthStatus,
  type GoalTargetSnapshot,
} from "@/lib/goals/domain-operations";

export type GoalTreeGapCode =
  | "ROOT_CIRCLE_MISSING"
  | "ROOT_CIRCLE_MULTIPLE"
  | "VISIBLE_PARENT_MISSING"
  | "MISSING_GOAL"
  | "MISSING_PARENT_SUPPORT"
  | "STALE_PARENT_SUPPORT"
  | "OWNER_ROLE_INACTIVE"
  | "OWNER_ROLE_UNASSIGNED"
  | "MISSING_TARGET_EVIDENCE"
  | "STALE_TARGET_EVIDENCE";

export type GoalTreeGap = {
  code: GoalTreeGapCode;
  circleId: string | null;
  goalId: string | null;
  targetId: string | null;
};

export type GoalTreeCycle = {
  id: string;
  name: string;
  status: "PLANNED" | "ACTIVE" | "CLOSED" | "CANCELLED";
  startAt: Date;
  endAt: Date;
  checkInCadenceDays: number;
  url: string;
};

export type GoalTreeCircle = {
  id: string;
  name: string;
  purpose: string;
  status: "NORMAL" | "WARNING" | "HALTED" | "ARCHIVED";
  parentId: string | null;
  url: string;
  factTime: "CURRENT";
};

export type GoalTreeEvidence = {
  id: string;
  fact: string;
  evidenceSummary: string;
  currentValue: string | null;
  milestoneCompleted: boolean | null;
  acceptanceEvidence: string | null;
  assessment: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "ACHIEVED";
  recorder: { id: string; name: string };
  meetingId: string | null;
  meetingUrl: string | null;
  sourceUrl: string | null;
  isCorrection: boolean;
  recordedAt: Date;
};

export type GoalTreeTarget = {
  id: string;
  position: number;
  label: string;
  kind: "NUMERIC" | "MILESTONE";
  baselineValue: string | null;
  desiredValue: string | null;
  unit: string | null;
  acceptanceCriteria: string | null;
  metric: { id: string; name: string } | null;
  effectiveEvidence: GoalTreeEvidence | null;
  evidenceIsStale: boolean;
};

export type GoalTreeRoleOption = {
  id: string;
  circleId: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  assignees: Array<{ id: string; name: string }>;
  assigneeCount: number;
  assigneesHasMore: boolean;
  factTime: "CURRENT";
};

export type GoalTreeMetricOption = {
  id: string;
  name: string;
};

export type GoalTreeWorkLink = {
  id: string;
  kind: "PROJECT" | "ACTION" | "BLOCKING_TENSION";
  objectId: string;
  label: string;
  objectStatus: string;
  url: string;
  createdAt: Date;
};

export type GoalTreeDecisionSource = {
  id: string;
  proposalKind: "CREATE" | "REPLACE" | "CLOSE";
  proposalTitle: string | null;
  revision: number;
  outcome: "ADOPTED" | "RETURNED" | "DECLINED";
  meetingId: string;
  meetingUrl: string;
  recorder: { id: string; name: string };
  decidedAt: Date;
};

export type GoalTreeGoal = {
  id: string;
  circleId: string;
  title: string;
  intendedOutcome: string;
  status: "ACTIVE" | "SUPERSEDED" | "ACHIEVED" | "NOT_ACHIEVED";
  parentGoal: { id: string; title: string; url: string } | null;
  health: GoalHealthStatus;
  ownerRole: GoalTreeRoleOption | null;
  targets: GoalTreeTarget[];
  workLinks: GoalTreeWorkLink[];
  workLinksHasMore: boolean;
  adoption: GoalTreeDecisionSource | null;
  terminalDecision: GoalTreeDecisionSource | null;
  createdAt: Date;
  terminalAt: Date | null;
  url: string;
  gaps: GoalTreeGap[];
};

export type GoalTreeNode = {
  id: string;
  parentId: string | null;
  circle: GoalTreeCircle;
  goal: GoalTreeGoal | null;
  capabilities: {
    canDraftCreate: boolean;
    canDraftReplace: boolean;
    canDraftClose: boolean;
  };
  draftOwnerRoles: GoalTreeRoleOption[];
  draftOwnerRolesHasMore: boolean;
  draftMetrics: GoalTreeMetricOption[];
  draftMetricsHasMore: boolean;
  gaps: GoalTreeGap[];
  children: GoalTreeNode[];
};

export type GoalTreeProposal = {
  id: string;
  circleId: string;
  proposer: { id: string; name: string };
  kind: "CREATE" | "REPLACE" | "CLOSE";
  status: "DRAFT" | "SUBMITTED" | "ADOPTED" | "RETURNED" | "DECLINED" | "WITHDRAWN";
  replacedGoalId: string | null;
  currentRevision: number;
  submittedAt: Date | null;
  terminalAt: Date | null;
  revision: {
    title: string | null;
    intendedOutcome: string | null;
    ownerRoleId: string | null;
    ownerRole: GoalTreeRoleOption | null;
    parentGoalId: string | null;
    closeResult: "ACHIEVED" | "NOT_ACHIEVED" | null;
    conclusion: string | null;
    authoredBy: { id: string; name: string };
    createdAt: Date;
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
  } | null;
  capabilities: {
    canAppendRevision: boolean;
    canSubmit: boolean;
    canWithdraw: boolean;
  };
};

export type GoalTreeProjection =
  | {
      status: "NOT_AVAILABLE";
      reason: "VIEWER_NOT_FOUND" | "CYCLE_NOT_FOUND";
      cycles: GoalTreeCycle[];
      cyclesHasMore: boolean;
      requestedCycleId: string | null;
    }
  | {
      status: "EMPTY";
      cycles: [];
      cyclesHasMore: false;
    }
  | {
      status: "TRUNCATED";
      reason: "TREE_LIMIT_EXCEEDED" | "TARGET_LIMIT_EXCEEDED" | "ACTIONABLE_PROPOSAL_LIMIT_EXCEEDED";
      cycle: GoalTreeCycle;
      cycles: GoalTreeCycle[];
      cyclesHasMore: boolean;
    }
  | {
      status: "READY";
      cycle: GoalTreeCycle;
      cycles: GoalTreeCycle[];
      cyclesHasMore: boolean;
      roots: GoalTreeNode[];
      detached: GoalTreeNode[];
      proposals: GoalTreeProposal[];
      actionableProposals: GoalTreeProposal[];
      proposalPagination: GoalTreePagination;
      gaps: GoalTreeGap[];
      selectedGoal: GoalTreeGoal | null;
      requestedGoalUnavailable: boolean;
      capabilities: { canDraftProposal: boolean };
    };

export type QueryGoalTreeInput = {
  organizationId: string;
  viewerPersonId: string;
  cycleId?: string;
  goalId?: string;
  proposalPage?: number;
};

export type GoalTreePagination = {
  page: number;
  pageSize: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

export type GoalTreeReadDependencies = {
  prisma: PrismaClient;
  now: Date;
};

const TREE_LIMIT = 200;
const PREVIEW_LIMIT = 50;
const PREVIEW_PROBE_SIZE = PREVIEW_LIMIT + 1;
const ACTIONABLE_PROPOSAL_LIMIT = 50;
const ACTIONABLE_PROPOSAL_PROBE_SIZE = ACTIONABLE_PROPOSAL_LIMIT + 1;
const ASSIGNEE_PREVIEW_LIMIT = 5;
const ASSIGNEE_PROBE_SIZE = ASSIGNEE_PREVIEW_LIMIT + 1;
const TARGET_LIMIT = 20;
const TARGET_PROBE_SIZE = TARGET_LIMIT + 1;
const MAX_PAGE = 42_949_673;
const goalCycleSelect = {
  id: true,
  name: true,
  status: true,
  startAt: true,
  endAt: true,
  checkInCadenceDays: true,
} as const;
const goalProposalSelect = {
  id: true,
  circleId: true,
  kind: true,
  status: true,
  replacedGoalId: true,
  currentRevision: true,
  submittedAt: true,
  terminalAt: true,
  proposer: { select: { id: true, name: true } },
} as const;

async function resolveCycleRow(
  prisma: PrismaClient,
  organizationId: string,
  requestedCycleId: string | null,
) {
  if (requestedCycleId) {
    return prisma.goalCycle.findFirst({
      where: { id: requestedCycleId, organizationId },
      select: goalCycleSelect,
    });
  }
  const orderBy = [{ startAt: "desc" as const }, { id: "asc" as const }];
  const [active, planned, historical] = await Promise.all([
    prisma.goalCycle.findFirst({
      where: { organizationId, status: "ACTIVE" },
      orderBy,
      select: goalCycleSelect,
    }),
    prisma.goalCycle.findFirst({
      where: { organizationId, status: "PLANNED" },
      orderBy,
      select: goalCycleSelect,
    }),
    prisma.goalCycle.findFirst({
      where: { organizationId, status: { in: ["CLOSED", "CANCELLED"] } },
      orderBy,
      select: goalCycleSelect,
    }),
  ]);
  return active ?? planned ?? historical;
}

export async function queryGoalTree(
  input: QueryGoalTreeInput,
  dependencies: GoalTreeReadDependencies,
): Promise<GoalTreeProjection> {
  const organizationId = input.organizationId.trim();
  const viewerPersonId = input.viewerPersonId.trim();
  const requestedCycleId = normalizeOptionalId(input.cycleId);
  const requestedGoalId = normalizeOptionalId(input.goalId);
  const proposalPage = normalizePage(input.proposalPage);
  if (!organizationId || !viewerPersonId || !isValidDate(dependencies.now)) {
    return { status: "NOT_AVAILABLE", reason: "VIEWER_NOT_FOUND", cycles: [], cyclesHasMore: false, requestedCycleId };
  }

  const viewer = await dependencies.prisma.person.findFirst({
    where: { id: viewerPersonId, organizationId },
    select: { id: true },
  });
  if (!viewer) {
    return { status: "NOT_AVAILABLE", reason: "VIEWER_NOT_FOUND", cycles: [], cyclesHasMore: false, requestedCycleId };
  }

  const cycleProbe = await dependencies.prisma.goalCycle.findMany({
    where: { organizationId },
    orderBy: [{ startAt: "desc" }, { id: "asc" }],
    take: PREVIEW_PROBE_SIZE,
    select: goalCycleSelect,
  });
  if (cycleProbe.length === 0) return { status: "EMPTY", cycles: [], cyclesHasMore: false };
  const cycles = cycleProbe.slice(0, PREVIEW_LIMIT).map(toCycleProjection);
  const cyclesHasMore = cycleProbe.length > PREVIEW_LIMIT;
  const cycleRow = await resolveCycleRow(dependencies.prisma, organizationId, requestedCycleId);
  if (!cycleRow) {
    return { status: "NOT_AVAILABLE", reason: "CYCLE_NOT_FOUND", cycles, cyclesHasMore, requestedCycleId };
  }

  const [circleProbe, goalProbe, proposalRows, actionableProposalRows] = await Promise.all([
    cycleRow.status === "CANCELLED" ? Promise.resolve([]) : dependencies.prisma.circle.findMany({
      where: { organizationId },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: TREE_LIMIT + 1,
      select: {
        id: true,
        name: true,
        purpose: true,
        status: true,
        parentId: true,
        roles: {
          where: { organizationId, status: "ACTIVE" },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          take: PREVIEW_PROBE_SIZE,
          select: {
            id: true,
            circleId: true,
            name: true,
            status: true,
            assignees: {
              where: { organizationId },
              orderBy: [{ name: "asc" }, { id: "asc" }],
              take: ASSIGNEE_PROBE_SIZE,
              select: { id: true, name: true },
            },
            _count: { select: { assignees: { where: { organizationId } } } },
          },
        },
        metricDefs: {
          where: { organizationId },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          take: PREVIEW_PROBE_SIZE,
          select: { id: true, name: true },
        },
      },
    }),
    cycleRow.status === "CANCELLED"
      ? Promise.resolve([])
      : dependencies.prisma.goal.findMany({
          where: { organizationId, cycleId: cycleRow.id },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: TREE_LIMIT + 1,
          select: {
            id: true,
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
            parentGoal: { select: { id: true, title: true } },
            ownerRole: {
              select: {
                id: true,
                circleId: true,
                name: true,
                status: true,
                assignees: {
                  where: { organizationId },
                  orderBy: [{ name: "asc" }, { id: "asc" }],
                  take: ASSIGNEE_PROBE_SIZE,
                  select: { id: true, name: true },
                },
                _count: { select: { assignees: { where: { organizationId } } } },
              },
            },
            targets: {
              where: { organizationId },
              orderBy: [{ position: "asc" }, { id: "asc" }],
              take: TARGET_PROBE_SIZE,
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
                metric: { select: { id: true, name: true } },
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
                    recorder: { select: { id: true, name: true } },
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
              take: PREVIEW_PROBE_SIZE,
              select: {
                id: true,
                kind: true,
                projectId: true,
                tensionId: true,
                createdAt: true,
                project: { select: { id: true, name: true, status: true } },
                tension: { select: { id: true, title: true, status: true } },
              },
            },
            adoptedDecision: {
              select: {
                id: true,
                revision: true,
                outcome: true,
                meetingId: true,
                decidedAt: true,
                proposal: { select: { kind: true } },
                revisionRecord: { select: { title: true, conclusion: true } },
                recorder: { select: { id: true, name: true } },
              },
            },
            terminalDecision: {
              select: {
                id: true,
                revision: true,
                outcome: true,
                meetingId: true,
                decidedAt: true,
                proposal: { select: { kind: true } },
                revisionRecord: { select: { title: true, conclusion: true } },
                recorder: { select: { id: true, name: true } },
              },
            },
          },
        }),
    dependencies.prisma.goalProposal.findMany({
      where: { organizationId, cycleId: cycleRow.id },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (proposalPage - 1) * PREVIEW_LIMIT,
      take: PREVIEW_PROBE_SIZE,
      select: goalProposalSelect,
    }),
    dependencies.prisma.goalProposal.findMany({
      where: {
        organizationId,
        cycleId: cycleRow.id,
        proposerId: viewerPersonId,
        status: { in: ["DRAFT", "RETURNED", "SUBMITTED"] },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: ACTIONABLE_PROPOSAL_PROBE_SIZE,
      select: goalProposalSelect,
    }),
  ]);

  if (circleProbe.length > TREE_LIMIT || goalProbe.length > TREE_LIMIT) {
    return {
      status: "TRUNCATED",
      reason: "TREE_LIMIT_EXCEEDED",
      cycle: toCycleProjection(cycleRow),
      cycles,
      cyclesHasMore,
    };
  }
  const circleRows = circleProbe.slice(0, TREE_LIMIT);
  const goalRows = goalProbe.slice(0, TREE_LIMIT);
  if (goalRows.some((goalRow) => goalRow.targets.length > TARGET_LIMIT)) {
    return {
      status: "TRUNCATED",
      reason: "TARGET_LIMIT_EXCEEDED",
      cycle: toCycleProjection(cycleRow),
      cycles,
      cyclesHasMore,
    };
  }
  if (actionableProposalRows.length > ACTIONABLE_PROPOSAL_LIMIT) {
    return {
      status: "TRUNCATED",
      reason: "ACTIONABLE_PROPOSAL_LIMIT_EXCEEDED",
      cycle: toCycleProjection(cycleRow),
      cycles,
      cyclesHasMore,
    };
  }

  const visibleProposalRows = proposalRows.slice(0, PREVIEW_LIMIT);
  const visibleActionableProposalRows = actionableProposalRows.slice(0, ACTIONABLE_PROPOSAL_LIMIT);
  const projectedProposalRows = [...new Map(
    [...visibleActionableProposalRows, ...visibleProposalRows].map((row) => [row.id, row]),
  ).values()];
  const proposalRevisionKeys = projectedProposalRows.map((row) => ({ proposalId: row.id, revision: row.currentRevision }));
  const revisionRows = proposalRevisionKeys.length === 0 ? [] : await dependencies.prisma.goalProposalRevision.findMany({
      where: { organizationId, OR: proposalRevisionKeys },
      select: {
        proposalId: true,
        revision: true,
        title: true,
        intendedOutcome: true,
        ownerRoleId: true,
        parentGoalId: true,
        closeResult: true,
        conclusion: true,
        authoredById: true,
        createdAt: true,
        authoredBy: { select: { id: true, name: true } },
        ownerRole: {
          select: {
            id: true,
            circleId: true,
            name: true,
            status: true,
            assignees: {
              where: { organizationId },
              orderBy: [{ name: "asc" }, { id: "asc" }],
              take: ASSIGNEE_PROBE_SIZE,
              select: { id: true, name: true },
            },
            _count: { select: { assignees: { where: { organizationId } } } },
          },
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
    });
  if (revisionRows.some((revision) => revision.targets.length > TARGET_LIMIT)) {
    return {
      status: "TRUNCATED",
      reason: "TARGET_LIMIT_EXCEEDED",
      cycle: toCycleProjection(cycleRow),
      cycles,
      cyclesHasMore,
    };
  }

  const circlesById = new Map(circleRows.map((row) => [row.id, toCircleProjection(row)]));
  const draftRolesByCircle = new Map<string, GoalTreeRoleOption[]>();
  const draftRolesHasMoreByCircle = new Map<string, boolean>();
  const draftMetricsByCircle = new Map<string, GoalTreeMetricOption[]>();
  const draftMetricsHasMoreByCircle = new Map<string, boolean>();
  for (const circleRow of circleRows) {
    draftRolesByCircle.set(circleRow.id, circleRow.roles.slice(0, PREVIEW_LIMIT).map(toRoleOption));
    draftRolesHasMoreByCircle.set(circleRow.id, circleRow.roles.length > PREVIEW_LIMIT);
    draftMetricsByCircle.set(circleRow.id, circleRow.metricDefs.slice(0, PREVIEW_LIMIT));
    draftMetricsHasMoreByCircle.set(circleRow.id, circleRow.metricDefs.length > PREVIEW_LIMIT);
  }
  const goalsById = new Map(goalRows.map((row) => [row.id, row]));
  const activeGoalByCircle = new Map(
    [...goalRows]
      .filter((row) => row.status === "ACTIVE")
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || compareText(left.id, right.id))
      .map((row) => [row.circleId, row]),
  );

  const goalDetails = new Map<string, GoalTreeGoal>();
  for (const goalRow of goalRows) {
    const targets = goalRow.targets;
    const checkIns = targets.flatMap((target) => target.checkIns.map(toCheckInSnapshot));
    const health = targets.length === 0
      ? { status: goalRow.status === "ACTIVE" ? "NOT_UPDATED" as const : goalRow.status, targets: [] }
      : deriveGoalHealth({
          goal: { id: goalRow.id, status: goalRow.status },
          cycle: { endAt: cycleRow.endAt, checkInCadenceDays: cycleRow.checkInCadenceDays },
          targets: targets.map(toTargetSnapshot),
          checkIns,
          now: dependencies.now,
        });
    const evidenceByTarget = new Map(health.targets.map((row) => [row.targetId, row]));
    const role = goalRow.ownerRole;
    const gaps: GoalTreeGap[] = [];
    if (!role || role.status !== "ACTIVE") gaps.push(gap("OWNER_ROLE_INACTIVE", goalRow.circleId, goalRow.id));
    if (!role || role._count.assignees === 0) gaps.push(gap("OWNER_ROLE_UNASSIGNED", goalRow.circleId, goalRow.id));

    const projectedTargets = targets.map((target): GoalTreeTarget => {
      const targetEvidence = evidenceByTarget.get(target.id);
      const effectiveEvidence = targetEvidence?.effectiveCheckIn
        ? target.checkIns.find((row) => row.id === targetEvidence.effectiveCheckIn?.id) ?? null
        : null;
      if (!targetEvidence?.effectiveCheckIn) gaps.push(gap("MISSING_TARGET_EVIDENCE", goalRow.circleId, goalRow.id, target.id));
      else if (targetEvidence.stale) gaps.push(gap("STALE_TARGET_EVIDENCE", goalRow.circleId, goalRow.id, target.id));
      return {
        id: target.id,
        position: target.position,
        label: target.label,
        kind: target.kind,
        baselineValue: decimalText(target.baselineValue),
        desiredValue: decimalText(target.desiredValue),
        unit: target.unit,
        acceptanceCriteria: target.acceptanceCriteria,
        metric: target.metric,
        effectiveEvidence: effectiveEvidence ? toEvidenceProjection(effectiveEvidence) : null,
        evidenceIsStale: targetEvidence?.stale ?? false,
      };
    });

    goalDetails.set(goalRow.id, {
      id: goalRow.id,
      circleId: goalRow.circleId,
      title: goalRow.title,
      intendedOutcome: goalRow.intendedOutcome,
      status: goalRow.status,
      parentGoal: goalRow.parentGoal ? {
        id: goalRow.parentGoal.id,
        title: goalRow.parentGoal.title,
        url: goalUrl(cycleRow.id, goalRow.parentGoal.id),
      } : null,
      health: health.status,
      ownerRole: role ? toRoleOption(role) : null,
      targets: projectedTargets,
      workLinks: goalRow.workLinks.slice(0, PREVIEW_LIMIT).flatMap((row) => {
        const work = row.project ?? row.tension;
        const objectId = row.projectId ?? row.tensionId;
        if (!work || !objectId) return [];
        return [{
          id: row.id,
          kind: row.kind,
          objectId,
          label: "name" in work ? work.name : work.title,
          objectStatus: String(work.status),
          url: row.kind === "PROJECT"
            ? entityUrl("projects", objectId)
            : row.kind === "ACTION"
              ? entityUrl("tracker", objectId)
              : entityUrl("tensions", objectId),
          createdAt: row.createdAt,
        }];
      }),
      workLinksHasMore: goalRow.workLinks.length > PREVIEW_LIMIT,
      adoption: decisionProjection(goalRow.adoptedDecision),
      terminalDecision: decisionProjection(goalRow.terminalDecision),
      createdAt: goalRow.createdAt,
      terminalAt: goalRow.terminalAt,
      url: goalUrl(cycleRow.id, goalRow.id),
      gaps,
    });
  }

  const allGaps: GoalTreeGap[] = [];
  const nodes = cycleRow.status === "CLOSED"
    ? buildHistoricalNodes(goalRows, circlesById, goalDetails, allGaps)
    : cycleRow.status === "CANCELLED"
      ? []
      : buildCurrentNodes(
          cycleRow.status,
          circleRows,
          activeGoalByCircle,
          goalsById,
          goalDetails,
          draftRolesByCircle,
          draftRolesHasMoreByCircle,
          draftMetricsByCircle,
          draftMetricsHasMoreByCircle,
          allGaps,
        );
  const nodeIds = new Set(nodes.map((node) => node.id));
  const roots = nestNodes(nodes.filter((node) => node.parentId === null || nodeIds.has(node.parentId)));
  const nestedIds = collectNodeIds(roots);
  const detached = nestNodes(nodes.filter((node) => !nestedIds.has(node.id)));

  const proposalProjections = new Map(projectedProposalRows.map((proposal): [string, GoalTreeProposal] => {
    const revision = revisionRows.find((row) => row.proposalId === proposal.id && row.revision === proposal.currentRevision);
    const isProposer = proposal.proposer.id === viewerPersonId;
    return [proposal.id, {
      id: proposal.id,
      circleId: proposal.circleId,
      proposer: proposal.proposer,
      kind: proposal.kind,
      status: proposal.status,
      replacedGoalId: proposal.replacedGoalId,
      currentRevision: proposal.currentRevision,
      submittedAt: proposal.submittedAt,
      terminalAt: proposal.terminalAt,
      revision: revision ? {
        title: revision.title,
        intendedOutcome: revision.intendedOutcome,
        ownerRoleId: revision.ownerRoleId,
        ownerRole: revision.ownerRole ? toRoleOption(revision.ownerRole) : null,
        parentGoalId: revision.parentGoalId,
        closeResult: revision.closeResult,
        conclusion: revision.conclusion,
        authoredBy: revision.authoredBy,
        createdAt: revision.createdAt,
        targets: revision.targets.map((row) => ({
            id: row.id,
            position: row.position,
            label: row.label,
            kind: row.kind,
            baselineValue: decimalText(row.baselineValue),
            desiredValue: decimalText(row.desiredValue),
            unit: row.unit,
            acceptanceCriteria: row.acceptanceCriteria,
            metricId: row.metricId,
            metric: row.metric,
          })),
      } : null,
      capabilities: {
        canAppendRevision: isProposer && proposal.status === "RETURNED",
        canSubmit: isProposer && proposal.status === "DRAFT",
        canWithdraw: isProposer && ["DRAFT", "RETURNED", "SUBMITTED"].includes(proposal.status),
      },
    }];
  }));
  const proposals = visibleProposalRows.map((proposal) => proposalProjections.get(proposal.id)!);
  const actionableProposals = visibleActionableProposalRows.map((proposal) => proposalProjections.get(proposal.id)!);

  const selectedGoal = requestedGoalId
    ? nodes.find((node) => node.goal?.id === requestedGoalId)?.goal ?? null
    : firstGoal(roots) ?? firstGoal(detached);
  return {
    status: "READY",
    cycle: toCycleProjection(cycleRow),
    cycles,
    cyclesHasMore,
    roots,
    detached,
    proposals,
    actionableProposals,
    proposalPagination: pagination(proposalPage, proposalRows.length),
    gaps: deduplicateGaps(allGaps.concat([...goalDetails.values()].flatMap((goal) => goal.gaps))),
    selectedGoal,
    requestedGoalUnavailable: Boolean(requestedGoalId && !selectedGoal),
    capabilities: { canDraftProposal: cycleRow.status === "PLANNED" || cycleRow.status === "ACTIVE" },
  };
}

function buildCurrentNodes(
  cycleStatus: "PLANNED" | "ACTIVE",
  circleRows: Array<{ id: string; name: string; purpose: string; status: "NORMAL" | "WARNING" | "HALTED" | "ARCHIVED"; parentId: string | null }>,
  activeGoalByCircle: Map<string, { id: string; circleId: string; parentGoalId: string | null }>,
  goalsById: Map<string, { id: string; status: "ACTIVE" | "SUPERSEDED" | "ACHIEVED" | "NOT_ACHIEVED" }>,
  goalDetails: Map<string, GoalTreeGoal>,
  draftRolesByCircle: Map<string, GoalTreeRoleOption[]>,
  draftRolesHasMoreByCircle: Map<string, boolean>,
  draftMetricsByCircle: Map<string, GoalTreeMetricOption[]>,
  draftMetricsHasMoreByCircle: Map<string, boolean>,
  allGaps: GoalTreeGap[],
): GoalTreeNode[] {
  const visible = circleRows.filter((row) => row.status !== "ARCHIVED");
  const visibleIds = new Set(visible.map((row) => row.id));
  const rootCount = visible.filter((row) => row.parentId === null).length;
  if (rootCount === 0) allGaps.push(gap("ROOT_CIRCLE_MISSING"));
  if (rootCount > 1) allGaps.push(gap("ROOT_CIRCLE_MULTIPLE"));

  return visible.map((circle): GoalTreeNode => {
    const activeGoal = activeGoalByCircle.get(circle.id);
    const detail = activeGoal ? goalDetails.get(activeGoal.id) ?? null : null;
    const gaps: GoalTreeGap[] = [];
    if (circle.parentId && !visibleIds.has(circle.parentId)) gaps.push(gap("VISIBLE_PARENT_MISSING", circle.id));
    if (cycleStatus === "ACTIVE" && !activeGoal) gaps.push(gap("MISSING_GOAL", circle.id));
    if (activeGoal && circle.parentId) {
      const parentGoal = activeGoalByCircle.get(circle.parentId);
      if (!activeGoal.parentGoalId || !goalsById.has(activeGoal.parentGoalId)) {
        gaps.push(gap("MISSING_PARENT_SUPPORT", circle.id, activeGoal.id));
      } else if (!parentGoal || activeGoal.parentGoalId !== parentGoal.id || goalsById.get(activeGoal.parentGoalId)?.status !== "ACTIVE") {
        gaps.push(gap("STALE_PARENT_SUPPORT", circle.id, activeGoal.id));
      }
    } else if (activeGoal?.parentGoalId) {
      gaps.push(gap("STALE_PARENT_SUPPORT", circle.id, activeGoal.id));
    }
    allGaps.push(...gaps);
    return {
      id: circle.id,
      parentId: circle.parentId && visibleIds.has(circle.parentId) ? circle.parentId : null,
      circle: toCircleProjection(circle),
      goal: detail,
      capabilities: {
        canDraftCreate: !activeGoal && (
          circle.parentId === null
          || (visibleIds.has(circle.parentId) && activeGoalByCircle.has(circle.parentId))
        ),
        canDraftReplace: Boolean(activeGoal),
        canDraftClose: Boolean(activeGoal),
      },
      draftOwnerRoles: draftRolesByCircle.get(circle.id) ?? [],
      draftOwnerRolesHasMore: draftRolesHasMoreByCircle.get(circle.id) ?? false,
      draftMetrics: draftMetricsByCircle.get(circle.id) ?? [],
      draftMetricsHasMore: draftMetricsHasMoreByCircle.get(circle.id) ?? false,
      gaps: gaps.concat(detail?.gaps ?? []),
      children: [],
    };
  });
}

function buildHistoricalNodes(
  goalRows: Array<{ id: string; circleId: string; parentGoalId: string | null }>,
  circlesById: Map<string, GoalTreeCircle>,
  goalDetails: Map<string, GoalTreeGoal>,
  allGaps: GoalTreeGap[],
): GoalTreeNode[] {
  const goalIds = new Set(goalRows.map((row) => row.id));
  return goalRows.flatMap((goal): GoalTreeNode[] => {
    const circle = circlesById.get(goal.circleId);
    const detail = goalDetails.get(goal.id);
    if (!circle || !detail) return [];
    const gaps: GoalTreeGap[] = [];
    if (goal.parentGoalId && !goalIds.has(goal.parentGoalId)) {
      gaps.push(gap("MISSING_PARENT_SUPPORT", goal.circleId, goal.id));
      allGaps.push(...gaps);
    }
    return [{
      id: goal.id,
      parentId: goal.parentGoalId && goalIds.has(goal.parentGoalId) ? goal.parentGoalId : null,
      circle,
      goal: detail,
      capabilities: { canDraftCreate: false, canDraftReplace: false, canDraftClose: false },
      draftOwnerRoles: [],
      draftOwnerRolesHasMore: false,
      draftMetrics: [],
      draftMetricsHasMore: false,
      gaps: gaps.concat(detail.gaps),
      children: [],
    }];
  });
}

function nestNodes(nodes: GoalTreeNode[]): GoalTreeNode[] {
  const copies = new Map(nodes.map((node) => [node.id, { ...node, children: [] as GoalTreeNode[] }]));
  const roots: GoalTreeNode[] = [];
  for (const node of copies.values()) {
    const parent = node.parentId ? copies.get(node.parentId) : null;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (items: GoalTreeNode[]): GoalTreeNode[] => items
    .sort((left, right) => compareText(left.circle.name, right.circle.name) || compareText(left.id, right.id))
    .map((node) => ({ ...node, children: sort(node.children) }));
  return sort(roots);
}

function collectNodeIds(nodes: GoalTreeNode[]): Set<string> {
  const ids = new Set<string>();
  const visit = (node: GoalTreeNode) => {
    if (ids.has(node.id)) return;
    ids.add(node.id);
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return ids;
}

function firstGoal(nodes: GoalTreeNode[]): GoalTreeGoal | null {
  for (const node of nodes) {
    if (node.goal) return node.goal;
    const childGoal = firstGoal(node.children);
    if (childGoal) return childGoal;
  }
  return null;
}

function toCycleProjection(row: {
  id: string;
  name: string;
  status: "PLANNED" | "ACTIVE" | "CLOSED" | "CANCELLED";
  startAt: Date;
  endAt: Date;
  checkInCadenceDays: number;
}): GoalTreeCycle {
  return { ...row, url: goalUrl(row.id) };
}

function toCircleProjection(row: {
  id: string;
  name: string;
  purpose: string;
  status: "NORMAL" | "WARNING" | "HALTED" | "ARCHIVED";
  parentId: string | null;
}): GoalTreeCircle {
  return { ...row, url: entityUrl("circles", row.id), factTime: "CURRENT" };
}

function toRoleOption(row: {
  id: string;
  circleId: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  assignees: Array<{ id: string; name: string }>;
  _count: { assignees: number };
}): GoalTreeRoleOption {
  return {
    id: row.id,
    circleId: row.circleId,
    name: row.name,
    status: row.status,
    assignees: row.assignees.slice(0, ASSIGNEE_PREVIEW_LIMIT),
    assigneeCount: row._count.assignees,
    assigneesHasMore: row._count.assignees > ASSIGNEE_PREVIEW_LIMIT,
    factTime: "CURRENT",
  };
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

function toEvidenceProjection(row: {
  id: string;
  fact: string;
  evidenceSummary: string;
  currentValue: unknown;
  milestoneCompleted: boolean | null;
  acceptanceEvidence: string | null;
  assessment: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "ACHIEVED";
  recorder: { id: string; name: string };
  meetingId: string | null;
  sourceUrl: string | null;
  supersedesCheckInId: string | null;
  recordedAt: Date;
}): GoalTreeEvidence {
  return {
    id: row.id,
    fact: row.fact,
    evidenceSummary: row.evidenceSummary,
    currentValue: decimalText(row.currentValue),
    milestoneCompleted: row.milestoneCompleted,
    acceptanceEvidence: row.acceptanceEvidence,
    assessment: row.assessment,
    recorder: { id: row.recorder.id, name: row.recorder.name },
    meetingId: row.meetingId,
    meetingUrl: row.meetingId ? entityUrl("meetings", row.meetingId) : null,
    sourceUrl: row.sourceUrl,
    isCorrection: row.supersedesCheckInId !== null,
    recordedAt: row.recordedAt,
  };
}

function decisionProjection(row: {
  id: string;
  revision: number;
  outcome: "ADOPTED" | "RETURNED" | "DECLINED";
  meetingId: string;
  decidedAt: Date;
  proposal: { kind: "CREATE" | "REPLACE" | "CLOSE" };
  revisionRecord: { title: string | null; conclusion: string | null };
  recorder: { id: string; name: string };
} | null | undefined): GoalTreeDecisionSource | null {
  return row ? {
    id: row.id,
    proposalKind: row.proposal.kind,
    proposalTitle: row.revisionRecord.title ?? row.revisionRecord.conclusion,
    revision: row.revision,
    outcome: row.outcome,
    meetingId: row.meetingId,
    meetingUrl: entityUrl("meetings", row.meetingId),
    recorder: row.recorder,
    decidedAt: row.decidedAt,
  } : null;
}

function goalUrl(cycleId: string, goalId?: string): string {
  const cycle = encodeURIComponent(cycleId);
  const goal = goalId ? `&goal=${encodeURIComponent(goalId)}` : "";
  return withBasePath(`/app/goals?cycle=${cycle}${goal}` as `/${string}`);
}

function entityUrl(kind: "circles" | "meetings" | "projects" | "tensions" | "tracker", id: string): string {
  return withBasePath(`/app/${kind}/${encodeURIComponent(id)}` as `/${string}`);
}

function gap(code: GoalTreeGapCode, circleId: string | null = null, goalId: string | null = null, targetId: string | null = null): GoalTreeGap {
  return { code, circleId, goalId, targetId };
}

function deduplicateGaps(gaps: GoalTreeGap[]): GoalTreeGap[] {
  const seen = new Set<string>();
  return gaps.filter((item) => {
    const key = `${item.code}:${item.circleId ?? ""}:${item.goalId ?? ""}:${item.targetId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function decimalText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "object" && value !== null && "toString" in value
    ? String((value as { toString(): string }).toString())
    : String(value);
}

function normalizeOptionalId(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

function normalizePage(value: number | undefined): number {
  return Number.isSafeInteger(value) && value !== undefined && value > 0 && value <= MAX_PAGE
    ? value
    : 1;
}

function pagination(page: number, rowCount: number): GoalTreePagination {
  return {
    page,
    pageSize: PREVIEW_LIMIT,
    hasPrevious: page > 1,
    hasNext: rowCount > PREVIEW_LIMIT,
  };
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
