import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { after, before, describe, test } from "node:test";

import { withCollaborationActionTestDependencies } from "./collaboration-action-dependencies";

type EndMeetingAction = typeof import("./collaboration-actions").endMeetingAction;

const require = createRequire(import.meta.url);
let originalServerOnlyModule: NodeJS.Module | undefined;
let serverOnlyPath = "";
let endMeetingAction: EndMeetingAction;

before(async () => {
  serverOnlyPath = require.resolve("server-only");
  originalServerOnlyModule = require.cache[serverOnlyPath];
  const serverOnlyShim = new Module(serverOnlyPath);
  serverOnlyShim.filename = serverOnlyPath;
  serverOnlyShim.loaded = true;
  require.cache[serverOnlyPath] = serverOnlyShim;
  ({ endMeetingAction } = await import("./collaboration-actions"));
});

after(() => {
  if (originalServerOnlyModule) require.cache[serverOnlyPath] = originalServerOnlyModule;
  else delete require.cache[serverOnlyPath];
});

const source = readFileSync(new URL("./collaboration-actions.ts", import.meta.url), "utf8");

test("meeting participant updates read the effective organization scope rule", () => {
  assert.match(source, /getOrganizationGovernanceConfig\(orgId\)/);
  assert.match(source, /meetingParticipantScope === "CIRCLE_SCOPE"/);
  assert.match(source, /outsideCircle/);
});

test("participant scope checks both home Circle and an active role in the meeting Circle", () => {
  assert.match(source, /homeCircleId !== meeting\.circleId/);
  assert.match(source, /roles\.length === 0/);
});

function endMeetingHarness(lifecycleStatus: "SETUP" | "ACTIVE" | null) {
  const calls = {
    lifecycleReads: 0,
    notesReads: 0,
    meetingWrites: 0,
    isolationLevel: "",
    revalidated: [] as string[],
  };
  const meeting = {
    id: "meeting-1",
    title: "Weekly tactical",
    startedAt: new Date("2026-07-20T09:00:00.000Z"),
    endedAt: null,
    notesRevision: 0,
    type: "TACTICAL",
    circleId: "circle-1",
    participants: [{ id: "person-1" }],
  };
  const tx = {
    organization: {
      findUnique: async () => {
        calls.lifecycleReads += 1;
        return lifecycleStatus === null ? null : { lifecycleStatus };
      },
    },
    meeting: {
      findFirst: async () => {
        calls.notesReads += 1;
        return { title: meeting.title, circle: { name: "Product" } };
      },
      update: async () => {
        calls.meetingWrites += 1;
        return { id: meeting.id };
      },
    },
    tension: { findMany: async () => { calls.notesReads += 1; return []; } },
    tacticalOutcomeProposal: { findMany: async () => { calls.notesReads += 1; return []; } },
  };
  return {
    calls,
    dependencies: {
      prisma: {
        meeting: { findFirst: async () => meeting },
        $transaction: async (
          work: (transaction: typeof tx) => Promise<unknown>,
          options: { isolationLevel: string },
        ) => {
          calls.isolationLevel = options.isolationLevel;
          return work(tx);
        },
      },
      getCurrentOrgId: async () => "org-1",
      getCurrentPerson: async () => ({ id: "person-1" }),
      revalidatePath: (path: string) => calls.revalidated.push(path),
    },
  };
}

describe("endMeetingAction lifecycle gate", () => {
  for (const [label, lifecycleStatus] of [["SETUP", "SETUP"], ["missing", null]] as const) {
    test(`${label} organization is denied before notes or meeting writes`, async () => {
      const harness = endMeetingHarness(lifecycleStatus);
      const result = await withCollaborationActionTestDependencies(
        harness.dependencies,
        () => endMeetingAction("meeting-1", undefined),
      );

      assert.deepEqual(result, { error: "组织尚未启用，不能进行会议操作" });
      assert.equal(harness.calls.lifecycleReads, 1);
      assert.equal(harness.calls.isolationLevel, "Serializable");
      assert.equal(harness.calls.notesReads, 0);
      assert.equal(harness.calls.meetingWrites, 0);
      assert.deepEqual(harness.calls.revalidated, []);
    });
  }

  test("ACTIVE preserves automatic notes, meeting end write, and revalidation", async () => {
    const harness = endMeetingHarness("ACTIVE");
    const result = await withCollaborationActionTestDependencies(
      harness.dependencies,
      () => endMeetingAction("meeting-1", undefined),
    );

    assert.deepEqual(result, { ok: true });
    assert.equal(harness.calls.lifecycleReads, 1);
    assert.equal(harness.calls.isolationLevel, "Serializable");
    assert.equal(harness.calls.notesReads, 3);
    assert.equal(harness.calls.meetingWrites, 1);
    assert.deepEqual(harness.calls.revalidated, ["/app/meetings/meeting-1", "/app/meetings"]);
  });
});
