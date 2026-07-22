import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  assignTensionAction,
  convertTensionToDecision,
  createValidationActionResolutionAction,
  createValidationProjectResolutionAction,
  deferValidationResolutionAction,
  markValidationGovernanceCandidateAction,
  resolveTensionInMeeting,
} from "./actions";

const denial = { error: "该直接处理入口已停用，请使用战术结果提案并由参会人记录会议结果" };

describe("retired direct meeting outcomes", () => {
  test("assignment, decision, pilot Project/Action/candidate, and defer calls fail closed", async () => {
    const formData = new FormData();
    assert.deepEqual(await assignTensionAction("tension", "meeting", null, formData), denial);
    assert.deepEqual(await convertTensionToDecision("tension", "meeting", null, formData), denial);
    assert.deepEqual(await createValidationProjectResolutionAction("tension", "meeting", null, formData), denial);
    assert.deepEqual(await createValidationActionResolutionAction("tension", "meeting", null, formData), denial);
    assert.deepEqual(await markValidationGovernanceCandidateAction("tension", "meeting", null, formData), denial);
    assert.deepEqual(await deferValidationResolutionAction("tension", "meeting", null, formData), denial);
  });

  test("direct meeting resolution rejects invocation", async () => {
    await assert.rejects(
      resolveTensionInMeeting("tension", "meeting"),
      /该直接处理入口已停用/,
    );
  });
});
