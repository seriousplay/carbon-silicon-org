import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import {
  GoalDomainError,
  type AppendGoalCheckInsInput,
  type AppendGoalProposalRevisionInput,
  type CreateGoalProposalInput,
  type GoalCheckInSnapshot,
  type GoalDomainDependencies,
  type GoalProposalSnapshot,
} from "@/lib/goals/domain-operations";
import type { RaiseTensionInput, UpdateMeetingNotesInput } from "@/lib/domain-operations";

import { hashBrainCommandBinding } from "./command-registry";
import {
  D1_BRAIN_GOAL_COMMAND_NAMES,
  M3_D2_BRAIN_COMMAND_NAMES,
  M3_D3_BRAIN_COMMAND_NAMES,
  confirmGoalCommandPreview,
  type BrainGoalCommandActor,
  type BrainGoalCommandLedgerStore,
  type BrainGoalCommandOperation,
  type BrainGoalCommandOperations,
  type BrainGoalCommandSourceValidator,
  type BrainGoalCommandTerminalInput,
} from "./goal-command-handler";

const actor: BrainGoalCommandActor = {
  organizationId: "org-a",
  userId: "user-a",
  personId: "person-a",
};

const expiresAt = new Date("2026-07-15T12:15:00.000Z");
const now = new Date("2026-07-15T12:00:00.000Z");
const goalDomain = {} as GoalDomainDependencies;

const target = {
  position: 1,
  label: "Activation",
  kind: "NUMERIC",
  baselineValue: "10",
  desiredValue: "20",
  unit: "%",
} as const;

const payloads = {
  "goal_proposal.create_draft": {
    command: "goal_proposal.create_draft",
    cycleId: "cycle-1",
    circleId: "circle-1",
    ownerRoleId: "role-1",
    title: "Improve activation",
    intendedOutcome: "Users activate",
    targets: [target],
  },
  "goal_proposal.append_returned_revision": {
    command: "goal_proposal.append_returned_revision",
    proposalId: "proposal-1",
    expectedRevision: 2,
    title: "Improve activation",
    intendedOutcome: "Users activate",
    rationale: "Addressed the return",
    targets: [target],
  },
  "goal_check_in.append": {
    command: "goal_check_in.append",
    goalId: "goal-1",
    targetId: "target-1",
    fact: "Activation reached 18%",
    evidenceSummary: "Weekly report",
    assessment: "ON_TRACK",
  },
  "tension.raise": {
    command: "tension.raise",
    title: "Routing is unclear",
    description: "The route is missing",
    type: "CLARIFYING",
    circleIds: ["circle-1"],
    handlingMode: "TACTICAL",
  },
  "tactical_outcome.submit_proposal": {
    command: "tactical_outcome.submit_proposal",
    tensionId: "tension-1",
    meetingId: "meeting-1",
    expectedRevision: 0,
    kind: "PROJECT",
    title: "Fix routing",
    description: "Make routing explicit",
    responsibility: "Circle lead",
    circleId: "circle-1",
    responsiblePersonId: "person-a",
  },
  "meeting_notes.update": {
    command: "meeting_notes.update",
    meetingId: "meeting-1",
    expectedNotesRevision: 1,
    notes: "Updated notes",
  },
  "governance_proposal.create": {
    command: "governance_proposal.create",
    tensionId: "tension-1",
    meetingId: "meeting-1",
    currentStructure: "Current role boundary",
    proposedStructure: "New role boundary",
    rationale: "The current boundary creates a repeated tension",
    expectedImpact: "The proposer can safely test the change",
    structuralChange: { schemaVersion: 1, operation: "ROLE_ARCHIVED", targetId: "role-1" },
  },
} as const;

const sourceBindings = {
  "goal_proposal.create_draft": [
    { objectType: "goal_cycle", objectId: "cycle-1", sourceVersionAt: "status:PLANNED", status: "PLANNED" },
    { objectType: "circle", objectId: "circle-1", sourceVersionAt: "active:true" },
    { objectType: "role", objectId: "role-1", sourceVersionAt: "active:true" },
  ],
  "goal_proposal.append_returned_revision": [
    { objectType: "goal_proposal", objectId: "proposal-1", sourceVersionAt: "revision:2", revision: 2, status: "RETURNED" },
  ],
  "goal_check_in.append": [
    { objectType: "goal", objectId: "goal-1", sourceVersionAt: "status:ACTIVE", status: "ACTIVE" },
    { objectType: "goal_target", objectId: "target-1", sourceVersionAt: "goal:goal-1" },
  ],
  "tension.raise": [
    { objectType: "circle", objectId: "circle-1", sourceVersionAt: "active:true" },
  ],
  "tactical_outcome.submit_proposal": [
    { objectType: "tension", objectId: "tension-1", sourceVersionAt: "revision:0", revision: 0 },
    { objectType: "meeting", objectId: "meeting-1", sourceVersionAt: "ended:false" },
  ],
  "meeting_notes.update": [
    { objectType: "meeting", objectId: "meeting-1", sourceVersionAt: "notesRevision:1", revision: 1 },
  ],
  "governance_proposal.create": [
    { objectType: "tension", objectId: "tension-1", sourceVersionAt: "revision:0", revision: 0 },
    { objectType: "meeting", objectId: "meeting-1", sourceVersionAt: "ended:false" },
  ],
} as const;

describe("V5-M3-D3 Brain command handler", () => {
  test("executes the accepted D1, D2, and D3 commands", async () => {
    assert.deepEqual(D1_BRAIN_GOAL_COMMAND_NAMES, [
      "goal_proposal.create_draft",
      "goal_proposal.append_returned_revision",
      "goal_check_in.append",
    ]);
    assert.deepEqual(M3_D2_BRAIN_COMMAND_NAMES, [
      "tension.raise",
      "tactical_outcome.submit_proposal",
    ]);
    assert.deepEqual(M3_D3_BRAIN_COMMAND_NAMES, [
      "meeting_notes.update",
    ]);
    const ledger = new FakeLedger([
      operation("create", "goal_proposal.create_draft"),
      operation("revision", "goal_proposal.append_returned_revision"),
      operation("check-in", "goal_check_in.append"),
      operation("tension", "tension.raise"),
      operation("tactical", "tactical_outcome.submit_proposal"),
      operation("notes", "meeting_notes.update"),
    ]);
    const calls: string[] = [];
    const operations = recordingOperations(calls);
    const dependencies = deps(ledger, operations);

    for (const previewId of ["create", "revision", "check-in", "tension", "tactical", "notes"]) {
      const result = await confirmGoalCommandPreview({ previewId, mutationKey: `key-${previewId}`, actor }, dependencies);
      assert.equal(result.ok, true);
    }
    assert.deepEqual(calls, [
      "createGoalProposal",
      "appendGoalProposalRevision",
      "appendGoalCheckIns",
      "raiseTension",
      "submitTacticalOutcomeProposal",
      "updateMeetingNotes",
    ]);
  });

  test("keeps the handler boundary closed instead of adding generic dispatch or non-Goal imports", () => {
    const source = readFileSync(new URL("./goal-command-handler.ts", import.meta.url), "utf8");
    const imports = source.split("\n").filter((line) => line.startsWith("import ")).join("\n");
    assert.doesNotMatch(source, /\bregister\s*\(/);
    assert.doesNotMatch(source, /\bdispatch\s*\(/);
    assert.doesNotMatch(imports, /tactical-outcome-actions|meeting_notes|meeting-notes|tension-processor|governance-decision/);
    assert.match(source, /runAtomically/);
    assert.match(source, /\$transaction\(/);
    assert.match(source, /FOR UPDATE/);
    assert.match(source, /createPrismaGoalDomainTransactionDependencies/);
    assert.match(source, /deferDomainRejection: true/);
    assert.match(source, /readMeetingLifecycleStatus: createPrismaMeetingLifecycleReader\(transaction\)/);
    assert.match(source, /TransactionIsolationLevel\.Serializable/);
    assert.match(source, /updateMany\(\{/);
    assert.match(source, /status: "PREVIEWED"/);
    assert.match(source, /ownerUserId: input\.actor\.userId/);
    assert.match(source, /actorId: input\.actor\.personId/);
    assert.match(source, /case "goal_proposal\.create_draft"/);
    assert.match(source, /case "goal_proposal\.append_returned_revision"/);
    assert.match(source, /case "goal_check_in\.append"/);
    assert.match(source, /case "tension\.raise"/);
    assert.match(source, /case "tactical_outcome\.submit_proposal"/);
	    assert.match(source, /case "meeting_notes\.update"/);
	    assert.match(source, /case "governance_proposal\.create"/);
	    const governanceCreate = source.slice(
	      source.indexOf("createGovernanceProposal: async"),
	      source.indexOf("createRoleApplication: async"),
	    );
	    assert.match(governanceCreate, /endedAt:\s*null/);
	    assert.match(governanceCreate, /participants:\s*\{\s*some:\s*\{\s*id:\s*input\.actorId,\s*organizationId:\s*input\.organizationId\s*\}/);
	    const executionSwitch = source.slice(
	      source.indexOf("switch (payload.command)"),
	      source.indexOf("function goalProposalTarget"),
	    );
	    assert.match(executionSwitch, /case "meeting_notes\.update"/);
	    assert.match(executionSwitch, /case "governance_proposal\.create"/);
	  });

  test("create draft delegates to createGoalProposal with trusted actor and resolved payload", async () => {
    const ledger = new FakeLedger([operation("create", "goal_proposal.create_draft")]);
    const captured: CreateGoalProposalInput[] = [];
    const result = await confirmGoalCommandPreview({
      previewId: "create",
      mutationKey: "create-key",
      actor,
    }, deps(ledger, {
      ...recordingOperations([]),
      createGoalProposal: async (input) => {
        captured.push(input);
        return proposal("proposal-created");
      },
    }));

    assert.equal(result.ok, true);
    assert.equal(captured.length, 1);
    const capturedInput = captured[0];
    assert.ok(capturedInput);
    assert.equal(capturedInput.organizationId, actor.organizationId);
    assert.equal(capturedInput.actor.userId, actor.userId);
    assert.equal(capturedInput.actor.personId, actor.personId);
    assert.equal(capturedInput.cycleId, "cycle-1");
    assert.equal(capturedInput.revision.ownerRoleId, "role-1");
    assert.equal(ledger.get("create")?.status, "SUCCEEDED");
  });

  test("returned revision and check-in delegate to canonical Goal operations", async () => {
    const ledger = new FakeLedger([
      operation("revision", "goal_proposal.append_returned_revision"),
      operation("check-in", "goal_check_in.append"),
    ]);
    const revisionInputs: AppendGoalProposalRevisionInput[] = [];
    const checkInInputs: AppendGoalCheckInsInput[] = [];
    const operations = recordingOperations([]);
    const dependencies = deps(ledger, {
      ...operations,
      appendGoalProposalRevision: async (input) => {
        revisionInputs.push(input);
        return proposal("proposal-revised");
      },
      appendGoalCheckIns: async (input) => {
        checkInInputs.push(input);
        return [checkIn("check-in-1")];
      },
    });

    assert.equal((await confirmGoalCommandPreview({ previewId: "revision", mutationKey: "revision-key", actor }, dependencies)).ok, true);
    assert.equal((await confirmGoalCommandPreview({ previewId: "check-in", mutationKey: "check-key", actor }, dependencies)).ok, true);
    assert.equal(revisionInputs.length, 1);
    assert.equal(checkInInputs.length, 1);
    const capturedRevisionInput = revisionInputs[0];
    const capturedCheckInInput = checkInInputs[0];
    assert.ok(capturedRevisionInput);
    assert.ok(capturedCheckInInput);
    assert.equal(capturedRevisionInput.proposalId, "proposal-1");
    assert.equal(capturedRevisionInput.expectedRevision, 2);
    assert.equal(capturedCheckInInput.goalId, "goal-1");
    assert.equal(capturedCheckInInput.entries[0]?.targetId, "target-1");
    assert.equal(capturedCheckInInput.entries[0]?.assessment, "ON_TRACK");
  });

  test("tension raise binds the actor as raiser and fails closed for unsupported meeting routes", async () => {
    const ledger = new FakeLedger([
      operation("tension", "tension.raise", {
        serverPayload: {
          ...payloads["tension.raise"],
          routeCircleId: "circle-2",
        },
        payloadHash: hashBrainCommandBinding({
          ...payloads["tension.raise"],
          routeCircleId: "circle-2",
        }),
      }),
      operation("meeting-route", "tension.raise", {
        serverPayload: {
          ...payloads["tension.raise"],
          routeMeetingId: "meeting-1",
        },
        payloadHash: hashBrainCommandBinding({
          ...payloads["tension.raise"],
          routeMeetingId: "meeting-1",
        }),
      }),
    ]);
    const captured: RaiseTensionInput[] = [];
    const success = await confirmGoalCommandPreview({
      previewId: "tension",
      mutationKey: "tension-key",
      actor,
    }, deps(ledger, {
      ...recordingOperations([]),
      raiseTension: async (input) => {
        captured.push(input);
        return { id: "tension-created" };
      },
    }));
    assert.equal(success.ok, true);
    assert.equal(captured[0]?.raiserId, actor.personId);
    assert.deepEqual(captured[0]?.circleIds, ["circle-1", "circle-2"]);

    const rejected = await confirmGoalCommandPreview({
      previewId: "meeting-route",
      mutationKey: "meeting-route-key",
      actor,
    }, deps(ledger, recordingOperations([])));
    assert.equal(rejected.ok, false);
    if (!rejected.ok) assert.equal(rejected.error.code, "INVALID_INPUT");
  });

  test("meeting notes update binds actor authority and exact expected revision", async () => {
    const ledger = new FakeLedger([operation("notes", "meeting_notes.update")]);
    const captured: UpdateMeetingNotesInput[] = [];
    const result = await confirmGoalCommandPreview({
      previewId: "notes",
      mutationKey: "notes-key",
      actor,
    }, deps(ledger, {
      ...recordingOperations([]),
      updateMeetingNotes: async (input) => {
        captured.push(input);
        return { ok: true, meetingId: input.meetingId, notesRevision: input.expectedNotesRevision + 1 };
      },
    }));

    assert.equal(result.ok, true);
    assert.equal(captured.length, 1);
    assert.deepEqual(captured[0], {
      organizationId: actor.organizationId,
      actorId: actor.personId,
      meetingId: "meeting-1",
      expectedNotesRevision: 1,
      notes: "Updated notes",
    });
  });

  test("keeps meeting commands PREVIEWED without validation or writes in SETUP and missing lifecycle", async () => {
    const commands = [
      "tactical_outcome.submit_proposal",
      "meeting_notes.update",
      "governance_proposal.create",
    ] as const;

    for (const lifecycleStatus of ["SETUP", undefined]) {
      for (const command of commands) {
        const ledger = new FakeLedger([operation(command, command)]);
        const operationCalls: string[] = [];
        let sourceValidationCalls = 0;
        const result = await confirmGoalCommandPreview({
          previewId: command,
          mutationKey: `key-${command}`,
          actor,
        }, deps(
          ledger,
          recordingOperations(operationCalls),
          { validate: async () => {
            sourceValidationCalls += 1;
            return { ok: true };
          } },
          async () => lifecycleStatus,
        ));

        assert.equal(result.ok, false);
        if (!result.ok) assert.equal(result.error.code, "INVALID_STATE");
        assert.equal(ledger.get(command)?.status, "PREVIEWED");
        assert.equal(ledger.completeCalls, 0);
        assert.equal(sourceValidationCalls, 0);
        assert.deepEqual(operationCalls, []);
      }
    }
  });

  test("passes all meeting commands through in ACTIVE lifecycle", async () => {
    const commands = [
      "tactical_outcome.submit_proposal",
      "meeting_notes.update",
      "governance_proposal.create",
    ] as const;
    const ledger = new FakeLedger(commands.map((command) => operation(command, command)));
    const operationCalls: string[] = [];

    for (const command of commands) {
      const result = await confirmGoalCommandPreview({
        previewId: command,
        mutationKey: `key-${command}`,
        actor,
      }, deps(ledger, recordingOperations(operationCalls)));
      assert.equal(result.ok, true);
    }

    assert.deepEqual(operationCalls, [
      "submitTacticalOutcomeProposal",
      "updateMeetingNotes",
      "createGovernanceProposal",
    ]);
    assert.equal(ledger.completeCalls, 3);
  });

  test("executes a non-meeting command in SETUP without reading the lifecycle gate", async () => {
    const ledger = new FakeLedger([operation("tension", "tension.raise")]);
    const operationCalls: string[] = [];
    let lifecycleReads = 0;
    const result = await confirmGoalCommandPreview({
      previewId: "tension",
      mutationKey: "tension-key",
      actor,
    }, deps(
      ledger,
      recordingOperations(operationCalls),
      undefined,
      async () => {
        lifecycleReads += 1;
        return "SETUP";
      },
    ));

    assert.equal(result.ok, true);
    assert.deepEqual(operationCalls, ["raiseTension"]);
    assert.equal(lifecycleReads, 0);
  });

  test("rejects stale preview, expired preview, owner mismatch, and source drift before Goal mutation", async () => {
    const ledger = new FakeLedger([
      operation("stale", "goal_proposal.create_draft", { sourceBindingHash: "0".repeat(64) }),
      operation("expired", "goal_proposal.create_draft", { previewExpiresAt: new Date("2026-07-15T11:59:59.000Z") }),
      operation("owner", "goal_proposal.create_draft", { ownerUserId: "other-user" }),
      operation("drift", "goal_proposal.create_draft"),
    ]);
    const calls: string[] = [];

    const stale = await confirmGoalCommandPreview({ previewId: "stale", mutationKey: "stale-key", actor }, deps(ledger, recordingOperations(calls)));
    assert.equal(stale.ok, false);
    if (!stale.ok) assert.equal(stale.error.code, "STALE_PREVIEW");

    const expired = await confirmGoalCommandPreview({ previewId: "expired", mutationKey: "expired-key", actor }, deps(ledger, recordingOperations(calls)));
    assert.equal(expired.ok, false);
    if (!expired.ok) assert.equal(expired.error.code, "PREVIEW_EXPIRED");
    assert.equal(ledger.get("expired")?.status, "EXPIRED");
    assert.equal(ledger.get("expired")?.mutationKey, null);
    const expiredReplay = await confirmGoalCommandPreview({ previewId: "expired", mutationKey: "later-key", actor }, deps(ledger, recordingOperations(calls)));
    assert.deepEqual(expiredReplay, expired);

    const owner = await confirmGoalCommandPreview({ previewId: "owner", mutationKey: "owner-key", actor }, deps(ledger, recordingOperations(calls)));
    assert.equal(owner.ok, false);
    if (!owner.ok) assert.equal(owner.error.code, "NOT_AVAILABLE");

    const drift = await confirmGoalCommandPreview(
      { previewId: "drift", mutationKey: "drift-key", actor },
      deps(ledger, recordingOperations(calls), { validate: async () => ({ ok: false, code: "STALE_PREVIEW" }) }),
    );
    assert.equal(drift.ok, false);
    if (!drift.ok) assert.equal(drift.error.code, "STALE_PREVIEW");
    assert.deepEqual(calls, []);
  });

  test("preserves idempotent replay and rejects duplicate mutation conflicts", async () => {
    const ledger = new FakeLedger([
      operation("create", "goal_proposal.create_draft"),
      operation("fresh", "goal_proposal.create_draft"),
      operation("other", "goal_proposal.create_draft", {
        status: "SUCCEEDED",
        mutationKey: "used-key",
        terminalCode: "SUCCEEDED",
        terminalResult: { schemaVersion: 1, ok: true, code: "SUCCEEDED", result: { resultId: "other", status: "SUCCEEDED" } },
      }),
    ]);
    const calls: string[] = [];
    const dependencies = deps(ledger, recordingOperations(calls));

    const first = await confirmGoalCommandPreview({ previewId: "create", mutationKey: "create-key", actor }, dependencies);
    const replay = await confirmGoalCommandPreview({ previewId: "create", mutationKey: "create-key", actor }, dependencies);
    const retryConflict = await confirmGoalCommandPreview({ previewId: "create", mutationKey: "another-key", actor }, dependencies);
    const duplicate = await confirmGoalCommandPreview({ previewId: "fresh", mutationKey: "used-key", actor }, dependencies);

    assert.equal(first.ok, true);
    assert.deepEqual(replay, first);
    assert.equal(retryConflict.ok, false);
    if (!retryConflict.ok) assert.equal(retryConflict.error.code, "RETRY_CONFLICT");
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) assert.equal(duplicate.error.code, "IDEMPOTENCY_CONFLICT");
    assert.deepEqual(calls, ["createGoalProposal"]);
  });

  test("redacts internal errors in terminal result", async () => {
    const ledger = new FakeLedger([operation("create", "goal_proposal.create_draft")]);
    const result = await confirmGoalCommandPreview({
      previewId: "create",
      mutationKey: "create-key",
      actor,
    }, deps(ledger, {
      ...recordingOperations([]),
      createGoalProposal: async () => {
        throw new Error("secret database detail");
      },
    }));

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "TEMPORARY_FAILURE");
      assert.doesNotMatch(JSON.stringify(result.error), /secret database detail/);
    }
    assert.equal(ledger.get("create")?.status, "REJECTED");
    assert.doesNotMatch(JSON.stringify(ledger.get("create")?.terminalResult), /secret database detail/);
  });

  test("defers domain rejections until after the atomic transaction rolls back", async () => {
    const ledger = new FakeLedger([operation("create", "goal_proposal.create_draft")]);
    const atomicLedger: BrainGoalCommandLedgerStore = {
      loadOwnedOperation: (input) => ledger.loadOwnedOperation(input),
      findOperationByMutationKey: (input) => ledger.findOperationByMutationKey(input),
      completeOperation: async () => {
        throw new Error("terminalized inside atomic transaction");
      },
    };
    const result = await confirmGoalCommandPreview({
      previewId: "create",
      mutationKey: "create-key",
      actor,
    }, {
      ...deps(ledger, {
        ...recordingOperations([]),
        createGoalProposal: async () => {
          throw new GoalDomainError("FORBIDDEN");
        },
      }),
      runAtomically: (work) => work({
        ...deps(atomicLedger, {
          ...recordingOperations([]),
          createGoalProposal: async () => {
            throw new GoalDomainError("FORBIDDEN");
          },
        }),
        deferDomainRejection: true,
      }),
    });

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "ACCESS_DENIED");
    assert.equal(ledger.get("create")?.status, "REJECTED");
    assert.equal(ledger.get("create")?.terminalCode, "ACCESS_DENIED");
  });

  test("replays a terminal winner after an atomic transaction conflict", async () => {
    const ledger = new FakeLedger([
      operation("create", "goal_proposal.create_draft", {
        status: "SUCCEEDED",
        mutationKey: "create-key",
        terminalCode: "SUCCEEDED",
        terminalResult: {
          schemaVersion: 1,
          ok: true,
          code: "SUCCEEDED",
          result: { resultId: "proposal-created", status: "SUCCEEDED", summary: "Goal draft created." },
        },
      }),
    ]);
    const result = await confirmGoalCommandPreview({
      previewId: "create",
      mutationKey: "create-key",
      actor,
    }, {
      ...deps(ledger, recordingOperations([])),
      runAtomically: async () => {
        throw new Error("serialization conflict after winner committed");
      },
    });

    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.result.resultId, "proposal-created");
  });

  test("redacts ledger and source validation infrastructure failures", async () => {
    const loadFailure = await confirmGoalCommandPreview({
      previewId: "create",
      mutationKey: "create-key",
      actor,
    }, deps({
      loadOwnedOperation: async () => {
        throw new Error("secret load failure");
      },
      findOperationByMutationKey: async () => null,
      completeOperation: async () => {
        throw new Error("unexpected completion");
      },
    }, recordingOperations([])));
    assert.equal(loadFailure.ok, false);
    if (!loadFailure.ok) {
      assert.equal(loadFailure.error.code, "TEMPORARY_FAILURE");
      assert.doesNotMatch(JSON.stringify(loadFailure.error), /secret load failure/);
    }

    const sourceFailure = await confirmGoalCommandPreview({
      previewId: "create",
      mutationKey: "create-key",
      actor,
    }, deps(
      new FakeLedger([operation("create", "goal_proposal.create_draft")]),
      recordingOperations([]),
      { validate: async () => { throw new Error("secret source failure"); } },
    ));
    assert.equal(sourceFailure.ok, false);
    if (!sourceFailure.ok) {
      assert.equal(sourceFailure.error.code, "TEMPORARY_FAILURE");
      assert.doesNotMatch(JSON.stringify(sourceFailure.error), /secret source failure/);
    }
  });

  test("maps canonical duplicate mutation conflict to public idempotency conflict", async () => {
    const ledger = new FakeLedger([operation("create", "goal_proposal.create_draft")]);
    const result = await confirmGoalCommandPreview({
      previewId: "create",
      mutationKey: "create-key",
      actor,
    }, deps(ledger, {
      ...recordingOperations([]),
      createGoalProposal: async () => {
        throw new GoalDomainError("MUTATION_KEY_CONFLICT");
      },
    }));

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "IDEMPOTENCY_CONFLICT");
  });
});

function operation(
  id: string,
  command: keyof typeof payloads,
  overrides: Partial<BrainGoalCommandOperation> = {},
): BrainGoalCommandOperation {
  return {
    id,
    organizationId: actor.organizationId,
    ownerUserId: actor.userId,
    actorId: actor.personId,
    commandName: command,
    commandSchemaVersion: 1,
    serverPayload: payloads[command],
    payloadHash: hashBrainCommandBinding(payloads[command]),
    sourceBindings: sourceBindings[command],
    sourceBindingHash: hashBrainCommandBinding(sourceBindings[command]),
    previewExpiresAt: expiresAt,
    mutationKey: null,
    status: "PREVIEWED",
    terminalCode: null,
    terminalResult: null,
    ...overrides,
  };
}

function deps(
  ledger: BrainGoalCommandLedgerStore,
  operations: BrainGoalCommandOperations,
  sourceValidator: BrainGoalCommandSourceValidator = { validate: async () => ({ ok: true }) },
  readMeetingLifecycleStatus: (organizationId: string) => Promise<unknown> = async () => "ACTIVE",
) {
  return {
    ledger,
    goalDomain,
    sourceValidator,
    readMeetingLifecycleStatus,
    operations,
    now: () => now,
    correlationId: () => "corr-1",
  };
}

function recordingOperations(calls: string[]): BrainGoalCommandOperations {
  return {
    createGoalProposal: async () => {
      calls.push("createGoalProposal");
      return proposal("proposal-created");
    },
    appendGoalProposalRevision: async () => {
      calls.push("appendGoalProposalRevision");
      return proposal("proposal-revised");
    },
    appendGoalCheckIns: async () => {
      calls.push("appendGoalCheckIns");
      return [checkIn("check-in-1")];
    },
    raiseTension: async () => {
      calls.push("raiseTension");
      return { id: "tension-created" };
    },
    submitTacticalOutcomeProposal: async () => {
      calls.push("submitTacticalOutcomeProposal");
      return { ok: true, proposalId: "tactical-proposal-1", revision: 1, status: "PROPOSED" };
    },
    updateMeetingNotes: async () => {
      calls.push("updateMeetingNotes");
      return { ok: true, meetingId: "meeting-1", notesRevision: 2 };
    },
    createGovernanceProposal: async () => {
      calls.push("createGovernanceProposal");
      return { id: "governance-proposal-1" };
    },
  };
}

function proposal(id: string): GoalProposalSnapshot {
  return {
    id,
    organizationId: actor.organizationId,
    cycleId: "cycle-1",
    circleId: "circle-1",
    proposerId: actor.personId,
    kind: "CREATE",
    status: "DRAFT",
    replacedGoalId: null,
    currentRevision: 1,
    submittedAt: null,
    terminalAt: null,
    cycleStatus: "PLANNED",
    revision: {
      revision: 1,
      title: "Improve activation",
      intendedOutcome: "Users activate",
      ownerRoleId: "role-1",
      parentGoalId: null,
      closeResult: null,
      conclusion: null,
      authoredById: actor.personId,
      createdAt: now,
      targets: [],
    },
  };
}

function checkIn(id: string): GoalCheckInSnapshot {
  return {
    id,
    organizationId: actor.organizationId,
    goalId: "goal-1",
    targetId: "target-1",
    fact: "Activation reached 18%",
    evidenceSummary: "Weekly report",
    currentValue: null,
    milestoneCompleted: null,
    acceptanceEvidence: null,
    assessment: "ON_TRACK",
    recorderId: actor.personId,
    meetingId: null,
    sourceUrl: null,
    supersedesCheckInId: null,
    recordedAt: now,
  };
}

class FakeLedger implements BrainGoalCommandLedgerStore {
  private readonly rows = new Map<string, BrainGoalCommandOperation>();
  completeCalls = 0;

  constructor(rows: BrainGoalCommandOperation[]) {
    for (const row of rows) this.rows.set(row.id, row);
  }

  get(id: string): BrainGoalCommandOperation | undefined {
    return this.rows.get(id);
  }

  async loadOwnedOperation(input: { id: string; actor: BrainGoalCommandActor }) {
    const row = this.rows.get(input.id);
    if (!row) return null;
    if (
      row.organizationId !== input.actor.organizationId ||
      row.ownerUserId !== input.actor.userId ||
      row.actorId !== input.actor.personId
    ) {
      return null;
    }
    return row;
  }

  async findOperationByMutationKey(input: { organizationId: string; mutationKey: string }) {
    return [...this.rows.values()].find((row) =>
      row.organizationId === input.organizationId &&
      row.mutationKey === input.mutationKey
    ) ?? null;
  }

  async completeOperation(input: BrainGoalCommandTerminalInput) {
    this.completeCalls += 1;
    const row = this.rows.get(input.id);
    assert.ok(row);
    if (input.mutationKey) {
      const duplicate = await this.findOperationByMutationKey({
        organizationId: input.actor.organizationId,
        mutationKey: input.mutationKey,
      });
      if (duplicate && duplicate.id !== input.id) {
        throw new Error("unique mutation conflict");
      }
    }
    const updated = {
      ...row,
      status: input.status,
      mutationKey: input.mutationKey,
      terminalCode: input.terminalCode,
      terminalResult: input.terminalResult,
    } satisfies BrainGoalCommandOperation;
    this.rows.set(input.id, updated);
    return updated;
  }
}
