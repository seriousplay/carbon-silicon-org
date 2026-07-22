import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeLog, sanitizeHeaders, userError } from "./api-error";

test("sanitizeLog redacts Bearer tokens", () => {
  const result = sanitizeLog("Authorization: Bearer sk-abc123xyz-secret-key");
  assert.ok(!result.includes("sk-abc123xyz-secret-key"));
  assert.ok(result.includes("[REDACTED]"));
});

test("sanitizeLog redacts API keys in query strings", () => {
  const result = sanitizeLog("Error calling https://api.example.com?api_key=secret123");
  assert.ok(!result.includes("secret123"));
  assert.ok(result.includes("[REDACTED]"));
});

test("sanitizeLog preserves safe content", () => {
  const result = sanitizeLog("Connection timeout after 30s");
  assert.equal(result, "Connection timeout after 30s");
});

test("sanitizeHeaders redacts sensitive headers", () => {
  const headers = new Headers({
    "content-type": "application/json",
    "authorization": "Bearer secret-token",
    "cookie": "session=abc123",
    "x-api-key": "key-12345",
    "x-csrf-token": "csrf-token-123",
    "accept": "application/json",
  });
  const result = sanitizeHeaders(headers);
  assert.equal(result["authorization"], "[REDACTED]");
  assert.equal(result["cookie"], "[REDACTED]");
  assert.equal(result["x-api-key"], "[REDACTED]");
  assert.equal(result["x-csrf-token"], "[REDACTED]");
  assert.equal(result["content-type"], "application/json");
  assert.equal(result["accept"], "application/json");
});

test("userError creates an error safe for production exposure", () => {
  const err = userError("邮箱已注册");
  assert.ok(err.message.startsWith("USER:"));
  assert.equal(err.message, "USER:邮箱已注册");
});

test("sanitizeLog handles password in error messages", () => {
  const result = sanitizeLog("Validation failed: password=mySecret123");
  assert.ok(!result.includes("mySecret123"));
  assert.ok(result.includes("[REDACTED]"));
});
