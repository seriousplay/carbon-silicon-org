import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKFLOW_COMPILER_VERSION,
  WORKFLOW_DEFINITION_SCHEMA_VERSION,
  WORKFLOW_PROTOCOL_VERSION,
  type CompiledRuntimeNode,
  type CompiledWorkflow,
  type WorkflowEdge,
} from "../protocol";
import { transitionRuntime, type RuntimeEvidence } from "../runtime-engine";

function workflow(nodes: CompiledRuntimeNode[], edges: WorkflowEdge[], entryNodeId = nodes[0].id): CompiledWorkflow {
  const adjacency: CompiledWorkflow["adjacency"] = Object.fromEntries(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    adjacency[edge.from].push({
      edgeId: edge.id,
      to: edge.to,
      ...(edge.branch ? { branch: edge.branch } : {}),
    });
  }
  return {
    protocolVersion: WORKFLOW_PROTOCOL_VERSION,
    definitionSchemaVersion: WORKFLOW_DEFINITION_SCHEMA_VERSION,
    compilerVersion: WORKFLOW_COMPILER_VERSION,
    entryNodeId,
    nodes,
    edges,
    adjacency,
    terminalNodeIds: nodes.filter((node) => node.type === "complete" || node.type === "terminate").map((node) => node.id),
    requiredCapabilities: [],
    hashes: { source: "source", semantics: "semantics" },
  };
}

test("advances evidence to confirmation and then completion with ordered events", () => {
  const compiled = workflow(
    [
      { id: "evidence", type: "structured_evidence_input", config: { fields: ["result"], roleId: "operator" } },
      { id: "confirm", type: "human_confirmation", config: { prompt: "Accept?", roleId: "reviewer" } },
      { id: "done", type: "complete", config: { outcome: "accepted" } },
    ],
    [
      { id: "e1", from: "evidence", to: "confirm" },
      { id: "e2", from: "confirm", to: "done" },
    ],
  );

  const submitted = transitionRuntime({
    workflow: compiled,
    currentNodeId: "evidence",
    currentNodeVisit: 0,
    evidence: {},
    command: { kind: "SUBMIT_EVIDENCE", payload: { evidence: { result: "pass" } } },
  });
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  assert.deepEqual(
    {
      node: submitted.nextNodeId,
      visit: submitted.nextNodeVisit,
      status: submitted.status,
      patch: submitted.evidencePatch,
      events: submitted.events.map((event) => event.type),
    },
    {
      node: "confirm",
      visit: 1,
      status: "ACTIVE",
      patch: { result: "pass" },
      events: ["COMMAND_ACCEPTED", "EVIDENCE_RECORDED", "NODE_TRANSITIONED"],
    },
  );

  const confirmed = transitionRuntime({
    workflow: compiled,
    currentNodeId: submitted.nextNodeId,
    currentNodeVisit: submitted.nextNodeVisit,
    evidence: { result: "pass" },
    command: { kind: "CONFIRM" },
  });
  assert.equal(confirmed.ok, true);
  if (!confirmed.ok) return;
  assert.deepEqual(confirmed.evidencePatch, {});
  assert.deepEqual(
    {
      node: confirmed.nextNodeId,
      visit: confirmed.nextNodeVisit,
      status: confirmed.status,
      waitingRoleId: confirmed.waitingRoleId,
      events: confirmed.events.map((event) => event.type),
    },
    {
      node: "done",
      visit: 2,
      status: "COMPLETED",
      waitingRoleId: null,
      events: ["COMMAND_ACCEPTED", "NODE_TRANSITIONED", "COMPLETED"],
    },
  );
});

test("routes both condition branches for equals, not_equals, and exists", () => {
  const cases: Array<{
    operator: "equals" | "not_equals" | "exists";
    value?: string;
    evidence: RuntimeEvidence;
    expected: "yes" | "no";
  }> = [
    { operator: "equals", value: "pass", evidence: { result: "pass" }, expected: "yes" },
    { operator: "equals", value: "pass", evidence: { result: "fail" }, expected: "no" },
    { operator: "not_equals", value: "pass", evidence: { result: "fail" }, expected: "yes" },
    { operator: "exists", evidence: {}, expected: "no" },
    { operator: "exists", evidence: { result: false }, expected: "yes" },
  ];

  for (const scenario of cases) {
    const config = {
      field: "result",
      operator: scenario.operator,
      ...(scenario.value === undefined ? {} : { value: scenario.value }),
    };
    const compiled = workflow(
      [
        { id: "check", type: "condition", config },
        { id: "yes", type: "complete", config: { outcome: "yes" } },
        { id: "no", type: "terminate", config: { reason: "no" } },
      ],
      [
        { id: "true-edge", from: "check", to: "yes", branch: "true" },
        { id: "false-edge", from: "check", to: "no", branch: "false" },
      ],
    );
    const result = transitionRuntime({
      workflow: compiled,
      currentNodeId: "check",
      currentNodeVisit: 0,
      evidence: scenario.evidence,
      command: null,
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.nextNodeId, scenario.expected);
  }
});

test("waits for the configured role and resumes explicitly", () => {
  const compiled = workflow(
    [
      { id: "wait", type: "wait_for_role", config: { roleId: "reviewer", request: "Review evidence" } },
      { id: "done", type: "complete", config: { outcome: "reviewed" } },
    ],
    [{ id: "resume-edge", from: "wait", to: "done" }],
  );
  const waiting = transitionRuntime({
    workflow: compiled,
    currentNodeId: "wait",
    currentNodeVisit: 3,
    evidence: {},
    command: null,
  });
  assert.equal(waiting.ok, true);
  if (!waiting.ok) return;
  assert.equal(waiting.status, "WAITING");
  assert.equal(waiting.waitingRoleId, "reviewer");

  const resumed = transitionRuntime({
    workflow: compiled,
    currentNodeId: waiting.nextNodeId,
    currentNodeVisit: waiting.nextNodeVisit,
    evidence: {},
    command: { kind: "RESUME" },
  });
  assert.equal(resumed.ok, true);
  if (resumed.ok) assert.equal(resumed.status, "COMPLETED");
});

test("terminates with the configured reason", () => {
  const compiled = workflow([{ id: "stop", type: "terminate", config: { reason: "rejected" } }], []);
  const result = transitionRuntime({
    workflow: compiled,
    currentNodeId: "stop",
    currentNodeVisit: 0,
    evidence: {},
    command: null,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.status, "TERMINATED");
  assert.deepEqual(result.events, [{ type: "TERMINATED", nodeId: "stop", nodeVisit: 0, reason: "rejected" }]);
});

test("returns a typed error for an invalid command without partial output", () => {
  const compiled = workflow([
    { id: "confirm", type: "human_confirmation", config: { prompt: "Confirm", roleId: "reviewer" } },
  ], []);
  const result = transitionRuntime({
    workflow: compiled,
    currentNodeId: "confirm",
    currentNodeVisit: 0,
    evidence: {},
    command: { kind: "SUBMIT_EVIDENCE", payload: { evidence: {} } },
  });
  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "INVALID_COMMAND",
      nodeId: "confirm",
      message: "human_confirmation requires CONFIRM without a payload",
    },
  });
});

test("distinguishes unsupported nodes from unsupported side effects", () => {
  const attachment = workflow([
    { id: "attachment", type: "attachment_input", config: { allowedMimeTypes: ["text/plain"], roleId: "operator" } },
  ], []);
  const unsupported = transitionRuntime({
    workflow: attachment,
    currentNodeId: "attachment",
    currentNodeVisit: 0,
    evidence: {},
    command: null,
  });
  assert.equal(unsupported.ok, false);
  if (!unsupported.ok) assert.equal(unsupported.error.code, "UNSUPPORTED_NODE");

  const sideEffect = workflow([
    {
      id: "project",
      type: "create_project",
      config: { confirmationNodeId: "confirm", nameField: "name", resultField: "result", roleId: "owner" },
    },
  ], []);
  const rejectedSideEffect = transitionRuntime({
    workflow: sideEffect,
    currentNodeId: "project",
    currentNodeVisit: 0,
    evidence: {},
    command: null,
  });
  assert.equal(rejectedSideEffect.ok, false);
  if (!rejectedSideEffect.ok) assert.equal(rejectedSideEffect.error.code, "UNSUPPORTED_SIDE_EFFECT");
});

test("confirmed enabled side effects wait for explicit execution and only then advance", () => {
  const compiled = workflow(
    [
      { id: "confirm", type: "human_confirmation", config: { prompt: "Raise?", roleId: "operator" } },
      { id: "raise", type: "raise_tension", config: { confirmationNodeId: "confirm", roleId: "operator", titleField: "title", descriptionField: "description" } },
      { id: "done", type: "complete", config: { outcome: "raised" } },
    ],
    [{ id: "to-raise", from: "confirm", to: "raise" }, { id: "to-done", from: "raise", to: "done" }],
  );
  const confirmed = transitionRuntime({ workflow: compiled, currentNodeId: "confirm", currentNodeVisit: 0, evidence: {}, command: { kind: "CONFIRM" } });
  assert.equal(confirmed.ok, true);
  if (!confirmed.ok) return;
  assert.equal(confirmed.nextNodeId, "raise");
  assert.equal(confirmed.status, "ACTIVE");
  assert.deepEqual(confirmed.events.map((event) => event.type), ["COMMAND_ACCEPTED", "NODE_TRANSITIONED"]);

  const executed = transitionRuntime({ workflow: compiled, currentNodeId: "raise", currentNodeVisit: 1, evidence: {}, command: { kind: "EXECUTE_SIDE_EFFECT" } });
  assert.equal(executed.ok, true);
  if (!executed.ok) return;
  assert.equal(executed.status, "COMPLETED");
  assert.deepEqual(executed.events.map((event) => event.type), ["COMMAND_ACCEPTED", "SIDE_EFFECT_COMPLETED", "NODE_TRANSITIONED", "COMPLETED"]);
});

test("pauses a condition loop after 32 automatic transitions", () => {
  const compiled = workflow(
    [
      { id: "loop", type: "condition", config: { field: "again", operator: "equals", value: true } },
      { id: "done", type: "complete", config: { outcome: "done" } },
    ],
    [
      { id: "loop-edge", from: "loop", to: "loop", branch: "true" },
      { id: "done-edge", from: "loop", to: "done", branch: "false" },
    ],
  );
  const result = transitionRuntime({
    workflow: compiled,
    currentNodeId: "loop",
    currentNodeVisit: 0,
    evidence: { again: true },
    command: null,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.status, "PAUSED");
  assert.equal(result.nextNodeId, "loop");
  assert.equal(result.nextNodeVisit, 32);
  assert.deepEqual(result.events.at(-1), { type: "LOOP_LIMIT", nodeId: "loop", nodeVisit: 32, limit: 32 });
});
