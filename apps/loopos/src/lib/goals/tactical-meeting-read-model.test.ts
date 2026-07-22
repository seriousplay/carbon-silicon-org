import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import type { TacticalGoalMeetingProjection } from "./tactical-meeting-read-model";

type ReadModelModule = typeof import("./tactical-meeting-read-model");
type Row = Record<string, unknown>;
type Call = { model: string; operation: string; args: Record<string, unknown> };

const require = createRequire(import.meta.url);
const originalNodePath = process.env.NODE_PATH;
const originalBasePath = process.env.NEXT_PUBLIC_BASE_PATH;
const compiledModules = resolve(dirname(fileURLToPath(import.meta.url)), "../../../node_modules/next/dist/compiled");
const moduleWithInitPaths = Module as typeof Module & { _initPaths(): void };
let originalServerOnlyModule: NodeJS.Module | undefined;
let serverOnlyPath = "";
let queryTacticalGoalMeeting: ReadModelModule["queryTacticalGoalMeeting"];

before(async () => {
  process.env.NODE_PATH = originalNodePath ? `${compiledModules}:${originalNodePath}` : compiledModules;
  process.env.NEXT_PUBLIC_BASE_PATH = "/loopos";
  moduleWithInitPaths._initPaths();
  serverOnlyPath = require.resolve("server-only");
  originalServerOnlyModule = require.cache[serverOnlyPath];
  const shim = new Module(serverOnlyPath);
  shim.filename = serverOnlyPath;
  shim.loaded = true;
  require.cache[serverOnlyPath] = shim;
  ({ queryTacticalGoalMeeting } = await import("./tactical-meeting-read-model"));
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

class FakePrisma {
  readonly calls: Call[] = [];
  readonly prisma: Record<string, Record<string, (args: Record<string, unknown>) => Promise<unknown>>>;

  constructor(private readonly rows: {
    meeting?: Row | null;
    goal?: Row | null;
    ownerMembership?: Row | null;
    tacticalOutcomeProposals?: Row[];
    tensions?: Row[];
  }) {
    const ownerMembership = rows.ownerMembership === undefined ? { id: "role-a" } : rows.ownerMembership;
    this.prisma = {
      meeting: { findFirst: async (args) => this.one("meeting", "findFirst", args, rows.meeting ?? null) },
      goal: { findFirst: async (args) => this.one("goal", "findFirst", args, rows.goal ?? null) },
      roleDef: { findFirst: async (args) => this.one("roleDef", "findFirst", args, ownerMembership) },
      tacticalOutcomeProposal: {
        findMany: async (args) => this.many("tacticalOutcomeProposal", "findMany", args, rows.tacticalOutcomeProposals ?? []),
      },
      tension: { findMany: async (args) => this.many("tension", "findMany", args, rows.tensions ?? []) },
    };
  }

  dependencies() {
    return { prisma: this.prisma as never, now: () => new Date("2026-07-15T12:00:00.000Z") };
  }

  private async one(model: string, operation: string, args: Record<string, unknown>, row: Row | null) {
    this.calls.push({ model, operation, args });
    return row;
  }

  private async many(model: string, operation: string, args: Record<string, unknown>, rows: Row[]) {
    this.calls.push({ model, operation, args });
    return rows;
  }
}

function meeting(overrides: Row = {}): Row {
  return {
    id: "meeting-a",
    title: "Weekly tactical",
    type: "TACTICAL",
    endedAt: null,
    circleId: "circle-a",
    circle: { id: "circle-a", name: "Model circle" },
    participants: [{ id: "viewer-a" }],
    ...overrides,
  };
}

function checkIn(id: string, overrides: Row = {}): Row {
  return {
    id,
    fact: `fact-${id}`,
    evidenceSummary: `evidence-${id}`,
    currentValue: "15.0000000000",
    milestoneCompleted: null,
    acceptanceEvidence: null,
    assessment: "ON_TRACK",
    recorderId: "viewer-a",
    recorder: { id: "viewer-a", name: "Viewer" },
    meetingId: "meeting-a",
    meeting: { id: "meeting-a", title: "Weekly tactical" },
    sourceUrl: "https://example.com/evidence",
    supersedesCheckInId: null,
    recordedAt: new Date("2026-07-14T12:00:00.000Z"),
    ...overrides,
  };
}

function goal(overrides: Row = {}): Row {
  return {
    id: "goal-a",
    cycleId: "cycle-a",
    circleId: "circle-a",
    title: "Ship the base model",
    intendedOutcome: "A reliable weekly release",
    ownerRoleId: "role-a",
    parentGoalId: null,
    status: "ACTIVE",
    adoptedDecisionId: "decision-a",
    terminalDecisionId: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    terminalAt: null,
    cycle: {
      id: "cycle-a",
      name: "2026 Q3",
      status: "ACTIVE",
      startAt: new Date("2026-07-01T00:00:00.000Z"),
      endAt: new Date("2026-09-30T00:00:00.000Z"),
      checkInCadenceDays: 7,
    },
    circle: { id: "circle-a", name: "Model circle" },
    ownerRole: {
      id: "role-a",
      name: "Model steward",
      status: "ACTIVE",
      assignees: [{ id: "viewer-a", name: "Viewer" }],
      _count: { assignees: 1 },
    },
    targets: [{
      id: "target-a",
      sourceProposalTargetId: "proposal-target-a",
      position: 0,
      label: "Evaluation score",
      kind: "NUMERIC",
      baselineValue: "10.0000000000",
      desiredValue: "20.0000000000",
      unit: "points",
      acceptanceCriteria: null,
      metricId: null,
      checkIns: [
        checkIn("check-correction", {
          fact: "corrected fact",
          supersedesCheckInId: "check-old",
          recordedAt: new Date("2026-07-15T08:00:00.000Z"),
        }),
        checkIn("check-old"),
      ],
    }],
    workLinks: [
      {
        id: "link-active",
        kind: "PROJECT",
        status: "ACTIVE",
        projectId: "project-linked",
        tensionId: null,
        project: { id: "project-linked", name: "Linked project" },
        tension: null,
        createdBy: { id: "viewer-a", name: "Viewer" },
        createdMeeting: { id: "meeting-a", title: "Weekly tactical" },
        createdAt: new Date("2026-07-14T09:00:00.000Z"),
        removedBy: null,
        removedMeeting: null,
        removedAt: null,
        removalReason: null,
      },
      {
        id: "link-removed",
        kind: "BLOCKING_TENSION",
        status: "REMOVED",
        projectId: null,
        tensionId: "tension-removed",
        project: null,
        tension: { id: "tension-removed", title: "Former blocker" },
        createdBy: { id: "member-b", name: "Member" },
        createdMeeting: { id: "meeting-a", title: "Weekly tactical" },
        createdAt: new Date("2026-07-13T09:00:00.000Z"),
        removedBy: { id: "viewer-a", name: "Viewer" },
        removedMeeting: { id: "meeting-a", title: "Weekly tactical" },
        removedAt: new Date("2026-07-15T09:00:00.000Z"),
        removalReason: "No longer blocks the goal",
      },
    ],
    ...overrides,
  };
}

function ready(value: TacticalGoalMeetingProjection) {
  assert.equal(value.status, "READY");
  return value as Extract<TacticalGoalMeetingProjection, { status: "READY" }>;
}

test("cross-tenant and wrong-type meetings fail closed after one tenant-bound query", async () => {
  for (const row of [null, meeting({ type: "STRATEGY" })]) {
    const fake = new FakePrisma({ meeting: row });
    assert.deepEqual(await queryTacticalGoalMeeting(
      { organizationId: "org-a", meetingId: "meeting-a", viewerPersonId: "viewer-a" },
      fake.dependencies(),
    ), { status: "NOT_AVAILABLE" });
    assert.equal(fake.calls.length, 1);
    assert.deepEqual(fake.calls[0].args.where, { id: "meeting-a", organizationId: "org-a" });
  }
});

test("an exact tactical meeting without a Circle is reported without querying goals", async () => {
  const fake = new FakePrisma({ meeting: meeting({ circleId: null, circle: null }) });
  const result = await queryTacticalGoalMeeting(
    { organizationId: "org-a", meetingId: "meeting-a", viewerPersonId: "viewer-a" },
    fake.dependencies(),
  );
  assert.equal(result.status, "NO_CIRCLE");
  assert.equal(fake.calls.length, 1);
});

test("the absence of an active Goal in the active cycle is explicit and tenant bounded", async () => {
  const fake = new FakePrisma({ meeting: meeting(), goal: null });
  const result = await queryTacticalGoalMeeting(
    { organizationId: "org-a", meetingId: "meeting-a", viewerPersonId: "viewer-a" },
    fake.dependencies(),
  );
  assert.equal(result.status, "NO_ACTIVE_GOAL");
  assert.equal(fake.calls.length, 2);
  assert.deepEqual(fake.calls[1].args.where, {
    organizationId: "org-a",
    circleId: "circle-a",
    status: "ACTIVE",
    cycle: { status: "ACTIVE" },
  });
});

test("projects ACTIVE Goal state with health, all evidence, correction lineage, and link provenance", async () => {
  const fake = new FakePrisma({
    meeting: meeting(),
    goal: goal(),
    tacticalOutcomeProposals: [
      {
        id: "proposal-project",
        kind: "PROJECT",
        title: "Ship evaluation project",
        sourceTension: { id: "source-project", title: "Evaluation is slow" },
        outcomeProject: { id: "project-new", name: "Evaluation sprint" },
        outcomeAction: null,
      },
      {
        id: "proposal-action",
        kind: "ACTION",
        title: "Run benchmark",
        sourceTension: { id: "source-action", title: "Benchmark missing" },
        outcomeProject: null,
        outcomeAction: { id: "action-new", title: "Run benchmark now" },
      },
    ],
    tensions: [{ id: "blocking-a", title: "GPU quota", status: "BLOCKED" }],
  });

  const projection = ready(await queryTacticalGoalMeeting(
    { organizationId: "org-a", meetingId: "meeting-a", viewerPersonId: "viewer-a" },
    fake.dependencies(),
  ));

  assert.equal(projection.meeting.viewerIsParticipant, true);
  assert.equal("participants" in projection.meeting, false);
  assert.equal(projection.meeting.canAppendEvidence, true);
  assert.equal(projection.meeting.canManageWorkLinks, true);
  assert.equal(projection.goal.viewerIsOwnerRoleAssignee, true);
  assert.equal(projection.goal.ownerRole.assigneeCount, 1);
  assert.equal(projection.goal.ownerRole.assigneesHasMore, false);
  assert.equal(projection.goal.health, "ON_TRACK");
  assert.equal(projection.goal.targets[0].evidence.length, 2);
  assert.equal(projection.goal.targets[0].evidence[1].isSuperseded, true);
  assert.equal(projection.goal.targets[0].evidence[0].supersedesCheckInId, "check-old");
  assert.equal(projection.goal.targets[0].effectiveEvidence?.fact, "corrected fact");
  assert.deepEqual(projection.goal.workLinks.map((link) => link.status), ["ACTIVE", "REMOVED"]);
  assert.equal(projection.goal.workLinks[1].removalReason, "No longer blocks the goal");
  assert.equal(projection.candidates.projects[0].title, "Evaluation sprint");
  assert.equal(projection.candidates.actions[0].title, "Run benchmark now");
  assert.equal(projection.candidates.blockingTensions[0].title, "GPU quota");
  assert.equal(projection.goal.url, "/loopos/app/goals?cycle=cycle-a&goal=goal-a");
  assert.equal(projection.goal.targets[0].evidence[0].meetingUrl, "/loopos/app/meetings/meeting-a");
  assert.equal(projection.goal.targets[0].evidence[0].ageLabel, "4 小时前");
});

test("candidate queries are exact-meeting, approved, same-Circle, non-terminal, and tenant bounded", async () => {
  const fake = new FakePrisma({ meeting: meeting(), goal: goal(), tacticalOutcomeProposals: [], tensions: [] });
  await queryTacticalGoalMeeting(
    { organizationId: "org-a", meetingId: "meeting-a", viewerPersonId: "viewer-a" },
    fake.dependencies(),
  );

  const proposalCall = fake.calls.find((call) => call.model === "tacticalOutcomeProposal");
  assert.deepEqual(proposalCall?.args.where, {
    organizationId: "org-a",
    meetingId: "meeting-a",
    circleId: "circle-a",
    status: "APPROVED",
    OR: [
      {
        outcomeProjectId: { not: null },
        outcomeProject: { goalWorkLinks: { none: { organizationId: "org-a", goalId: "goal-a", status: "ACTIVE" } } },
      },
      {
        outcomeActionId: { not: null },
        outcomeAction: { goalWorkLinks: { none: { organizationId: "org-a", goalId: "goal-a", status: "ACTIVE" } } },
      },
    ],
  });
  const tensionCall = fake.calls.find((call) => call.model === "tension");
  assert.deepEqual(tensionCall?.args.where, {
    organizationId: "org-a",
    status: { notIn: ["RESOLVED", "REJECTED"] },
    circles: { some: { id: "circle-a", organizationId: "org-a" } },
    goalWorkLinks: { none: { organizationId: "org-a", goalId: "goal-a", status: "ACTIVE" } },
  });
});

test("capabilities separate owner evidence authority from exact participant work-link authority", async () => {
  const ownerOnly = ready(await queryTacticalGoalMeeting(
    { organizationId: "org-a", meetingId: "meeting-a", viewerPersonId: "viewer-a" },
    new FakePrisma({
      meeting: meeting({ participants: [] }),
      goal: goal(),
    }).dependencies(),
  ));
  assert.equal(ownerOnly.meeting.canAppendEvidence, true);
  assert.equal(ownerOnly.meeting.canManageWorkLinks, false);

  const neither = ready(await queryTacticalGoalMeeting(
    { organizationId: "org-a", meetingId: "meeting-a", viewerPersonId: "viewer-a" },
    new FakePrisma({
      meeting: meeting({ participants: [] }),
      goal: goal({ ownerRole: { id: "role-a", name: "Owner", status: "ACTIVE", assignees: [], _count: { assignees: 0 } } }),
      ownerMembership: null,
    }).dependencies(),
  ));
  assert.equal(neither.meeting.canAppendEvidence, false);
  assert.equal(neither.meeting.canManageWorkLinks, false);
});

test("participant and owner membership use exact viewer probes while owner previews disclose truncation", async () => {
  const ownerPreview = Array.from({ length: 6 }, (_, index) => ({
    id: `owner-${index}`,
    name: `Owner ${index}`,
  }));
  const fake = new FakePrisma({
    meeting: meeting({ participants: [] }),
    goal: goal({
      ownerRole: {
        id: "role-a",
        name: "Model steward",
        status: "ACTIVE",
        assignees: ownerPreview,
        _count: { assignees: 8 },
      },
    }),
    ownerMembership: { id: "role-a" },
  });

  const projection = ready(await queryTacticalGoalMeeting(
    { organizationId: "org-a", meetingId: "meeting-a", viewerPersonId: "viewer-a" },
    fake.dependencies(),
  ));

  assert.equal(projection.meeting.viewerIsParticipant, false);
  assert.equal("participants" in projection.meeting, false);
  assert.equal(projection.goal.ownerRole.assignees.length, 5);
  assert.equal(projection.goal.ownerRole.assigneeCount, 8);
  assert.equal(projection.goal.ownerRole.assigneesHasMore, true);
  assert.equal(projection.goal.viewerIsOwnerRoleAssignee, true);
  assert.equal(projection.meeting.canAppendEvidence, true);
  assert.equal(projection.meeting.canManageWorkLinks, false);

  const meetingSelect = fake.calls.find((call) => call.model === "meeting")?.args.select as Row;
  assert.deepEqual((meetingSelect.participants as Row).where, { organizationId: "org-a", id: "viewer-a" });
  assert.equal((meetingSelect.participants as Row).take, 1);

  const goalSelect = fake.calls.find((call) => call.model === "goal")?.args.select as Row;
  const ownerRoleSelect = (goalSelect.ownerRole as Row).select as Row;
  assert.equal((ownerRoleSelect.assignees as Row).take, 6);
  assert.deepEqual((ownerRoleSelect.assignees as Row).orderBy, [{ name: "asc" }, { id: "asc" }]);
  assert.deepEqual(ownerRoleSelect._count, {
    select: { assignees: { where: { organizationId: "org-a" } } },
  });

  const ownerProbe = fake.calls.find((call) => call.model === "roleDef");
  assert.deepEqual(ownerProbe?.args.where, {
    id: "role-a",
    organizationId: "org-a",
    status: "ACTIVE",
    assignees: { some: { id: "viewer-a", organizationId: "org-a" } },
    ownedGoals: { some: { id: "goal-a", organizationId: "org-a", status: "ACTIVE" } },
  });
  assert.deepEqual(ownerProbe?.args.select, { id: true });
});

test("every high-cardinality tactical collection uses a stable 50+1 probe and exposes truncation", async () => {
  const row = goal();
  const targets = row.targets as Row[];
  targets[0].checkIns = Array.from({ length: 51 }, (_, index) => checkIn(`check-${index}`, {
    recordedAt: new Date(Date.UTC(2026, 6, 15, 11, 59 - index)),
  }));
  row.workLinks = Array.from({ length: 51 }, (_, index) => ({
    id: `link-${index}`,
    kind: "PROJECT",
    status: "ACTIVE",
    projectId: `project-${index}`,
    tensionId: null,
    project: { id: `project-${index}`, name: `Project ${index}` },
    tension: null,
    createdBy: { id: "viewer-a", name: "Viewer" },
    createdMeeting: { id: "meeting-a", title: "Weekly tactical" },
    createdAt: new Date(Date.UTC(2026, 6, 15, 11, 59 - index)),
    removedBy: null,
    removedMeeting: null,
    removedAt: null,
    removalReason: null,
  }));
  const outcomes = Array.from({ length: 51 }, (_, index) => ({
    id: `proposal-${index}`,
    kind: "PROJECT",
    title: `Proposal ${index}`,
    sourceTension: { id: `source-${index}`, title: `Source ${index}` },
    outcomeProject: { id: `candidate-${index}`, name: `Candidate ${index}` },
    outcomeAction: null,
  }));
  const blockers = Array.from({ length: 51 }, (_, index) => ({ id: `blocker-${index}`, title: `Blocker ${index}`, status: "OPEN" }));
  const fake = new FakePrisma({ meeting: meeting(), goal: row, tacticalOutcomeProposals: outcomes, tensions: blockers });
  const projection = ready(await queryTacticalGoalMeeting(
    { organizationId: "org-a", meetingId: "meeting-a", viewerPersonId: "viewer-a" },
    fake.dependencies(),
  ));

  assert.equal(projection.goal.targets[0].evidence.length, 50);
  assert.equal(projection.goal.targets[0].evidenceHasMore, true);
  assert.equal(projection.goal.workLinks.length, 50);
  assert.equal(projection.goal.workLinksHasMore, true);
  assert.equal(projection.candidates.projects.length, 50);
  assert.equal(projection.candidates.approvedOutcomesHasMore, true);
  assert.equal(projection.candidates.blockingTensions.length, 50);
  assert.equal(projection.candidates.blockingTensionsHasMore, true);
  assert.equal(projection.goal.targets[0].effectiveEvidence?.id, "check-0");

  const goalSelect = fake.calls.find((call) => call.model === "goal")?.args.select as Row;
  const targetSelect = ((goalSelect.targets as Row).select as Row).checkIns as Row;
  assert.equal(targetSelect.take, 51);
  assert.equal((goalSelect.workLinks as Row).take, 51);
  assert.deepEqual((goalSelect.workLinks as Row).orderBy, [{ status: "asc" }, { createdAt: "desc" }, { id: "desc" }]);
  assert.equal(fake.calls.find((call) => call.model === "tacticalOutcomeProposal")?.args.take, 51);
  assert.equal(fake.calls.find((call) => call.model === "tension")?.args.take, 51);
});

test("invalid identities fail closed before database access", async () => {
  const fake = new FakePrisma({ meeting: meeting(), goal: goal() });
  assert.deepEqual(await queryTacticalGoalMeeting(
    { organizationId: " ", meetingId: "meeting-a", viewerPersonId: "viewer-a" },
    fake.dependencies(),
  ), { status: "NOT_AVAILABLE" });
  assert.equal(fake.calls.length, 0);
});
