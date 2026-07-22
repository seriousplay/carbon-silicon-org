import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const worker = readFileSync(new URL("../../../worker/index.ts", import.meta.url), "utf8");

test("worker runs commitment reconciliation and uses event identity for legacy notifications", () => {
  assert.match(worker, /reconcileCommitmentNotificationsForOrg/);
  assert.match(worker, /eventKey:/);
  assert.match(worker, /createNotification/);
  assert.doesNotMatch(worker, /recentCount/);
  assert.doesNotMatch(worker, /notifyCooldown/);
});
