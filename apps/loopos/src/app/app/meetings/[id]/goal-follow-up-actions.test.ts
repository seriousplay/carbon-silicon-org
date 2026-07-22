import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import { GoalDomainError, type GoalDomainActor } from "@/lib/goals/domain-operations";
import { withGoalFollowUpActionTestDependencies } from "./goal-follow-up-action-dependencies";

type ActionsModule = typeof import("./goal-follow-up-actions");
const require = createRequire(import.meta.url);
const originalNodePath = process.env.NODE_PATH;
const compiledModules = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../node_modules/next/dist/compiled");
const moduleWithInitPaths = Module as typeof Module & { _initPaths(): void };
let originalServerOnlyModule: NodeJS.Module | undefined;
let serverOnlyPath = "";
let actions: ActionsModule;

before(async () => {
  process.env.NODE_PATH = originalNodePath ? `${compiledModules}:${originalNodePath}` : compiledModules;
  moduleWithInitPaths._initPaths();
  serverOnlyPath = require.resolve("server-only");
  originalServerOnlyModule = require.cache[serverOnlyPath];
  const shim = new Module(serverOnlyPath);
  shim.filename = serverOnlyPath;
  shim.loaded = true;
  require.cache[serverOnlyPath] = shim;
  actions = await import("./goal-follow-up-actions");
});

after(() => {
  if (originalServerOnlyModule) require.cache[serverOnlyPath] = originalServerOnlyModule;
  else delete require.cache[serverOnlyPath];
  if (originalNodePath === undefined) delete process.env.NODE_PATH;
  else process.env.NODE_PATH = originalNodePath;
  moduleWithInitPaths._initPaths();
});

const actor = {
  organizationId: "org-a",
  userId: "user-a",
  personId: "person-a",
} satisfies GoalDomainActor;

function createHarness(options: {
  meeting?: { id: string; circleId: string; endedAt: Date | null; participants: Array<{ id: string }> } | null;
  goal?: { id: string; circleId: string; ownerRole: { status: string; assignees: Array<{ id: string }> } } | null;
} = {}) {
  const calls: Array<{ operation: string; input: unknown }> = [];
  const queries: Array<{ model: string; args: unknown }> = [];
  const revalidated: string[] = [];
  const meeting = options.meeting === undefined
    ? { id: "meeting-a", circleId: "circle-a", endedAt: null, participants: [{ id: "person-a" }] }
    : options.meeting;
  const goal = options.goal === undefined
    ? { id: "goal-a", circleId: "circle-a", ownerRole: { status: "ACTIVE", assignees: [] } }
    : options.goal;
  const prisma = {
    meeting: { findFirst: async (args: unknown) => { queries.push({ model: "meeting", args }); return meeting; } },
    goal: { findFirst: async (args: unknown) => { queries.push({ model: "goal", args }); return goal; } },
  };
  const domain = { marker: "domain" };
  return {
    calls,
    queries,
    revalidated,
    domain,
    dependencies: {
      prisma,
      resolveActorContext: async () => actor,
      revalidatePath: (path: string) => revalidated.push(path),
      createPrismaGoalDomainDependencies: (received: unknown) => {
        assert.equal(received, prisma);
        return domain;
      },
      appendGoalCheckIns: async (input: unknown) => {
        calls.push({ operation: "CHECK_IN", input });
        return [{ id: "internal-check-in", recordedAt: new Date(), meetingId: "meeting-a" }];
      },
      createGoalWorkLink: async (input: unknown) => {
        calls.push({ operation: "LINK", input });
        return { id: "internal-link", status: "ACTIVE" };
      },
      removeGoalWorkLink: async (input: unknown) => {
        calls.push({ operation: "REMOVE", input });
        return { id: "internal-link", status: "REMOVED" };
      },
    },
  };
}

function checkInForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  for (const [name, value] of Object.entries({
    targetId: "target-a",
    assessment: "ON_TRACK",
    fact: "  Evaluation completed.  ",
    evidenceSummary: "  Score is 15.  ",
    currentValue: "15",
    sourceUrl: "https://example.com/evidence",
    ...overrides,
  })) form.set(name, value);
  return form;
}

function linkForm(kind = "PROJECT", workObjectId = "project-a") {
  const form = new FormData();
  form.set("kind", kind);
  form.set("workObjectId", workObjectId);
  return form;
}

function removeForm(reason = "No longer blocks delivery") {
  const form = new FormData();
  form.set("linkId", "link-a");
  form.set("reason", reason);
  return form;
}

async function run<T>(harness: ReturnType<typeof createHarness>, work: () => Promise<T>) {
  return withGoalFollowUpActionTestDependencies(harness.dependencies, work);
}

test("exports exactly the three thin follow-up Server Actions", () => {
  assert.deepEqual(Object.keys(actions).sort(), [
    "appendGoalCheckInAction",
    "createGoalWorkLinkAction",
    "removeGoalWorkLinkAction",
  ]);
});

test("check-in derives identity, validates exact meeting/Goal, and delegates once to B2", async () => {
  const harness = createHarness();
  const result = await run(harness, () => actions.appendGoalCheckInAction(
    "meeting-a", "goal-a", undefined, checkInForm(),
  ));
  assert.deepEqual(result, { status: "SUCCESS", operation: "CHECK_IN" });
  assert.deepEqual(harness.calls, [{
    operation: "CHECK_IN",
    input: {
      organizationId: "org-a",
      goalId: "goal-a",
      actor,
      meetingId: "meeting-a",
      entries: [{
        targetId: "target-a",
        assessment: "ON_TRACK",
        fact: "Evaluation completed.",
        evidenceSummary: "Score is 15.",
        currentValue: "15",
        sourceUrl: "https://example.com/evidence",
      }],
    },
  }]);
  assert.deepEqual(harness.revalidated, ["/app/meetings/meeting-a", "/app/goals", "/app"]);
});

test("milestone ACHIEVED correction preserves append-only input without client identity", async () => {
  const harness = createHarness();
  const form = checkInForm({
    assessment: "ACHIEVED",
    milestoneCompleted: "true",
    acceptanceEvidence: "Acceptance suite passed",
    supersedesCheckInId: "check-old",
  });
  form.delete("currentValue");
  form.delete("sourceUrl");
  form.set("organizationId", "forged-org");
  assert.deepEqual(await run(harness, () => actions.appendGoalCheckInAction(
    "meeting-a", "goal-a", undefined, form,
  )), { status: "ERROR", code: "INVALID_INPUT" });
  assert.equal(harness.calls.length, 0);

  form.delete("organizationId");
  assert.deepEqual(await run(harness, () => actions.appendGoalCheckInAction(
    "meeting-a", "goal-a", undefined, form,
  )), { status: "SUCCESS", operation: "CHECK_IN" });
  assert.deepEqual((harness.calls[0].input as { entries: unknown[] }).entries, [{
    targetId: "target-a",
    assessment: "ACHIEVED",
    fact: "Evaluation completed.",
    evidenceSummary: "Score is 15.",
    milestoneCompleted: true,
    acceptanceEvidence: "Acceptance suite passed",
    supersedesCheckInId: "check-old",
  }]);
});

test("strict FormData rejects duplicates, files, mixed target values, over-limit text, and normal extra fields while accepting Next metadata", async () => {
  const invalid: FormData[] = [];
  const duplicate = checkInForm(); duplicate.append("targetId", "target-b"); invalid.push(duplicate);
  const file = checkInForm(); file.set("fact", new File(["secret"], "secret.txt")); invalid.push(file);
  const mixed = checkInForm({ milestoneCompleted: "false" }); invalid.push(mixed);
  const long = checkInForm({ fact: "界".repeat(1_334) }); invalid.push(long);
  const extra = checkInForm({ isAdmin: "true" }); invalid.push(extra);
  for (const form of invalid) {
    const harness = createHarness();
    assert.deepEqual(await run(harness, () => actions.appendGoalCheckInAction(
      "meeting-a", "goal-a", undefined, form,
    )), { status: "ERROR", code: "INVALID_INPUT" });
    assert.equal(harness.calls.length, 0);
  }

  const harness = createHarness();
  const metadata = checkInForm();
  metadata.set("$ACTION_REF_4", "");
  metadata.set("$ACTION_4:0", "framework");
  metadata.set("$ACTION_KEY", "framework-key");
  assert.deepEqual(await run(harness, () => actions.appendGoalCheckInAction(
    "meeting-a", "goal-a", undefined, metadata,
  )), { status: "SUCCESS", operation: "CHECK_IN" });
});

test("same-Circle active owner Role assignee can append evidence without meeting provenance but cannot manage work links", async () => {
  const harness = createHarness({
    meeting: { id: "meeting-a", circleId: "circle-a", endedAt: null, participants: [{ id: "other" }] },
    goal: { id: "goal-a", circleId: "circle-a", ownerRole: { status: "ACTIVE", assignees: [{ id: "person-a" }] } },
  });
  assert.deepEqual(await run(harness, () => actions.appendGoalCheckInAction(
    "meeting-a", "goal-a", undefined, checkInForm(),
  )), { status: "SUCCESS", operation: "CHECK_IN" });
  assert.equal("meetingId" in (harness.calls[0].input as Record<string, unknown>), false);

  assert.deepEqual(await run(harness, () => actions.createGoalWorkLinkAction(
    "meeting-a", "goal-a", undefined, linkForm(),
  )), { status: "ERROR", code: "NOT_AVAILABLE" });
  assert.deepEqual(await run(harness, () => actions.removeGoalWorkLinkAction(
    "meeting-a", "goal-a", undefined, removeForm(),
  )), { status: "ERROR", code: "NOT_AVAILABLE" });
});

test("nonparticipant nonowner is denied and same-Circle integrity still fails closed", async () => {
  for (const harness of [
    createHarness({ meeting: null }),
    createHarness({ goal: null }),
    createHarness({
      meeting: { id: "meeting-a", circleId: "circle-a", endedAt: null, participants: [{ id: "other" }] },
      goal: { id: "goal-a", circleId: "circle-a", ownerRole: { status: "ACTIVE", assignees: [] } },
    }),
    createHarness({
      meeting: { id: "meeting-a", circleId: "circle-a", endedAt: null, participants: [{ id: "person-a" }] },
      goal: { id: "goal-a", circleId: "circle-b", ownerRole: { status: "ACTIVE", assignees: [] } },
    }),
  ]) {
    assert.deepEqual(await run(harness, () => actions.appendGoalCheckInAction(
      "meeting-a", "goal-a", undefined, checkInForm(),
    )), { status: "ERROR", code: "NOT_AVAILABLE" });
    assert.equal(harness.calls.length, 0);
  }
});

test("work-link transport delegates candidate validation to the canonical domain transaction", async () => {
  for (const [kind, id] of [
    ["PROJECT", "project-a"],
    ["ACTION", "action-a"],
    ["BLOCKING_TENSION", "tension-a"],
  ] as const) {
    const harness = createHarness();
    assert.deepEqual(await run(harness, () => actions.createGoalWorkLinkAction(
      "meeting-a", "goal-a", undefined, linkForm(kind, id),
    )), { status: "SUCCESS", operation: "LINK" });
    assert.equal(harness.calls[0].operation, "LINK");
    assert.deepEqual(harness.calls[0].input, {
      organizationId: "org-a", goalId: "goal-a", actor, meetingId: "meeting-a", kind, workObjectId: id,
    });
    assert.deepEqual(harness.queries.map(({ model }) => model), ["meeting", "goal"]);
  }
});

test("remove delegates with a mandatory reason and all successes expose only fixed DTOs", async () => {
  const harness = createHarness();
  assert.deepEqual(await run(harness, () => actions.removeGoalWorkLinkAction(
    "meeting-a", "goal-a", undefined, removeForm(),
  )), { status: "SUCCESS", operation: "REMOVE" });
  assert.deepEqual(harness.calls[0], {
    operation: "REMOVE",
    input: {
      organizationId: "org-a",
      goalId: "goal-a",
      linkId: "link-a",
      actor,
      meetingId: "meeting-a",
      reason: "No longer blocks delivery",
    },
  });
  assert.deepEqual(Object.keys(await run(createHarness(), () => actions.createGoalWorkLinkAction(
    "meeting-a", "goal-a", undefined, linkForm(),
  )) ?? {}).sort(), ["operation", "status"]);
});

test("domain conflicts map to CONFLICT, unavailable facts to NOT_AVAILABLE, and unknown failures are redacted", async () => {
  const cases = [
    [new GoalDomainError("CORRECTION_CONFLICT"), "CONFLICT"],
    [new GoalDomainError("WORK_LINK_ALREADY_ACTIVE"), "CONFLICT"],
    [new GoalDomainError("SERIALIZATION_CONFLICT"), "CONFLICT"],
    [new GoalDomainError("RECORDER_NOT_PARTICIPANT"), "NOT_AVAILABLE"],
    [new GoalDomainError("TARGET_NOT_FOUND"), "NOT_AVAILABLE"],
    [new GoalDomainError("INVALID_INPUT"), "INVALID_INPUT"],
    [new GoalDomainError("PERSISTENCE_FAILED"), "TEMPORARY_FAILURE"],
  ] as const;
  for (const [error, code] of cases) {
    const harness = createHarness();
    const dependencies = { ...harness.dependencies, appendGoalCheckIns: async () => { throw error; } };
    assert.deepEqual(await withGoalFollowUpActionTestDependencies(dependencies, () => (
      actions.appendGoalCheckInAction("meeting-a", "goal-a", undefined, checkInForm())
    )), { status: "ERROR", code });
    assert.deepEqual(harness.revalidated, []);
  }

  const harness = createHarness();
  const dependencies = {
    ...harness.dependencies,
    appendGoalCheckIns: async () => { throw new Error("database-password internal-id"); },
  };
  assert.deepEqual(await withGoalFollowUpActionTestDependencies(dependencies, () => (
    actions.appendGoalCheckInAction("meeting-a", "goal-a", undefined, checkInForm())
  )), { status: "ERROR", code: "TEMPORARY_FAILURE" });
});
