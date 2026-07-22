import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { after, before, describe, test } from "node:test";

import { withMeetingActionTestDependencies } from "./action-dependencies";

type CreateMeetingAction = typeof import("./actions").createMeetingAction;

const require = createRequire(import.meta.url);
let originalServerOnlyModule: NodeJS.Module | undefined;
let serverOnlyPath = "";
let createMeetingAction: CreateMeetingAction;

before(async () => {
  serverOnlyPath = require.resolve("server-only");
  originalServerOnlyModule = require.cache[serverOnlyPath];
  const serverOnlyShim = new Module(serverOnlyPath);
  serverOnlyShim.filename = serverOnlyPath;
  serverOnlyShim.loaded = true;
  require.cache[serverOnlyPath] = serverOnlyShim;
  ({ createMeetingAction } = await import("./actions"));
});

after(() => {
  if (originalServerOnlyModule) require.cache[serverOnlyPath] = originalServerOnlyModule;
  else delete require.cache[serverOnlyPath];
});

function meetingForm(): FormData {
  const formData = new FormData();
  formData.set("title", "Weekly tactical");
  formData.set("type", "TACTICAL");
  formData.set("durationMin", "30");
  formData.set("startedAt", "2026-07-20T09:00:00.000Z");
  formData.append("participantIds", "person-1");
  return formData;
}

function createHarness(lifecycleStatus: "SETUP" | "ACTIVE" | null) {
  const calls = {
    organizationRead: 0,
    meetingCreate: 0,
    notification: 0,
    revalidated: [] as string[],
    redirected: [] as string[],
    isolationLevel: "" as string,
  };
  const tx = {
    organization: {
      findUnique: async () => {
        calls.organizationRead += 1;
        return lifecycleStatus === null ? null : { lifecycleStatus };
      },
    },
    meeting: {
      create: async () => {
        calls.meetingCreate += 1;
        return {
          id: "meeting-1",
          title: "Weekly tactical",
          startedAt: new Date("2026-07-20T09:00:00.000Z"),
        };
      },
    },
  };

  return {
    calls,
    dependencies: {
      prisma: {
        person: {
          findMany: async () => [{ id: "person-1" }],
        },
        circle: {
          findFirst: async () => ({ id: "circle-1" }),
        },
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
      notifyMeetingParticipants: async () => {
        calls.notification += 1;
      },
      revalidatePath: (path: string) => calls.revalidated.push(path),
      redirect: (path: string) => {
        calls.redirected.push(path);
      },
    },
  };
}

describe("createMeetingAction lifecycle gate", () => {
  for (const [label, lifecycleStatus] of [
    ["SETUP", "SETUP"],
    ["missing organization", null],
  ] as const) {
    test(`${label} is denied inside the transaction with zero meeting and notification writes`, async () => {
      const harness = createHarness(lifecycleStatus);

      const result = await withMeetingActionTestDependencies(
        harness.dependencies,
        () => createMeetingAction(undefined, meetingForm()),
      );

      assert.deepEqual(result, { error: "组织尚未启用，不能发起会议" });
      assert.equal(harness.calls.organizationRead, 1);
      assert.equal(harness.calls.isolationLevel, "Serializable");
      assert.equal(harness.calls.meetingCreate, 0);
      assert.equal(harness.calls.notification, 0);
      assert.deepEqual(harness.calls.revalidated, []);
      assert.deepEqual(harness.calls.redirected, []);
    });
  }

  test("ACTIVE preserves meeting creation, notification, revalidation, and redirect", async () => {
    const harness = createHarness("ACTIVE");

    const result = await withMeetingActionTestDependencies(
      harness.dependencies,
      () => createMeetingAction(undefined, meetingForm()),
    );

    assert.equal(result, undefined);
    assert.equal(harness.calls.organizationRead, 1);
    assert.equal(harness.calls.isolationLevel, "Serializable");
    assert.equal(harness.calls.meetingCreate, 1);
    assert.equal(harness.calls.notification, 1);
    assert.deepEqual(harness.calls.revalidated, ["/app/meetings"]);
    assert.deepEqual(harness.calls.redirected, ["/app/meetings/meeting-1"]);
  });
});
