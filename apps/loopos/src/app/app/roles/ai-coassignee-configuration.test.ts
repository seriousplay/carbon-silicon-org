import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const pageSource = readFileSync(new URL("./[id]/page.tsx", import.meta.url), "utf8");
const actionSource = readFileSync(new URL("./[id]/actions.ts", import.meta.url), "utf8");

describe("V6-M4-B AI co-assignee configuration surface", () => {
  test("shows AI co-assignment policy on the Role detail surface", () => {
    assert.match(pageSource, /AI 共同承担策略/);
    assert.match(pageSource, /aiCoAssignmentPolicies/);
    assert.match(pageSource, /AI_CAPABILITY_RISK_LEVELS/);
    assert.match(pageSource, /saveRoleAiCoAssigneePolicy/);
  });

  test("saves proposed policy through the M4-A guarded path", () => {
    assert.match(actionSource, /requireOrgAdmin\(\)/);
    assert.match(actionSource, /isAiCapabilityRiskLevel\(maxRiskLevel\)/);
    assert.match(actionSource, /aiRoleCoAssignmentPolicy\.findUnique/);
    assert.match(actionSource, /existingPolicy\.status !== "PROPOSED"/);
    assert.match(actionSource, /AI_CO_ASSIGNMENT_POLICY_NOT_PROPOSED/);
    assert.match(actionSource, /saveAiCoAssigneePolicy/);
    assert.match(actionSource, /status: "PROPOSED"/);
  });

  test("keeps approval lifecycle explicit and state-bounded", () => {
    assert.match(actionSource, /approveRoleAiCoAssigneePolicy/);
    assert.match(actionSource, /where: \{ id: policyId, organizationId: person\.organizationId, roleId, status: "PROPOSED" \}/);
    assert.match(actionSource, /status: "APPROVED"/);
    assert.match(actionSource, /suspendRoleAiCoAssigneePolicy/);
    assert.match(actionSource, /where: \{ id: policyId, organizationId: person\.organizationId, roleId, status: "APPROVED" \}/);
    assert.match(actionSource, /status: "SUSPENDED"/);
    assert.match(actionSource, /revokeRoleAiCoAssigneePolicy/);
    assert.match(actionSource, /status: \{ in: \["PROPOSED", "APPROVED", "SUSPENDED"\] \}/);
    assert.match(actionSource, /status: "REVOKED"/);
    assert.match(pageSource, /approveRoleAiCoAssigneePolicy/);
    assert.match(pageSource, /suspendRoleAiCoAssigneePolicy/);
    assert.match(pageSource, /revokeRoleAiCoAssigneePolicy/);
  });

  test("shows read-only execution readiness without an execution path", () => {
    assert.match(pageSource, /evaluateAiExecutionReadiness/);
    assert.match(pageSource, /执行准备度/);
    assert.match(pageSource, /不会触发 AI 自动执行/);
    assert.match(pageSource, /aiPerson: \{ select: \{ name: true, entityType: true \} \}/);
    assert.match(pageSource, /accountableHuman: \{ select: \{ name: true, entityType: true \} \}/);
  });

  test("does not activate AI execution or candidate tension sensing", () => {
    const m4bSource = `${pageSource}\n${actionSource}`;
    assert.doesNotMatch(m4bSource, /candidate[_-]?tension/i);
    assert.doesNotMatch(m4bSource, /scheduler|executeAi|executionJob|executionLedger|notification/i);
    assert.doesNotMatch(m4bSource, /biocoach/i);
  });
});
