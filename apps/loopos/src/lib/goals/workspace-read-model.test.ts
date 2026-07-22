import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

import type { WorkspaceGoalProjection } from "./workspace-read-model";

type ReadModelModule = typeof import("./workspace-read-model");
type Row = Record<string, unknown>;
type Call = { model: "person" | "goalCycle" | "goal" | "health"; args: Record<string, unknown> };

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
let queryWorkspaceGoalContext: ReadModelModule["queryWorkspaceGoalContext"];

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
  ({ queryWorkspaceGoalContext } = await import("./workspace-read-model"));
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

const now = new Date("2026-07-15T12:00:00.000Z");

class FakePrisma {
  readonly calls: Call[] = [];
  readonly prisma = {
    person: { findFirst: async (args: Record<string, unknown>) => this.readOne("person", args) },
    goalCycle: { findFirst: async (args: Record<string, unknown>) => this.readOne("goalCycle", args) },
    goal: { findMany: async (args: Record<string, unknown>) => this.readMany("goal", args) },
    $queryRaw: async (query: unknown) => this.readHealth(query),
  };

  constructor(
    private readonly rows: {
      person?: Row | null;
      goalCycle?: Row | null;
      goal?: Row[];
      health?: Row[];
    } = {},
    private readonly failure?: Call["model"],
  ) {}

  dependencies() {
    return { prisma: this.prisma as never, now };
  }

  private async readOne(model: "person" | "goalCycle", args: Record<string, unknown>) {
    this.calls.push({ model, args });
    if (this.failure === model) throw new Error("private persistence detail");
    return this.rows[model] ?? null;
  }

  private async readMany(model: "goal", args: Record<string, unknown>) {
    this.calls.push({ model, args });
    if (this.failure === model) throw new Error("private persistence detail");
    return this.rows.goal ?? [];
  }

  private async readHealth(query: unknown) {
    this.calls.push({ model: "health", args: { query } });
    if (this.failure === "health") throw new Error("private persistence detail");
    return this.rows.health ?? (this.rows.goal ?? []).map((row) => ({
      goalId: row.id,
      targetCount: 1,
      evidenceCount: 1,
      achievedCount: 0,
      offTrackCount: 0,
      atRiskCount: 1,
      staleCount: 1,
    }));
  }
}

function cycle(overrides: Row = {}): Row {
  return {
    id: "cycle-a",
    name: "2026 Q3",
    status: "ACTIVE",
    startAt: new Date("2026-07-01T00:00:00.000Z"),
    endAt: new Date("2026-09-30T23:59:59.000Z"),
    checkInCadenceDays: 7,
    ...overrides,
  };
}

function target(id: string, overrides: Row = {}): Row {
  return {
    id,
    goalId: "goal-a",
    sourceProposalTargetId: `proposal-${id}`,
    position: 0,
    label: "完成关键验证",
    kind: "MILESTONE",
    baselineValue: null,
    desiredValue: null,
    unit: null,
    acceptanceCriteria: "有真实用户证据",
    metricId: null,
    checkIns: [{
      id: `check-in-${id}`,
      goalId: "goal-a",
      targetId: id,
      fact: "完成 3 次访谈",
      evidenceSummary: "访谈结论已归档",
      currentValue: null,
      milestoneCompleted: false,
      acceptanceEvidence: null,
      assessment: "AT_RISK",
      recorderId: "person-a",
      meetingId: "meeting-a",
      sourceUrl: "https://evidence.example/report",
      supersedesCheckInId: null,
      recordedAt: new Date("2026-07-05T12:00:00.000Z"),
    }],
    ...overrides,
  };
}

function goal(id = "goal-a", overrides: Row = {}): Row {
  return {
    id,
    organizationId: "org-a",
    cycleId: "cycle-a",
    circleId: "circle-a",
    title: `主目标 ${id}`,
    intendedOutcome: "形成可持续的交付节奏",
    ownerRoleId: "role-a",
    status: "ACTIVE",
    createdAt: new Date("2026-07-02T00:00:00.000Z"),
    circle: {
      id: "circle-a",
      name: "模型回路",
      status: "NORMAL",
      _count: { meetings: 1 },
      meetings: [{
        id: "meeting-a",
        title: "模型回路周会",
        startedAt: new Date("2026-07-15T08:00:00.000Z"),
      }],
    },
    ownerRole: {
      id: "role-a",
      name: "交付负责人",
      status: "ACTIVE",
      assignees: [{ id: "person-a", name: "成员 A" }],
      _count: { assignees: 1 },
    },
    _count: { targets: 1, workLinks: 2 },
    targets: [target("target-a")],
    workLinks: [{
      id: "link-project",
      kind: "PROJECT",
      createdAt: new Date("2026-07-10T00:00:00.000Z"),
      project: { id: "project-a", name: "验证项目", status: "IN_PROGRESS" },
      tension: null,
    }, {
      id: "link-action",
      kind: "ACTION",
      createdAt: new Date("2026-07-11T00:00:00.000Z"),
      project: null,
      tension: { id: "action-a", title: "完成验证访谈", status: "ASSIGNED" },
    }],
    ...overrides,
  };
}

function ready(projection: WorkspaceGoalProjection) {
  assert.equal(projection.status, "READY");
  return projection as Extract<WorkspaceGoalProjection, { status: "READY" }>;
}

test("viewer and active cycle lookup are tenant-bounded and deny before reading Goals", async () => {
  const fake = new FakePrisma({ person: null, goalCycle: cycle() });
  const projection = await queryWorkspaceGoalContext(
    { organizationId: "org-a", viewerPersonId: "person-a" },
    fake.dependencies(),
  );

  assert.deepEqual(projection, {
    status: "NOT_AVAILABLE",
    reason: "VIEWER_NOT_FOUND",
    allGoalsUrl: "/app/goals",
  });
  assert.equal(fake.calls.some((call) => call.model === "goal"), false);
  assert.deepEqual(fake.calls.find((call) => call.model === "person")?.args.where, {
    id: "person-a",
    organizationId: "org-a",
  });
  assert.deepEqual(fake.calls.find((call) => call.model === "goalCycle")?.args.where, {
    organizationId: "org-a",
    status: "ACTIVE",
  });
});

test("missing active cycle is an honest unavailable state", async () => {
  const fake = new FakePrisma({ person: { id: "person-a" }, goalCycle: null });
  const projection = await queryWorkspaceGoalContext(
    { organizationId: "org-a", viewerPersonId: "person-a" },
    fake.dependencies(),
  );

  assert.deepEqual(projection, {
    status: "NOT_AVAILABLE",
    reason: "ACTIVE_CYCLE_NOT_FOUND",
    allGoalsUrl: "/app/goals",
  });
  assert.equal(fake.calls.some((call) => call.model === "goal"), false);
});

test("Goal query applies strict database-level relevance, stable order, and 6+1 bound", async () => {
  const fake = new FakePrisma({ person: { id: "person-a" }, goalCycle: cycle(), goal: [] });
  const projection = await queryWorkspaceGoalContext(
    { organizationId: "org-a", viewerPersonId: "person-a" },
    fake.dependencies(),
  );

  assert.equal(projection.status, "EMPTY");
  const goalCall = fake.calls.find((call) => call.model === "goal");
  assert.ok(goalCall);
  assert.deepEqual(goalCall.args.where, {
    organizationId: "org-a",
    cycleId: "cycle-a",
    status: "ACTIVE",
    circle: { organizationId: "org-a", status: { not: "ARCHIVED" } },
    OR: [{
      ownerRole: {
        organizationId: "org-a",
        status: "ACTIVE",
        assignees: { some: { id: "person-a", organizationId: "org-a" } },
      },
    }, {
      circle: {
        organizationId: "org-a",
        meetings: {
          some: {
            organizationId: "org-a",
            type: "TACTICAL",
            endedAt: null,
            circleId: { not: null },
            participants: { some: { id: "person-a", organizationId: "org-a" } },
          },
        },
      },
    }],
  });
  assert.deepEqual(goalCall.args.orderBy, [{ createdAt: "asc" }, { id: "asc" }]);
  assert.equal(goalCall.args.take, 7);

  const select = goalCall.args.select as Record<string, Record<string, unknown>>;
  const circleSelect = select.circle.select as Record<string, Record<string, unknown>>;
  const roleSelect = select.ownerRole.select as Record<string, Record<string, unknown>>;
  const targetSelect = select.targets as Record<string, unknown>;
  const checkIns = (targetSelect.select as Record<string, Record<string, unknown>>).checkIns;
  const workLinks = select.workLinks as Record<string, unknown>;
  assert.equal(circleSelect.meetings.take, 4);
  assert.deepEqual(circleSelect.meetings.orderBy, [{ startedAt: "asc" }, { id: "asc" }]);
  assert.equal(roleSelect.assignees.take, 1);
  assert.deepEqual(roleSelect.assignees.where, {
    id: "person-a",
    organizationId: "org-a",
  });
  assert.equal(targetSelect.take, 3);
  assert.equal(checkIns.take, 1);
  assert.equal(workLinks.take, 4);
  assert.deepEqual(workLinks.orderBy, [{ createdAt: "desc" }, { id: "asc" }]);
});

test("one Goal is deduplicated while owner Role and every exact tactical meeting source are retained", async () => {
  const first = goal();
  const second = goal("goal-a", {
    circle: {
      id: "circle-a",
      name: "模型回路",
      status: "NORMAL",
      _count: { meetings: 1 },
      meetings: [{
        id: "meeting-b",
        title: "模型回路补充会",
        startedAt: new Date("2026-07-15T10:00:00.000Z"),
      }],
    },
  });
  const fake = new FakePrisma({
    person: { id: "person-a" },
    goalCycle: cycle(),
    goal: [first, second],
  });

  const projection = ready(await queryWorkspaceGoalContext(
    { organizationId: "org-a", viewerPersonId: "person-a" },
    fake.dependencies(),
  ));

  assert.equal(projection.goals.length, 1);
  assert.deepEqual(projection.goals[0].meetings.map((meeting) => meeting.title), [
    "模型回路周会",
    "模型回路补充会",
  ]);
  assert.equal(projection.goals[0].ownerRole.name, "交付负责人");
  assert.equal(projection.goals[0].ownerRole.viewerAssigned, true);
  assert.equal(projection.goals[0].ownerRole.assigneeCount, 1);
});

test("projection derives health, evidence age/staleness, and stable source URLs without authoring data", async () => {
  const fake = new FakePrisma({
    person: { id: "person-a" },
    goalCycle: cycle(),
    goal: [goal()],
  });

  const projection = ready(await queryWorkspaceGoalContext(
    { organizationId: "org-a", viewerPersonId: "person-a" },
    fake.dependencies(),
  ));
  const projectedGoal = projection.goals[0];

  assert.equal(projectedGoal.health, "AT_RISK");
  assert.equal(projectedGoal.url, "/app/goals?cycle=cycle-a&goal=goal-a");
  assert.equal(projectedGoal.circle.url, "/app/circles/circle-a");
  assert.equal(projectedGoal.ownerRole.url, "/app/roles/role-a");
  assert.equal(projectedGoal.meetings[0].url, "/app/meetings/meeting-a");
  assert.equal(projectedGoal.targets[0].evidenceAgeDays, 10);
  assert.equal(projectedGoal.targets[0].evidenceIsStale, true);
  assert.equal(projectedGoal.targets[0].effectiveEvidence?.meetingUrl, "/app/meetings/meeting-a");
  assert.equal(projectedGoal.workLinks[0].url, "/app/projects/project-a");
  assert.equal(projectedGoal.workLinks[1].url, "/app/tracker/action-a");
  assert.doesNotMatch(JSON.stringify(projection), /proposal|capabilit|parentGoal|revision/i);
});

test("bounded target previews do not determine health for undisplayed Targets", async () => {
  const fake = new FakePrisma({
    person: { id: "person-a" },
    goalCycle: cycle(),
    goal: [goal("goal-a", {
      _count: { targets: 9, workLinks: 2 },
      targets: [target("target-a", {
        checkIns: [{
          id: "check-in-visible",
          goalId: "goal-a",
          targetId: "target-a",
          fact: "可见指标正常",
          evidenceSummary: "可见证据",
          currentValue: null,
          milestoneCompleted: false,
          acceptanceEvidence: null,
          assessment: "ON_TRACK",
          recorderId: "person-a",
          meetingId: null,
          sourceUrl: null,
          supersedesCheckInId: null,
          recordedAt: new Date("2026-07-15T10:00:00.000Z"),
        }],
      })],
    })],
    health: [{
      goalId: "goal-a",
      targetCount: 9,
      evidenceCount: 9,
      achievedCount: 0,
      offTrackCount: 1,
      atRiskCount: 0,
      staleCount: 0,
    }],
  });

  const projection = ready(await queryWorkspaceGoalContext(
    { organizationId: "org-a", viewerPersonId: "person-a" },
    fake.dependencies(),
  ));

  assert.equal(projection.goals[0].health, "OFF_TRACK");
  assert.equal(projection.goals[0].targets.length, 1);
  assert.equal(projection.goals[0].targetCount, 9);
  assert.equal(projection.goals[0].targetsHasMore, true);
  assert.equal(fake.calls.filter((call) => call.model === "health").length, 1);
});

test("visible nested truncation and owner facts are explicit without losing viewer relevance", async () => {
  const meetings = Array.from({ length: 4 }, (_, index) => ({
    id: `meeting-${index + 1}`,
    title: `战术会 ${index + 1}`,
    startedAt: new Date(`2026-07-1${index + 1}T08:00:00.000Z`),
  }));
  const workLinks = Array.from({ length: 4 }, (_, index) => ({
    id: `link-${index + 1}`,
    kind: "PROJECT",
    createdAt: new Date(`2026-07-1${index + 1}T00:00:00.000Z`),
    project: { id: `project-${index + 1}`, name: `项目 ${index + 1}`, status: "IN_PROGRESS" },
    tension: null,
  }));
  const fake = new FakePrisma({
    person: { id: "person-a" },
    goalCycle: cycle(),
    goal: [goal("goal-a", {
      circle: {
        id: "circle-a",
        name: "模型回路",
        status: "NORMAL",
        _count: { meetings: 8 },
        meetings,
      },
      ownerRole: {
        id: "role-a",
        name: "交付负责人",
        status: "ACTIVE",
        assignees: [],
        _count: { assignees: 12 },
      },
      _count: { targets: 7, workLinks: 9 },
      targets: [target("target-1"), target("target-2"), target("target-3")],
      workLinks,
    })],
  });

  const projection = ready(await queryWorkspaceGoalContext(
    { organizationId: "org-a", viewerPersonId: "person-a" },
    fake.dependencies(),
  ));
  const projectedGoal = projection.goals[0];

  assert.equal(projectedGoal.meetings.length, 3);
  assert.equal(projectedGoal.meetingCount, 8);
  assert.equal(projectedGoal.meetingsHasMore, true);
  assert.equal(projectedGoal.targets.length, 2);
  assert.equal(projectedGoal.targetCount, 7);
  assert.equal(projectedGoal.targetsHasMore, true);
  assert.equal(projectedGoal.workLinks.length, 3);
  assert.equal(projectedGoal.workLinkCount, 9);
  assert.equal(projectedGoal.workLinksHasMore, true);
  assert.equal(projectedGoal.ownerRole.assigneeCount, 12);
  assert.equal(projectedGoal.ownerRole.viewerAssigned, false);
});

test("the seventh distinct Goal becomes an explicit hasMore signal instead of silent truncation", async () => {
  const rows = Array.from({ length: 7 }, (_, index) => goal(`goal-${index + 1}`, {
    circleId: `circle-${index + 1}`,
    title: `主目标 ${index + 1}`,
    targets: [target(`target-${index + 1}`, { goalId: `goal-${index + 1}` })],
  }));
  const fake = new FakePrisma({ person: { id: "person-a" }, goalCycle: cycle(), goal: rows });

  const projection = ready(await queryWorkspaceGoalContext(
    { organizationId: "org-a", viewerPersonId: "person-a" },
    fake.dependencies(),
  ));

  assert.equal(projection.goals.length, 6);
  assert.equal(projection.hasMore, true);
  assert.equal(projection.allGoalsUrl, "/app/goals?cycle=cycle-a");
});

test("persistence failures are redacted into a fail-closed unavailable state", async () => {
  const fake = new FakePrisma({ person: { id: "person-a" }, goalCycle: cycle() }, "goal");
  const projection = await queryWorkspaceGoalContext(
    { organizationId: "org-a", viewerPersonId: "person-a" },
    fake.dependencies(),
  );

  assert.deepEqual(projection, {
    status: "NOT_AVAILABLE",
    reason: "READ_FAILED",
    allGoalsUrl: "/app/goals",
  });
  assert.doesNotMatch(JSON.stringify(projection), /private persistence detail/);
});
