import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const actionSource = readFileSync(new URL("./governance-rules-actions.ts", import.meta.url), "utf8");
const formSource = readFileSync(new URL("./governance-rules-form.tsx", import.meta.url), "utf8");

test("role assignment confirmation cannot be downgraded to direct confirmation", () => {
  assert.match(actionSource, /roleAssignmentConfirmation: "GOVERNANCE_PROCESS"/);
  assert.doesNotMatch(actionSource, /DIRECT_CONFIRMATION/);
  assert.match(formSource, /核心治理不变量/);
  assert.doesNotMatch(formSource, /name="roleAssignmentConfirmation"/);
});
