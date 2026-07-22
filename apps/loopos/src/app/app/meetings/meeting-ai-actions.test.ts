import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const actions = readFileSync(new URL("./[id]/ai-actions.ts", import.meta.url), "utf8");
const buttons = readFileSync(new URL("./[id]/ai-buttons.tsx", import.meta.url), "utf8");

test("guard report generation previews without persisting", () => {
  const generation = actions.slice(actions.indexOf("generateGuardReportAction"), actions.indexOf("confirmGuardReportAction"));
  assert.doesNotMatch(generation, /meeting\.update/);
  assert.match(generation, /draft: report, notesRevision/);
});

test("guard report confirmation is participant scoped and revision bound", () => {
  assert.match(actions, /participants: \{ some: \{ id: person\.id \} \}/);
  assert.match(actions, /notesRevision,/);
  assert.match(buttons, /确认保存报告/);
});
