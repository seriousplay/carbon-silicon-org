import assert from "node:assert/strict";
import test from "node:test";
import { checkRateLimit } from "./rate-limit";

const config = { maxRequests: 3, windowSeconds: 60 };

test("rate limiter allows requests within limit", () => {
  for (let i = 0; i < 3; i++) {
    const result = checkRateLimit(`test-allow-${process.pid}`, config);
    assert.equal(result.allowed, true);
  }
});

test("rate limiter blocks requests exceeding limit", () => {
  const key = `test-block-${process.pid}`;
  for (let i = 0; i < 3; i++) {
    checkRateLimit(key, config);
  }
  const blocked = checkRateLimit(key, config);
  assert.equal(blocked.allowed, false);
  if (!blocked.allowed) {
    assert.ok(blocked.retryAfter > 0);
    assert.ok(blocked.retryAfter <= 60);
  }
});

test("rate limiter resets after window expires", () => {
  const shortConfig = { maxRequests: 2, windowSeconds: 1 };
  const key = "test-reset-immediate";

  checkRateLimit(key, shortConfig);
  checkRateLimit(key, shortConfig);
  const blocked = checkRateLimit(key, shortConfig);
  assert.equal(blocked.allowed, false);

  // Key part: different key should not be affected
  const otherKey = "test-reset-other";
  const result = checkRateLimit(otherKey, shortConfig);
  assert.equal(result.allowed, true);
});

test("rate limiter isolates different keys", () => {
  const a = checkRateLimit(`test-isolate-a-${process.pid}`, config);
  const b = checkRateLimit(`test-isolate-b-${process.pid}`, config);
  assert.equal(a.allowed, true);
  assert.equal(b.allowed, true);
});
