import assert from "node:assert/strict";
import { test } from "node:test";
import { compareVersionSnapshots, structuralDiff } from "../diff";

test("structural diff uses stable ids and deterministic field paths", () => {
  const before = { nodes: [{ id: "b", config: { prompt: "old" } }, { id: "a", type: "complete" }] };
  const after = { nodes: [{ id: "c", type: "terminate" }, { id: "b", config: { prompt: "new" } }] };
  assert.deepEqual(structuralDiff(before, after).map(({ kind, path }) => ({ kind, path })), [
    { kind: "REMOVED", path: '$.nodes[id="a"]' },
    { kind: "CHANGED", path: '$.nodes[id="b"].config.prompt' },
    { kind: "ADDED", path: '$.nodes[id="c"]' },
  ]);
  assert.deepEqual(structuralDiff(before, after), structuralDiff(before, { nodes: [...after.nodes].reverse() }));
});

test("same-version comparison returns an empty successful diff", () => {
  assert.deepEqual(compareVersionSnapshots("v1", "v1", [{ id: "v1", sourceSnapshot: { nodes: [] } }]), { ok: true, changes: [] });
});
