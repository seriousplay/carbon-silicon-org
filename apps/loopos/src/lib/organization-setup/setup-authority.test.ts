import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  evaluateSetupAuthority,
  type SetupAuthorityInput,
} from "./setup-authority";

function input(overrides: Partial<SetupAuthorityInput> = {}): SetupAuthorityInput {
  return {
    lifecycleStatus: "SETUP",
    actorOrganizationId: "org-a",
    actorMembershipRole: "ORG_MEMBER",
    actorPersonId: "person-lead",
    ledStructureIds: ["circle-branch"],
    target: {
      kind: "STRUCTURE",
      organizationId: "org-a",
      structureId: "circle-branch",
      ancestorIds: ["circle-root"],
    },
    ...overrides,
  };
}

describe("evaluateSetupAuthority", () => {
  test("allows a SETUP organization administrator across the organization", () => {
    assert.deepEqual(evaluateSetupAuthority(input({
      actorMembershipRole: "ORG_ADMIN",
      target: { kind: "ORGANIZATION", organizationId: "org-a" },
    })), { allowed: true });
  });

  test("allows an assigned structure lead on their own node and descendants", () => {
    assert.deepEqual(evaluateSetupAuthority(input()), { allowed: true });
    assert.deepEqual(evaluateSetupAuthority(input({
      target: {
        kind: "STRUCTURE",
        organizationId: "org-a",
        structureId: "circle-child",
        ancestorIds: ["circle-root", "circle-branch"],
      },
    })), { allowed: true });
  });

  test("denies a structure lead on parallel branches, ancestors, and organization-wide edits", () => {
    for (const target of [
      {
        kind: "STRUCTURE" as const,
        organizationId: "org-a",
        structureId: "circle-peer",
        ancestorIds: ["circle-root"],
      },
      {
        kind: "STRUCTURE" as const,
        organizationId: "org-a",
        structureId: "circle-root",
        ancestorIds: [] as string[],
      },
      { kind: "ORGANIZATION" as const, organizationId: "org-a" },
    ]) {
      assert.deepEqual(evaluateSetupAuthority(input({ target })), {
        allowed: false,
        reason: "INSUFFICIENT_AUTHORITY",
      });
    }
  });

  test("denies cross-organization targets", () => {
    assert.deepEqual(evaluateSetupAuthority(input({
      actorMembershipRole: "ORG_ADMIN",
      target: { kind: "ORGANIZATION", organizationId: "org-b" },
    })), { allowed: false, reason: "CROSS_ORGANIZATION" });
  });

  test("denies all direct setup authority after activation", () => {
    assert.deepEqual(evaluateSetupAuthority(input({
      lifecycleStatus: "ACTIVE",
      actorMembershipRole: "ORG_ADMIN",
      target: { kind: "ORGANIZATION", organizationId: "org-a" },
    })), { allowed: false, reason: "LIFECYCLE_NOT_SETUP" });
  });
});
