import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

import type { GoalTreeNode } from "./read-model";

type ReadModelModule = typeof import("./read-model");

const require = createRequire(import.meta.url);
const originalNodePath = process.env.NODE_PATH;
const originalBasePath = process.env.NEXT_PUBLIC_BASE_PATH;
const compiledModules = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../node_modules/next/dist/compiled",
);
const moduleWithInitPaths = Module as typeof Module & { _initPaths(): void };
let originalServerOnlyModule: NodeJS.Module | undefined;
let serverOnlyPath = "";
let queryGoalTree: ReadModelModule["queryGoalTree"];

before(async () => {
  process.env.NODE_PATH = originalNodePath
    ? `${compiledModules}:${originalNodePath}`
    : compiledModules;
  process.env.NEXT_PUBLIC_BASE_PATH = "/loopos";
  moduleWithInitPaths._initPaths();
  serverOnlyPath = require.resolve("server-only");
  originalServerOnlyModule = require.cache[serverOnlyPath];
  const serverOnlyShim = new Module(serverOnlyPath);
  serverOnlyShim.filename = serverOnlyPath;
  serverOnlyShim.loaded = true;
  require.cache[serverOnlyPath] = serverOnlyShim;
  ({ queryGoalTree } = await import("./read-model"));
});

after(() => {
  if (originalServerOnlyModule) require.cache[serverOnlyPath] = originalServerOnlyModule;
  else delete require.cache[serverOnlyPath];
  if (originalNodePath === undefined) delete process.env.NODE_PATH;
  else process.env.NODE_PATH = originalNodePath;
  if (originalBasePath === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
  else process.env.NEXT_PUBLIC_BASE_PATH = originalBasePath;
  moduleWithInitPaths._initPaths();
});

const now = new Date("2026-07-15T08:00:00.000Z");
const future = new Date("2026-08-15T08:00:00.000Z");

type Row = Record<string, unknown>;
type Call = { model: string; operation: "findFirst" | "findMany"; args: Record<string, unknown> };

class FakePrisma {
  readonly calls: Call[] = [];
  readonly prisma: Record<string, { findFirst(args: Record<string, unknown>): Promise<Row | null>; findMany(args: Record<string, unknown>): Promise<Row[]> }>;

  constructor(private readonly tables: Record<string, Row[]>) {
    this.prisma = Object.fromEntries(
      [
        "person",
        "goalCycle",
        "circle",
        "goal",
        "goalProposal",
        "goalTarget",
        "goalCheckIn",
        "goalWorkLink",
        "roleDef",
        "goalDecision",
        "goalProposalRevision",
        "goalProposalTarget",
        "project",
        "tension",
        "metric",
      ].map((model) => [model, {
        findFirst: async (args: Record<string, unknown>) => this.read(model, "findFirst", args)[0] ?? null,
        findMany: async (args: Record<string, unknown>) => this.read(model, "findMany", args),
      }]),
    );
  }

  dependencies() {
    return { prisma: this.prisma as never, now };
  }

  private read(model: string, operation: Call["operation"], args: Record<string, unknown>): Row[] {
    this.calls.push({ model, operation, args });
    const where = (args.where ?? {}) as Record<string, unknown>;
    const rows = (this.tables[model] ?? []).filter((row) => matches(row, where));
    const ordered = applyOrder(rows, args.orderBy);
    const skipped = typeof args.skip === "number" ? ordered.slice(args.skip) : ordered;
    const bounded = typeof args.take === "number" ? skipped.slice(0, args.take) : skipped;
    return bounded.map((row) => this.hydrate(model, row, args.select as Row | undefined));
  }

  private hydrate(model: string, source: Row, select: Row | undefined): Row {
    const row = { ...source };
    if (model === "circle") {
      row.roles = this.nested("roleDef", {
        ...(select?.roles as Row | undefined),
        where: { ...((select?.roles as Row | undefined)?.where as Row), circleId: row.id },
      }).map((roleRow) => this.roleProjection(String(roleRow.id), select?.roles as Row | undefined));
      row.metricDefs = this.nested("metric", {
        ...(select?.metricDefs as Row | undefined),
        where: { ...((select?.metricDefs as Row | undefined)?.where as Row), circleId: row.id },
      });
    }
    if (model === "goal") {
      row.ownerRole = this.roleProjection(String(row.ownerRoleId), select?.ownerRole as Row | undefined);
      row.parentGoal = row.parentGoalId
        ? this.tables.goal?.find((candidate) => candidate.id === row.parentGoalId && candidate.organizationId === row.organizationId) ?? null
        : null;
      row.targets = this.nested("goalTarget", {
        ...(select?.targets as Row | undefined),
        where: { ...((select?.targets as Row | undefined)?.where as Row), goalId: row.id },
      }).map((targetRow) => this.targetProjection(targetRow, select?.targets as Row | undefined));
      row.workLinks = this.nested("goalWorkLink", {
        ...(select?.workLinks as Row | undefined),
        where: { ...((select?.workLinks as Row | undefined)?.where as Row), goalId: row.id },
      }).map((link) => ({
        ...link,
        project: link.projectId ? this.tables.project?.find((candidate) => candidate.id === link.projectId && candidate.organizationId === row.organizationId) ?? null : null,
        tension: link.tensionId ? this.tables.tension?.find((candidate) => candidate.id === link.tensionId && candidate.organizationId === row.organizationId) ?? null : null,
      }));
      row.adoptedDecision = this.decisionProjection(row.adoptedDecisionId);
      row.terminalDecision = this.decisionProjection(row.terminalDecisionId);
    }
    if (model === "goalProposalRevision") {
      row.ownerRole = row.ownerRoleId
        ? this.roleProjection(String(row.ownerRoleId), (select?.ownerRole as Row | undefined))
        : null;
      row.authoredBy = this.tables.person?.find((candidate) => candidate.id === row.authoredById && candidate.organizationId === row.organizationId) ?? null;
      row.targets = this.nested("goalProposalTarget", {
        ...(select?.targets as Row | undefined),
        where: {
          ...((select?.targets as Row | undefined)?.where as Row),
          proposalId: row.proposalId,
          revision: row.revision,
        },
      }).map((targetRow) => this.targetProjection(targetRow, select?.targets as Row | undefined));
    }
    if (model === "goalProposal") {
      row.proposer = this.tables.person?.find((candidate) => candidate.id === row.proposerId && candidate.organizationId === row.organizationId) ?? null;
    }
    if (model === "roleDef") return this.roleProjection(String(row.id), select) ?? row;
    return row;
  }

  private nested(model: string, args: Row | undefined): Row[] {
    if (!args) return [];
    const where = (args.where ?? {}) as Row;
    const ordered = applyOrder((this.tables[model] ?? []).filter((row) => matches(row, where)), args.orderBy);
    return typeof args.take === "number" ? ordered.slice(0, args.take) : ordered;
  }

  private roleProjection(id: string, relation: Row | undefined): Row | null {
    const source = this.tables.roleDef?.find((row) => row.id === id);
    if (!source) return null;
    const assigneeArgs = ((relation?.select as Row | undefined)?.assignees ?? relation?.assignees) as Row | undefined;
    const assignees = applyOrder(
      ((source.assignees as Row[]) ?? []).filter((row) => matches(row, (assigneeArgs?.where ?? {}) as Row)),
      assigneeArgs?.orderBy,
    );
    return {
      ...source,
      assignees: (typeof assigneeArgs?.take === "number" ? assignees.slice(0, assigneeArgs.take) : assignees)
        .map(({ id: assigneeId, name }) => ({ id: assigneeId, name })),
      _count: { assignees: ((source.assignees as Row[]) ?? []).length },
    };
  }

  private targetProjection(source: Row, relation: Row | undefined): Row {
    const nestedSelect = relation?.select as Row | undefined;
    const checkInArgs = nestedSelect?.checkIns as Row | undefined;
    const supersededIds = new Set<unknown>((this.tables.goalCheckIn ?? []).flatMap((row) => row.supersedesCheckInId ? [row.supersedesCheckInId] : []));
    const checkIns = applyOrder(
      (this.tables.goalCheckIn ?? []).filter((row) => row.targetId === source.id && !supersededIds.has(row.id)),
      checkInArgs?.orderBy,
    );
    const bounded = typeof checkInArgs?.take === "number" ? checkIns.slice(0, checkInArgs.take) : checkIns;
    return {
      ...source,
      metric: source.metricId
        ? this.tables.metric?.find((row) => row.id === source.metricId && row.organizationId === source.organizationId) ?? null
        : null,
      checkIns: bounded.map((row) => ({
        ...row,
        recorder: this.tables.person?.find((personRow) => personRow.id === row.recorderId && personRow.organizationId === row.organizationId) ?? null,
      })),
    };
  }

  private decisionProjection(id: unknown): Row | null {
    if (!id) return null;
    const source = this.tables.goalDecision?.find((row) => row.id === id);
    if (!source) return null;
    const proposalRow = this.tables.goalProposal?.find((row) => row.id === source.proposalId);
    const revisionRow = this.tables.goalProposalRevision?.find((row) => row.proposalId === source.proposalId && row.revision === source.revision);
    return {
      ...source,
      proposal: proposalRow ? { id: proposalRow.id, kind: proposalRow.kind } : null,
      revisionRecord: revisionRow ?? null,
      recorder: this.tables.person?.find((row) => row.id === source.recorderId && row.organizationId === source.organizationId) ?? null,
    };
  }
}

function matches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (key === "supersededBy") return true;
    if (key === "OR") {
      return (expected as Record<string, unknown>[]).some((branch) => matches(row, branch));
    }
    if (expected && typeof expected === "object" && "in" in expected) {
      return (expected as { in: unknown[] }).in.includes(row[key]);
    }
    return row[key] === expected;
  });
}

function applyOrder(rows: Row[], orderBy: unknown): Row[] {
  if (!Array.isArray(orderBy)) return [...rows];
  return [...rows].sort((left, right) => {
    for (const clause of orderBy as Record<string, "asc" | "desc">[]) {
      const [field, direction] = Object.entries(clause)[0];
      const a = left[field];
      const b = right[field];
      const comparison = a instanceof Date && b instanceof Date
        ? a.getTime() - b.getTime()
        : String(a).localeCompare(String(b));
      if (comparison !== 0) return direction === "desc" ? -comparison : comparison;
    }
    return 0;
  });
}

function person(id = "viewer-a", organizationId = "org-a", name = "Viewer A"): Row {
  return { id, organizationId, name };
}

function cycle(
  id: string,
  status: "PLANNED" | "ACTIVE" | "CLOSED" | "CANCELLED",
  startAt: Date,
  organizationId = "org-a",
): Row {
  return {
    id,
    organizationId,
    name: id,
    status,
    startAt,
    endAt: future,
    checkInCadenceDays: 7,
  };
}

function circle(id: string, parentId: string | null, status = "NORMAL", organizationId = "org-a"): Row {
  return { id, organizationId, name: id, purpose: `${id} purpose`, status, parentId };
}

function role(
  id: string,
  circleId: string,
  status: "ACTIVE" | "PAUSED" | "ARCHIVED" = "ACTIVE",
  assignees: Row[] = [{ id: `${id}-assignee`, name: `${id} assignee` }],
  organizationId = "org-a",
): Row {
  return {
    id,
    organizationId,
    circleId,
    name: id,
    status,
    assignees: assignees.map((assignee) => ({ ...assignee, organizationId: assignee.organizationId ?? organizationId })),
  };
}

function metric(id: string, circleId: string, name = id, organizationId = "org-a"): Row {
  return { id, organizationId, circleId, name };
}

function goal(
  id: string,
  cycleId: string,
  circleId: string,
  ownerRoleId: string,
  parentGoalId: string | null = null,
  status: "ACTIVE" | "SUPERSEDED" | "ACHIEVED" | "NOT_ACHIEVED" = "ACTIVE",
  organizationId = "org-a",
): Row {
  return {
    id,
    organizationId,
    cycleId,
    circleId,
    title: id,
    intendedOutcome: `${id} outcome`,
    ownerRoleId,
    parentGoalId,
    status,
    adoptedDecisionId: null,
    terminalDecisionId: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    terminalAt: status === "ACTIVE" ? null : new Date("2026-07-10T00:00:00.000Z"),
  };
}

function target(id: string, goalId: string, position = 0, organizationId = "org-a"): Row {
  return {
    id,
    organizationId,
    goalId,
    sourceProposalTargetId: `source-${id}`,
    position,
    label: id,
    kind: "NUMERIC",
    baselineValue: "0",
    desiredValue: "100",
    unit: "%",
    acceptanceCriteria: null,
    metricId: null,
  };
}

function checkIn(
  id: string,
  goalId: string,
  targetId: string,
  assessment: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "ACHIEVED",
  recordedAt: Date,
  supersedesCheckInId: string | null = null,
  organizationId = "org-a",
): Row {
  return {
    id,
    organizationId,
    goalId,
    targetId,
    fact: `${id} fact`,
    evidenceSummary: `${id} evidence`,
    currentValue: assessment === "ACHIEVED" ? "100" : "50",
    milestoneCompleted: null,
    acceptanceEvidence: null,
    assessment,
    recorderId: "viewer-a",
    meetingId: null,
    sourceUrl: null,
    supersedesCheckInId,
    recordedAt,
  };
}

function proposal(
  id: string,
  cycleId: string,
  proposerId: string,
  status: "DRAFT" | "SUBMITTED" | "ADOPTED" | "RETURNED" | "DECLINED" | "WITHDRAWN",
  currentRevision: number,
  circleId = "root",
  organizationId = "org-a",
): Row {
  return {
    id,
    organizationId,
    cycleId,
    circleId,
    proposerId,
    kind: "CREATE",
    status,
    replacedGoalId: null,
    currentRevision,
    submittedAt: null,
    terminalAt: null,
    createdAt: now,
  };
}

function revision(
  proposalId: string,
  revisionNumber: number,
  ownerRoleId = "role-root-active",
  organizationId = "org-a",
): Row {
  return {
    proposalId,
    organizationId,
    revision: revisionNumber,
    title: `${proposalId} revision ${revisionNumber}`,
    intendedOutcome: "Outcome",
    ownerRoleId,
    parentGoalId: null,
    closeResult: null,
    conclusion: null,
    authoredById: "viewer-a",
    createdAt: now,
  };
}

function baseTables(cycles: Row[]): Record<string, Row[]> {
  return {
    person: [person()],
    goalCycle: cycles,
    circle: [],
    goal: [],
    goalProposal: [],
    goalTarget: [],
    goalCheckIn: [],
    goalWorkLink: [],
    roleDef: [],
    goalDecision: [],
    goalProposalRevision: [],
    goalProposalTarget: [],
    project: [],
    tension: [],
    metric: [],
  };
}

function ready<T>(projection: T): Extract<T, { status: "READY" }> {
  assert.equal((projection as { status: string }).status, "READY");
  return projection as Extract<T, { status: "READY" }>;
}

function flattenNodes(nodes: GoalTreeNode[]): GoalTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);
}

test("every query is tenant-scoped and an invisible requested cycle never falls back", async () => {
  const tables = baseTables([cycle("active-a", "ACTIVE", new Date("2026-07-01"))]);
  tables.person.push(person("viewer-b", "org-b", "Tenant B"));
  tables.goalCycle.push(cycle("cycle-b", "ACTIVE", new Date("2026-07-02"), "org-b"));
  tables.circle.push(circle("root", null), circle("root-b", null, "NORMAL", "org-b"));
  tables.roleDef.push(role("role-root-active", "root"), role("role-b", "root-b", "ACTIVE", [], "org-b"));
  const goalA = goal("goal-a", "active-a", "root", "role-root-active");
  goalA.adoptedDecisionId = "decision-a";
  tables.goal.push(goalA, goal("goal-b", "cycle-b", "root-b", "role-b", null, "ACTIVE", "org-b"));
  tables.goalTarget.push(target("target-a", "goal-a"), target("target-b", "goal-b", 0, "org-b"));
  tables.goalCheckIn.push(checkIn("check-a", "goal-a", "target-a", "ON_TRACK", now), checkIn("check-b", "goal-b", "target-b", "ACHIEVED", now, null, "org-b"));
  tables.goalWorkLink.push({ id: "link-a", organizationId: "org-a", goalId: "goal-a", kind: "PROJECT", status: "ACTIVE", projectId: "project-a", tensionId: null, createdAt: now });
  tables.goalWorkLink.push({ id: "link-tension-a", organizationId: "org-a", goalId: "goal-a", kind: "BLOCKING_TENSION", status: "ACTIVE", projectId: null, tensionId: "tension-a", createdAt: now });
  tables.project.push({ id: "project-a", organizationId: "org-a", name: "Project A", status: "ACTIVE" });
  tables.tension.push({ id: "tension-a", organizationId: "org-a", title: "Tension A", status: "OPEN" });
  tables.goalDecision.push({ id: "decision-a", organizationId: "org-a", proposalId: "proposal-a", revision: 1, outcome: "ADOPTED", meetingId: "meeting-a", recorderId: "viewer-a", decidedAt: now });
  tables.goalProposal.push(proposal("proposal-a", "active-a", "viewer-a", "DRAFT", 1));
  tables.goalProposalRevision.push(revision("proposal-a", 1));
  tables.goalProposalTarget.push({ ...target("proposal-target-a", "unused"), proposalId: "proposal-a", revision: 1 });

  const fake = new FakePrisma(tables);
  const projection = ready(await queryGoalTree({ organizationId: "org-a", viewerPersonId: "viewer-a" }, fake.dependencies()));
  assert.equal(projection.cycle.id, "active-a");
  assert.equal(projection.selectedGoal?.adoption?.recorder.name, "Viewer A");
  assert.equal(projection.selectedGoal?.adoption?.proposalTitle, "proposal-a revision 1");
  assert.equal(JSON.stringify(projection).includes("goal-b"), false);
  assert.ok(fake.calls.length >= 8);
  for (const call of fake.calls) {
    assert.equal((call.args.where as Row).organizationId, "org-a", `${call.model}.${call.operation} must be tenant-scoped`);
  }

  const unavailable = await queryGoalTree(
    { organizationId: "org-a", viewerPersonId: "viewer-a", cycleId: "cycle-b" },
    new FakePrisma(tables).dependencies(),
  );
  assert.deepEqual(
    { status: unavailable.status, reason: unavailable.status === "NOT_AVAILABLE" ? unavailable.reason : null },
    { status: "NOT_AVAILABLE", reason: "CYCLE_NOT_FOUND" },
  );
});

test("default cycle selection prefers ACTIVE, then newest PLANNED, then newest historical", async () => {
  const rows = [
    cycle("planned-a", "PLANNED", new Date("2026-09-01")),
    cycle("planned-b", "PLANNED", new Date("2026-09-01")),
    cycle("active", "ACTIVE", new Date("2026-06-01")),
    cycle("cancelled", "CANCELLED", new Date("2026-05-01")),
    cycle("closed", "CLOSED", new Date("2026-04-01")),
  ];
  assert.equal(ready(await queryGoalTree({ organizationId: "org-a", viewerPersonId: "viewer-a" }, new FakePrisma(baseTables(rows)).dependencies())).cycle.id, "active");

  assert.equal(ready(await queryGoalTree(
    { organizationId: "org-a", viewerPersonId: "viewer-a" },
    new FakePrisma(baseTables(rows.filter((row) => row.status !== "ACTIVE"))).dependencies(),
  )).cycle.id, "planned-a");

  assert.equal(ready(await queryGoalTree(
    { organizationId: "org-a", viewerPersonId: "viewer-a" },
    new FakePrisma(baseTables(rows.filter((row) => row.status === "CLOSED" || row.status === "CANCELLED"))).dependencies(),
  )).cycle.id, "cancelled");
});

test("current trees expose structural, ownership, support, and evidence gaps while PLANNED omits missing goals", async () => {
  const tables = baseTables([cycle("active", "ACTIVE", new Date("2026-07-01"))]);
  tables.circle.push(
    circle("root", null),
    circle("second-root", null),
    circle("orphan", "hidden-parent"),
    circle("missing-support", "root"),
    circle("stale-support", "root"),
  );
  tables.roleDef.push(
    role("role-root", "root", "PAUSED", []),
    role("role-child", "missing-support"),
    role("role-stale", "stale-support"),
  );
  tables.goal.push(
    goal("goal-root", "active", "root", "role-root"),
    goal("goal-child", "active", "missing-support", "role-child"),
    goal("goal-stale", "active", "stale-support", "role-stale", "old-parent"),
    goal("old-parent", "active", "root", "role-root", null, "SUPERSEDED"),
  );
  tables.goalTarget.push(target("missing-evidence", "goal-root"), target("stale-evidence", "goal-child"));
  tables.goalCheckIn.push(checkIn("stale-check", "goal-child", "stale-evidence", "ON_TRACK", new Date("2026-07-01T00:00:00.000Z")));

  const active = ready(await queryGoalTree({ organizationId: "org-a", viewerPersonId: "viewer-a" }, new FakePrisma(tables).dependencies()));
  const codes = new Set(active.gaps.map((gap) => gap.code));
  for (const code of [
    "ROOT_CIRCLE_MULTIPLE",
    "VISIBLE_PARENT_MISSING",
    "MISSING_GOAL",
    "MISSING_PARENT_SUPPORT",
    "STALE_PARENT_SUPPORT",
    "OWNER_ROLE_INACTIVE",
    "OWNER_ROLE_UNASSIGNED",
    "MISSING_TARGET_EVIDENCE",
    "STALE_TARGET_EVIDENCE",
  ]) assert.ok(codes.has(code as never), `missing ${code}`);

  const noRootTables = baseTables([cycle("no-root", "ACTIVE", new Date("2026-07-01"))]);
  noRootTables.circle.push(circle("child-only", "absent"));
  const noRoot = ready(await queryGoalTree({ organizationId: "org-a", viewerPersonId: "viewer-a" }, new FakePrisma(noRootTables).dependencies()));
  assert.ok(noRoot.gaps.some((gap) => gap.code === "ROOT_CIRCLE_MISSING"));

  const plannedTables = { ...tables, goalCycle: [cycle("planned", "PLANNED", new Date("2026-07-01"))], goal: [], goalTarget: [], goalCheckIn: [] };
  const planned = ready(await queryGoalTree({ organizationId: "org-a", viewerPersonId: "viewer-a" }, new FakePrisma(plannedTables).dependencies()));
  assert.equal(planned.gaps.some((gap) => gap.code === "MISSING_GOAL"), false);
});

test("a child Circle can draft-create only when its visible parent has a current active Goal", async () => {
  const tables = baseTables([cycle("active", "ACTIVE", new Date("2026-07-01"))]);
  tables.circle.push(circle("root", null), circle("child", "root"));
  tables.roleDef.push(role("role-root", "root"));

  const withoutParentGoal = ready(await queryGoalTree(
    { organizationId: "org-a", viewerPersonId: "viewer-a" },
    new FakePrisma(tables).dependencies(),
  ));
  const rootWithoutGoal = flattenNodes(withoutParentGoal.roots).find((node) => node.circle.id === "root");
  const childWithoutParentGoal = flattenNodes(withoutParentGoal.roots).find((node) => node.circle.id === "child");
  assert.equal(rootWithoutGoal?.capabilities.canDraftCreate, true);
  assert.equal(childWithoutParentGoal?.capabilities.canDraftCreate, false);
  assert.equal(childWithoutParentGoal?.gaps.some((item) => item.code === "MISSING_GOAL"), true);

  tables.goal.push(goal("goal-root", "active", "root", "role-root"));
  const withParentGoal = ready(await queryGoalTree(
    { organizationId: "org-a", viewerPersonId: "viewer-a" },
    new FakePrisma(tables).dependencies(),
  ));
  const childWithParentGoal = flattenNodes(withParentGoal.roots).find((node) => node.circle.id === "child");
  assert.equal(childWithParentGoal?.capabilities.canDraftCreate, true);
});

test("same-cycle non-current Goal deep links are unavailable without becoming selected", async () => {
  const tables = baseTables([cycle("active", "ACTIVE", new Date("2026-07-01"))]);
  tables.circle.push(circle("root", null));
  tables.roleDef.push(role("role-root", "root"));
  tables.goal.push(
    goal("goal-current", "active", "root", "role-root"),
    goal("goal-superseded", "active", "root", "role-root", null, "SUPERSEDED"),
    goal("goal-terminal", "active", "root", "role-root", null, "ACHIEVED"),
  );

  for (const goalId of ["goal-superseded", "goal-terminal"]) {
    const projection = ready(await queryGoalTree(
      { organizationId: "org-a", viewerPersonId: "viewer-a", cycleId: "active", goalId },
      new FakePrisma(tables).dependencies(),
    ));
    assert.equal(projection.selectedGoal, null, `${goalId} must not become selected`);
    assert.equal(projection.requestedGoalUnavailable, true, `${goalId} must be unavailable`);
  }
});

test("effective corrections, current roles, work links, requested goals, and proposal capabilities project exactly", async () => {
  const tables = baseTables([cycle("active / one", "ACTIVE", new Date("2026-07-01"))]);
  tables.person.push(person("other", "org-a", "Other"));
  tables.circle.push(circle("root", null), circle("child", "root"));
  tables.roleDef.push(
    role("role-root-active", "root"),
    role("role-root-paused", "root", "PAUSED"),
    role("role-child-active", "child"),
  );
  tables.goal.push(
    goal("goal / one", "active / one", "root", "role-root-active", "parent-history"),
    goal("parent-history", "active / one", "root", "role-root-active", null, "SUPERSEDED"),
  );
  tables.goalTarget.push(target("target", "goal / one"));
  tables.goalCheckIn.push(
    checkIn("old", "goal / one", "target", "OFF_TRACK", new Date(now.getTime() - 1_000)),
    checkIn("correction", "goal / one", "target", "ACHIEVED", now, "old"),
  );
  tables.goalWorkLink.push(
    { id: "project-link", organizationId: "org-a", goalId: "goal / one", kind: "PROJECT", status: "ACTIVE", projectId: "project / 1", tensionId: null, createdAt: now },
    { id: "action-link", organizationId: "org-a", goalId: "goal / one", kind: "ACTION", status: "ACTIVE", projectId: null, tensionId: "action / 1", createdAt: now },
    { id: "tension-link", organizationId: "org-a", goalId: "goal / one", kind: "BLOCKING_TENSION", status: "ACTIVE", projectId: null, tensionId: "tension / 1", createdAt: now },
  );
  tables.project.push({ id: "project / 1", organizationId: "org-a", name: "Project", status: "ACTIVE" });
  tables.tension.push(
    { id: "action / 1", organizationId: "org-a", title: "Action", status: "OPEN" },
    { id: "tension / 1", organizationId: "org-a", title: "Tension", status: "OPEN" },
  );
  tables.goalProposal.push(
    proposal("mine-draft", "active / one", "viewer-a", "DRAFT", 2),
    proposal("mine-returned", "active / one", "viewer-a", "RETURNED", 1),
    proposal("other-draft", "active / one", "other", "DRAFT", 1),
  );
  tables.goalProposalRevision.push(
    revision("mine-draft", 1, "role-root-paused"),
    revision("mine-draft", 2),
    revision("mine-returned", 1),
    { ...revision("other-draft", 1), authoredById: "other" },
  );

  const projection = ready(await queryGoalTree(
    { organizationId: "org-a", viewerPersonId: "viewer-a", cycleId: "active / one", goalId: "goal / one" },
    new FakePrisma(tables).dependencies(),
  ));
  assert.equal(projection.selectedGoal?.health, "ACHIEVED");
  assert.equal(projection.selectedGoal?.parentGoal?.title, "parent-history");
  assert.equal(projection.selectedGoal?.parentGoal?.url, "/loopos/app/goals?cycle=active%20%2F%20one&goal=parent-history");
  assert.equal(projection.selectedGoal?.targets[0].effectiveEvidence?.id, "correction");
  assert.deepEqual(projection.selectedGoal?.workLinks.map((link) => [link.kind, link.url]).sort(), [
    ["ACTION", "/loopos/app/tracker/action%20%2F%201"],
    ["BLOCKING_TENSION", "/loopos/app/tensions/tension%20%2F%201"],
    ["PROJECT", "/loopos/app/projects/project%20%2F%201"],
  ]);
  assert.equal(projection.selectedGoal?.url, "/loopos/app/goals?cycle=active%20%2F%20one&goal=goal%20%2F%20one");

  const rootNode = flattenNodes(projection.roots).find((node) => node.circle.id === "root");
  assert.deepEqual(rootNode?.draftOwnerRoles.map((item) => item.id), ["role-root-active"]);
  assert.equal(rootNode?.draftOwnerRoles[0].factTime, "CURRENT");
  const draft = projection.proposals.find((item) => item.id === "mine-draft")!;
  assert.equal(draft.revision?.title, "mine-draft revision 2");
  assert.equal(draft.revision?.ownerRole?.factTime, "CURRENT");
  assert.deepEqual(draft.capabilities, { canAppendRevision: false, canSubmit: true, canWithdraw: true });
  assert.deepEqual(
    projection.proposals.find((item) => item.id === "mine-returned")?.capabilities,
    { canAppendRevision: true, canSubmit: false, canWithdraw: true },
  );
  assert.deepEqual(
    projection.proposals.find((item) => item.id === "other-draft")?.capabilities,
    { canAppendRevision: false, canSubmit: false, canWithdraw: false },
  );

  const unavailable = ready(await queryGoalTree(
    { organizationId: "org-a", viewerPersonId: "viewer-a", goalId: "goal-from-org-b" },
    new FakePrisma(tables).dependencies(),
  ));
  assert.equal(unavailable.selectedGoal, null);
  assert.equal(unavailable.requestedGoalUnavailable, true);
});

test("CLOSED reconstructs only immutable Goal parent support, never current Circle topology", async () => {
  const tables = baseTables([cycle("closed", "CLOSED", new Date("2026-05-01"))]);
  tables.circle.push(circle("root-now", "unrelated-current-parent"), circle("child-now", null));
  tables.roleDef.push(role("role-root", "root-now"), role("role-child", "child-now"));
  tables.goal.push(
    goal("historical-root", "closed", "root-now", "role-root", null, "ACHIEVED"),
    goal("historical-child", "closed", "child-now", "role-child", "historical-root", "ACHIEVED"),
  );

  const projection = ready(await queryGoalTree({ organizationId: "org-a", viewerPersonId: "viewer-a" }, new FakePrisma(tables).dependencies()));
  assert.equal(projection.roots[0].id, "historical-root");
  assert.equal(projection.roots[0].children[0].id, "historical-child");
  assert.equal(projection.gaps.some((gap) => ["ROOT_CIRCLE_MISSING", "ROOT_CIRCLE_MULTIPLE", "VISIBLE_PARENT_MISSING", "STALE_PARENT_SUPPORT"].includes(gap.code)), false);
  assert.deepEqual(projection.roots[0].capabilities, { canDraftCreate: false, canDraftReplace: false, canDraftClose: false });
});

test("CANCELLED has proposal history pinned to currentRevision but no canonical nodes", async () => {
  const tables = baseTables([cycle("cancelled", "CANCELLED", new Date("2026-05-01"))]);
  tables.circle.push(circle("root", null));
  tables.roleDef.push(role("role-root-active", "root"));
  tables.goal.push(goal("must-not-render", "cancelled", "root", "role-root-active"));
  tables.goalProposal.push(proposal("cancelled-proposal", "cancelled", "viewer-a", "WITHDRAWN", 2));
  tables.goalProposalRevision.push(revision("cancelled-proposal", 1), revision("cancelled-proposal", 2));

  const fake = new FakePrisma(tables);
  const projection = ready(await queryGoalTree({ organizationId: "org-a", viewerPersonId: "viewer-a" }, fake.dependencies()));
  assert.deepEqual(projection.roots, []);
  assert.deepEqual(projection.detached, []);
  assert.equal(projection.proposals[0].revision?.title, "cancelled-proposal revision 2");
  assert.equal(fake.calls.some((call) => call.model === "goal"), false);
  assert.equal(projection.capabilities.canDraftProposal, false);
});

test("cycle previews are 50+1 bounded while default and requested cycle resolution stay exact", async () => {
  const planned = Array.from({ length: 55 }, (_, index) => cycle(
    `planned-${String(index).padStart(2, "0")}`,
    "PLANNED",
    new Date(Date.UTC(2026, 11, 31 - index)),
  ));
  const rows = [...planned, cycle("active-exact", "ACTIVE", new Date("2026-01-01T00:00:00.000Z"))];
  const fake = new FakePrisma(baseTables(rows));

  const defaultProjection = ready(await queryGoalTree(
    { organizationId: "org-a", viewerPersonId: "viewer-a" },
    fake.dependencies(),
  ));
  assert.equal(defaultProjection.cycle.id, "active-exact");
  assert.equal(defaultProjection.cycles.length, 50);
  assert.equal(defaultProjection.cyclesHasMore, true);

  const requestedProjection = ready(await queryGoalTree(
    { organizationId: "org-a", viewerPersonId: "viewer-a", cycleId: "planned-54" },
    new FakePrisma(baseTables(rows)).dependencies(),
  ));
  assert.equal(requestedProjection.cycle.id, "planned-54");
  assert.equal(requestedProjection.cycles.some((item) => item.id === "planned-54"), false);

  const previewCall = fake.calls.find((call) => call.model === "goalCycle" && call.operation === "findMany");
  assert.equal(previewCall?.args.take, 51);
  const activeCall = fake.calls.find((call) => call.model === "goalCycle" && call.operation === "findFirst" && (call.args.where as Row).status === "ACTIVE");
  assert.deepEqual(activeCall?.args.orderBy, [{ startAt: "desc" }, { id: "asc" }]);
});

test("proposal history uses independent reachable 50+1 pages and bounds revision follow-ups", async () => {
  const rows = baseTables([cycle("cancelled", "CANCELLED", new Date("2026-05-01"))]);
  rows.goalProposal = Array.from({ length: 101 }, (_, index) => proposal(
    `proposal-${String(index).padStart(3, "0")}`,
    "cancelled",
    "viewer-a",
    "WITHDRAWN",
    1,
  ));
  rows.goalProposalRevision = rows.goalProposal.map((row) => revision(String(row.id), 1));
  const fake = new FakePrisma(rows);
  const pages = [];

  for (const proposalPage of [1, 2, 3]) {
    pages.push(ready(await queryGoalTree(
      { organizationId: "org-a", viewerPersonId: "viewer-a", proposalPage },
      fake.dependencies(),
    )));
  }

  assert.deepEqual(pages.map((page) => page.proposals.length), [50, 50, 1]);
  assert.deepEqual(pages.map((page) => page.proposalPagination), [
    { page: 1, pageSize: 50, hasPrevious: false, hasNext: true },
    { page: 2, pageSize: 50, hasPrevious: true, hasNext: true },
    { page: 3, pageSize: 50, hasPrevious: true, hasNext: false },
  ]);
  assert.deepEqual(pages.map((page) => page.proposals[0]?.id), ["proposal-000", "proposal-050", "proposal-100"]);
  const historyCalls = fake.calls.filter(
    (call) => call.model === "goalProposal" && !("proposerId" in (call.args.where as Row)),
  );
  assert.deepEqual(historyCalls.map((call) => call.args.skip), [0, 50, 100]);
  assert.deepEqual(historyCalls.map((call) => call.args.take), [51, 51, 51]);
  const actionableCalls = fake.calls.filter(
    (call) => call.model === "goalProposal" && (call.args.where as Row).proposerId === "viewer-a",
  );
  assert.equal(actionableCalls.length, 3);
  assert.ok(actionableCalls.every((call) => call.args.take === 51));
  assert.ok(actionableCalls.every((call) => !("skip" in call.args)));
  const revisionCalls = fake.calls.filter((call) => call.model === "goalProposalRevision");
  assert.ok(revisionCalls.every((call) => ((call.args.where as Row).OR as Row[]).length <= 50));
});

test("viewer-actionable proposals remain reachable beyond history row 50 without duplicate revision reads", async () => {
  const rows = baseTables([cycle("cancelled", "CANCELLED", new Date("2026-05-01"))]);
  rows.goalProposal = [
    ...Array.from({ length: 50 }, (_, index) => proposal(
      `history-${String(index).padStart(2, "0")}`,
      "cancelled",
      "viewer-a",
      "WITHDRAWN",
      1,
    )),
    proposal("zz-actionable", "cancelled", "viewer-a", "DRAFT", 1),
  ];
  rows.goalProposalRevision = rows.goalProposal.map((row) => revision(String(row.id), 1));
  const fake = new FakePrisma(rows);

  const projection = ready(await queryGoalTree(
    { organizationId: "org-a", viewerPersonId: "viewer-a" },
    fake.dependencies(),
  ));

  assert.equal(projection.proposals.some((item) => item.id === "zz-actionable"), false);
  assert.deepEqual(projection.actionableProposals.map((item) => item.id), ["zz-actionable"]);
  assert.equal(projection.actionableProposals[0].capabilities.canSubmit, true);
  const revisionCall = fake.calls.find((call) => call.model === "goalProposalRevision");
  const revisionKeys = ((revisionCall?.args.where as Row).OR as Row[]).map((key) => String(key.proposalId));
  assert.equal(revisionKeys.length, new Set(revisionKeys).size);
  assert.equal(revisionKeys.length, 51);
});

test("actionable proposal sentinel fails closed before health or revision projection", async () => {
  const rows = baseTables([cycle("cancelled", "CANCELLED", new Date("2026-05-01"))]);
  rows.goalProposal = Array.from({ length: 51 }, (_, index) => proposal(
    `actionable-${String(index).padStart(2, "0")}`,
    "cancelled",
    "viewer-a",
    index % 3 === 0 ? "DRAFT" : index % 3 === 1 ? "RETURNED" : "SUBMITTED",
    1,
  ));
  const fake = new FakePrisma(rows);

  const projection = await queryGoalTree(
    { organizationId: "org-a", viewerPersonId: "viewer-a" },
    fake.dependencies(),
  );

  assert.equal(projection.status, "TRUNCATED");
  if (projection.status !== "TRUNCATED") return;
  assert.equal(projection.reason, "ACTIONABLE_PROPOSAL_LIMIT_EXCEEDED");
  assert.equal(JSON.stringify(projection).includes("health"), false);
  assert.equal(fake.calls.some((call) => call.model === "goalProposalRevision"), false);
  const actionableCall = fake.calls.find(
    (call) => call.model === "goalProposal" && (call.args.where as Row).proposerId === "viewer-a",
  );
  assert.deepEqual((actionableCall?.args.where as Row).status, { in: ["DRAFT", "RETURNED", "SUBMITTED"] });
  assert.equal(actionableCall?.args.take, 51);
});

test("Circle, Goal, and Target sentinels return TRUNCATED without health or gap truth", async () => {
  const circleOverflow = baseTables([cycle("active", "ACTIVE", new Date("2026-07-01"))]);
  circleOverflow.circle = Array.from({ length: 201 }, (_, index) => circle(`circle-${String(index).padStart(3, "0")}`, null));
  const circleFake = new FakePrisma(circleOverflow);
  const circleProjection = await queryGoalTree(
    { organizationId: "org-a", viewerPersonId: "viewer-a" },
    circleFake.dependencies(),
  );
  assert.equal(circleProjection.status, "TRUNCATED");
  assert.equal(JSON.stringify(circleProjection).includes("health"), false);
  assert.equal(JSON.stringify(circleProjection).includes("gaps"), false);
  assert.equal(circleFake.calls.find((call) => call.model === "circle")?.args.take, 201);

  const goalOverflow = baseTables([cycle("active", "ACTIVE", new Date("2026-07-01"))]);
  goalOverflow.circle.push(circle("root", null));
  goalOverflow.roleDef.push(role("role-root", "root"));
  goalOverflow.goal = Array.from({ length: 201 }, (_, index) => goal(
    `goal-${String(index).padStart(3, "0")}`,
    "active",
    "root",
    "role-root",
  ));
  const goalFake = new FakePrisma(goalOverflow);
  const goalProjection = await queryGoalTree(
    { organizationId: "org-a", viewerPersonId: "viewer-a" },
    goalFake.dependencies(),
  );
  assert.equal(goalProjection.status, "TRUNCATED");
  assert.equal(JSON.stringify(goalProjection).includes("health"), false);
  assert.equal(goalFake.calls.find((call) => call.model === "goal")?.args.take, 201);

  const targetOverflow = baseTables([cycle("active", "ACTIVE", new Date("2026-07-01"))]);
  targetOverflow.circle.push(circle("root", null));
  targetOverflow.roleDef.push(role("role-root", "root"));
  targetOverflow.goal.push(goal("goal-root", "active", "root", "role-root"));
  targetOverflow.goalTarget = Array.from({ length: 21 }, (_, index) => target(`target-${index}`, "goal-root", index));
  const targetFake = new FakePrisma(targetOverflow);
  const targetProjection = await queryGoalTree(
    { organizationId: "org-a", viewerPersonId: "viewer-a" },
    targetFake.dependencies(),
  );
  assert.equal(targetProjection.status, "TRUNCATED");
  assert.equal(JSON.stringify(targetProjection).includes("health"), false);
  const goalSelect = targetFake.calls.find((call) => call.model === "goal")?.args.select as Row;
  assert.equal((goalSelect.targets as Row).take, 21);
});

test("bounded role, Metric, assignee, and work previews expose stable hasMore metadata and exact counts", async () => {
  const rows = baseTables([cycle("active", "ACTIVE", new Date("2026-07-01"))]);
  rows.circle.push(circle("root", null));
  rows.roleDef = Array.from({ length: 51 }, (_, index) => role(
    `role-${String(index).padStart(2, "0")}`,
    "root",
    "ACTIVE",
    Array.from({ length: 8 }, (_, assigneeIndex) => ({
      id: `person-${index}-${assigneeIndex}`,
      name: `成员 ${assigneeIndex}`,
    })),
  ));
  rows.metric = Array.from({ length: 51 }, (_, index) => metric(
    `metric-${String(index).padStart(2, "0")}`,
    "root",
    `指标 ${String(index).padStart(2, "0")}`,
  ));
  rows.goal.push(goal("goal-root", "active", "root", "role-00"));
  rows.goalTarget.push({ ...target("target-root", "goal-root"), metricId: "metric-50" });
  rows.goalWorkLink = Array.from({ length: 51 }, (_, index) => ({
    id: `link-${String(index).padStart(2, "0")}`,
    organizationId: "org-a",
    goalId: "goal-root",
    kind: "PROJECT",
    status: "ACTIVE",
    projectId: `project-${index}`,
    tensionId: null,
    createdAt: now,
  }));
  rows.project = Array.from({ length: 51 }, (_, index) => ({
    id: `project-${index}`,
    organizationId: "org-a",
    name: `项目 ${index}`,
    status: "ACTIVE",
  }));

  const fake = new FakePrisma(rows);
  const projection = ready(await queryGoalTree(
    { organizationId: "org-a", viewerPersonId: "viewer-a" },
    fake.dependencies(),
  ));
  const node = projection.roots[0];
  assert.equal(node.draftOwnerRoles.length, 50);
  assert.equal(node.draftOwnerRolesHasMore, true);
  assert.equal(node.draftMetrics.length, 50);
  assert.equal(node.draftMetricsHasMore, true);
  assert.equal(node.draftOwnerRoles[0].assignees.length, 5);
  assert.equal(node.draftOwnerRoles[0].assigneeCount, 8);
  assert.equal(node.draftOwnerRoles[0].assigneesHasMore, true);
  assert.equal(node.goal?.workLinks.length, 50);
  assert.equal(node.goal?.workLinksHasMore, true);
  assert.equal(node.goal?.targets[0].metric?.name, "指标 50");

  const circleSelect = fake.calls.find((call) => call.model === "circle")?.args.select as Row;
  assert.equal((circleSelect.roles as Row).take, 51);
  assert.deepEqual((circleSelect.roles as Row).orderBy, [{ name: "asc" }, { id: "asc" }]);
  assert.equal((circleSelect.metricDefs as Row).take, 51);
  assert.deepEqual((circleSelect.metricDefs as Row).orderBy, [{ name: "asc" }, { id: "asc" }]);
  const roleSelect = ((circleSelect.roles as Row).select as Row);
  assert.equal((roleSelect.assignees as Row).take, 6);
  assert.deepEqual((roleSelect.assignees as Row).orderBy, [{ name: "asc" }, { id: "asc" }]);
  const goalSelect = fake.calls.find((call) => call.model === "goal")?.args.select as Row;
  assert.deepEqual((goalSelect.workLinks as Row).orderBy, [{ createdAt: "desc" }, { id: "asc" }]);
});

test("exact current and revision owner Roles retain names outside the active Role preview", async () => {
  const rows = baseTables([cycle("active", "ACTIVE", new Date("2026-07-01"))]);
  rows.circle.push(circle("root", null));
  rows.roleDef = Array.from({ length: 51 }, (_, index) => role(
    `role-${String(index).padStart(2, "0")}`,
    "root",
  ));
  rows.goal.push(goal("goal-root", "active", "root", "role-50"));
  rows.goalProposal.push(proposal("returned-proposal", "active", "viewer-a", "RETURNED", 1));
  rows.goalProposalRevision.push(revision("returned-proposal", 1, "role-50"));

  const projection = ready(await queryGoalTree(
    { organizationId: "org-a", viewerPersonId: "viewer-a" },
    new FakePrisma(rows).dependencies(),
  ));
  const node = projection.roots[0];

  assert.equal(node.draftOwnerRoles.some((item) => item.id === "role-50"), false);
  assert.deepEqual(node.goal?.ownerRole && {
    id: node.goal.ownerRole.id,
    name: node.goal.ownerRole.name,
  }, { id: "role-50", name: "role-50" });
  assert.deepEqual(projection.actionableProposals[0].revision?.ownerRole && {
    id: projection.actionableProposals[0].revision.ownerRole.id,
    name: projection.actionableProposals[0].revision.ownerRole.name,
  }, { id: "role-50", name: "role-50" });
});

test("effective evidence loads one exact latest unsuperseded check-in with named recorder", async () => {
  const rows = baseTables([cycle("active", "ACTIVE", new Date("2026-07-01"))]);
  rows.circle.push(circle("root", null));
  rows.roleDef.push(role("role-root", "root"));
  rows.goal.push(goal("goal-root", "active", "root", "role-root"));
  rows.goalTarget.push(target("target-root", "goal-root"));
  rows.person.push(person("recorder-a", "org-a", "记录人甲"));
  rows.goalCheckIn.push(
    checkIn("old", "goal-root", "target-root", "OFF_TRACK", new Date(now.getTime() - 2_000)),
    { ...checkIn("correction", "goal-root", "target-root", "ON_TRACK", now, "old"), recorderId: "recorder-a" },
  );

  const fake = new FakePrisma(rows);
  const projection = ready(await queryGoalTree(
    { organizationId: "org-a", viewerPersonId: "viewer-a" },
    fake.dependencies(),
  ));
  assert.equal(projection.selectedGoal?.health, "ON_TRACK");
  assert.equal(projection.selectedGoal?.targets[0].effectiveEvidence?.id, "correction");
  assert.deepEqual(projection.selectedGoal?.targets[0].effectiveEvidence?.recorder, {
    id: "recorder-a",
    name: "记录人甲",
  });
  const goalSelect = fake.calls.find((call) => call.model === "goal")?.args.select as Row;
  const targetSelect = ((goalSelect.targets as Row).select as Row);
  const checkInArgs = targetSelect.checkIns as Row;
  assert.deepEqual(checkInArgs.where, { organizationId: "org-a", supersededBy: null });
  assert.deepEqual(checkInArgs.orderBy, [{ recordedAt: "desc" }, { id: "desc" }]);
  assert.equal(checkInArgs.take, 1);
});
