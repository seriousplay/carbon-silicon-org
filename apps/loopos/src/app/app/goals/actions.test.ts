import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  GoalDomainError,
  type GoalDomainActor,
  type GoalProposalSnapshot,
} from "@/lib/goals/domain-operations";
import { withGoalActionTestDependencies } from "./action-dependencies";

type GoalActionsModule = typeof import("./actions");

const require = createRequire(import.meta.url);
const originalNodePath = process.env.NODE_PATH;
const compiledModules = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../node_modules/next/dist/compiled",
);
const moduleWithInitPaths = Module as typeof Module & { _initPaths(): void };
let originalServerOnlyModule: NodeJS.Module | undefined;
let serverOnlyPath = "";
let goalActions: GoalActionsModule;

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
  goalActions = await import("./actions");
});

after(() => {
  if (originalServerOnlyModule) require.cache[serverOnlyPath] = originalServerOnlyModule;
  else delete require.cache[serverOnlyPath];
  if (originalNodePath === undefined) delete process.env.NODE_PATH;
  else process.env.NODE_PATH = originalNodePath;
  moduleWithInitPaths._initPaths();
});

type Operation = "create" | "append" | "submit" | "withdraw";

type RecordedCall = {
  input: unknown;
  domain: unknown;
};

const trustedActor = {
  organizationId: "org-trusted",
  userId: "user-trusted",
  personId: "person-trusted",
} satisfies GoalDomainActor;

function proposal(
  id: string,
  currentRevision: number,
  status: GoalProposalSnapshot["status"],
): GoalProposalSnapshot {
  return {
    id,
    organizationId: "internal-org-id",
    cycleId: "internal-cycle-id",
    circleId: "internal-circle-id",
    proposerId: "internal-person-id",
    kind: "CREATE",
    status,
    replacedGoalId: null,
    currentRevision,
    submittedAt: null,
    terminalAt: null,
    cycleStatus: "ACTIVE",
    revision: {
      revision: currentRevision,
      title: "Internal title",
      intendedOutcome: "Internal outcome",
      ownerRoleId: "internal-role-id",
      parentGoalId: null,
      closeResult: null,
      conclusion: null,
      authoredById: "internal-person-id",
      createdAt: new Date("2026-07-15T00:00:00.000Z"),
      targets: [],
    },
  };
}

function createHarness(actor: GoalDomainActor = trustedActor) {
  const calls: Record<Operation, RecordedCall[]> = {
    create: [],
    append: [],
    submit: [],
    withdraw: [],
  };
  const revalidated: string[] = [];
  const prisma = { marker: `prisma-${actor.organizationId}` };
  const domain = { marker: `domain-${actor.organizationId}` };
  const record = (
    operation: Operation,
    result: GoalProposalSnapshot,
  ) => async (input: unknown, receivedDomain: unknown) => {
    calls[operation].push({ input, domain: receivedDomain });
    return result;
  };

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
      createGoalProposal: record("create", proposal("proposal-create", 1, "DRAFT")),
      appendGoalProposalRevision: record("append", proposal("proposal-append", 4, "DRAFT")),
      submitGoalProposal: record("submit", proposal("proposal-submit", 3, "SUBMITTED")),
      withdrawGoalProposal: record("withdraw", proposal("proposal-withdraw", 2, "WITHDRAWN")),
    },
  };
}

function setAll(formData: FormData, fields: Record<string, string>): FormData {
  for (const [name, value] of Object.entries(fields)) formData.set(name, value);
  return formData;
}

function createForm(kind: "CREATE" | "REPLACE" | "CLOSE" = "CREATE"): FormData {
  const formData = setAll(new FormData(), {
    kind,
    cycleId: "cycle-1",
    circleId: "circle-1",
  });
  if (kind === "CLOSE") {
    return setAll(formData, {
      replacedGoalId: "goal-active",
      closeResult: "ACHIEVED",
      conclusion: "The intended outcome is evidenced.",
    });
  }
  if (kind === "REPLACE") formData.set("replacedGoalId", "goal-active");
  return setAll(formData, {
    title: "Increase grounded answers",
    intendedOutcome: "Users receive reliable organizational answers.",
    ownerRoleId: "role-owner",
    parentGoalId: "goal-parent",
    targets: JSON.stringify([
      {
        kind: "NUMERIC",
        label: "Grounded answer rate",
        baselineValue: 40,
        desiredValue: "90",
        unit: "%",
        metricId: "metric-grounding",
      },
      {
        kind: "MILESTONE",
        label: "Evidence review",
        acceptanceCriteria: "Three weekly reviews accepted",
      },
    ]),
  });
}

function transitionForm(proposalId: string, expectedRevision: string): FormData {
  return setAll(new FormData(), {
    proposalId,
    expectedRevision,
    cycleId: "cycle-1",
    circleId: "circle-1",
    kind: "CREATE",
    replacedGoalId: "",
    targets: "[]",
  });
}

async function withHarness<TResult>(
  harness: ReturnType<typeof createHarness>,
  work: () => Promise<TResult>,
): Promise<TResult> {
  return withGoalActionTestDependencies(harness.dependencies, work);
}

test("exports exactly the four drafting Server Actions", () => {
  assert.deepEqual(Object.keys(goalActions).sort(), [
    "appendGoalProposalRevisionAction",
    "createGoalCycleAction",
    "createGoalProposalAction",
    "submitGoalProposalAction",
    "withdrawGoalProposalAction",
  ]);
});

describe("createGoalProposalAction", () => {
  test("parses CREATE numeric and milestone targets using resolved identity", async () => {
    const harness = createHarness();
    const formData = createForm();

    const result = await withHarness(harness, () => goalActions.createGoalProposalAction(undefined, formData));

    assert.deepEqual(result, { proposalId: "proposal-create", currentRevision: 1, status: "DRAFT" });
    assert.deepEqual(harness.calls.create, [{
      input: {
        organizationId: trustedActor.organizationId,
        cycleId: "cycle-1",
        circleId: "circle-1",
        actor: trustedActor,
        kind: "CREATE",
        revision: {
          title: "Increase grounded answers",
          intendedOutcome: "Users receive reliable organizational answers.",
          ownerRoleId: "role-owner",
          parentGoalId: "goal-parent",
          targets: [
            {
              kind: "NUMERIC",
              label: "Grounded answer rate",
              baselineValue: 40,
              desiredValue: "90",
              unit: "%",
              metricId: "metric-grounding",
            },
            {
              kind: "MILESTONE",
              label: "Evidence review",
              acceptanceCriteria: "Three weekly reviews accepted",
            },
          ],
        },
      },
      domain: harness.domain,
    }]);
    assert.deepEqual(harness.revalidated, ["/app/goals"]);
  });

  test("parses REPLACE and CLOSE revisions without carrying unrelated revision fields", async () => {
    const replaceHarness = createHarness();
    await withHarness(replaceHarness, () => goalActions.createGoalProposalAction(undefined, createForm("REPLACE")));
    assert.deepEqual(replaceHarness.calls.create[0]?.input, {
      organizationId: trustedActor.organizationId,
      cycleId: "cycle-1",
      circleId: "circle-1",
      actor: trustedActor,
      kind: "REPLACE",
      replacedGoalId: "goal-active",
      revision: {
        title: "Increase grounded answers",
        intendedOutcome: "Users receive reliable organizational answers.",
        ownerRoleId: "role-owner",
        parentGoalId: "goal-parent",
        targets: [
          {
            kind: "NUMERIC",
            label: "Grounded answer rate",
            baselineValue: 40,
            desiredValue: "90",
            unit: "%",
            metricId: "metric-grounding",
          },
          {
            kind: "MILESTONE",
            label: "Evidence review",
            acceptanceCriteria: "Three weekly reviews accepted",
          },
        ],
      },
    });

    const closeHarness = createHarness();
    const closeForm = createForm("CLOSE");
    setAll(closeForm, { title: "must-not-cross", targets: "must-not-cross" });
    await withHarness(closeHarness, () => goalActions.createGoalProposalAction(undefined, closeForm));
    assert.deepEqual(closeHarness.calls.create[0]?.input, {
      organizationId: trustedActor.organizationId,
      cycleId: "cycle-1",
      circleId: "circle-1",
      actor: trustedActor,
      kind: "CLOSE",
      replacedGoalId: "goal-active",
      revision: {
        closeResult: "ACHIEVED",
        conclusion: "The intended outcome is evidenced.",
      },
    });
  });

  test("rejects over-limit, malformed, extra-key, and duplicate required fields before domain delegation", async () => {
    const invalidForms: FormData[] = [];

    const overLimit = createForm();
    overLimit.set("targets", JSON.stringify(Array.from({ length: 21 }, (_, index) => ({
      kind: "MILESTONE",
      label: `Target ${index}`,
      acceptanceCriteria: "Done",
    }))));
    invalidForms.push(overLimit);

    const malformed = createForm();
    malformed.set("targets", "not-json");
    invalidForms.push(malformed);

    const extraKey = createForm();
    extraKey.set("targets", JSON.stringify([{
      kind: "MILESTONE",
      label: "Target",
      acceptanceCriteria: "Done",
      internalOwner: "must-not-be-accepted",
    }]));
    invalidForms.push(extraKey);

    const duplicateRequired = createForm();
    duplicateRequired.append("title", "Second title");
    invalidForms.push(duplicateRequired);

    for (const formData of invalidForms) {
      const harness = createHarness();
      assert.deepEqual(
        await withHarness(harness, () => goalActions.createGoalProposalAction(undefined, formData)),
        { code: "INVALID_INPUT" },
      );
      assert.equal(harness.calls.create.length, 0);
      assert.deepEqual(harness.revalidated, []);
    }
  });
});

test("rejects forged identity and authority fields before domain delegation", async () => {
  for (const field of ["organizationId", "userId", "personId", "actor", "isAdmin"]) {
    const harness = createHarness();
    const formData = createForm();
    formData.set(field, "forged");

    assert.deepEqual(
      await withHarness(harness, () => goalActions.createGoalProposalAction(undefined, formData)),
      { code: "INVALID_INPUT" },
    );
    assert.equal(harness.calls.create.length, 0);
    assert.deepEqual(harness.revalidated, []);
  }
});

test("rejects ordinary fields outside each drafting action allowlist", async () => {
  const appendHarness = createHarness();
  const appendForm = createForm();
  setAll(appendForm, { proposalId: "proposal-1", expectedRevision: "1", unexpected: "value" });
  assert.deepEqual(
    await withHarness(appendHarness, () => goalActions.appendGoalProposalRevisionAction(undefined, appendForm)),
    { code: "INVALID_INPUT" },
  );
  assert.equal(appendHarness.calls.append.length, 0);

  const submitHarness = createHarness();
  const submitForm = transitionForm("proposal-1", "1");
  submitForm.set("title", "must-not-be-accepted");
  assert.deepEqual(
    await withHarness(submitHarness, () => goalActions.submitGoalProposalAction(undefined, submitForm)),
    { code: "INVALID_INPUT" },
  );
  assert.equal(submitHarness.calls.submit.length, 0);

  const withdrawHarness = createHarness();
  const withdrawForm = transitionForm("proposal-1", "1");
  withdrawForm.set("membershipRole", "ORG_ADMIN");
  assert.deepEqual(
    await withHarness(withdrawHarness, () => goalActions.withdrawGoalProposalAction(undefined, withdrawForm)),
    { code: "INVALID_INPUT" },
  );
  assert.equal(withdrawHarness.calls.withdraw.length, 0);
});

test("ignores Next Server Action metadata for every drafting action", async () => {
  const harness = createHarness();
  const forms = [
    createForm(),
    setAll(createForm(), { proposalId: "proposal-append", expectedRevision: "1" }),
    transitionForm("proposal-submit", "1"),
    transitionForm("proposal-withdraw", "1"),
  ];
  for (const formData of forms) {
    formData.set("$ACTION_REF_7", "");
    formData.set("$ACTION_7:0", "metadata-zero");
    formData.set("$ACTION_KEY", "metadata-key");
  }

  await withHarness(harness, async () => {
    assert.deepEqual(
      await goalActions.createGoalProposalAction(undefined, forms[0]),
      { proposalId: "proposal-create", currentRevision: 1, status: "DRAFT" },
    );
    assert.deepEqual(
      await goalActions.appendGoalProposalRevisionAction(undefined, forms[1]),
      { proposalId: "proposal-append", currentRevision: 4, status: "DRAFT" },
    );
    assert.deepEqual(
      await goalActions.submitGoalProposalAction(undefined, forms[2]),
      { proposalId: "proposal-submit", currentRevision: 3, status: "SUBMITTED" },
    );
    assert.deepEqual(
      await goalActions.withdrawGoalProposalAction(undefined, forms[3]),
      { proposalId: "proposal-withdraw", currentRevision: 2, status: "WITHDRAWN" },
    );
  });

  assert.deepEqual(Object.fromEntries(
    Object.entries(harness.calls).map(([operation, calls]) => [operation, calls.length]),
  ), { create: 1, append: 1, submit: 1, withdraw: 1 });
  assert.deepEqual(harness.revalidated, ["/app/goals", "/app/goals", "/app/goals", "/app/goals"]);
});

test("append delegates the parsed revision and submit/resubmit and withdraw delegate strict revisions", async () => {
  const harness = createHarness();
  const appendForm = createForm();
  setAll(appendForm, { proposalId: "proposal-returned", expectedRevision: "3" });

  await withHarness(harness, async () => {
    assert.deepEqual(
      await goalActions.appendGoalProposalRevisionAction(undefined, appendForm),
      { proposalId: "proposal-append", currentRevision: 4, status: "DRAFT" },
    );
    assert.deepEqual(
      await goalActions.submitGoalProposalAction(undefined, transitionForm("proposal-draft", "1")),
      { proposalId: "proposal-submit", currentRevision: 3, status: "SUBMITTED" },
    );
    assert.deepEqual(
      await goalActions.submitGoalProposalAction(undefined, transitionForm("proposal-returned", "2")),
      { proposalId: "proposal-submit", currentRevision: 3, status: "SUBMITTED" },
    );
    assert.deepEqual(
      await goalActions.withdrawGoalProposalAction(undefined, transitionForm("proposal-withdrawable", "5")),
      { proposalId: "proposal-withdraw", currentRevision: 2, status: "WITHDRAWN" },
    );
  });

  const appendInput = harness.calls.append[0]?.input as { expectedRevision?: number; proposalId?: string; actor?: GoalDomainActor };
  assert.equal(appendInput.proposalId, "proposal-returned");
  assert.equal(appendInput.expectedRevision, 3);
  assert.deepEqual(appendInput.actor, trustedActor);
  assert.deepEqual(harness.calls.submit.map(({ input }) => input), [
    { organizationId: "org-trusted", proposalId: "proposal-draft", expectedRevision: 1, actor: trustedActor },
    { organizationId: "org-trusted", proposalId: "proposal-returned", expectedRevision: 2, actor: trustedActor },
  ]);
  assert.deepEqual(harness.calls.withdraw.map(({ input }) => input), [
    { organizationId: "org-trusted", proposalId: "proposal-withdrawable", expectedRevision: 5, actor: trustedActor },
  ]);
  assert.deepEqual(harness.revalidated, ["/app/goals", "/app/goals", "/app/goals", "/app/goals"]);
});

test("rejects non-canonical and duplicate expectedRevision values", async () => {
  const invalidRevisions = ["", "0", "01", "1.0", "-1", "9007199254740992"];
  for (const revision of invalidRevisions) {
    const harness = createHarness();
    assert.deepEqual(
      await withHarness(harness, () => goalActions.submitGoalProposalAction(undefined, transitionForm("proposal-1", revision))),
      { code: "INVALID_INPUT" },
    );
    assert.equal(harness.calls.submit.length, 0);
  }

  const harness = createHarness();
  const duplicate = transitionForm("proposal-1", "1");
  duplicate.append("expectedRevision", "2");
  assert.deepEqual(
    await withHarness(harness, () => goalActions.withdrawGoalProposalAction(undefined, duplicate)),
    { code: "INVALID_INPUT" },
  );
  assert.equal(harness.calls.withdraw.length, 0);
});

test("returns an allowlisted success shape and revalidates only after success", async () => {
  const harness = createHarness();
  const result = await withHarness(harness, () => goalActions.submitGoalProposalAction(
    { code: "INVALID_STATE" },
    transitionForm("proposal-1", "1"),
  ));

  assert.deepEqual(result, { proposalId: "proposal-submit", currentRevision: 3, status: "SUBMITTED" });
  assert.deepEqual(Object.keys(result ?? {}).sort(), ["currentRevision", "proposalId", "status"]);
  assert.deepEqual(harness.revalidated, ["/app/goals"]);
});

test("maps domain failures to fixed public codes and redacts unknown failures", async () => {
  const cases = [
    [new GoalDomainError("INVALID_INPUT"), "INVALID_INPUT"],
    [new GoalDomainError("CYCLE_NOT_FOUND"), "NOT_AVAILABLE"],
    [new GoalDomainError("STALE_REVISION"), "STALE_REVISION"],
    [new GoalDomainError("OWNER_ROLE_INVALID"), "INVALID_REFERENCE"],
    [new GoalDomainError("SERIALIZATION_CONFLICT"), "RETRY_CONFLICT"],
    [new GoalDomainError("PROPOSER_REQUIRED"), "INVALID_STATE"],
  ] as const;

  for (const [error, code] of cases) {
    const harness = createHarness();
    const dependencies = {
      ...harness.dependencies,
      submitGoalProposal: async () => { throw error; },
    };
    assert.deepEqual(
      await withGoalActionTestDependencies(dependencies, () => goalActions.submitGoalProposalAction(
        undefined,
        transitionForm("proposal-secret", "1"),
      )),
      { code },
    );
    assert.deepEqual(harness.revalidated, []);
  }

  const harness = createHarness();
  const unknown = Object.assign(new Error("database password and stack secret"), { internalId: "internal-987" });
  const dependencies = {
    ...harness.dependencies,
    submitGoalProposal: async () => { throw unknown; },
  };
  const result = await withGoalActionTestDependencies(dependencies, () => goalActions.submitGoalProposalAction(
    undefined,
    transitionForm("proposal-secret", "1"),
  ));
  assert.deepEqual(result, { code: "TEMPORARY_FAILURE" });
  assert.equal(JSON.stringify(result).includes("database password"), false);
  assert.equal(JSON.stringify(result).includes("internal-987"), false);
  assert.equal(JSON.stringify(result).includes("stack"), false);
  assert.deepEqual(harness.revalidated, []);
});

test("keeps concurrent injected identities and dependencies isolated without a database", async () => {
  const actorA = { organizationId: "org-a", userId: "user-a", personId: "person-a" };
  const actorB = { organizationId: "org-b", userId: "user-b", personId: "person-b" };
  const harnessA = createHarness(actorA);
  const harnessB = createHarness(actorB);

  const [resultA, resultB] = await Promise.all([
    withHarness(harnessA, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return goalActions.submitGoalProposalAction(undefined, transitionForm("proposal-a", "1"));
    }),
    withHarness(harnessB, () => goalActions.submitGoalProposalAction(undefined, transitionForm("proposal-b", "2"))),
  ]);

  assert.deepEqual(resultA, { proposalId: "proposal-submit", currentRevision: 3, status: "SUBMITTED" });
  assert.deepEqual(resultB, { proposalId: "proposal-submit", currentRevision: 3, status: "SUBMITTED" });
  assert.deepEqual(harnessA.calls.submit[0]?.input, {
    organizationId: "org-a",
    proposalId: "proposal-a",
    expectedRevision: 1,
    actor: actorA,
  });
  assert.deepEqual(harnessB.calls.submit[0]?.input, {
    organizationId: "org-b",
    proposalId: "proposal-b",
    expectedRevision: 2,
    actor: actorB,
  });
  assert.equal(harnessA.calls.submit[0]?.domain, harnessA.domain);
  assert.equal(harnessB.calls.submit[0]?.domain, harnessB.domain);
  assert.deepEqual(harnessA.revalidated, ["/app/goals"]);
  assert.deepEqual(harnessB.revalidated, ["/app/goals"]);
});
