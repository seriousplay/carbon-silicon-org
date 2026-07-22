import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { minimalDefinition } from "./admin";
import { createAIProposalRequestToken, isAIProposalCurrent, layoutForAIProposal, proposeWorkflowDraft } from "./ai-proposal";
import type { WorkflowDefinition } from "./protocol";

const env: NodeJS.ProcessEnv = { NODE_ENV: "test", AI_PROVIDER: "openai", OPENAI_API_KEY: "test" };
const editableDefinition = (name: string): WorkflowDefinition => JSON.parse(JSON.stringify(minimalDefinition(name))) as WorkflowDefinition;

describe("structured AI workflow proposals", () => {
  test("proposal request token expires after any local edit or snapshot change", () => {
    const current = editableDefinition("Before");
    const token = createAIProposalRequestToken(3, current);
    assert.equal(isAIProposalCurrent(token, 3, current), true);
    assert.equal(isAIProposalCurrent(token, 4, current), false);
    assert.equal(isAIProposalCurrent(token, 3, { ...current, name: "Changed" }), false);
  });

  test("proposal layout keeps stable node positions and leaves new nodes for default placement", () => {
    const current = editableDefinition("Before");
    const proposal: WorkflowDefinition = { ...current, nodes: [...current.nodes, { id: "new", type: "complete", config: { outcome: "new" } }] };
    assert.deepEqual(layoutForAIProposal(proposal, { start: { x: 10, y: 20 }, complete: { x: 300, y: 20 }, removed: { x: 2, y: 3 } }), {
      start: { x: 10, y: 20 }, complete: { x: 300, y: 20 },
    });
  });

  test("returns a canonical proposal and deterministic server diff without persistence hooks", async () => {
    const current = minimalDefinition("Before");
    const proposed = { ...current, name: "After" };
    let calls = 0;
    const result = await proposeWorkflowDraft({ instruction: "Rename it", currentDefinition: current, env, generate: async () => { calls += 1; return proposed; } });
    assert.equal(calls, 1);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.proposal.name, "After");
      assert.deepEqual(result.changes, [{ kind: "CHANGED", path: "$.name", before: "Before", after: "After" }]);
    }
  });

  test("fails narrowly when no supported configured provider exists", async () => {
    assert.deepEqual(await proposeWorkflowDraft({ instruction: "Change it", currentDefinition: minimalDefinition("Before"), env: { NODE_ENV: "test", AI_PROVIDER: "stepfun", STEPFUN_API_KEY: "test" } }), { ok: false, error: "PROVIDER_UNAVAILABLE" });
  });

  test("maps timeout, schema, and provider failures", async () => {
    const base = { instruction: "Change it", currentDefinition: minimalDefinition("Before"), env };
    assert.deepEqual(await proposeWorkflowDraft({ ...base, generate: async () => { throw new DOMException("Timed out", "AbortError"); } }), { ok: false, error: "TIMEOUT" });
    assert.deepEqual(await proposeWorkflowDraft({ ...base, generate: async () => { throw new Error("schema validation failed"); } }), { ok: false, error: "INVALID_SCHEMA" });
    assert.deepEqual(await proposeWorkflowDraft({ ...base, generate: async () => { throw new Error("provider unavailable"); } }), { ok: false, error: "GENERATION_FAILED" });
  });

  test("rejects prompt and structured output limits before compilation", async () => {
    assert.deepEqual(await proposeWorkflowDraft({ instruction: "x".repeat(4_001), currentDefinition: minimalDefinition("Before"), env }), { ok: false, error: "INVALID_INPUT" });
    const oversized = { ...minimalDefinition("Before"), nodes: Array.from({ length: 41 }, (_, index) => ({ id: `n${index}`, type: "complete", config: { outcome: "done" } })) };
    const result = await proposeWorkflowDraft({ instruction: "Change it", currentDefinition: minimalDefinition("Before"), env, generate: async () => oversized });
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.error, "LIMIT_EXCEEDED");
  });

  test("rejects compiler-invalid output", async () => {
    const invalid = { ...minimalDefinition("Before"), entryNodeId: "missing" };
    const result = await proposeWorkflowDraft({ instruction: "Change it", currentDefinition: minimalDefinition("Before"), env, generate: async () => invalid });
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.error, "COMPILER_REJECTED");
  });
});
