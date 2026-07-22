import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { authorizeCurrentPersonAdmin, authorizeOrgAdmin, minimalDefinition, saveDraftCas, validateDraftInput } from "../admin";
import { hashCanonical } from "../compiler";

describe("tenant administrator guard", () => {
  test("allows admin and denies member or missing membership", async () => {
    const admin = await authorizeOrgAdmin("user", "org", async () => ({ role: "ORG_ADMIN", personId: "person" }));
    assert.equal(admin.ok, true);
    assert.deepEqual(await authorizeOrgAdmin("user", "org", async () => ({ role: "ORG_MEMBER", personId: "person" })), { ok: false, error: "FORBIDDEN" });
    assert.deepEqual(await authorizeOrgAdmin("user", "org", async () => null), { ok: false, error: "FORBIDDEN" });
  });

  test("cross-tenant lookup cannot authorize", async () => {
    const result = await authorizeOrgAdmin("user", "other-org", async (_user, org) => org === "own-org" ? { role: "ORG_ADMIN", personId: "person" } : null);
    assert.deepEqual(result, { ok: false, error: "FORBIDDEN" });
  });

  test("uses the current person's organization when the user has multiple memberships", async () => {
    const queried: string[] = [];
    const result = await authorizeCurrentPersonAdmin("user", { id: "person", organizationId: "current-org" }, async (_user, organizationId) => {
      queried.push(organizationId);
      return organizationId === "current-org" ? { role: "ORG_MEMBER" } : { role: "ORG_ADMIN" };
    });
    assert.deepEqual(queried, ["current-org"]);
    assert.deepEqual(result, { ok: false, error: "FORBIDDEN" });
  });
});

describe("draft compare and swap", () => {
  test("recomputes raw hash and increments revision", async () => {
    const definition = minimalDefinition("Example");
    let updateValues: { hash: string } | undefined;
    const result = await saveDraftCas({ definition, layout: {}, expectedRevision: 2, expectedHash: "a".repeat(64), readCurrent: async () => null, updateIfCurrent: async (values) => { updateValues = values; return true; } });
    assert.deepEqual(result, { ok: true, revision: 3, hash: hashCanonical(definition) });
    assert.equal(updateValues?.hash, hashCanonical(definition));
  });

  test("returns typed stale state after failed CAS", async () => {
    const result = await saveDraftCas({ definition: minimalDefinition("Example"), layout: {}, expectedRevision: 2, expectedHash: "a".repeat(64), readCurrent: async () => ({ revision: 3, hash: "b".repeat(64) }), updateIfCurrent: async () => false });
    assert.deepEqual(result, { ok: false, error: "STALE_DRAFT", currentRevision: 3, currentHash: "b".repeat(64) });
  });

  test("reports compiler validation failure", () => {
    const result = validateDraftInput({ nodes: [] });
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.issues.length > 0);
  });

  test("saves a bounded invalid intermediate object and validation later reports issues", async () => {
    const definition = { nodes: [] };
    const saved = await saveDraftCas({ definition, layout: {}, expectedRevision: 0, expectedHash: "a".repeat(64), readCurrent: async () => null, updateIfCurrent: async () => true });
    assert.equal(saved.ok, true);
    const validation = validateDraftInput(definition);
    assert.equal(validation.ok, false);
    if (!validation.ok) assert.ok(validation.issues.length > 0);
  });

  test("rejects malformed roots, invalid layout, and oversized definitions", async () => {
    const base = { layout: {}, expectedRevision: 0, expectedHash: "a".repeat(64), readCurrent: async () => null, updateIfCurrent: async () => true };
    assert.deepEqual(await saveDraftCas({ ...base, definition: undefined }), { ok: false, error: "INVALID_INPUT" });
    assert.deepEqual(await saveDraftCas({ ...base, definition: [] }), { ok: false, error: "INVALID_INPUT" });
    assert.deepEqual(await saveDraftCas({ ...base, definition: {}, layout: { node: { x: Number.NaN, y: 0 } } }), { ok: false, error: "INVALID_INPUT" });
    assert.deepEqual(await saveDraftCas({ ...base, definition: { value: "x".repeat(257 * 1024) } }), { ok: false, error: "INVALID_INPUT" });
    assert.deepEqual(await saveDraftCas({ ...base, definition: {}, expectedRevision: -1 }), { ok: false, error: "INVALID_INPUT" });
    assert.deepEqual(await saveDraftCas({ ...base, definition: {}, expectedHash: "bad" }), { ok: false, error: "INVALID_INPUT" });
    assert.deepEqual(await saveDraftCas({ ...base, definition: {}, layout: Object.fromEntries(Array.from({ length: 7000 }, (_, index) => [`node-${index}`, { x: index, y: index }])) }), { ok: false, error: "INVALID_INPUT" });
  });
});
