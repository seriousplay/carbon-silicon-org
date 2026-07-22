import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  evaluateOrganizationSetupReadiness,
  ORGANIZATION_SETUP_HARD_GATE_CODES,
  ORGANIZATION_SETUP_WARNING_CODES,
  type OrganizationSetupReadinessInput,
} from "./readiness";

function readyInput(): OrganizationSetupReadinessInput {
  return {
    organizationPurpose: "持续为客户创造可验证价值",
    structures: [{ id: "root", parentId: null, active: true, hasLead: true }],
    roles: [
      {
        id: "lead",
        active: true,
        key: true,
        purpose: "维护组织目的",
        accountabilities: "推进组织运行",
        assigneeCount: 1,
        humanAssigneeCount: 1,
      },
    ],
    hasGoalCycle: true,
    hasOrganizationGoal: true,
    meetingCadenceConfigured: true,
    brainModelAvailable: true,
    heldInvitationCount: 0,
  };
}

describe("organization setup readiness", () => {
  test("passes exactly the three required hard gates", () => {
    const result = evaluateOrganizationSetupReadiness(readyInput());

    assert.equal(result.readyToActivate, true);
    assert.deepEqual(Object.keys(result.hardGates), ORGANIZATION_SETUP_HARD_GATE_CODES);
    assert.deepEqual(result.failedHardGateCodes, []);
    assert.deepEqual(result.warningCodes, []);
  });

  test("reports each hard gate independently", () => {
    // Only 3 hard gates now (KEY_ROLE_ASSIGNED is a warning)
    const cases: Array<[string, OrganizationSetupReadinessInput, string]> = [
      ["purpose", { ...readyInput(), organizationPurpose: "  " }, "ORGANIZATION_PURPOSE_DEFINED"],
      ["root", { ...readyInput(), structures: [] }, "EXACTLY_ONE_ROOT_STRUCTURE"],
      ["role", { ...readyInput(), roles: [] }, "ACTIVE_ROLE_EXISTS"],
    ];

    for (const [name, input, expectedCode] of cases) {
      const result = evaluateOrganizationSetupReadiness(input);
      assert.equal(result.readyToActivate, false, name);
      assert.ok(result.failedHardGateCodes.includes(expectedCode as never), name);
    }

    const twoRoots = evaluateOrganizationSetupReadiness({
      ...readyInput(),
      structures: [
        ...readyInput().structures,
        { id: "other-root", parentId: null, active: true, hasLead: true },
      ],
    });
    assert.deepEqual(twoRoots.failedHardGateCodes, ["EXACTLY_ONE_ROOT_STRUCTURE"]);
  });

  test("KEY_ROLE_ASSIGNED is a warning, not a hard gate — org can activate without human role assignments", () => {
    // Missing key role assignment should NOT block activation
    const result = evaluateOrganizationSetupReadiness({
      ...readyInput(),
      roles: [{ ...readyInput().roles[0]!, assigneeCount: 0, humanAssigneeCount: 0 }],
    });

    assert.equal(result.readyToActivate, true);
    assert.deepEqual(result.failedHardGateCodes, []);
    assert.ok(result.warningCodes.includes("KEY_ROLE_ASSIGNED"));
  });

  test("does not treat an AI-only key role as a valid human assignment", () => {
    const result = evaluateOrganizationSetupReadiness({
      ...readyInput(),
      roles: [{ ...readyInput().roles[0]!, assigneeCount: 1, humanAssigneeCount: 0 }],
    });

    // Still activates — KEY_ROLE_ASSIGNED is a warning only
    assert.equal(result.readyToActivate, true);
    assert.deepEqual(result.failedHardGateCodes, []);
    assert.ok(result.warningCodes.includes("KEY_ROLE_ASSIGNED"));
    assert.doesNotMatch(result.warningCodes.join(","), /VACANT_ROLES/);
  });

  test("emits every warning from a bounded deterministic code set", () => {
    const input = readyInput();
    const result = evaluateOrganizationSetupReadiness({
      ...input,
      structures: [
        ...input.structures,
        { id: "child", parentId: "root", active: true, hasLead: false },
      ],
      roles: [
        { ...input.roles[0]!, assigneeCount: 0, humanAssigneeCount: 0 },
        {
          id: "vacant",
          active: true,
          key: false,
          purpose: " ",
          accountabilities: null,
          assigneeCount: 0,
          humanAssigneeCount: 0,
        },
      ],
      hasGoalCycle: false,
      hasOrganizationGoal: false,
      meetingCadenceConfigured: false,
      brainModelAvailable: false,
      heldInvitationCount: 3,
    });

    assert.equal(result.readyToActivate, true);
    assert.deepEqual(result.warningCodes, ORGANIZATION_SETUP_WARNING_CODES);
  });

  test("ignores archived structures and inactive roles", () => {
    const input = readyInput();
    const result = evaluateOrganizationSetupReadiness({
      ...input,
      structures: [
        ...input.structures,
        { id: "archived-root", parentId: null, active: false, hasLead: false },
      ],
      roles: [
        ...input.roles,
        {
          id: "archived-role",
          active: false,
          key: false,
          purpose: null,
          accountabilities: null,
          assigneeCount: 0,
          humanAssigneeCount: 0,
        },
      ],
    });

    assert.equal(result.readyToActivate, true);
    assert.deepEqual(result.warningCodes, []);
  });
});
