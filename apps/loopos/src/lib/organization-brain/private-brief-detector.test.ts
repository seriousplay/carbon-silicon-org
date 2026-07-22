import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import {
  buildPrivateBrief,
  type PrivateBriefDetectorInput,
} from "./private-brief-detector";

const now = new Date("2026-07-15T12:00:00.000Z");

function fixture(overrides: Partial<PrivateBriefDetectorInput> = {}): PrivateBriefDetectorInput {
  return {
    now,
    actorPersonId: "person-a",
    goals: [
      {
        id: "goal-parent",
        title: "Company activation",
        circleId: "circle-parent",
        circleName: "Root",
        cycleId: "cycle-1",
        status: "ACTIVE",
        isPrimary: true,
        lastCheckInAt: "2026-06-20T12:00:00.000Z",
        applicationUrl: "/app/goals?cycle=cycle-1&goal=goal-parent",
      },
    ],
    targets: [
      {
        id: "target-a",
        goalId: "goal-parent",
        goalTitle: "Company activation",
        label: "Activation rate",
        evidenceAt: null,
        applicationUrl: "/app/goals?cycle=cycle-1&goal=goal-parent",
      },
    ],
    meetings: [
      {
        id: "meeting-a",
        title: "Weekly tactical",
        type: "TACTICAL",
        circleId: "circle-parent",
        startedAt: "2026-07-12T12:00:00.000Z",
        unresolvedOutputCount: 2,
        applicationUrl: "/app/meetings/meeting-a",
      },
    ],
    tensions: [
      {
        id: "tension-a",
        title: "Routing unclear",
        circleId: "circle-parent",
        circleName: "Root",
        status: "OPEN",
        similarityKey: "routing",
        createdAt: "2026-07-10T12:00:00.000Z",
        applicationUrl: "/app/tensions/tension-a",
      },
      {
        id: "tension-b",
        title: "Routing still unclear",
        circleId: "circle-parent",
        circleName: "Root",
        status: "OPEN",
        similarityKey: "routing",
        createdAt: "2026-07-11T12:00:00.000Z",
        applicationUrl: "/app/tensions/tension-b",
      },
    ],
    work: [
      {
        id: "project-a",
        kind: "PROJECT",
        title: "Repair onboarding path",
        status: "ACTIVE",
        ownerPersonId: "person-a",
        roleId: null,
        circleId: "circle-parent",
        applicationUrl: "/app/projects/project-a",
      },
    ],
    circles: [
      {
        id: "circle-parent",
        name: "Root",
        parentCircleId: null,
        applicationUrl: "/app/circles/circle-parent",
      },
      {
        id: "circle-child",
        name: "Activation",
        parentCircleId: "circle-parent",
        applicationUrl: "/app/circles/circle-child",
      },
    ],
    ...overrides,
  };
}

function kinds(input: PrivateBriefDetectorInput): readonly string[] {
  return buildPrivateBrief(input).signals.map((signal) => signal.kind);
}

describe("V5-M4-A1 private brief detector", () => {
  test("builds the six accepted deterministic signal kinds with sources and safe actions", () => {
    const brief = buildPrivateBrief(fixture());

    assert.deepEqual(new Set(brief.signals.map((signal) => signal.kind)), new Set([
      "STALE_GOAL_CHECK_IN",
      "MISSING_TARGET_EVIDENCE",
      "UNRESOLVED_MEETING_OUTPUT",
      "REPEATED_TENSION",
      "ROLE_WORK_MISMATCH",
      "MISSING_CHILD_GOAL",
    ]));
    assert.equal(brief.schemaVersion, 1);
    assert.equal(brief.generatedAt, now.toISOString());
    assert.equal(brief.truncated, false);
    for (const signal of brief.signals) {
      assert.ok(signal.dedupeKey.startsWith(`${signal.kind}:`));
      assert.ok(signal.title.length > 0);
      assert.ok(signal.reason.length > 0);
      assert.ok(signal.sources.length > 0);
      assert.ok(signal.action.applicationUrl.startsWith("/app/"));
    }
  });

  test("omits fresh, closed, resolved, or unrelated facts without inventing signals", () => {
    assert.deepEqual(kinds(fixture({
      goals: [
        {
          ...fixture().goals![0],
          lastCheckInAt: "2026-07-14T12:00:00.000Z",
        },
      ],
      targets: [
        {
          ...fixture().targets![0],
          evidenceAt: "2026-07-14T12:00:00.000Z",
        },
      ],
      meetings: [
        {
          ...fixture().meetings![0],
          unresolvedOutputCount: 0,
        },
      ],
      tensions: [
        {
          ...fixture().tensions![0],
          status: "CLOSED",
        },
      ],
      work: [
        {
          ...fixture().work![0],
          roleId: "role-a",
          circleId: "circle-parent",
        },
      ],
      circles: [
        ...fixture().circles!,
        {
          id: "circle-child-goal",
          name: "Activation Goal",
          parentCircleId: "circle-parent",
          applicationUrl: "/app/circles/circle-child-goal",
        },
      ],
      maxSignals: 10,
    })).filter((kind) => kind !== "MISSING_CHILD_GOAL"), []);
  });

  test("deduplicates repeated signals and records truncation separately", () => {
    const brief = buildPrivateBrief(fixture({
      maxSignals: 1,
      goals: [
        fixture().goals![0],
        { ...fixture().goals![0], title: "Duplicate title" },
      ],
      targets: fixture().targets,
      meetings: [],
      tensions: [],
      work: [],
      circles: [],
    }));

    assert.equal(brief.signals.length, 1);
    assert.equal(brief.truncated, true);
    assert.equal(
      brief.signals.filter((signal) => signal.dedupeKey === "STALE_GOAL_CHECK_IN:goal:goal-parent").length,
      1,
    );
  });

  test("fails closed when required source identity or labels are missing", () => {
    const brief = buildPrivateBrief(fixture({
      goals: [
        {
          ...fixture().goals![0],
          id: "",
        },
      ],
      targets: [
        {
          ...fixture().targets![0],
          label: "",
        },
      ],
      meetings: [],
      tensions: [],
      work: [],
      circles: [],
    }));

    assert.deepEqual(brief.signals, []);
  });

  test("fails closed when source or action links are missing or non-application URLs", () => {
    const missingLink = buildPrivateBrief(fixture({
      goals: [
        {
          ...fixture().goals![0],
          applicationUrl: "",
        },
      ],
      targets: [],
      meetings: [],
      tensions: [],
      work: [],
      circles: [],
    }));
    const externalLink = buildPrivateBrief(fixture({
      goals: [
        {
          ...fixture().goals![0],
          applicationUrl: "https://example.com/app/goals",
        },
      ],
      targets: [],
      meetings: [],
      tensions: [],
      work: [],
      circles: [],
    }));

    assert.deepEqual(missingLink.signals, []);
    assert.deepEqual(externalLink.signals, []);
  });

  test("static boundary has no database, action, command execution, provider, plugin, or shared-memory write imports", () => {
    const source = readFileSync("src/lib/organization-brain/private-brief-detector.ts", "utf8");
    const importLines = source.split("\n").filter((line) => line.startsWith("import"));
    assert.deepEqual(importLines, [
      "import type {",
    ]);
    const forbidden = [
      "prisma",
      "server-only",
      "actions",
      "confirmGoalCommandPreview",
      "CommandRegistry",
      "provider",
      "plugin",
      "deployment",
      "fs",
      "child_process",
      "memory candidate",
      "shared memory",
    ];
    for (const token of forbidden) {
      assert.equal(source.includes(token), false, token);
    }
  });
});
