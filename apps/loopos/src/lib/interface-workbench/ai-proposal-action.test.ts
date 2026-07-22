import assert from "node:assert/strict";
import { test } from "node:test";

import { runWithAIProposalLocks } from "./ai-proposal-action";

test("a failed user lock returns BUSY before organization lock or proposal generation", async () => {
  const locks: string[] = [];
  let proposals = 0;
  const result = await runWithAIProposalLocks({
    userId: "user-1", organizationId: "org-1",
    tryLock: async (key) => { locks.push(key); return false; },
    propose: async () => { proposals += 1; return { ok: false, error: "GENERATION_FAILED" }; },
  });
  assert.deepEqual(result, { ok: false, error: "BUSY" });
  assert.deepEqual(locks, ["user:user-1"]);
  assert.equal(proposals, 0);
});

test("a failed organization lock returns BUSY before proposal generation", async () => {
  const locks: string[] = [];
  let proposals = 0;
  const result = await runWithAIProposalLocks({
    userId: "user-1", organizationId: "org-1",
    tryLock: async (key) => { locks.push(key); return key.startsWith("user:"); },
    propose: async () => { proposals += 1; return { ok: false, error: "GENERATION_FAILED" }; },
  });
  assert.deepEqual(result, { ok: false, error: "BUSY" });
  assert.deepEqual(locks, ["user:user-1", "organization:org-1"]);
  assert.equal(proposals, 0);
});

test("both locks permit exactly one proposal call and expose no write operation", async () => {
  const locks: string[] = [];
  let proposals = 0;
  const result = await runWithAIProposalLocks({
    userId: "user-1", organizationId: "org-1",
    tryLock: async (key) => { locks.push(key); return true; },
    propose: async () => { proposals += 1; return { ok: false, error: "PROVIDER_UNAVAILABLE" }; },
  });
  assert.deepEqual(result, { ok: false, error: "PROVIDER_UNAVAILABLE" });
  assert.deepEqual(locks, ["user:user-1", "organization:org-1"]);
  assert.equal(proposals, 1);
});
