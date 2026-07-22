import assert from "node:assert/strict";
import test from "node:test";
import {
  createPkcePair,
  hashToken,
  normalizeReturnPath,
  openExportGrant,
  openOAuthState,
  sealExportGrant,
  sealOAuthState,
} from "./auth-crypto";

test("OAuth state validates its signature and expiry", () => {
  const secret = "a".repeat(32);
  const sealed = sealOAuthState(
    { state: "state", verifier: "verifier", next: "/loop-designer/sessions/1", expiresAt: 2000 },
    secret,
  );
  assert.equal(openOAuthState(sealed, secret, 1000)?.next, "/loop-designer/sessions/1");
  assert.equal(openOAuthState(sealed, "b".repeat(32), 1000), null);
  assert.equal(openOAuthState(sealed, secret, 3000), null);
});

test("return paths cannot escape the loop designer", () => {
  assert.equal(normalizeReturnPath("https://evil.example"), "/loop-designer");
  assert.equal(normalizeReturnPath("//evil.example"), "/loop-designer");
  assert.equal(normalizeReturnPath("/tools"), "/loop-designer");
  assert.equal(normalizeReturnPath("/loop-designer/sessions/1"), "/loop-designer/sessions/1");
  // Path injection via @ character
  assert.equal(normalizeReturnPath("/loop-designer@evil.com"), "/loop-designer");
  assert.equal(normalizeReturnPath("/loop-designer%2Fevil"), "/loop-designer");
  assert.equal(normalizeReturnPath(""), "/loop-designer");
  assert.equal(normalizeReturnPath(null), "/loop-designer");
});

test("PKCE and session tokens use URL-safe stable digests", () => {
  const pkce = createPkcePair();
  assert.match(pkce.verifier, /^[A-Za-z0-9_-]+$/);
  assert.match(pkce.challenge, /^[A-Za-z0-9_-]+$/);
  assert.equal(hashToken("token"), hashToken("token"));
  assert.notEqual(hashToken("token"), hashToken("other"));
});

test("export grants are scoped to one user, session, file type and expiry", () => {
  const secret = "c".repeat(32);
  const grant = {
    userId: "user-1",
    sessionId: "session-1",
    kind: "pdf" as const,
    expiresAt: 2000,
  };
  const sealed = sealExportGrant(grant, secret);
  assert.deepEqual(openExportGrant(sealed, secret, 1000), grant);
  assert.equal(openExportGrant(sealed, secret, 3000), null);
  assert.equal(openExportGrant(`${sealed}x`, secret, 1000), null);
});
