import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseGovernanceStructuralChange } from "./governance-change";

describe("governance structural change contract", () => {
  test("accepts each existing distributed change type", () => {
    const cases = [
      { schemaVersion: 1, operation: "ROLE_CREATED", ownershipType: "HOME", circleId: "c", name: "r", purpose: "p", domain: null, accountabilities: "a", category: "EXPERT" },
      { schemaVersion: 1, operation: "ROLE_MODIFIED", targetId: "r", name: "r2", purpose: "p", domain: null, accountabilities: "a" },
      { schemaVersion: 1, operation: "ROLE_ARCHIVED", targetId: "r" },
      { schemaVersion: 1, operation: "CIRCLE_CREATED", name: "c", purpose: "p", domain: null, number: "CUSTOM", type: "PRODUCTION", parentId: null },
      { schemaVersion: 1, operation: "CIRCLE_MODIFIED", targetId: "c", name: "c2", purpose: "p", domain: null },
      { schemaVersion: 1, operation: "HOME_CHANGE", targetId: "person", homeCircleId: "circle" },
      { schemaVersion: 1, operation: "AGENT_CREATED", name: "agent", agentModel: "model", agentEndpoint: null, agentAbilities: "abilities", agentConfig: null, circleId: "c" },
      { schemaVersion: 1, operation: "CHARTER_CREATED", version: "v1", content: "rules", changeSummary: null, previousVersionId: null },
      { schemaVersion: 1, operation: "CHARTER_AMENDED", targetId: "charter", version: "v2", content: "new rules", changeSummary: "update" },
    ];
    assert.equal(cases.map(parseGovernanceStructuralChange).length, 9);
  });

  test("rejects unknown keys and missing target identifiers", () => {
    assert.throws(() => parseGovernanceStructuralChange({ schemaVersion: 1, operation: "ROLE_ARCHIVED", targetId: "r", extra: true }), /INVALID_CHANGE_PAYLOAD/);
    assert.throws(() => parseGovernanceStructuralChange({ schemaVersion: 1, operation: "HOME_CHANGE", targetId: "p", homeCircleId: "" }), /INVALID_CHANGE_PAYLOAD/);
  });
});
