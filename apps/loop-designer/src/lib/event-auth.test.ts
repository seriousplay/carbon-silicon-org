import assert from "node:assert/strict";
import test from "node:test";
import { maskPhone, normalizePhone, verifyEventAccessCode } from "./event-auth-utils";

test("normalizes mainland China phone numbers for event login", () => {
  assert.equal(normalizePhone("138 0013 8000"), "13800138000");
  assert.equal(normalizePhone("+86 138-0013-8000"), "13800138000");
  assert.equal(normalizePhone("12345"), "");
});

test("masks event login phone numbers for display", () => {
  assert.equal(maskPhone("13800138000"), "138****8000");
  assert.equal(maskPhone(""), "现场学员");
});

test("event access code comparison remains exact", () => {
  assert.equal(verifyEventAccessCode("ABC123", "ABC123"), true);
  assert.equal(verifyEventAccessCode("ABC123", "abc123"), false);
});
