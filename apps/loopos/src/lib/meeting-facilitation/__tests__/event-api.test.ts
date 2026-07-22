import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { parseEventCursor, parseEventLimit } from "../event-api";

describe("meeting event API inputs", () => {
  test("uses bounded cursor and batch defaults", () => {
    assert.equal(parseEventCursor(null), 0);
    assert.equal(parseEventCursor("42"), 42);
    assert.equal(parseEventLimit(null), 100);
    assert.equal(parseEventLimit("200"), 200);
  });

  test("rejects negative, fractional, unsafe and oversized inputs", () => {
    for (const value of ["-1", "1.5", "abc", "9007199254740992"]) {
      assert.throws(() => parseEventCursor(value), /INVALID_EVENT_CURSOR/);
    }
    for (const value of ["0", "201", "1.5", "abc"]) {
      assert.throws(() => parseEventLimit(value), /INVALID_EVENT_LIMIT/);
    }
  });
});
