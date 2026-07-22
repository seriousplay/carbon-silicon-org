import assert from "node:assert/strict";
import test from "node:test";

import {
  completeBrainArtifact,
  createBrainArtifact,
  failBrainArtifact,
  markBrainArtifactReady,
  startBrainArtifactExecution,
} from "./artifact-lifecycle";

const now = new Date("2026-07-17T10:00:00.000Z");
const input = {
  id: "artifact-1",
  organizationId: "org-1",
  ownerPersonId: "person-1",
  artifactType: "TENSION_DRAFT" as const,
  payload: { title: "A real tension" },
  sourceRefs: [{ organizationId: "org-1", ownerPersonId: "person-1", type: "meeting", id: "meeting-1", label: "Weekly", applicationUrl: "/app/meetings/meeting-1", observedAt: now.toISOString() }],
  actor: { type: "person" as const, id: "person-1", label: "Owner" },
  now,
  expiresAt: new Date("2026-07-17T10:15:00.000Z"),
};

test("artifact lifecycle preserves owner-private draft data through successful execution", () => {
  const draft = createBrainArtifact(input);
  const ready = markBrainArtifactReady(draft, new Date("2026-07-17T10:01:00.000Z"));
  const executing = startBrainArtifactExecution(ready, new Date("2026-07-17T10:02:00.000Z"));
  const terminal = completeBrainArtifact(executing, { tensionId: "tension-1" }, new Date("2026-07-17T10:03:00.000Z"));

  assert.equal(terminal.status, "SUCCEEDED");
  assert.deepEqual(terminal.payload, draft.payload);
  assert.deepEqual(terminal.terminalResult, { tensionId: "tension-1" });
  assert.throws(() => markBrainArtifactReady(terminal, new Date("2026-07-17T10:04:00.000Z")), /TERMINAL_IMMUTABLE/);
});

test("execution failure is terminal but keeps the draft payload", () => {
  const draft = createBrainArtifact(input);
  const ready = markBrainArtifactReady(draft, new Date("2026-07-17T10:01:00.000Z"));
  const executing = startBrainArtifactExecution(ready, new Date("2026-07-17T10:02:00.000Z"));
  const failed = failBrainArtifact(executing, "DOMAIN_VALIDATION_FAILED", new Date("2026-07-17T10:03:00.000Z"));

  assert.equal(failed.status, "FAILED");
  assert.equal(failed.failureCode, "DOMAIN_VALIDATION_FAILED");
  assert.deepEqual(failed.payload, { title: "A real tension" });
  assert.throws(() => failBrainArtifact(failed, "OTHER", new Date("2026-07-17T10:04:00.000Z")), /TERMINAL_IMMUTABLE/);
});

test("artifact creation rejects foreign owner, invalid source, and expired preview", () => {
  assert.throws(() => createBrainArtifact({ ...input, actor: { ...input.actor, id: "person-2" } }), /OWNER_REQUIRED/);
  assert.throws(() => createBrainArtifact({ ...input, sourceRefs: [{ ...input.sourceRefs[0], organizationId: "org-2" }] }), /INVALID_SOURCE/);
  assert.throws(() => createBrainArtifact({ ...input, sourceRefs: [{ ...input.sourceRefs[0], ownerPersonId: "person-2" }] }), /INVALID_SOURCE/);
  assert.throws(() => createBrainArtifact({ ...input, sourceRefs: [{ ...input.sourceRefs[0], applicationUrl: "https://example.com" }] }), /INVALID_SOURCE/);
  assert.throws(() => createBrainArtifact({ ...input, expiresAt: new Date("2026-07-17T09:59:00.000Z") }), /EXPIRED/);
  assert.throws(() => createBrainArtifact({ ...input, payload: { text: "x".repeat(64_001) } }), /INVALID_INPUT/);
});
