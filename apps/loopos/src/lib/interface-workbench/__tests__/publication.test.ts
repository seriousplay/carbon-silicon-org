import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { hashCanonical } from "../compiler";
import { minimalDefinition } from "../admin";
import { preparePublication, prepareThenPublish, publishDraft } from "../publication";

function harness(overrides: Partial<Parameters<typeof publishDraft>[0]> = {}) {
  const draft = minimalDefinition("Example");
  const preparation = preparePublication(draft);
  assert.equal(preparation.ok, true);
  if (!preparation.ok) throw new Error("fixture must compile");
  const calls: string[] = [];
  return { calls, input: {
    prepared: preparation.prepared, expectedRevision: 4, expectedHash: hashCanonical(draft), publisherId: "person",
    lockWorkbench: async () => { calls.push("lock"); return { id: "wb", draft, draftLayout: { start: { x: 1, y: 2 } }, draftRevision: 4, draftHash: hashCanonical(draft), activeVersionId: "v1" }; },
    latestVersion: async () => { calls.push("latest"); return { id: "v1", version: 1, sourceHash: "old" }; },
    findBySourceHash: async () => { calls.push("duplicate"); return null; },
    createVersion: async (data: Record<string, unknown>) => { calls.push(`create:${data.version}:${data.parentVersionId}`); return { id: "v2" }; },
    setActiveVersion: async (id: string) => { calls.push(`active:${id}`); },
    ...overrides,
  }};
}

describe("atomic publication service", () => {
  test("locks first, allocates sequential lineage, inserts then updates pointer", async () => {
    const h = harness();
    assert.deepEqual(await publishDraft(h.input), { ok: true, versionId: "v2", version: 2 });
    assert.deepEqual(h.calls, ["lock", "duplicate", "latest", "create:2:v1", "active:v2"]);
  });

  test("allocates from max version but parents from the locked active pointer", async () => {
    const h = harness({
      lockWorkbench: async () => ({ id: "wb", draft: minimalDefinition("Example"), draftLayout: {}, draftRevision: 4, draftHash: hashCanonical(minimalDefinition("Example")), activeVersionId: "active-v2" }),
      latestVersion: async () => ({ id: "latest-v4", version: 4, sourceHash: "newer-inactive" }),
    });
    assert.deepEqual(await publishDraft(h.input), { ok: true, versionId: "v2", version: 5 });
    assert.ok(h.calls.includes("create:5:active-v2"));
  });

  test("preparation completes before the lock callback starts", async () => {
    const calls: string[] = [];
    const result = await prepareThenPublish(minimalDefinition("Example"), async (prepared) => {
      calls.push("prepared");
      const h = harness({ prepared, lockWorkbench: async () => { calls.push("lock"); return null; } });
      return publishDraft(h.input);
    });
    assert.deepEqual(result, { ok: false, error: "NOT_FOUND" });
    assert.deepEqual(calls, ["prepared", "lock"]);
  });

  test("invalid preparation returns before the publish callback", async () => {
    let called = false;
    const result = await prepareThenPublish({}, async () => { called = true; return { ok: false, error: "NOT_FOUND" }; });
    assert.equal(result.ok, false);
    assert.equal(called, false);
  });

  test("returns duplicate without creating or updating immutable history", async () => {
    const h = harness({ findBySourceHash: async () => ({ id: "v1", version: 1, sourceHash: "same" }) });
    assert.deepEqual(await publishDraft(h.input), { ok: false, error: "DUPLICATE_SOURCE", versionId: "v1", version: 1 });
    assert.deepEqual(h.calls, ["lock"]);
  });

  test("rejects stale revision and prepared-hash mismatch after lock", async () => {
    const stale = harness({ expectedRevision: 3 });
    assert.deepEqual(await publishDraft(stale.input), { ok: false, error: "STALE_DRAFT" });
    const changed = harness({ lockWorkbench: async () => ({ id: "wb", draft: {}, draftLayout: {}, draftRevision: 4, draftHash: "x", activeVersionId: null }), expectedHash: "x" });
    assert.deepEqual(await publishDraft(changed.input), { ok: false, error: "STALE_DRAFT" });
  });

  test("does not move active pointer when version insertion fails", async () => {
    const h = harness({ createVersion: async () => { throw new Error("insert failed"); } });
    await assert.rejects(() => publishDraft(h.input), /insert failed/);
    assert.equal(h.calls.some((call) => call.startsWith("active:")), false);
  });

  test("service failure propagation occurs after create when active pointer update fails", async () => {
    const h = harness({ setActiveVersion: async () => { h.calls.push("active-failed"); throw new Error("active update failed"); } });
    await assert.rejects(() => publishDraft(h.input), /active update failed/);
    assert.deepEqual(h.calls.slice(-2), ["create:2:v1", "active-failed"]);
  });

  test("publication API exposes no version update or delete dependency", () => {
    const h = harness();
    assert.deepEqual(Object.keys(h.input).sort(), ["createVersion", "expectedHash", "expectedRevision", "findBySourceHash", "latestVersion", "lockWorkbench", "prepared", "publisherId", "setActiveVersion"].sort());
  });
});
