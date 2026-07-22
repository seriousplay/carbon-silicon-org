import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  canAdvanceInterfaceWorkflow,
  canStartInterfaceWorkflow,
  canViewInterfaceWorkflow,
  type RuntimePermissionActor,
  type RuntimePermissionInterface,
  type RuntimeWaitingBinding,
} from "../runtime-permissions";

const interfaceContext: RuntimePermissionInterface = {
  organizationId: "org-1",
  ownerId: "owner",
  fromCircleLeadPersonId: "from-lead",
  toCircleLeadPersonId: "to-lead",
  supportPersonIds: ["direct-support"],
  supportRoleDefIds: ["support-role"],
};

function actor(
  personId: string,
  overrides: Partial<RuntimePermissionActor> = {},
): RuntimePermissionActor {
  return {
    organizationId: "org-1",
    personId,
    membershipRole: "ORG_MEMBER",
    assignedRoleDefIds: [],
    ...overrides,
  };
}

describe("runtime start and view permissions", () => {
  const allowedActors: Array<[string, RuntimePermissionActor]> = [
    ["organization administrator", actor("admin", { membershipRole: "ORG_ADMIN" })],
    ["interface owner", actor("owner")],
    ["from-circle lead", actor("from-lead")],
    ["to-circle lead", actor("to-lead")],
    ["direct support person", actor("direct-support")],
    ["interface support role assignee", actor("role-support", { assignedRoleDefIds: ["support-role"] })],
  ];

  for (const [label, allowedActor] of allowedActors) {
    test(`allows ${label} to start and view`, () => {
      assert.equal(canStartInterfaceWorkflow(allowedActor, interfaceContext), true);
      assert.equal(canViewInterfaceWorkflow(allowedActor, interfaceContext), true);
    });
  }

  test("denies an unrelated organization member", () => {
    const unrelated = actor("unrelated", { assignedRoleDefIds: ["other-role"] });
    assert.equal(canStartInterfaceWorkflow(unrelated, interfaceContext), false);
    assert.equal(canViewInterfaceWorkflow(unrelated, interfaceContext), false);
  });

  test("denies a cross-organization administrator", () => {
    const crossOrgAdmin = actor("admin", {
      organizationId: "org-2",
      membershipRole: "ORG_ADMIN",
    });
    assert.equal(canStartInterfaceWorkflow(crossOrgAdmin, interfaceContext), false);
    assert.equal(canViewInterfaceWorkflow(crossOrgAdmin, interfaceContext), false);
  });
});

describe("runtime advance permissions", () => {
  const waitingForPerson: RuntimeWaitingBinding = {
    organizationId: "org-1",
    personId: "waiting-person",
    roleDefId: null,
  };
  const waitingForRole: RuntimeWaitingBinding = {
    organizationId: "org-1",
    personId: null,
    roleDefId: "waiting-role",
  };

  test("allows the current waiting binding person without takeover", () => {
    assert.deepEqual(
      canAdvanceInterfaceWorkflow(actor("waiting-person"), interfaceContext, waitingForPerson),
      { allowed: true, requiresTakeoverEvent: false },
    );
  });

  test("allows an assignee of the current waiting binding RoleDef without takeover", () => {
    assert.deepEqual(
      canAdvanceInterfaceWorkflow(
        actor("role-assignee", { assignedRoleDefIds: ["waiting-role"] }),
        interfaceContext,
        waitingForRole,
      ),
      { allowed: true, requiresTakeoverEvent: false },
    );
  });

  test("denies unrelated members and assignees of another RoleDef", () => {
    assert.deepEqual(
      canAdvanceInterfaceWorkflow(
        actor("unrelated", { assignedRoleDefIds: ["other-role"] }),
        interfaceContext,
        waitingForRole,
      ),
      { allowed: false, requiresTakeoverEvent: false },
    );
  });

  test("requires an explicit takeover from an organization administrator", () => {
    const admin = actor("admin", { membershipRole: "ORG_ADMIN" });
    assert.deepEqual(
      canAdvanceInterfaceWorkflow(admin, interfaceContext, waitingForPerson),
      { allowed: false, requiresTakeoverEvent: false },
    );
    assert.deepEqual(
      canAdvanceInterfaceWorkflow(admin, interfaceContext, waitingForPerson, { takeover: true }),
      { allowed: true, requiresTakeoverEvent: true },
    );
  });

  test("requires an explicit takeover from the interface owner", () => {
    const owner = actor("owner");
    assert.deepEqual(
      canAdvanceInterfaceWorkflow(owner, interfaceContext, waitingForRole),
      { allowed: false, requiresTakeoverEvent: false },
    );
    assert.deepEqual(
      canAdvanceInterfaceWorkflow(owner, interfaceContext, waitingForRole, { takeover: true }),
      { allowed: true, requiresTakeoverEvent: true },
    );
  });

  test("does not mark takeover when an administrator or owner is already responsible", () => {
    assert.deepEqual(
      canAdvanceInterfaceWorkflow(
        actor("owner", { membershipRole: "ORG_ADMIN" }),
        interfaceContext,
        { organizationId: "org-1", personId: "owner", roleDefId: null },
        { takeover: true },
      ),
      { allowed: true, requiresTakeoverEvent: false },
    );
  });

  test("denies cross-organization actors and bindings even with takeover", () => {
    const crossOrgAdmin = actor("admin", {
      organizationId: "org-2",
      membershipRole: "ORG_ADMIN",
    });
    assert.deepEqual(
      canAdvanceInterfaceWorkflow(crossOrgAdmin, interfaceContext, waitingForPerson, { takeover: true }),
      { allowed: false, requiresTakeoverEvent: false },
    );
    assert.deepEqual(
      canAdvanceInterfaceWorkflow(
        actor("owner"),
        interfaceContext,
        { ...waitingForPerson, organizationId: "org-2" },
        { takeover: true },
      ),
      { allowed: false, requiresTakeoverEvent: false },
    );
  });
});
