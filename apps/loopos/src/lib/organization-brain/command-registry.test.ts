import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import {
  BRAIN_COMMAND_NAMES,
  BRAIN_COMMAND_PUBLIC_ERROR_CODES,
  BRAIN_COMMAND_REGISTRY,
  BrainCommandValidationError,
  canonicalizeBrainCommandBinding,
  hashBrainCommandBinding,
  parseBrainCommandInput,
  parseBrainCommandPublicError,
  parseBrainCommandServerPayload,
  publicBrainCommandError,
  type BrainCommandPublicErrorCode,
} from "./command-registry";

const validTarget = {
  position: 1,
  label: "Activation rate",
  kind: "NUMERIC",
  desiredValue: "80%",
} as const;

const validInputs = {
  "goal_proposal.create_draft": {
    cycleRef: "cycle:evidence-1",
    circleRef: "circle:evidence-1",
    ownerRoleRef: "role:evidence-1",
    title: "Improve activation",
    intendedOutcome: "Users complete onboarding",
    targets: [validTarget],
  },
  "goal_proposal.append_returned_revision": {
    proposalRef: "proposal:evidence-1",
    expectedRevision: 2,
    title: "Improve activation",
    intendedOutcome: "Users complete onboarding",
    rationale: "Addressed returned points",
    targets: [validTarget],
  },
  "goal_check_in.append": {
    goalRef: "goal:evidence-1",
    targetRef: "target:evidence-1",
    fact: "Activation reached 72%",
    evidenceSummary: "Latest weekly review",
    assessment: "ON_TRACK",
  },
  "tension.raise": {
    title: "Routing is unclear",
    description: "The owner cannot select a tactical route",
    type: "CLARIFYING",
    circleRefs: ["circle:evidence-1"],
    handlingMode: "TACTICAL",
    routeCircleRef: "circle:evidence-1",
  },
  "tactical_outcome.submit_proposal": {
    tensionRef: "tension:evidence-1",
    meetingRef: "meeting:evidence-1",
    expectedRevision: 0,
    kind: "PROJECT",
    title: "Fix routing",
    description: "Create a proposal for routing clarity",
    responsibility: "Circle lead confirms the route",
  },
  "meeting_notes.update": {
    meetingRef: "meeting:evidence-1",
    expectedNotesRevision: 3,
    notes: "Updated notes",
  },
  "governance_proposal.create": {
    tensionRef: "tension:evidence-1",
    meetingRef: "meeting:evidence-1",
    currentStructure: "Current role boundary",
    proposedStructure: "New role boundary",
    rationale: "The current boundary creates a repeated tension",
    expectedImpact: "The proposer can safely test the change",
    structuralChange: { schemaVersion: 1, operation: "ROLE_ARCHIVED", targetId: "role:evidence-1" },
  },
  "role_application.create": {
    roleRef: "role:evidence-1",
    motivation: "承担该角色",
    capabilitySummary: "具备相关能力",
    commitment: "持续投入",
  },
} as const;

const validPayloads = {
  "goal_proposal.create_draft": {
    command: "goal_proposal.create_draft",
    cycleId: "cycle-1",
    circleId: "circle-1",
    ownerRoleId: "role-1",
    title: "Improve activation",
    intendedOutcome: "Users complete onboarding",
    targets: [{ ...validTarget, metricId: "metric-1" }],
  },
  "goal_proposal.append_returned_revision": {
    command: "goal_proposal.append_returned_revision",
    proposalId: "proposal-1",
    expectedRevision: 2,
    title: "Improve activation",
    intendedOutcome: "Users complete onboarding",
    rationale: "Addressed returned points",
    targets: [validTarget],
  },
  "goal_check_in.append": {
    command: "goal_check_in.append",
    goalId: "goal-1",
    targetId: "target-1",
    fact: "Activation reached 72%",
    evidenceSummary: "Latest weekly review",
    assessment: "ON_TRACK",
  },
  "tension.raise": {
    command: "tension.raise",
    title: "Routing is unclear",
    description: "The owner cannot select a tactical route",
    type: "CLARIFYING",
    circleIds: ["circle-1"],
    handlingMode: "TACTICAL",
    routeCircleId: "circle-1",
  },
  "tactical_outcome.submit_proposal": {
    command: "tactical_outcome.submit_proposal",
    tensionId: "tension-1",
    meetingId: "meeting-1",
    expectedRevision: 0,
    kind: "PROJECT",
    title: "Fix routing",
    description: "Create a proposal for routing clarity",
    responsibility: "Circle lead confirms the route",
    circleId: "circle-1",
    responsiblePersonId: "person-1",
  },
  "meeting_notes.update": {
    command: "meeting_notes.update",
    meetingId: "meeting-1",
    expectedNotesRevision: 3,
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
  "role_application.create": {
    command: "role_application.create",
    roleRef: "role-1",
    motivation: "承担该角色",
    capabilitySummary: "具备相关能力",
    commitment: "持续投入",
  },
} as const;

function rejectsCommand(input: unknown, code: BrainCommandPublicErrorCode): void {
  assert.throws(
    () => parseBrainCommandInput(input),
    (error) => error instanceof BrainCommandValidationError && error.code === code,
  );
}

describe("V5-M3-C static Brain command registry", () => {
    test("exposes the accepted command metadata variants", () => {
    assert.deepEqual(BRAIN_COMMAND_NAMES, [
      "goal_proposal.create_draft",
      "goal_proposal.append_returned_revision",
      "goal_check_in.append",
      "tension.raise",
      "tactical_outcome.submit_proposal",
      "meeting_notes.update",
      "governance_proposal.create",
      "role_application.create",
    ]);
    assert.deepEqual(Object.keys(BRAIN_COMMAND_REGISTRY), [...BRAIN_COMMAND_NAMES]);

    for (const command of BRAIN_COMMAND_NAMES) {
      const metadata = BRAIN_COMMAND_REGISTRY[command];
      assert.equal(metadata.command, command);
      assert.equal(metadata.schemaVersion, 1);
      assert.equal(Object.isFrozen(metadata), true);
      assert.deepEqual(Object.keys(metadata.publicErrors), [...BRAIN_COMMAND_PUBLIC_ERROR_CODES]);
      assert.equal(typeof metadata.parseInput, "function");
      assert.equal(typeof metadata.parseServerPayload, "function");
      assert.equal(typeof metadata.parseSourceBindings, "function");
      assert.equal(typeof metadata.formatHumanDiff, "function");
      assert.equal(typeof metadata.parseResult, "function");
    }
  });

  test("parses only the exact allowlist and rejects forbidden commands", () => {
    for (const command of BRAIN_COMMAND_NAMES) {
      const parsed = parseBrainCommandInput({
        schemaVersion: 1,
        command,
        input: validInputs[command],
      });
      assert.equal(parsed.schemaVersion, 1);
      assert.equal(parsed.command, command);
      assert.equal(Object.isFrozen(parsed.input), true);
    }

    rejectsCommand(
      { schemaVersion: 1, command: "goal_proposal.submit", input: {} },
      "INVALID_COMMAND",
    );
    rejectsCommand(
      { schemaVersion: 1, command: "project.create", input: {} },
      "INVALID_COMMAND",
    );
    rejectsCommand(
      { schemaVersion: 1, command: "tactical_outcome.approve", input: {} },
      "INVALID_COMMAND",
    );
    rejectsCommand(
      { schemaVersion: 2, command: "meeting_notes.update", input: validInputs["meeting_notes.update"] },
      "INVALID_INPUT",
    );
  });

  test("rejects untrusted authority, storage, callback, and actor fields recursively", () => {
    for (const forbidden of [
      "organizationId",
      "personId",
      "userId",
      "actorId",
      "ownerId",
      "recorderId",
      "raiserId",
      "handler",
      "module",
      "table",
      "field",
      "sql",
      "callback",
      "databaseClient",
      "ActorContext",
    ]) {
      rejectsCommand(
        {
          schemaVersion: 1,
          command: "meeting_notes.update",
          input: {
            ...validInputs["meeting_notes.update"],
            nested: { [forbidden]: "forbidden" },
          },
        },
        "INVALID_INPUT",
      );
    }
  });

  test("closes input, server payload, source binding, diff, result, and error schemas", () => {
    const command = "tactical_outcome.submit_proposal";
    const metadata = BRAIN_COMMAND_REGISTRY[command];

    assert.throws(
      () => metadata.parseInput({ ...validInputs[command], extra: "nope" }),
      BrainCommandValidationError,
    );
    assert.throws(
      () => parseBrainCommandServerPayload({ ...validPayloads[command], extra: "nope" }),
      BrainCommandValidationError,
    );

    const payload = metadata.parseServerPayload(validPayloads[command]);
    const diff = metadata.formatHumanDiff(payload);
    assert.deepEqual(diff.map((item) => item.label), [
      "Kind",
      "Title",
      "Responsibility",
      "Due date",
    ]);
    assert.equal(Object.isFrozen(diff), true);

    const bindings = metadata.parseSourceBindings([
      {
        objectType: "tension",
        objectId: "tension-1",
        sourceVersionAt: "2026-07-15T17:30:00.000Z",
        revision: 0,
        status: "OPEN",
        meeting: "meeting-1",
        route: "TACTICAL",
      },
    ]);
    assert.equal(bindings[0]?.objectType, "tension");
    assert.throws(
      () => metadata.parseSourceBindings([{ objectType: "tension", objectId: "tension-1", sourceVersionAt: "now", extra: "nope" }]),
      BrainCommandValidationError,
    );
    assert.throws(
      () =>
        BRAIN_COMMAND_REGISTRY["meeting_notes.update"].parseSourceBindings([
          { objectType: "tension", objectId: "tension-1", sourceVersionAt: "now" },
        ]),
      BrainCommandValidationError,
    );

    assert.deepEqual(metadata.parseResult({ resultId: "result-1", status: "SUCCEEDED" }), {
      resultId: "result-1",
      status: "SUCCEEDED",
    });
    assert.throws(
      () => metadata.parseResult({ resultId: "result-1", status: "PROCESSING" }),
      BrainCommandValidationError,
    );

    const publicError = publicBrainCommandError({
      code: "TEMPORARY_FAILURE",
      correlationId: "corr-1",
      previewId: "preview-1",
    });
    assert.deepEqual(publicError, {
      code: "TEMPORARY_FAILURE",
      message: "The command could not be completed. Try again later.",
      correlationId: "corr-1",
      previewId: "preview-1",
    });
    assert.deepEqual(parseBrainCommandPublicError(publicError), publicError);
    assert.throws(
      () => parseBrainCommandPublicError({ ...publicError, stack: "private" }),
      BrainCommandValidationError,
    );
  });

  test("canonical binding hashes are stable across object key order", () => {
    const first = {
      command: "meeting_notes.update",
      payload: { meetingId: "meeting-1", notes: "Updated", expectedNotesRevision: 3 },
      sourceBindings: [
        { objectId: "meeting-1", objectType: "meeting", sourceVersionAt: "2026-07-15T17:30:00.000Z", revision: 3 },
      ],
    } as const;
    const second = {
      sourceBindings: [
        { revision: 3, sourceVersionAt: "2026-07-15T17:30:00.000Z", objectType: "meeting", objectId: "meeting-1" },
      ],
      payload: { notes: "Updated", expectedNotesRevision: 3, meetingId: "meeting-1" },
      command: "meeting_notes.update",
    } as const;

    assert.equal(canonicalizeBrainCommandBinding(first), canonicalizeBrainCommandBinding(second));
    assert.equal(hashBrainCommandBinding(first), hashBrainCommandBinding(second));
    assert.match(hashBrainCommandBinding(first), /^[0-9a-f]{64}$/);
  });

  test("does not introduce a generic dispatch or registration hook", () => {
    const source = readFileSync(new URL("./command-registry.ts", import.meta.url), "utf8");

    assert.doesNotMatch(source, /\bregister\s*\(/);
    assert.doesNotMatch(source, /\bdispatch\s*\(/);
    assert.doesNotMatch(source, /\bexecute\w*Command\s*\(/);
    assert.doesNotMatch(source, /domain-operations|tactical-outcome-actions|collaboration-actions/);
  });
});
