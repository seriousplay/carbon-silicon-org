import assert from "node:assert/strict";
import { test } from "node:test";
import { addSafeNode, connectSafeNodes, definitionToFlow, flowToDefinition, hasPersistentEdgeChanges, isMobileWorkbenchWidth, removeSafeNode, resolveSavedEditorState, transitionEditorState } from "./editor";
import { validateSubmittedDefinition } from "./editor-validation";
import type { WorkflowDefinition } from "./protocol";

const definition: WorkflowDefinition = {
  protocolVersion: 1, definitionSchemaVersion: 1, name: "Test", entryNodeId: "start",
  roles: [{ id: "operator", capabilities: ["collect_evidence", "confirm"] }],
  nodes: [
    { id: "start", type: "structured_evidence_input", config: { fields: ["summary"], roleId: "operator" } },
    { id: "done", type: "complete", config: { outcome: "accepted" } },
  ],
  edges: [{ id: "edge-1", from: "start", to: "done" }],
};

test("definition and layout round-trip through flow projection", () => {
  const layout = { start: { x: 10, y: 20 }, done: { x: 300, y: 20 } };
  const flow = definitionToFlow(definition, layout);
  assert.deepEqual(flowToDefinition(definition, flow.nodes, flow.edges), { definition, layout });
});

test("add remove and connect preserve unrelated node config", () => {
  const added = addSafeNode(definition, {}, { id: "confirm-1", type: "human_confirmation", config: { prompt: "Approve", roleId: "operator" } }, { x: 1, y: 2 });
  const connected = connectSafeNodes(added.definition, { from: "start", to: "confirm-1" });
  assert.deepEqual(connected.nodes[0].config, definition.nodes[0].config);
  assert.equal(connected.edges.at(-1)?.id, "edge-2");
  const removed = removeSafeNode(connected, added.layout, "confirm-1");
  assert.deepEqual(removed.definition.nodes, definition.nodes);
  assert.equal(removed.definition.edges.some((edge) => edge.to === "confirm-1"), false);
});

test("condition branches map through source handles", () => {
  const conditional: WorkflowDefinition = { ...definition, edges: [{ id: "yes", from: "condition-1", to: "done", branch: "true" }, { id: "no", from: "condition-1", to: "start", branch: "false" }] };
  const flow = definitionToFlow(conditional, {});
  assert.deepEqual(flowToDefinition(conditional, flow.nodes, flow.edges).definition.edges, conditional.edges);
});

test("stale state cannot be overwritten by local edits or save", () => {
  assert.equal(transitionEditorState("saved", "edit"), "unsaved");
  assert.equal(transitionEditorState("unsaved", "save"), "saving");
  assert.equal(transitionEditorState("saving", "stale"), "stale");
  assert.equal(transitionEditorState("stale", "edit"), "stale");
  assert.equal(transitionEditorState("stale", "reload"), "saved");
});

test("save completion only marks the submitted local snapshot as saved", () => {
  assert.equal(resolveSavedEditorState(4, 4), "saved");
  assert.equal(resolveSavedEditorState(4, 5), "unsaved");
});

test("edge selection is transient while structural edge changes are persistent", () => {
  assert.equal(hasPersistentEdgeChanges([{ type: "select" }]), false);
  assert.equal(hasPersistentEdgeChanges([{ type: "remove" }]), true);
  assert.equal(hasPersistentEdgeChanges([{ type: "select" }, { type: "replace" }]), true);
});

test("duplicate connection is rejected without changing definition identity", () => {
  assert.equal(connectSafeNodes(definition, { from: "start", to: "done" }), definition);
});

test("submitted unsaved definition is validated directly", () => {
  const local = { ...definition, name: "Unsaved local name", nodes: [] };
  const result = validateSubmittedDefinition(JSON.stringify(local));
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.issues.some((issue) => issue.path === "$.nodes"));
});

test("workflow metadata and entry changes survive projection", () => {
  const changed = { ...definition, name: "Renamed", entryNodeId: "done" };
  const flow = definitionToFlow(changed, {});
  assert.equal(flowToDefinition(changed, flow.nodes, flow.edges).definition.name, "Renamed");
  assert.equal(flowToDefinition(changed, flow.nodes, flow.edges).definition.entryNodeId, "done");
});

test("workbench media branch changes at the 768px desktop boundary", () => {
  assert.equal(isMobileWorkbenchWidth(767), true);
  assert.equal(isMobileWorkbenchWidth(768), false);
});
