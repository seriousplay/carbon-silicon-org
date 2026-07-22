import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const RESULT = spawnSync(
  process.execPath,
  ["scripts/verify-m5b-acceptance-state.mjs", "--json"],
  { cwd: process.cwd(), encoding: "utf8" },
);

test("M5-B acceptance keeps isolation, review, and deferral gates distinct", () => {
  assert.equal(RESULT.signal, null, RESULT.stderr);
  const state = JSON.parse(RESULT.stdout);
  const gates = new Map(state.gates.map((item) => [item.name, item.status]));

  assert.equal(gates.get("brain-readiness"), "pass");
  assert.equal(gates.get("biocoach-cross-database-isolation"), "pass");
  assert.equal(gates.get("brain-mutation-denial"), "pass");
  assert.equal(gates.get("authenticated-brain-read"), "pass");
  assert.equal(gates.get("cross-tenant-brain-read"), "pass");
  assert.equal(gates.get("roadmap-dashboard-synced"), "pass");
  assert.equal(gates.get("longitudinal-real-team"), "deferred");
  assert.ok(["pass", "blocked"].includes(gates.get("independent-security-review")));
  assert.ok(["pass", "blocked"].includes(gates.get("final-roadmap-audit")));

  const expectedAccepted = state.summary.blocked === 0 && state.summary.missing === 0;
  assert.equal(state.accepted, expectedAccepted);
  assert.equal(RESULT.status, state.accepted ? 0 : 1);

  const verifier = readFileSync("scripts/verify-m5b-acceptance-state.mjs", "utf8");
  const dashboard = readFileSync("progress-dashboard.html", "utf8");
  const staleTransitionClaim = "The final roadmap audit is the only remaining M5-B gate.";
  assert.ok(verifier.includes(`"${staleTransitionClaim}"`));
  assert.equal(dashboard.includes(staleTransitionClaim), false);

  if (gates.get("final-roadmap-audit") === "pass") {
    assert.equal(state.accepted, true);
    assert.ok(dashboard.includes('<span class="muted">Evidence blockers</span>'));
  }
});
