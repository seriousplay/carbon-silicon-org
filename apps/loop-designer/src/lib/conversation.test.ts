import assert from "node:assert/strict";
import test from "node:test";
import { CONVERSATION_STEPS, getNextStepIndex, getStep, isCollectionComplete } from "./conversation";

test("conversation contains the lightweight collection steps", () => {
  assert.deepEqual(CONVERSATION_STEPS.map((step) => step.id), ["business_goal", "workflow", "diagnosis"]);
});

test("step progression stops at collection complete", () => {
  assert.equal(getStep(-1).id, "business_goal");
  assert.equal(getNextStepIndex(2), 3);
  assert.equal(getNextStepIndex(3), 3);
  assert.equal(isCollectionComplete(2), false);
  assert.equal(isCollectionComplete(3), true);
});
