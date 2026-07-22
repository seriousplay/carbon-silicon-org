import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { compileWorkflow } from "../compiler";
import {
  WORKFLOW_COMPILER_VERSION,
  WORKFLOW_DEFINITION_SCHEMA_VERSION,
  WORKFLOW_PROTOCOL_VERSION,
  type WorkflowDefinition,
} from "../protocol";

function validWorkflow(): WorkflowDefinition {
  return {
    protocolVersion: WORKFLOW_PROTOCOL_VERSION,
    definitionSchemaVersion: WORKFLOW_DEFINITION_SCHEMA_VERSION,
    name: "Evidence to governance",
    entryNodeId: "evidence",
    roles: [
      { id: "operator", capabilities: ["collect_evidence", "confirm"] },
      { id: "facilitator", capabilities: ["governance"] },
    ],
    nodes: [
      { id: "evidence", type: "structured_evidence_input", config: { fields: ["summary"], roleId: "operator" } },
      { id: "confirm", type: "human_confirmation", config: { prompt: "Confirm evidence", roleId: "operator" } },
      { id: "candidate", type: "mark_governance_candidate", config: { confirmationNodeId: "confirm", rationaleField: "summary", roleId: "facilitator" } },
      { id: "governance", type: "route_governance_meeting", config: { confirmationNodeId: "confirm", roleId: "facilitator" } },
      { id: "done", type: "complete", config: { outcome: "routed" } },
    ],
    edges: [
      { id: "e1", from: "evidence", to: "confirm" },
      { id: "e2", from: "confirm", to: "candidate" },
      { id: "e3", from: "candidate", to: "governance" },
      { id: "e4", from: "governance", to: "done" },
    ],
    editor: { description: "Canvas-only description" },
  };
}

function issueCodes(input: unknown): string[] {
  const result = compileWorkflow(input);
  assert.equal(result.ok, false);
  return result.issues.map((issue) => issue.code);
}

describe("protocol identity and safe catalog", () => {
  test("requires supported protocol and definition schema versions", () => {
    const protocol = { ...validWorkflow(), protocolVersion: 2 };
    assert.ok(issueCodes(protocol).includes("INVALID_PROTOCOL_VERSION"));
    const schema = { ...validWorkflow(), definitionSchemaVersion: 2 };
    assert.ok(issueCodes(schema).includes("INVALID_SCHEMA_VERSION"));
  });

  test("requires non-empty edge ids and rejects unsupported nodes", () => {
    const missingId = validWorkflow() as unknown as { edges: Array<Record<string, unknown>> };
    delete missingId.edges[0].id;
    assert.ok(issueCodes(missingId).includes("MISSING_FIELD"));

    const script = validWorkflow() as unknown as { nodes: Array<Record<string, unknown>> };
    script.nodes[0] = { id: "script", type: "script", config: { source: "return 1" } };
    assert.ok(issueCodes(script).includes("UNSUPPORTED_NODE"));
  });

  test("rejects unknown executable-looking config and missing capabilities", () => {
    const unsafe = validWorkflow() as unknown as { nodes: Array<{ config: Record<string, unknown> }> };
    unsafe.nodes[0].config.url = "https://example.com";
    assert.ok(issueCodes(unsafe).includes("UNKNOWN_FIELD"));

    const missingCapability = validWorkflow();
    missingCapability.roles[1].capabilities = [];
    assert.ok(issueCodes(missingCapability).includes("MISSING_CAPABILITY"));
  });
});

describe("graph identity and roots", () => {
  test("entry has zero incoming edges and no other node is a root", () => {
    const incoming = validWorkflow();
    incoming.edges.push({ id: "loop", from: "done", to: "evidence" });
    assert.ok(issueCodes(incoming).includes("ENTRY_HAS_INCOMING"));

    const extraRoot = validWorkflow();
    extraRoot.nodes.push({ id: "orphan", type: "terminate", config: { reason: "orphan" } });
    assert.ok(issueCodes(extraRoot).includes("UNEXPECTED_ROOT"));
  });

  test("rejects duplicate edge ids and duplicate transitions", () => {
    const duplicateId = validWorkflow();
    duplicateId.edges[1].id = "e1";
    assert.ok(issueCodes(duplicateId).includes("DUPLICATE_EDGE"));

    const duplicateTransition = validWorkflow();
    duplicateTransition.edges.push({ id: "copy", from: "evidence", to: "confirm" });
    assert.ok(issueCodes(duplicateTransition).includes("DUPLICATE_TRANSITION"));
  });
});

describe("graph degree, reachability, and termination", () => {
  test("condition requires exactly one true and one false branch", () => {
    const workflow = conditionWorkflow();
    workflow.edges.find((edge) => edge.id === "false")!.branch = "true";
    assert.ok(issueCodes(workflow).includes("INVALID_BRANCH"));
  });

  test("non-condition non-terminal nodes require exactly one outgoing edge", () => {
    const workflow = validWorkflow();
    workflow.edges.push({ id: "second", from: "evidence", to: "done" });
    assert.ok(issueCodes(workflow).includes("INVALID_OUT_DEGREE"));
  });

  test("every node must be reachable from entry", () => {
    const workflow = validWorkflow();
    workflow.nodes.push({ id: "orphan", type: "terminate", config: { reason: "orphan" } });
    assert.ok(issueCodes(workflow).includes("UNREACHABLE_NODE"));
  });

  test("rejects reachable cycles and dead regions that cannot terminate", () => {
    const workflow = conditionWorkflow();
    workflow.nodes.push(
      { id: "wait-a", type: "wait_for_role", config: { roleId: "router", request: "A" } },
      { id: "wait-b", type: "wait_for_role", config: { roleId: "router", request: "B" } },
    );
    workflow.roles.push({ id: "router", capabilities: ["route"] });
    workflow.edges = workflow.edges.filter((edge) => edge.id !== "false");
    workflow.edges.push(
      { id: "false", from: "condition", to: "wait-a", branch: "false" },
      { id: "cycle-a", from: "wait-a", to: "wait-b" },
      { id: "cycle-b", from: "wait-b", to: "wait-a" },
    );
    assert.ok(issueCodes(workflow).includes("NON_TERMINATING_REGION"));
  });

  test("accepts a cycle when every node can still reach a terminal", () => {
    const workflow = conditionWorkflow();
    workflow.roles.push({ id: "router", capabilities: ["route"] });
    workflow.nodes.push({ id: "repeat", type: "wait_for_role", config: { roleId: "router", request: "Repeat" } });
    workflow.edges = workflow.edges.filter((edge) => edge.id !== "false");
    workflow.edges.push(
      { id: "false", from: "condition", to: "repeat", branch: "false" },
      { id: "repeat-loop", from: "repeat", to: "condition" },
    );
    const result = compileWorkflow(workflow);
    assert.equal(result.ok, true);
  });
});

describe("explicit side-effect confirmation", () => {
  test("requires confirmationNodeId on every side effect", () => {
    const workflow = validWorkflow() as unknown as { nodes: Array<{ config: Record<string, unknown> }> };
    delete workflow.nodes[2].config.confirmationNodeId;
    assert.ok(issueCodes(workflow).includes("MISSING_FIELD"));
  });

  test("requires a human confirmation reference", () => {
    const workflow = validWorkflow();
    const candidate = workflow.nodes[2];
    if (candidate.type !== "mark_governance_candidate") assert.fail("candidate fixture missing");
    candidate.config.confirmationNodeId = "evidence";
    assert.ok(issueCodes(workflow).includes("INVALID_CONFIRMATION_REFERENCE"));
  });

  test("requires the declared confirmation to dominate the side effect", () => {
    const workflow = conditionWorkflow();
    const candidate = workflow.nodes.find((node) => node.id === "candidate");
    if (candidate?.type !== "mark_governance_candidate") assert.fail("candidate fixture missing");
    candidate.config.confirmationNodeId = "confirm";
    assert.ok(issueCodes(workflow).includes("CONFIRMATION_REQUIRED"));
  });
});

describe("compiled runtime snapshot", () => {
  test("is deterministic, versioned, hashed, and distinct from source", () => {
    const first = validWorkflow();
    const second = validWorkflow();
    second.roles.reverse();
    second.nodes.reverse();
    second.edges.reverse();
    const firstResult = compileWorkflow(first);
    const secondResult = compileWorkflow(second);
    assert.equal(firstResult.ok, true);
    assert.equal(secondResult.ok, true);
    if (!firstResult.ok || !secondResult.ok) return;
    assert.equal(firstResult.sourceHash, secondResult.sourceHash);
    assert.equal(firstResult.compiledHash, secondResult.compiledHash);
    assert.notDeepEqual(firstResult.compiled, firstResult.snapshot);
    assert.equal(firstResult.compiled.protocolVersion, WORKFLOW_PROTOCOL_VERSION);
    assert.equal(firstResult.compiled.definitionSchemaVersion, WORKFLOW_DEFINITION_SCHEMA_VERSION);
    assert.equal(firstResult.compiled.compilerVersion, WORKFLOW_COMPILER_VERSION);
    assert.deepEqual(firstResult.compiled.terminalNodeIds, ["done"]);
    assert.deepEqual(firstResult.compiled.adjacency.evidence, [{ edgeId: "e1", to: "confirm" }]);
    assert.deepEqual(firstResult.compiled.requiredCapabilities, ["collect_evidence", "confirm", "governance"]);
    const candidate = firstResult.compiled.nodes.find((node) => node.id === "candidate");
    assert.deepEqual(Object.keys(candidate?.config ?? {}), ["confirmationNodeId", "rationaleField", "roleId"]);
    assert.equal(firstResult.compiled.hashes.source, firstResult.sourceHash);
    assert.equal(firstResult.compiled.hashes.semantics, firstResult.compiledHash);
    assert.equal("editor" in firstResult.compiled, false);
    assert.equal("name" in firstResult.compiled, false);
  });

  test("uses locale-independent code-unit ordering for non-ASCII identifiers", () => {
    const workflow = validWorkflow();
    workflow.roles.push(
      { id: "ä-role", capabilities: [] },
      { id: "z-role", capabilities: [] },
    );
    const result = compileWorkflow(workflow);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.snapshot.roles.map((role) => role.id), [
      "facilitator",
      "operator",
      "z-role",
      "ä-role",
    ]);
  });
});

function conditionWorkflow(): WorkflowDefinition {
  const workflow = validWorkflow();
  workflow.nodes.splice(1, 0, {
    id: "condition",
    type: "condition",
    config: { field: "summary", operator: "exists" },
  });
  workflow.edges = [
    { id: "to-condition", from: "evidence", to: "condition" },
    { id: "true", from: "condition", to: "confirm", branch: "true" },
    { id: "false", from: "condition", to: "candidate", branch: "false" },
    { id: "confirmed", from: "confirm", to: "candidate" },
    { id: "to-governance", from: "candidate", to: "governance" },
    { id: "to-done", from: "governance", to: "done" },
  ];
  return workflow;
}
