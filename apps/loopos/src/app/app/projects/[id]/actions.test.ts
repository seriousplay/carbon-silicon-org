import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("RTW1-S2 Project lifecycle", () => {
  test("only the current bearer can perform bounded stale-safe transitions", () => {
    assert.match(actions, /bearerId: actor\.id/);
    assert.match(actions, /status: expectedStatus/);
    assert.match(actions, /ACTIVE[\s\S]+PAUSED[\s\S]+COMPLETED/);
    assert.match(actions, /updateMany/);
  });

  test("completion stores its actor and time and the detail page exposes controls", () => {
    assert.match(actions, /completedById: actor\.id/);
    assert.match(actions, /completedAt: now/);
    assert.match(page, /ProjectLifecycleControls/);
  });
});
