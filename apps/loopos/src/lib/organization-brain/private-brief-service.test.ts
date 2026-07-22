import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, test } from "node:test";
import type { ActorContext } from "../authorization/actor-context-resolver";
import type {
  PrivateBriefFactStore,
  PrivateBriefSourceFacts,
} from "./private-brief-service";

type ServiceModule = typeof import("./private-brief-service");

const require = createRequire(import.meta.url);
const originalNodePath = process.env.NODE_PATH;
const compiledModules = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../node_modules/next/dist/compiled",
);
const moduleWithInitPaths = Module as typeof Module & { _initPaths(): void };
let originalServerOnlyModule: NodeJS.Module | undefined;
let serverOnlyPath = "";
let service: ServiceModule;

before(async () => {
  process.env.NODE_PATH = originalNodePath
    ? `${compiledModules}:${originalNodePath}`
    : compiledModules;
  moduleWithInitPaths._initPaths();
  serverOnlyPath = require.resolve("server-only");
  originalServerOnlyModule = require.cache[serverOnlyPath];
  const serverOnlyShim = new Module(serverOnlyPath);
  serverOnlyShim.filename = serverOnlyPath;
  serverOnlyShim.loaded = true;
  require.cache[serverOnlyPath] = serverOnlyShim;
  service = await import("./private-brief-service");
});

after(() => {
  if (originalServerOnlyModule) require.cache[serverOnlyPath] = originalServerOnlyModule;
  else delete require.cache[serverOnlyPath];
  if (originalNodePath === undefined) delete process.env.NODE_PATH;
  else process.env.NODE_PATH = originalNodePath;
  moduleWithInitPaths._initPaths();
});

const now = new Date("2026-07-15T12:00:00.000Z");
const actor: ActorContext = {
  organizationId: "org-a",
  userId: "user-a",
  personId: "person-a",
  membershipRole: "ORG_MEMBER",
  homeCircleId: "circle-a",
  assignedActiveRoleDefIds: ["role-a"],
  ledActiveCircleIds: ["circle-a"],
};

const emptyFacts: PrivateBriefSourceFacts = {
  goals: [],
  targets: [],
  meetings: [],
  tensions: [],
  work: [],
  circles: [],
};

describe("V5-M4-A2 private brief service", () => {
  test("returns a fixed access denial when actor context cannot be resolved", async () => {
    const facts: PrivateBriefFactStore = {
      loadFacts: async () => assert.fail("facts must not load without actor context"),
    };

    await assert.rejects(
      () => service.buildPrivateBriefForCurrentActor(
        { schemaVersion: 1 },
        {
          resolveActor: async () => {
            throw new Error("missing session");
          },
          facts,
          now: () => now,
        },
      ),
      (error) => error instanceof service.PrivateBriefServiceError && error.code === "ACCESS_DENIED",
    );
  });

  test("validates public input before reading actor or facts", async () => {
    await assert.rejects(
      () => service.buildPrivateBriefForCurrentActor(
        { schemaVersion: 1, maxSignals: 31 },
        {
          resolveActor: async () => assert.fail("actor must not resolve for invalid input"),
          facts: { loadFacts: async () => assert.fail("facts must not load for invalid input") },
          now: () => now,
        },
      ),
      (error) => error instanceof service.PrivateBriefServiceError && error.code === "INVALID_INPUT",
    );
  });

  test("projects only current-tenant and actor-owned facts into the private detector", async () => {
    const seenActors: ActorContext[] = [];
    const facts: PrivateBriefFactStore = {
      async loadFacts(currentActor) {
        seenActors.push(currentActor);
        return {
          goals: [
            {
              organizationId: "org-a",
              id: "goal-a",
              title: "Main goal",
              circleId: "circle-a",
              circleName: "Main",
              cycleId: "cycle-a",
              status: "ACTIVE",
              isPrimary: true,
              lastCheckInAt: null,
              applicationUrl: "/app/goals?goal=goal-a",
            },
            {
              organizationId: "org-b",
              id: "goal-b",
              title: "Other tenant goal",
              circleId: "circle-b",
              circleName: "Other",
              cycleId: "cycle-b",
              status: "ACTIVE",
              isPrimary: true,
              lastCheckInAt: null,
              applicationUrl: "/app/goals?goal=goal-b",
            },
          ],
          targets: [
            {
              organizationId: "org-a",
              id: "target-a",
              goalId: "goal-a",
              goalTitle: "Main goal",
              label: "Evidence",
              evidenceAt: null,
              applicationUrl: "/app/goals?goal=goal-a#target-a",
            },
          ],
          meetings: [
            {
              organizationId: "org-a",
              id: "meeting-a",
              title: "Weekly tactical",
              type: "TACTICAL",
              circleId: "circle-a",
              startedAt: "2026-07-14T12:00:00.000Z",
              unresolvedOutputCount: 1,
              applicationUrl: "/app/meetings/meeting-a",
            },
          ],
          tensions: [
            {
              organizationId: "org-a",
              id: "tension-a1",
              title: "Same issue",
              circleId: "circle-a",
              circleName: "Main",
              status: "OPEN",
              similarityKey: "same",
              createdAt: "2026-07-13T12:00:00.000Z",
              applicationUrl: "/app/tensions/tension-a1",
            },
            {
              organizationId: "org-a",
              id: "tension-a2",
              title: "Same issue again",
              circleId: "circle-a",
              circleName: "Main",
              status: "OPEN",
              similarityKey: "same",
              createdAt: "2026-07-12T12:00:00.000Z",
              applicationUrl: "/app/tensions/tension-a2",
            },
          ],
          work: [
            {
              organizationId: "org-a",
              id: "project-a",
              kind: "PROJECT",
              title: "Actor project",
              status: "ACTIVE",
              ownerPersonId: "person-a",
              roleId: null,
              circleId: "circle-a",
              applicationUrl: "/app/projects/project-a",
            },
            {
              organizationId: "org-a",
              id: "project-other",
              kind: "PROJECT",
              title: "Other project",
              status: "ACTIVE",
              ownerPersonId: "person-other",
              roleId: null,
              circleId: "circle-a",
              applicationUrl: "/app/projects/project-other",
            },
          ],
          circles: [
            {
              organizationId: "org-a",
              id: "circle-child",
              name: "Child",
              parentCircleId: "circle-a",
              applicationUrl: "/app/circles/circle-child",
            },
          ],
        };
      },
    };

    const brief = await service.buildPrivateBriefForCurrentActor(
      { schemaVersion: 1 },
      { resolveActor: async () => actor, facts, now: () => now },
    );

    assert.deepEqual(seenActors, [actor]);
    assert.deepEqual(
      brief.signals.map((signal) => signal.kind).sort(),
      [
        "MISSING_CHILD_GOAL",
        "MISSING_TARGET_EVIDENCE",
        "REPEATED_TENSION",
        "ROLE_WORK_MISMATCH",
        "STALE_GOAL_CHECK_IN",
        "UNRESOLVED_MEETING_OUTPUT",
      ].sort(),
    );
    assert.equal(brief.signals.some((signal) => signal.sources.some((source) => source.id === "goal-b")), false);
    assert.equal(brief.signals.some((signal) => signal.sources.some((source) => source.id === "project-other")), false);
  });

  test("caps public output through the detector without disclosing hidden counts", async () => {
    const facts: PrivateBriefFactStore = {
      async loadFacts() {
        return {
          ...emptyFacts,
          goals: [
            {
              organizationId: "org-a",
              id: "goal-a",
              title: "First",
              circleId: "circle-a",
              circleName: "Main",
              cycleId: "cycle-a",
              status: "ACTIVE",
              isPrimary: true,
              lastCheckInAt: null,
              applicationUrl: "/app/goals?goal=goal-a",
            },
            {
              organizationId: "org-a",
              id: "goal-b",
              title: "Second",
              circleId: "circle-a",
              circleName: "Main",
              cycleId: "cycle-a",
              status: "ACTIVE",
              isPrimary: true,
              lastCheckInAt: null,
              applicationUrl: "/app/goals?goal=goal-b",
            },
          ],
        };
      },
    };

    const brief = await service.buildPrivateBriefForCurrentActor(
      { schemaVersion: 1, maxSignals: 1 },
      { resolveActor: async () => actor, facts, now: () => now },
    );

    assert.equal(brief.signals.length, 1);
    assert.equal(brief.truncated, true);
  });

  test("Prisma fact store scopes every production read to the current actor organization", async () => {
    const calls: Array<Readonly<{ model: string; where: unknown }>> = [];
    const store = service.createPrismaPrivateBriefFactStore(fakePrisma(calls) as never);

    const facts = await store.loadFacts(actor, {
      now,
      windowDays: 7,
      maxFacts: 10,
    });

    assert.equal(calls.length > 0, true);
    for (const call of calls) {
      assert.match(JSON.stringify(call.where), /"organizationId":"org-a"/);
      assert.doesNotMatch(JSON.stringify(call.where), /org-b|person-other/);
    }
    assert.deepEqual(calls.find((call) => call.model === "meeting")?.where, {
      organizationId: "org-a",
      startedAt: { gte: new Date("2026-07-08T12:00:00.000Z") },
      participants: { some: { id: "person-a" } },
    });
    assert.deepEqual(calls.find((call) => call.model === "project")?.where, {
      organizationId: "org-a",
      bearerId: "person-a",
      status: "ACTIVE",
      tacticalOutcomeProposal: { status: "APPROVED", kind: "PROJECT" },
    });
    assert.deepEqual(calls.filter((call) => call.model === "tension")[1]?.where, {
      organizationId: "org-a",
      ownerId: "person-a",
      status: { notIn: ["RESOLVED", "REJECTED"] },
      tacticalOutcomeActionProposal: { status: "APPROVED", kind: "ACTION" },
    });
    assert.deepEqual(facts.goals.map((goal) => goal.id), ["goal-a"]);
    assert.deepEqual(facts.work.map((work) => work.ownerPersonId), ["person-a", "person-a"]);
  });

  test("static boundary has no command execution, provider, plugin, deployment, shared-memory, or write imports", () => {
    const source = readFileSync(new URL("./private-brief-service.ts", import.meta.url), "utf8");
    assert.match(source, /resolveActorContext/);
    assert.match(source, /buildPrivateBrief/);
    for (const forbidden of [
      "command-registry",
      "command-preview-core",
      "goal-command-handler",
      "reasoner",
      "query-planner",
      "plugin",
      "deployment",
      "shared-memory",
      "brain_memory",
    ]) {
      assert.doesNotMatch(source, new RegExp(forbidden));
    }
    assert.doesNotMatch(source, /\.(create|update|upsert|delete|deleteMany|createMany)\s*\(/);
    assert.doesNotMatch(source, /\$executeRaw|\$queryRaw|\$transaction/);
  });
});

function fakePrisma(calls: Array<Readonly<{ model: string; where: unknown }>>) {
  const record = (model: string, args: { where?: unknown }) => {
    calls.push({ model, where: args.where });
  };
  return {
    roleDef: {
      findMany: async (args: { where?: unknown }) => {
        record("roleDef", args);
        return [{ id: "role-a", circleId: "circle-a" }];
      },
    },
    goalCycle: {
      findFirst: async (args: { where?: unknown }) => {
        record("goalCycle", args);
        return { id: "cycle-a" };
      },
    },
    circle: {
      findMany: async (args: { where?: unknown }) => {
        record("circle", args);
        return [{ id: "circle-a", organizationId: "org-a", name: "Main", parentId: null }];
      },
    },
    goal: {
      findMany: async (args: { where?: unknown }) => {
        record("goal", args);
        return [{
          id: "goal-a",
          organizationId: "org-a",
          cycleId: "cycle-a",
          circleId: "circle-a",
          title: "Main goal",
          parentGoalId: null,
          checkIns: [],
          targets: [{
            id: "target-a",
            organizationId: "org-a",
            goalId: "goal-a",
            label: "Evidence",
            checkIns: [],
          }],
          circle: { name: "Main" },
        }];
      },
    },
    meeting: {
      findMany: async (args: { where?: unknown }) => {
        record("meeting", args);
        return [{
          id: "meeting-a",
          organizationId: "org-a",
          title: "Weekly",
          type: "TACTICAL",
          circleId: "circle-a",
          startedAt: now,
          tacticalOutcomeProposals: [{ id: "proposal-a" }],
          governanceDecisionProcesses: [],
          goalDecisions: [],
        }];
      },
    },
    tension: {
      findMany: async (args: { where?: unknown }) => {
        record("tension", args);
        return [{
          id: "tension-a",
          organizationId: "org-a",
          title: "Action",
          status: "OPEN",
          circleId: "circle-a",
          createdAt: now,
          updatedAt: now,
          ownerId: "person-a",
          roleId: null,
          circle: { id: "circle-a", name: "Main" },
          circles: [],
        }];
      },
    },
    project: {
      findMany: async (args: { where?: unknown }) => {
        record("project", args);
        return [{
          id: "project-a",
          organizationId: "org-a",
          name: "Actor project",
          status: "ACTIVE",
          bearerId: "person-a",
          circleId: "circle-a",
        }];
      },
    },
  };
}
