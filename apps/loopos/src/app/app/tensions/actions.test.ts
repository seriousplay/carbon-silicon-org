import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const form = readFileSync(new URL("./new/page-client.tsx", import.meta.url), "utf8");

describe("RTW1-S2 tension handling confirmation", () => {
  test("AI advice is stored separately and never becomes the confirmed handling mode", () => {
    assert.match(actions, /aiHandlingSuggestion/);
    assert.match(actions, /handlingMode: handlingMode as/);
    assert.doesNotMatch(actions, /handlingMode:\s*aiHandlingSuggestion/);
    assert.match(form, /请由你确认/);
  });

  test("only the open unrouted tension raiser can route an existing tension", () => {
    assert.match(actions, /raiserId: actor\.id, handlingMode: "UNROUTED", status: "OPEN"/);
    assert.match(actions, /handlingMode !== "TACTICAL" && handlingMode !== "GOVERNANCE"/);
  });
});
