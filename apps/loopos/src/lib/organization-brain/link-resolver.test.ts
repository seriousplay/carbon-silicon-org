import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { basePath } from "../base-path";
import { resolveBrainApplicationUrl } from "./link-resolver";
import type { BrainQueryResource } from "./query-plan";

describe("V5-M1-C deterministic application links", () => {
  test("resolves every catalog resource to its allowlisted route or null", () => {
    const cases: readonly Readonly<{
      resource: BrainQueryResource;
      row: Readonly<Record<string, unknown>>;
      expected: string | null;
    }>[] = [
      { resource: "currentActor", row: { personId: "person-a" }, expected: `${basePath}/app/me` },
      {
        resource: "organizationIdentity",
        row: { id: "org-a" },
        expected: `${basePath}/app/circles/map`,
      },
      {
        resource: "organizationBrainProfile",
        row: { id: "profile-a", avatarUrl: "https://attacker.invalid/profile" },
        expected: null,
      },
      {
        resource: "currentActorRoleAssignments",
        row: { roleDefinitionId: "role/a #1" },
        expected: `${basePath}/app/roles/role%2Fa%20%231`,
      },
      { resource: "privateConversations", row: { id: "conversation-a" }, expected: null },
      { resource: "privateMessages", row: { id: "message-a" }, expected: null },
      {
        resource: "circles",
        row: { id: "circle/a #1" },
        expected: `${basePath}/app/circles/circle%2Fa%20%231`,
      },
      {
        resource: "roleDefinitions",
        row: { id: "role-a" },
        expected: `${basePath}/app/roles/role-a`,
      },
      {
        resource: "projects",
        row: { id: "project-a" },
        expected: `${basePath}/app/projects/project-a`,
      },
      {
        resource: "actions",
        row: { id: "action-a" },
        expected: `${basePath}/app/tracker/action-a`,
      },
      {
        resource: "unresolvedTensions",
        row: { id: "tension-a" },
        expected: `${basePath}/app/tensions/tension-a`,
      },
      {
        resource: "meetingDrafts",
        row: { id: "meeting-a" },
        expected: `${basePath}/app/meetings/meeting-a`,
      },
      {
        resource: "approvedTacticalOutcomes",
        row: { id: "outcome-a", meetingId: "meeting/a #1" },
        expected: `${basePath}/app/meetings/meeting%2Fa%20%231`,
      },
      {
        resource: "adoptedGovernanceDecisions",
        row: { id: "process-a", decisionId: "decision/a #1" },
        expected: `${basePath}/app/governance#decision-decision%2Fa%20%231`,
      },
      {
        resource: "publishedGovernanceLogs",
        row: { id: "log-a", targetUrl: "https://attacker.invalid/log" },
        expected: null,
      },
      {
        resource: "goalCycles",
        row: { id: "cycle/a #1" },
        expected: `${basePath}/app/goals?cycle=cycle%2Fa%20%231&goal=`,
      },
      {
        resource: "goals",
        row: { id: "goal/a #1", cycleId: "cycle/a #1" },
        expected: `${basePath}/app/goals?cycle=cycle%2Fa%20%231&goal=goal%2Fa%20%231`,
      },
      {
        resource: "goalTargets",
        row: { id: "target-a", goalId: "goal-a", cycleId: "cycle-a" },
        expected: `${basePath}/app/goals?cycle=cycle-a&goal=goal-a`,
      },
      {
        resource: "goalEffectiveCheckIns",
        row: { id: "check-in-a", goalId: "goal-a", cycleId: "cycle-a" },
        expected: `${basePath}/app/goals?cycle=cycle-a&goal=goal-a`,
      },
      {
        resource: "goalActiveWorkLinks",
        row: { id: "link-a", kind: "PROJECT", projectId: "project/a #1" },
        expected: `${basePath}/app/projects/project%2Fa%20%231`,
      },
    ];

    assert.equal(cases.length, 20);
    for (const entry of cases) {
      assert.equal(
        resolveBrainApplicationUrl(entry.resource, entry.row),
        entry.expected,
        entry.resource,
      );
    }
  });

  test("returns null instead of building a route from missing or oversized IDs", () => {
    assert.equal(resolveBrainApplicationUrl("circles", {}), null);
    assert.equal(
      resolveBrainApplicationUrl("projects", { id: "x".repeat(192) }),
      null,
    );
    assert.equal(
      resolveBrainApplicationUrl("approvedTacticalOutcomes", { id: "outcome-a" }),
      null,
    );
    assert.equal(
      resolveBrainApplicationUrl("adoptedGovernanceDecisions", {
        id: "process-a",
      }),
      null,
    );
    assert.equal(resolveBrainApplicationUrl("goalCycles", {}), null);
    assert.equal(
      resolveBrainApplicationUrl("goals", { id: "goal-a" }),
      null,
    );
    assert.equal(
      resolveBrainApplicationUrl("goalActiveWorkLinks", {
        kind: "ACTION",
        tensionId: "action/a #1",
      }),
      `${basePath}/app/tracker/action%2Fa%20%231`,
    );
    assert.equal(
      resolveBrainApplicationUrl("goalActiveWorkLinks", {
        kind: "BLOCKING_TENSION",
        tensionId: "tension/a #1",
      }),
      `${basePath}/app/tensions/tension%2Fa%20%231`,
    );
    assert.equal(
      resolveBrainApplicationUrl("goalActiveWorkLinks", {
        kind: "UNKNOWN",
        projectId: "project-a",
        tensionId: "tension-a",
      }),
      null,
    );
  });
});
