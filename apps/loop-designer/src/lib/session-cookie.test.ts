import assert from "node:assert/strict";
import test from "node:test";
import { extractCookieValues, uniqueCookieValues } from "./session-cookie";

test("extracts duplicate session cookie values from raw cookie header", () => {
  const values = extractCookieValues(
    "other=1; loop_designer_session=stale; loop_designer_session=fresh; loop_designer_session_partitioned=fresh",
    ["loop_designer_session", "loop_designer_session_partitioned"],
  );

  assert.deepEqual(values, ["stale", "fresh", "fresh"]);
});

test("keeps unique cookie candidates in validation order", () => {
  assert.deepEqual(uniqueCookieValues([" stale ", "fresh", "fresh", ""]), ["stale", "fresh"]);
});

