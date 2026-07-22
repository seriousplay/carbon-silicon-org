import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  MEETING_LIFECYCLE_DENIAL_CODE,
  evaluateMeetingLifecycle,
} from "./meeting-lifecycle-policy";

describe("meeting lifecycle policy", () => {
  test("allows ACTIVE organizations", () => {
    assert.deepEqual(evaluateMeetingLifecycle("ACTIVE"), { allowed: true });
  });

  test("denies SETUP, missing, and unknown lifecycle values with one fixed code", () => {
    for (const lifecycleStatus of ["SETUP", null, undefined, "UNKNOWN"] as const) {
      assert.deepEqual(evaluateMeetingLifecycle(lifecycleStatus), {
        allowed: false,
        code: MEETING_LIFECYCLE_DENIAL_CODE,
      });
    }
  });
});
