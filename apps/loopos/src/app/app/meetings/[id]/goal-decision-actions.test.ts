import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  GoalDomainError,
  type GoalDecisionOutcome,
  type GoalDecisionResult,
  type GoalDomainActor,
  type GoalProposalStatus,
  type GoalSnapshot,
} from "@/lib/goals/domain-operations";
import { withGoalDecisionActionTestDependencies } from "./goal-decision-action-dependencies";

type GoalDecisionActionsModule = typeof import("./goal-decision-actions");

const require = createRequire(import.meta.url);
const originalNodePath = process.env.NODE_PATH;
const compiledModules = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../node_modules/next/dist/compiled",
);
const moduleWithInitPaths = Module as typeof Module & { _initPaths(): void };
let originalServerOnlyModule: NodeJS.Module | undefined;
let serverOnlyPath = "";
let goalDecisionActions: GoalDecisionActionsModule;

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
  goalDecisionActions = await import("./goal-decision-actions");
});

after(() => {
  if (originalServerOnlyModule) require.cache[serverOnlyPath] = originalServerOnlyModule;
  else delete require.cache[serverOnlyPath];
  if (originalNodePath === undefined) delete process.env.NODE_PATH;
  else process.env.NODE_PATH = originalNodePath;
  moduleWithInitPaths._initPaths();
});

const trustedActor = {
  organizationId: "org-trusted",
  userId: "user-trusted",
  personId: "person-trusted",
} satisfies GoalDomainActor;

const mutationKey = "123e4567-e89b-42d3-a456-426614174000";

function goal(id: string, status: GoalSnapshot["status"]): GoalSnapshot {
  return {
    id,
    organizationId: "internal-org",
    cycleId: "internal-cycle",
    circleId: "internal-circle",
    title: "Internal title",
    intendedOutcome: "Internal outcome",
    ownerRoleId: "internal-role",
    parentGoalId: null,
    status,
    adoptedDecisionId: "internal-decision",
    terminalDecisionId: status === "ACTIVE" ? null : "internal-decision",
    createdAt: new Date("2026-07-15T00:00:00.000Z"),
    terminalAt: status === "ACTIVE" ? null : new Date("2026-07-15T01:00:00.000Z"),
    targets: [],
  };
}

function decisionResult(
  outcome: GoalDecisionOutcome,
  options: {
    proposalStatus?: GoalProposalStatus;
    adoptedGoal?: GoalSnapshot | null;
    terminalGoal?: GoalSnapshot | null;
  } = {},
): GoalDecisionResult {
  const proposalStatus = options.proposalStatus ?? outcome;
  return {
    decision: {
      id: `decision-${outcome.toLowerCase()}`,
      organizationId: "internal-org",
      proposalId: `proposal-${outcome.toLowerCase()}`,
      revision: 3,
      outcome,
      meetingId: "internal-meeting",
      recorderId: "internal-recorder",
      mutationKey: "internal-mutation-key",
      note: "Internal note",
      decidedAt: new Date("2026-07-15T01:00:00.000Z"),
    },
    proposal: {
      id: `proposal-${outcome.toLowerCase()}`,
      organizationId: "internal-org",
      cycleId: "internal-cycle",
      circleId: "internal-circle",
      proposerId: "internal-proposer",
      kind: "CREATE",
      status: proposalStatus,
      replacedGoalId: null,
      currentRevision: 3,
      submittedAt: new Date("2026-07-15T00:30:00.000Z"),
      terminalAt: outcome === "RETURNED" ? null : new Date("2026-07-15T01:00:00.000Z"),
      cycleStatus: "ACTIVE",
      revision: {
        revision: 3,
        title: "Internal title",
        intendedOutcome: "Internal outcome",
        ownerRoleId: "internal-role",
        parentGoalId: null,
        closeResult: null,
        conclusion: null,
        authoredById: "internal-proposer",
        createdAt: new Date("2026-07-15T00:00:00.000Z"),
        targets: [],
      },
    },
    adoptedGoal: options.adoptedGoal ?? null,
    terminalGoal: options.terminalGoal ?? null,
  };
}

function form(
  outcome: GoalDecisionOutcome = "ADOPTED",
  fields: Record<string, string> = {},
): FormData {
  const formData = new FormData();
  for (const [name, value] of Object.entries({
    outcome,
    expectedRevision: "3",
    mutationKey,
    note: "  Confirmed by the strategic meeting.  ",
    ...fields,
  })) formData.set(name, value);
  return formData;
}

function createHarness(
  actor: GoalDomainActor = trustedActor,
  result: GoalDecisionResult = decisionResult("ADOPTED", { adoptedGoal: goal("goal-adopted", "ACTIVE") }),
) {
  const calls: Array<{ input: unknown; domain: unknown }> = [];
  const revalidated: string[] = [];
  const prisma = { marker: `prisma-${actor.organizationId}` };
  const domain = { marker: `domain-${actor.organizationId}` };
  return {
    calls,
    domain,
    revalidated,
    dependencies: {
      prisma,
      resolveActorContext: async () => actor,
      revalidatePath: (path: string) => revalidated.push(path),
      createPrismaGoalDomainDependencies: (receivedPrisma: unknown) => {
        assert.equal(receivedPrisma, prisma);
        return domain;
      },
      decideGoalProposal: async (input: unknown, receivedDomain: unknown) => {
        calls.push({ input, domain: receivedDomain });
        return result;
      },
    },
  };
}

async function withHarness<TResult>(
  harness: ReturnType<typeof createHarness>,
  work: () => Promise<TResult>,
): Promise<TResult> {
  return withGoalDecisionActionTestDependencies(harness.dependencies, work);
}

test("exports exactly one Server Action", () => {
  assert.deepEqual(Object.keys(goalDecisionActions), ["recordGoalDecisionAction"]);
});

describe("recordGoalDecisionAction", () => {
  test("derives identity server-side and delegates once to the accepted goal domain operation", async () => {
    const harness = createHarness();
    const input = form("ADOPTED", {
      organizationId: "org-forged",
      personId: "person-forged",
      userId: "user-forged",
    });

    assert.deepEqual(
      await withHarness(harness, () => goalDecisionActions.recordGoalDecisionAction(
        "proposal-adopted",
        "meeting-strategy",
        undefined,
        input,
      )),
      { code: "INVALID_INPUT" },
    );
    assert.deepEqual(harness.calls, []);

    const valid = form();
    const result = await withHarness(harness, () => goalDecisionActions.recordGoalDecisionAction(
      "proposal-adopted",
      "meeting-strategy",
      { code: "TEMPORARY_FAILURE" },
      valid,
    ));

    assert.deepEqual(result, {
      decisionId: "decision-adopted",
      proposalId: "proposal-adopted",
      revision: 3,
      outcome: "ADOPTED",
      proposalStatus: "ADOPTED",
      adoptedGoalId: "goal-adopted",
      terminalGoalId: null,
    });
    assert.deepEqual(harness.calls, [{
      input: {
        organizationId: trustedActor.organizationId,
        proposalId: "proposal-adopted",
        expectedRevision: 3,
        actor: trustedActor,
        meetingId: "meeting-strategy",
        mutationKey,
        outcome: "ADOPTED",
        note: "Confirmed by the strategic meeting.",
      },
      domain: harness.domain,
    }]);
    assert.deepEqual(harness.revalidated, ["/app/meetings/meeting-strategy", "/app/goals"]);
  });

  test("ignores Next Server Action metadata without passing it to the goal domain", async () => {
    const harness = createHarness();
    const input = form();
    input.set("$ACTION_REF_7", "");
    input.set("$ACTION_7:0", "metadata-zero");
    input.set("$ACTION_7:1", "metadata-one");
    input.set("$ACTION_KEY", "metadata-key");

    const result = await withHarness(harness, () => goalDecisionActions.recordGoalDecisionAction(
      "proposal-adopted",
      "meeting-strategy",
      undefined,
      input,
    ));

    assert.deepEqual(result, {
      decisionId: "decision-adopted",
      proposalId: "proposal-adopted",
      revision: 3,
      outcome: "ADOPTED",
      proposalStatus: "ADOPTED",
      adoptedGoalId: "goal-adopted",
      terminalGoalId: null,
    });
    assert.deepEqual(harness.calls, [{
      input: {
        organizationId: trustedActor.organizationId,
        proposalId: "proposal-adopted",
        expectedRevision: 3,
        actor: trustedActor,
        meetingId: "meeting-strategy",
        mutationKey,
        outcome: "ADOPTED",
        note: "Confirmed by the strategic meeting.",
      },
      domain: harness.domain,
    }]);
    assert.deepEqual(harness.revalidated, ["/app/meetings/meeting-strategy", "/app/goals"]);
  });

  test("supports adopted, returned, and declined results with an allowlisted DTO", async () => {
    const cases = [
      ["ADOPTED", decisionResult("ADOPTED", { adoptedGoal: goal("goal-new", "ACTIVE") }), "goal-new", null],
      ["ADOPTED", decisionResult("ADOPTED", { terminalGoal: goal("goal-closed", "ACHIEVED") }), null, "goal-closed"],
      ["RETURNED", decisionResult("RETURNED"), null, null],
      ["DECLINED", decisionResult("DECLINED"), null, null],
    ] as const;

    for (const [outcome, domainResult, adoptedGoalId, terminalGoalId] of cases) {
      const harness = createHarness(trustedActor, domainResult);
      const result = await withHarness(harness, () => goalDecisionActions.recordGoalDecisionAction(
        domainResult.proposal.id,
        "meeting-strategy",
        undefined,
        form(outcome),
      ));
      assert.deepEqual(result, {
        decisionId: domainResult.decision.id,
        proposalId: domainResult.proposal.id,
        revision: 3,
        outcome,
        proposalStatus: outcome,
        adoptedGoalId,
        terminalGoalId,
      });
      assert.deepEqual(Object.keys(result ?? {}).sort(), [
        "adoptedGoalId",
        "decisionId",
        "outcome",
        "proposalId",
        "proposalStatus",
        "revision",
        "terminalGoalId",
      ]);
      assert.deepEqual(harness.revalidated, ["/app/meetings/meeting-strategy", "/app/goals"]);
    }
  });

  test("strictly rejects malformed, duplicate, over-limit, and extra fields before delegation", async () => {
    const invalidForms: FormData[] = [
      form("ADOPTED", { outcome: "APPROVED" }),
      form("ADOPTED", { expectedRevision: "0" }),
      form("ADOPTED", { expectedRevision: "1.5" }),
      form("ADOPTED", { expectedRevision: "9007199254740992" }),
      form("ADOPTED", { mutationKey: "not-a-uuid" }),
      form("ADOPTED", { mutationKey: `${mutationKey}${"x".repeat(165)}` }),
      form("ADOPTED", { note: "n".repeat(2_001) }),
      form("ADOPTED", { membershipRole: "ORG_ADMIN" }),
      form("ADOPTED", { isCircleLead: "true" }),
      form("ADOPTED", { ownerRoleId: "role-owner" }),
    ];
    const duplicate = form();
    duplicate.append("outcome", "DECLINED");
    invalidForms.push(duplicate);
    const duplicateNote = form();
    duplicateNote.append("note", "second note");
    invalidForms.push(duplicateNote);
    const fileValue = form();
    fileValue.set("note", new File(["note"], "note.txt"));
    invalidForms.push(fileValue);

    for (const invalidForm of invalidForms) {
      const harness = createHarness();
      assert.deepEqual(
        await withHarness(harness, () => goalDecisionActions.recordGoalDecisionAction(
          "proposal-adopted",
          "meeting-strategy",
          undefined,
          invalidForm,
        )),
        { code: "INVALID_INPUT" },
      );
      assert.deepEqual(harness.calls, []);
      assert.deepEqual(harness.revalidated, []);
    }

    for (const field of ["outcome", "expectedRevision", "mutationKey"] as const) {
      const missing = form();
      missing.delete(field);
      const harness = createHarness();
      assert.deepEqual(
        await withHarness(harness, () => goalDecisionActions.recordGoalDecisionAction(
          "proposal-adopted",
          "meeting-strategy",
          undefined,
          missing,
        )),
        { code: "INVALID_INPUT" },
      );
      assert.deepEqual(harness.calls, []);
    }
  });

  test("maps stale, denial, and conflict failures to fixed public codes and redacts unknown errors", async () => {
    const cases = [
      [new GoalDomainError("INVALID_INPUT"), "INVALID_INPUT"],
      [new GoalDomainError("STALE_REVISION"), "STALE_REVISION"],
      [new GoalDomainError("PROPOSAL_NOT_FOUND"), "NOT_AVAILABLE"],
      [new GoalDomainError("MEETING_INVALID"), "NOT_AVAILABLE"],
      [new GoalDomainError("RECORDER_NOT_PARTICIPANT"), "NOT_AVAILABLE"],
      [new GoalDomainError("MUTATION_KEY_CONFLICT"), "RETRY_CONFLICT"],
      [new GoalDomainError("DECISION_ALREADY_RECORDED"), "RETRY_CONFLICT"],
      [new GoalDomainError("SERIALIZATION_CONFLICT"), "RETRY_CONFLICT"],
      [new GoalDomainError("PROPOSAL_STATE_CONFLICT"), "INVALID_STATE"],
    ] as const;

    for (const [error, code] of cases) {
      const harness = createHarness();
      const dependencies = {
        ...harness.dependencies,
        decideGoalProposal: async () => { throw error; },
      };
      assert.deepEqual(
        await withGoalDecisionActionTestDependencies(dependencies, () => (
          goalDecisionActions.recordGoalDecisionAction(
            "proposal-adopted",
            "meeting-strategy",
            undefined,
            form(),
          )
        )),
        { code },
      );
      assert.deepEqual(harness.revalidated, []);
    }

    const harness = createHarness();
    const unknown = Object.assign(new Error("database password and stack secret"), { internalId: "internal-987" });
    const dependencies = {
      ...harness.dependencies,
      decideGoalProposal: async () => { throw unknown; },
    };
    const result = await withGoalDecisionActionTestDependencies(dependencies, () => (
      goalDecisionActions.recordGoalDecisionAction(
        "proposal-secret",
        "meeting-secret",
        undefined,
        form(),
      )
    ));
    assert.deepEqual(result, { code: "TEMPORARY_FAILURE" });
    assert.doesNotMatch(JSON.stringify(result), /database password|internal-987|stack/i);
    assert.deepEqual(harness.revalidated, []);
  });

  test("keeps concurrent injected identities and dependencies isolated", async () => {
    const actorA = { organizationId: "org-a", userId: "user-a", personId: "person-a" };
    const actorB = { organizationId: "org-b", userId: "user-b", personId: "person-b" };
    const harnessA = createHarness(actorA);
    const harnessB = createHarness(actorB);

    await Promise.all([
      withHarness(harnessA, async () => {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
        return goalDecisionActions.recordGoalDecisionAction("proposal-a", "meeting-a", undefined, form());
      }),
      withHarness(harnessB, () => (
        goalDecisionActions.recordGoalDecisionAction("proposal-b", "meeting-b", undefined, form("DECLINED"))
      )),
    ]);

    assert.deepEqual(harnessA.calls[0]?.input, {
      organizationId: "org-a",
      proposalId: "proposal-a",
      expectedRevision: 3,
      actor: actorA,
      meetingId: "meeting-a",
      mutationKey,
      outcome: "ADOPTED",
      note: "Confirmed by the strategic meeting.",
    });
    assert.deepEqual(harnessB.calls[0]?.input, {
      organizationId: "org-b",
      proposalId: "proposal-b",
      expectedRevision: 3,
      actor: actorB,
      meetingId: "meeting-b",
      mutationKey,
      outcome: "DECLINED",
      note: "Confirmed by the strategic meeting.",
    });
    assert.equal(harnessA.calls[0]?.domain, harnessA.domain);
    assert.equal(harnessB.calls[0]?.domain, harnessB.domain);
  });
});

test("uses the dedicated Server Action boundary without forbidden subsystem imports", () => {
  const source = readFileSync(new URL("./goal-decision-actions.ts", import.meta.url), "utf8");
  assert.match(source, /^"use server";/);
  assert.match(source, /name\.startsWith\("\$ACTION_"\)/);
  assert.doesNotMatch(source, /from\s+["'][^"']*(?:tactical|governance|organization-brain|brain)[^"']*["']/i);
  assert.doesNotMatch(source, /\b(?:findFirst|findUnique|findMany|update|updateMany|create|delete|deleteMany)\s*\(/);
  assert.match(source, /decideGoalProposal/);
  assert.match(source, /createPrismaGoalDomainDependencies\(dependencies\.prisma\)/);
});
