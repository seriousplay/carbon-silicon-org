import assert from "node:assert/strict";
import { test } from "node:test";
import { compileWorkflow } from "../compiler";
import { validateWorkflowResourceBounds, WORKFLOW_RESOURCE_LIMITS } from "../bounds";

function issue(input: unknown) {
  const result = compileWorkflow(input);
  assert.equal(result.ok, false);
  return result.issues[0];
}

test("rejects role, node, and edge counts before graph validation", () => {
  for (const [key, limit] of [["roles", WORKFLOW_RESOURCE_LIMITS.roles], ["nodes", WORKFLOW_RESOURCE_LIMITS.nodes], ["edges", WORKFLOW_RESOURCE_LIMITS.edges]] as const) {
    const value = { roles: [], nodes: [], edges: [], [key]: Array.from({ length: limit + 1 }, () => ({})) };
    assert.deepEqual(issue(value).code, "RESOURCE_COUNT_EXCEEDED");
  }
});

test("rejects excessive nesting depth", () => {
  let nested: Record<string, unknown> = {};
  const root = nested;
  for (let index = 0; index <= WORKFLOW_RESOURCE_LIMITS.depth; index++) nested = nested.next = {};
  assert.equal(issue(root).code, "RESOURCE_DEPTH_EXCEEDED");
});

test("rejects excessive string and generic array lengths", () => {
  assert.equal(issue({ value: "x".repeat(WORKFLOW_RESOURCE_LIMITS.stringLength + 1) }).code, "RESOURCE_STRING_EXCEEDED");
  assert.equal(issue({ values: Array.from({ length: WORKFLOW_RESOURCE_LIMITS.arrayLength + 1 }, () => 0) }).code, "RESOURCE_ARRAY_EXCEEDED");
});

test("rejects aggregate collection entries with one typed issue", () => {
  const input = Object.fromEntries(Array.from({ length: WORKFLOW_RESOURCE_LIMITS.entries + 1 }, (_, index) => [`key${index}`, index]));
  const issues = validateWorkflowResourceBounds(input);
  assert.deepEqual(issues.map((entry) => entry.code), ["RESOURCE_ENTRIES_EXCEEDED"]);
  assert.equal(issue(input).code, "RESOURCE_ENTRIES_EXCEEDED");
});
