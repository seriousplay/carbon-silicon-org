import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

import type { StrategicGoalMeetingProjection } from "./strategic-meeting-read-model";

type ReadModelModule = typeof import("./strategic-meeting-read-model");

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
let queryStrategicGoalMeeting: ReadModelModule["queryStrategicGoalMeeting"];

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
  ({ queryStrategicGoalMeeting } = await import("./strategic-meeting-read-model"));
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

const submittedAt = new Date("2026-07-15T08:00:00.000Z");
const decidedAt = new Date("2026-07-15T09:00:00.000Z");

type Row = Record<string, unknown>;
type Call = {
  model: "meeting" | "goalProposal" | "goalDecision";
  operation: "findFirst" | "findMany";
  args: Record<string, unknown>;
};

class FakePrisma {
  readonly calls: Call[] = [];
  readonly prisma: Record<string, Record<string, (args: Record<string, unknown>) => Promise<unknown>>>;

  constructor(private readonly tables: Record<string, Row[]>) {
    this.prisma = {
      meeting: {
        findFirst: async (args) => this.read("meeting", "findFirst", args)[0] ?? null,
      },
      goalProposal: {
        findMany: async (args) => this.read("goalProposal", "findMany", args),
      },
      goalDecision: {
        findMany: async (args) => this.read("goalDecision", "findMany", args),
      },
    };
  }

  dependencies() {
    return { prisma: this.prisma as never };
  }

  private read(model: Call["model"], operation: Call["operation"], args: Record<string, unknown>): Row[] {
    this.calls.push({ model, operation, args });
    const where = (args.where ?? {}) as Record<string, unknown>;
    const rows = (this.tables[model] ?? []).filter((row) => matches(row, where));
    const ordered = applyOrder(rows, args.orderBy);
    const skipped = typeof args.skip === "number" ? ordered.slice(args.skip) : ordered;
    const bounded = typeof args.take === "number" ? skipped.slice(0, args.take) : skipped;
    return bounded.map((row) => this.hydrate(model, row, args.select as Row | undefined));
  }

  private hydrate(model: Call["model"], source: Row, select: Row | undefined): Row {
    const row = { ...source };
    if (model === "meeting") {
      const participantArgs = select?.participants as Row | undefined;
      const participants = ((source.participants as Row[]) ?? []).filter((participant) => matches(participant, (participantArgs?.where ?? {}) as Row));
      row.participants = typeof participantArgs?.take === "number"
        ? participants.slice(0, participantArgs.take)
        : participants;
      row._count = { participants: ((source.participants as Row[]) ?? []).length };
    }
    if (model === "goalProposal") {
      const proposer = source.proposer as Row;
      const proposerSelect = ((select?.proposer as Row | undefined)?.select ?? {}) as Row;
      const meetingArgs = proposerSelect.meetingsParticipated as Row | undefined;
      const exactMeetingId = (meetingArgs?.where as Row | undefined)?.id;
      const exactMeeting = this.tables.meeting.find((meetingRow) => meetingRow.id === exactMeetingId);
      const proposerIsParticipant = ((exactMeeting?.participants as Row[]) ?? []).some((participant) => participant.id === proposer.id);
      row.proposer = {
        ...proposer,
        meetingsParticipated: proposerIsParticipant && exactMeeting ? [{ id: exactMeeting.id }] : [],
      };
      const revision = source.currentRevisionRecord as Row;
      const targetArgs = (((select?.currentRevisionRecord as Row | undefined)?.select as Row | undefined)?.targets ?? {}) as Row;
      const targets = applyOrder((revision.targets as Row[]) ?? [], targetArgs.orderBy);
      row.currentRevisionRecord = {
        ...revision,
        targets: typeof targetArgs.take === "number" ? targets.slice(0, targetArgs.take) : targets,
      };
    }
    return row;
  }
}

function matches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, expected]) => row[key] === expected);
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

function meeting(overrides: Row = {}): Row {
  return {
    id: "meeting-a",
    organizationId: "org-a",
    title: "Strategy review",
    type: "STRATEGY",
    endedAt: null,
    circleId: "circle-a",
    circle: { id: "circle-a", name: "Circle A" },
    participants: [
      { id: "viewer-a", name: "Viewer A", organizationId: "org-a" },
      { id: "proposer-a", name: "Proposer A", organizationId: "org-a" },
    ],
    ...overrides,
  };
}

function proposal(id: string, overrides: Row = {}): Row {
  return {
    id,
    organizationId: "org-a",
    circleId: "circle-a",
    kind: "REPLACE",
    status: "SUBMITTED",
    currentRevision: 2,
    submittedAt,
    proposer: { id: "proposer-a", name: "Proposer A" },
    cycle: { id: "cycle-a", name: "Cycle A", status: "ACTIVE" },
    replacedGoal: {
      id: "replaced-a",
      cycleId: "cycle-a",
      title: "Existing goal",
      intendedOutcome: "Existing outcome",
      status: "ACTIVE",
    },
    currentRevisionRecord: {
      revision: 2,
      title: "Proposed goal",
      intendedOutcome: "Proposed outcome",
      closeResult: null,
      conclusion: null,
      ownerRole: {
        id: "role-a",
        circleId: "circle-a",
        name: "Goal owner",
        status: "ACTIVE",
      },
      parentGoal: {
        id: "parent-a",
        cycleId: "cycle-a",
        title: "Parent goal",
        status: "ACTIVE",
      },
      targets: [{
        id: "target-a",
        position: 0,
        label: "Revenue",
        kind: "NUMERIC",
        baselineValue: "10.0000000000",
        desiredValue: "20.0000000000",
        unit: "M",
        acceptanceCriteria: null,
        metricId: "metric-a",
        metric: { id: "metric-a", name: "Revenue metric" },
      }],
    },
    ...overrides,
  };
}

function decision(id: string, overrides: Row = {}): Row {
  return {
    id,
    organizationId: "org-a",
    meetingId: "meeting-a",
    proposalId: `proposal-${id}`,
    revision: 2,
    outcome: "ADOPTED",
    note: "Accepted",
    decidedAt,
    proposal: { id: `proposal-${id}`, kind: "CREATE", cycleId: "cycle-a" },
    revisionRecord: { revision: 2, title: "Decision revision" },
    recorder: { id: "viewer-a", name: "Viewer A" },
    adoptedGoal: null,
    terminalGoal: null,
    ...overrides,
  };
}

function tables(overrides: Partial<Record<string, Row[]>> = {}): Record<string, Row[]> {
  return {
    meeting: [meeting()],
    goalProposal: [],
    goalDecision: [],
    ...overrides,
  };
}

function ready(projection: StrategicGoalMeetingProjection): Extract<StrategicGoalMeetingProjection, { status: "READY" }> {
  assert.equal(projection.status, "READY");
  return projection as Extract<StrategicGoalMeetingProjection, { status: "READY" }>;
}

test("tenant denial never falls back and every executed query is tenant-scoped", async () => {
  const fake = new FakePrisma(tables({
    meeting: [meeting({ organizationId: "org-b", title: "Tenant B meeting" })],
  }));

  const projection = await queryStrategicGoalMeeting(
    { organizationId: "org-a", meetingId: "meeting-a", viewerPersonId: "viewer-a" },
    fake.dependencies(),
  );

  assert.deepEqual(projection, { status: "NOT_AVAILABLE" });
  assert.equal(fake.calls.length, 1);
  assert.deepEqual(fake.calls[0].args.where, { id: "meeting-a", organizationId: "org-a" });

  const successful = new FakePrisma(tables({
    goalProposal: [proposal("proposal-a")],
    goalDecision: [decision("decision-a")],
  }));
  await queryStrategicGoalMeeting(
    { organizationId: "org-a", meetingId: "meeting-a", viewerPersonId: "viewer-a" },
    successful.dependencies(),
  );
  assert.deepEqual(successful.calls.map((call) => call.model), ["meeting", "goalProposal", "goalDecision"]);
  for (const call of successful.calls) {
    assert.equal((call.args.where as Row).organizationId, "org-a", `${call.model} must be tenant-scoped`);
  }

  const meetingSelect = successful.calls[0].args.select as Row;
  const participantArgs = meetingSelect.participants as { where: Row; take: number };
  assert.deepEqual(participantArgs.where, { organizationId: "org-a", id: "viewer-a" });
  assert.equal(participantArgs.take, 1);
  assert.deepEqual(meetingSelect._count, {
    select: { participants: { where: { organizationId: "org-a" } } },
  });
  const proposalSelect = successful.calls[1].args.select as Row;
  const proposerSelect = (proposalSelect.proposer as { select: Row }).select;
  const participationProbe = proposerSelect.meetingsParticipated as Row;
  assert.deepEqual(participationProbe.where, { id: "meeting-a", organizationId: "org-a" });
  assert.equal(participationProbe.take, 1);
  const revisionSelect = (proposalSelect.currentRevisionRecord as { select: Row }).select;
  const targetArgs = revisionSelect.targets as { where: Row };
  assert.equal(targetArgs.where.organizationId, "org-a");
  assert.equal((targetArgs as unknown as Row).take, 21);
});

test("wrong meeting type or missing Circle is not available and performs no secondary reads", async () => {
  for (const row of [
    meeting({ type: "TACTICAL" }),
    meeting({ circleId: null, circle: null }),
  ]) {
    const fake = new FakePrisma(tables({ meeting: [row] }));
    assert.deepEqual(
      await queryStrategicGoalMeeting(
        { organizationId: "org-a", meetingId: "meeting-a", viewerPersonId: "viewer-a" },
        fake.dependencies(),
      ),
      { status: "NOT_AVAILABLE" },
    );
    assert.deepEqual(fake.calls.map((call) => call.model), ["meeting"]);
  }
});

test("record capability requires an open meeting plus viewer and proposer participation", async () => {
  const rows = [
    proposal("present"),
    proposal("absent", { proposer: { id: "proposer-absent", name: "Absent proposer" } }),
    proposal("planned", { cycle: { id: "cycle-planned", name: "Planned", status: "PLANNED" } }),
    proposal("closed", { cycle: { id: "cycle-closed", name: "Closed", status: "CLOSED" } }),
    proposal("cancelled", { cycle: { id: "cycle-cancelled", name: "Cancelled", status: "CANCELLED" } }),
  ];
  const open = ready(await queryStrategicGoalMeeting(
    { organizationId: "org-a", meetingId: "meeting-a", viewerPersonId: "viewer-a" },
    new FakePrisma(tables({ goalProposal: rows })).dependencies(),
  ));
  assert.equal(open.meeting.viewerIsParticipant, true);
  assert.equal(open.meeting.participantCount, 2);
  assert.equal("participants" in open.meeting, false);
  assert.deepEqual(open.proposals.map((item) => [item.id, item.proposerIsParticipant, item.canRecord, item.canAdopt]), [
    ["absent", false, false, false],
    ["cancelled", true, false, false],
    ["closed", true, false, false],
    ["planned", true, true, false],
    ["present", true, true, true],
  ]);

  const ended = ready(await queryStrategicGoalMeeting(
    { organizationId: "org-a", meetingId: "meeting-a", viewerPersonId: "viewer-a" },
    new FakePrisma(tables({
      meeting: [meeting({ endedAt: decidedAt })],
      goalProposal: rows,
    })).dependencies(),
  ));
  assert.equal(ended.meeting.endedAt, decidedAt);
  assert.ok(ended.proposals.every((item) => !item.canRecord));
  assert.ok(ended.proposals.every((item) => !item.canAdopt));

  const viewerAbsent = ready(await queryStrategicGoalMeeting(
    { organizationId: "org-a", meetingId: "meeting-a", viewerPersonId: "viewer-absent" },
    new FakePrisma(tables({ goalProposal: rows })).dependencies(),
  ));
  assert.equal(viewerAbsent.meeting.viewerIsParticipant, false);
  assert.ok(viewerAbsent.proposals.every((item) => !item.canRecord));
  assert.ok(viewerAbsent.proposals.every((item) => !item.canAdopt));
});

test("proposals use exact Circle and SUBMITTED filters and stay pinned to currentRevisionRecord", async () => {
  const projection = ready(await queryStrategicGoalMeeting(
    { organizationId: "org-a", meetingId: "meeting / one", viewerPersonId: "viewer-a" },
    new FakePrisma(tables({
      meeting: [meeting({ id: "meeting / one", circleId: "circle / a", circle: { id: "circle / a", name: "Circle A" } })],
      goalProposal: [
        proposal("current", {
          circleId: "circle / a",
          cycle: { id: "cycle / one", name: "Cycle One", status: "ACTIVE" },
          proposer: { id: "proposer-a", name: "Proposer A" },
          replacedGoal: {
            id: "goal / replaced",
            cycleId: "cycle / one",
            title: "Existing goal",
            intendedOutcome: "Existing outcome",
            status: "ACTIVE",
          },
          currentRevisionRecord: {
            ...(proposal("seed").currentRevisionRecord as Row),
            ownerRole: { id: "role / one", circleId: "circle / a", name: "Owner", status: "ACTIVE" },
            parentGoal: { id: "goal / parent", cycleId: "cycle / one", title: "Parent", status: "ACTIVE" },
          },
        }),
        proposal("other-circle", { circleId: "circle-b" }),
        proposal("draft", { circleId: "circle / a", status: "DRAFT" }),
        proposal("other-tenant", { organizationId: "org-b", circleId: "circle / a" }),
      ],
    })).dependencies(),
  ));

  assert.deepEqual(projection.proposals.map((item) => item.id), ["current"]);
  const current = projection.proposals[0];
  assert.equal(current.currentRevision.revision, 2);
  assert.equal(current.currentRevision.targets[0].baselineValue, "10.0000000000");
  assert.equal(current.currentRevision.targets[0].metric?.name, "Revenue metric");
  assert.equal(current.url, "/loopos/app/goals?cycle=cycle%20%2F%20one");
  assert.equal(current.replacedGoal?.url, "/loopos/app/goals?cycle=cycle%20%2F%20one&goal=goal%20%2F%20replaced");
  assert.equal(current.currentRevision.ownerRole?.url, "/loopos/app/roles/role%20%2F%20one");
  assert.equal(current.currentRevision.parentGoal?.url, "/loopos/app/goals?cycle=cycle%20%2F%20one&goal=goal%20%2F%20parent");
  assert.equal(projection.meeting.url, "/loopos/app/meetings/meeting%20%2F%20one");
  assert.equal(projection.meeting.circle.url, "/loopos/app/circles/circle%20%2F%20a");
});

test("replacement and closure proposals retain non-ACTIVE target Goal context", async () => {
  const projection = ready(await queryStrategicGoalMeeting(
    { organizationId: "org-a", meetingId: "meeting-a", viewerPersonId: "viewer-a" },
    new FakePrisma(tables({
      goalProposal: [
        proposal("replace-superseded", {
          kind: "REPLACE",
          replacedGoal: {
            id: "goal-superseded",
            cycleId: "cycle-a",
            title: "Superseded goal",
            intendedOutcome: "Superseded outcome",
            status: "SUPERSEDED",
          },
        }),
        proposal("close-achieved", {
          kind: "CLOSE",
          replacedGoal: {
            id: "goal-achieved",
            cycleId: "cycle-a",
            title: "Achieved goal",
            intendedOutcome: "Achieved outcome",
            status: "ACHIEVED",
          },
        }),
      ],
    })).dependencies(),
  ));

  assert.deepEqual(
    projection.proposals.map((item) => [item.id, item.replacedGoal?.id, item.replacedGoal?.status]),
    [
      ["close-achieved", "goal-achieved", "ACHIEVED"],
      ["replace-superseded", "goal-superseded", "SUPERSEDED"],
    ],
  );
});

test("decisions are exact-meeting history with recorder and adopted or terminal Goal provenance", async () => {
  const projection = ready(await queryStrategicGoalMeeting(
    { organizationId: "org-a", meetingId: "meeting-a", viewerPersonId: "viewer-a" },
    new FakePrisma(tables({
      goalDecision: [
        decision("adoption", {
          proposalId: "proposal-adoption",
          proposal: { id: "proposal-adoption", kind: "CREATE", cycleId: "cycle-a" },
          adoptedGoal: { id: "goal-adopted", cycleId: "cycle-a", title: "Adopted", status: "ACTIVE" },
        }),
        decision("terminal", {
          proposalId: "proposal-terminal",
          proposal: { id: "proposal-terminal", kind: "CLOSE", cycleId: "cycle-a" },
          outcome: "ADOPTED",
          note: "Goal achieved",
          recorder: { id: "recorder-a", name: "Recorder A" },
          terminalGoal: { id: "goal-terminal", cycleId: "cycle-a", title: "Terminal", status: "ACHIEVED" },
        }),
        decision("other-meeting", { meetingId: "meeting-b" }),
        decision("other-tenant", { organizationId: "org-b" }),
      ],
    })).dependencies(),
  ));

  assert.deepEqual(projection.decisions.map((item) => item.id), ["adoption", "terminal"]);
  assert.deepEqual(projection.decisions[0].recorder, { id: "viewer-a", name: "Viewer A" });
  assert.equal(projection.decisions[0].revision, 2);
  assert.equal(projection.decisions[0].revisionTitle, "Decision revision");
  assert.equal(projection.decisions[0].proposalUrl, "/loopos/app/goals?cycle=cycle-a");
  assert.equal(projection.decisions[0].adoptedGoal?.url, "/loopos/app/goals?cycle=cycle-a&goal=goal-adopted");
  assert.equal(projection.decisions[1].note, "Goal achieved");
  assert.equal(projection.decisions[1].terminalGoal?.url, "/loopos/app/goals?cycle=cycle-a&goal=goal-terminal");
});

test("101 proposal and decision rows remain reachable over three bounded independent pages", async () => {
  const proposals = Array.from({ length: 101 }, (_, index) => proposal(`proposal-${String(index).padStart(3, "0")}`));
  const decisions = Array.from({ length: 101 }, (_, index) => decision(`decision-${String(index).padStart(3, "0")}`));
  const fake = new FakePrisma(tables({ goalProposal: proposals, goalDecision: decisions }));

  const pages = [];
  for (const page of [1, 2, 3]) {
    pages.push(ready(await queryStrategicGoalMeeting(
      {
        organizationId: "org-a",
        meetingId: "meeting-a",
        viewerPersonId: "viewer-a",
        proposalPage: page,
        decisionPage: page,
      },
      fake.dependencies(),
    )));
  }

  assert.deepEqual(pages.map((page) => page.proposals.length), [50, 50, 1]);
  assert.deepEqual(pages.map((page) => page.decisions.length), [50, 50, 1]);
  assert.deepEqual(pages.map((page) => page.proposalPagination), [
    { page: 1, pageSize: 50, hasPrevious: false, hasNext: true },
    { page: 2, pageSize: 50, hasPrevious: true, hasNext: true },
    { page: 3, pageSize: 50, hasPrevious: true, hasNext: false },
  ]);
  assert.deepEqual(pages.map((page) => page.decisionPagination), pages.map((page) => page.proposalPagination));
  assert.deepEqual(pages.map((page) => page.proposals[0]?.id), ["proposal-000", "proposal-050", "proposal-100"]);
  assert.deepEqual(pages.map((page) => page.decisions[0]?.id), ["decision-000", "decision-050", "decision-100"]);

  for (const model of ["goalProposal", "goalDecision"] as const) {
    const calls = fake.calls.filter((call) => call.model === model);
    assert.deepEqual(calls.map((call) => call.args.skip), [0, 50, 100]);
    assert.deepEqual(calls.map((call) => call.args.take), [51, 51, 51]);
  }
});

test("invalid and unsafe pages normalize to page one", async () => {
  for (const invalid of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER]) {
    const fake = new FakePrisma(tables());
    const projection = ready(await queryStrategicGoalMeeting(
      {
        organizationId: "org-a",
        meetingId: "meeting-a",
        viewerPersonId: "viewer-a",
        proposalPage: invalid,
        decisionPage: invalid,
      },
      fake.dependencies(),
    ));
    assert.equal(projection.proposalPagination.page, 1);
    assert.equal(projection.decisionPagination.page, 1);
    assert.equal(fake.calls.find((call) => call.model === "goalProposal")?.args.skip, 0);
    assert.equal(fake.calls.find((call) => call.model === "goalDecision")?.args.skip, 0);
  }
});

test("revision Target overflow returns an explicit TRUNCATED projection and no actionable proposals", async () => {
  const overflowingProposal = proposal("overflow", {
    currentRevisionRecord: {
      ...(proposal("seed").currentRevisionRecord as Row),
      targets: Array.from({ length: 21 }, (_, index) => ({
        id: `target-${index}`,
        position: index,
        label: `Target ${index}`,
        kind: "MILESTONE",
        baselineValue: null,
        desiredValue: null,
        unit: null,
        acceptanceCriteria: "Done",
        metricId: null,
      })),
    },
  });
  const projection = await queryStrategicGoalMeeting(
    { organizationId: "org-a", meetingId: "meeting-a", viewerPersonId: "viewer-a" },
    new FakePrisma(tables({ goalProposal: [overflowingProposal] })).dependencies(),
  );

  assert.deepEqual(projection, { status: "TRUNCATED", reason: "PROPOSAL_TARGET_LIMIT_EXCEEDED" });
  assert.equal(JSON.stringify(projection).includes("canRecord"), false);
});

test("participant count and proposer membership are exact and independent of participant previews", async () => {
  const participants = Array.from({ length: 73 }, (_, index) => ({
    id: index === 0 ? "viewer-a" : index === 72 ? "proposer-last" : `participant-${index}`,
    name: `Participant ${index}`,
    organizationId: "org-a",
  }));
  const projection = ready(await queryStrategicGoalMeeting(
    { organizationId: "org-a", meetingId: "meeting-a", viewerPersonId: "viewer-a" },
    new FakePrisma(tables({
      meeting: [meeting({ participants })],
      goalProposal: [proposal("last", { proposer: { id: "proposer-last", name: "Last proposer" } })],
    })).dependencies(),
  ));

  assert.equal(projection.meeting.participantCount, 73);
  assert.equal(projection.meeting.viewerIsParticipant, true);
  assert.equal(projection.proposals[0].proposerIsParticipant, true);
  assert.equal(projection.proposals[0].canRecord, true);
});
