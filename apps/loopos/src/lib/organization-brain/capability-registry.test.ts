import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { BRAIN_COMMAND_NAMES, BRAIN_COMMAND_REGISTRY, BrainCommandValidationError } from "./command-registry";

import {
  BRAIN_CAPABILITY_REGISTRY,
  isBrainCapabilityHandlerId,
  parseBrainCapabilityRequest,
  resolveBrainCapability,
} from "./capability-registry";

describe("M6-2B typed Brain capability contract", () => {
  test("covers the registered commands without duplicating command schemas", () => {
    assert.deepEqual(Object.keys(BRAIN_CAPABILITY_REGISTRY), [...BRAIN_COMMAND_NAMES]);
    for (const id of BRAIN_COMMAND_NAMES) {
      const capability = BRAIN_CAPABILITY_REGISTRY[id];
      assert.equal(capability.id, id);
      assert.equal(capability.schemaVersion, 1);
      assert.equal(capability.requiresConfirmation, true);
      assert.equal(capability.idempotency, "REQUIRED");
      assert.equal(Object.isFrozen(capability), true);
      assert.equal(Object.isFrozen(capability.reads), true);
      assert.equal(capability.command, BRAIN_COMMAND_REGISTRY[id]);
      assert.match(capability.auditEvent, /^brain\.[a-z0-9_.]+$/);
      assert.equal(isBrainCapabilityHandlerId(capability.handlerId), true);
    }
    assert.deepEqual(
      Object.fromEntries(BRAIN_COMMAND_NAMES.map((id) => [id, BRAIN_CAPABILITY_REGISTRY[id].handlerId])),
      {
        "goal_proposal.create_draft": "goal-command-handler.create-goal-proposal",
        "goal_proposal.append_returned_revision": "goal-command-handler.append-goal-proposal-revision",
        "goal_check_in.append": "goal-command-handler.append-goal-check-in",
        "tension.raise": "goal-command-handler.raise-tension",
        "tactical_outcome.submit_proposal": "goal-command-handler.submit-tactical-outcome-proposal",
        "meeting_notes.update": "goal-command-handler.update-meeting-notes",
        "governance_proposal.create": "goal-command-handler.create-governance-proposal",
        "role_application.create": "goal-command-handler.create-role-application",
      },
    );
  });

  test("rejects unknown capability IDs and schema versions before parsing input", () => {
    assert.throws(() => resolveBrainCapability({ id: "arbitrary.handler", schemaVersion: 1 }), (error) =>
      error instanceof BrainCommandValidationError && error.code === "INVALID_COMMAND");
    assert.throws(() => resolveBrainCapability({ id: "tension.raise", schemaVersion: 2 }), (error) =>
      error instanceof BrainCommandValidationError && error.code === "INVALID_INPUT");
  });

  test("uses the existing closed input parser and rejects handler or database injection", () => {
    assert.throws(() => parseBrainCapabilityRequest({
      id: "tension.raise",
      schemaVersion: 1,
      input: { title: "x", description: "y", type: "CLARIFYING", circleRefs: ["c"], handlingMode: "UNROUTED", handler: "evil" },
    }), (error) => error instanceof BrainCommandValidationError && error.code === "INVALID_INPUT");
    assert.throws(() => parseBrainCapabilityRequest({
      id: "tension.raise",
      schemaVersion: 1,
      input: { title: "x", description: "y", type: "CLARIFYING", circleRefs: ["c"], handlingMode: "UNROUTED", sql: "select 1" },
    }), (error) => error instanceof BrainCommandValidationError && error.code === "INVALID_INPUT");
  });

  test("does not expose arbitrary handler injection or client imports", () => {
    assert.equal(isBrainCapabilityHandlerId("evil.module.run"), false);
    const source = readFileSync(new URL("./capability-registry.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /["']use client["']/);
    assert.match(source, /from "\.\/command-registry"/);
    assert.doesNotMatch(source, /from\s+["'][^"']*\.tsx?["']/);
    assert.doesNotMatch(source, /(?:table|sql|databaseClient)\s*:/);
    const handlerSource = readFileSync(new URL("./goal-command-handler.ts", import.meta.url), "utf8");
    const previewSource = readFileSync(new URL("./command-preview-core.ts", import.meta.url), "utf8");
    const serviceSource = readFileSync(new URL("./command-preview-service.ts", import.meta.url), "utf8");
    assert.doesNotMatch(handlerSource, /["']use client["']/);
    assert.doesNotMatch(previewSource, /["']use client["']/);
    assert.match(serviceSource, /^import "server-only";/);
    assert.match(handlerSource, /EXECUTABLE_HANDLER_IDS/);
    assert.match(previewSource, /commandSchemaVersion: true/);
  });
});
