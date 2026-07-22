import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { ActorContext } from "./actor-context-resolver";
import { evaluateReadAccess } from "./read-policy-core";

function actor(overrides: Partial<ActorContext> = {}): ActorContext {
  return {
    organizationId: "org-1",
    userId: "user-1",
    personId: "person-1",
    membershipRole: "ORG_MEMBER",
    homeCircleId: "circle-home",
    assignedActiveRoleDefIds: [],
    ledActiveCircleIds: [],
    ...overrides,
  };
}

describe("organization-transparent reads", () => {
  const objectTypes = [
    "ORGANIZATION",
    "GOAL",
    "CIRCLE",
    "ROLE_DEFINITION",
    "CONFIRMED_MEETING_RESULT",
    "PROJECT",
    "ACTION",
    "GOVERNANCE_RECORD",
    "PUBLISHED_DECISION",
  ];

  for (const objectType of objectTypes) {
    test(`allows every current member to read ${objectType}`, () => {
      const decision = evaluateReadAccess({
        actor: actor(),
        resource: {
          organizationId: "org-1",
          zone: "ORGANIZATION_TRANSPARENT",
          objectType,
        },
      });

      assert.deepEqual(decision, {
        allowed: true,
        basis: "CURRENT_ORGANIZATION_MEMBER",
      });
      assert.equal("canWrite" in decision, false);
    });
  }

  test("denies transparent facts from another organization, including to admins", () => {
    assert.equal(
      evaluateReadAccess({
        actor: actor({ membershipRole: "ORG_ADMIN" }),
        resource: {
          organizationId: "org-2",
          zone: "ORGANIZATION_TRANSPARENT",
          objectType: "CIRCLE",
        },
      }).allowed,
      false,
    );
  });
});

describe("personal-private reads", () => {
  test("allows only the owner", () => {
    assert.deepEqual(
      evaluateReadAccess({
        actor: actor(),
        resource: {
          organizationId: "org-1",
          zone: "PERSONAL_PRIVATE",
          objectType: "PRIVATE_BRAIN_CONVERSATION",
          ownerPersonId: "person-1",
        },
      }),
      { allowed: true, basis: "OWNER" },
    );
  });

  test("denies another person's private record to an admin and ignores caller bypass fields", () => {
    const callerControlledInput = {
      actor: actor({
        membershipRole: "ORG_ADMIN",
        ledActiveCircleIds: ["circle-1"],
        assignedActiveRoleDefIds: ["role-1"],
      }),
      resource: {
        organizationId: "org-1",
        zone: "PERSONAL_PRIVATE",
        objectType: "PRIVATE_BRAIN_CONVERSATION",
        ownerPersonId: "person-2",
        relatedPersonIds: ["person-1"],
        relatedCircleIds: ["circle-1"],
        relatedRoleDefIds: ["role-1"],
        allowOrganizationAdmin: true,
        allowLedCircle: true,
      },
      actorCapabilities: ["READ_PRIVATE_BRAIN_CONVERSATION"],
    };

    assert.equal(evaluateReadAccess(callerControlledInput).allowed, false);
  });
});

describe("fixed context-restricted matrix", () => {
  test("UNRESOLVED_TENSION allows owner, related person, related Circle lead, or admin", () => {
    const resource = {
      organizationId: "org-1",
      zone: "CONTEXT_RESTRICTED",
      objectType: "UNRESOLVED_TENSION",
      ownerPersonId: "owner",
      relatedPersonIds: ["related"],
      relatedCircleIds: ["circle-1"],
      participantPersonIds: ["participant"],
      relatedRoleDefIds: ["role-1"],
    };

    assert.deepEqual(
      evaluateReadAccess({ actor: actor({ personId: "owner" }), resource }),
      { allowed: true, basis: "OWNER" },
    );
    assert.deepEqual(
      evaluateReadAccess({ actor: actor({ personId: "related" }), resource }),
      { allowed: true, basis: "RELATED_PERSON" },
    );
    assert.deepEqual(
      evaluateReadAccess({
        actor: actor({ ledActiveCircleIds: ["circle-1"] }),
        resource,
      }),
      { allowed: true, basis: "LED_RELATED_CIRCLE" },
    );
    assert.deepEqual(
      evaluateReadAccess({
        actor: actor({ membershipRole: "ORG_ADMIN" }),
        resource,
      }),
      { allowed: true, basis: "ORGANIZATION_ADMIN" },
    );
    assert.equal(
      evaluateReadAccess({
        actor: actor({
          personId: "participant",
          assignedActiveRoleDefIds: ["role-1"],
        }),
        resource,
      }).allowed,
      false,
    );
  });

  test("MEETING_DRAFT allows participants only", () => {
    const resource = {
      organizationId: "org-1",
      zone: "CONTEXT_RESTRICTED",
      objectType: "MEETING_DRAFT",
      ownerPersonId: "person-1",
      participantPersonIds: ["participant"],
      relatedPersonIds: ["person-1"],
      relatedCircleIds: ["circle-1"],
      relatedRoleDefIds: ["role-1"],
    };

    assert.deepEqual(
      evaluateReadAccess({
        actor: actor({ personId: "participant" }),
        resource,
      }),
      { allowed: true, basis: "PARTICIPANT" },
    );

    for (const deniedActor of [
      actor(),
      actor({ membershipRole: "ORG_ADMIN" }),
      actor({ ledActiveCircleIds: ["circle-1"] }),
      actor({ assignedActiveRoleDefIds: ["role-1"] }),
    ]) {
      assert.equal(
        evaluateReadAccess({ actor: deniedActor, resource }).allowed,
        false,
      );
    }
  });

  test("INTERFACE_RUNTIME allows its fixed relationship set", () => {
    const resource = {
      organizationId: "org-1",
      zone: "CONTEXT_RESTRICTED",
      objectType: "INTERFACE_RUNTIME",
      ownerPersonId: "owner",
      relatedPersonIds: ["related"],
      relatedCircleIds: ["circle-1"],
      relatedRoleDefIds: ["role-1"],
    };
    const cases: Array<[
      ActorContext,
      | "OWNER"
      | "RELATED_PERSON"
      | "ASSIGNED_RELATED_ROLE_DEF"
      | "LED_RELATED_CIRCLE"
      | "ORGANIZATION_ADMIN",
    ]> = [
      [actor({ personId: "owner" }), "OWNER"],
      [actor({ personId: "related" }), "RELATED_PERSON"],
      [
        actor({ assignedActiveRoleDefIds: ["role-1"] }),
        "ASSIGNED_RELATED_ROLE_DEF",
      ],
      [actor({ ledActiveCircleIds: ["circle-1"] }), "LED_RELATED_CIRCLE"],
      [actor({ membershipRole: "ORG_ADMIN" }), "ORGANIZATION_ADMIN"],
    ];

    for (const [allowedActor, basis] of cases) {
      assert.deepEqual(
        evaluateReadAccess({ actor: allowedActor, resource }),
        { allowed: true, basis },
      );
    }
  });

  test("PERSONAL_WORK allows owner only", () => {
    const resource = {
      organizationId: "org-1",
      zone: "CONTEXT_RESTRICTED",
      objectType: "PERSONAL_WORK",
      ownerPersonId: "owner",
      participantPersonIds: ["person-1"],
      relatedPersonIds: ["person-1"],
      relatedCircleIds: ["circle-1"],
      relatedRoleDefIds: ["role-1"],
    };

    assert.deepEqual(
      evaluateReadAccess({ actor: actor({ personId: "owner" }), resource }),
      { allowed: true, basis: "OWNER" },
    );

    for (const deniedActor of [
      actor(),
      actor({ membershipRole: "ORG_ADMIN" }),
      actor({ ledActiveCircleIds: ["circle-1"] }),
      actor({ assignedActiveRoleDefIds: ["role-1"] }),
    ]) {
      assert.equal(
        evaluateReadAccess({ actor: deniedActor, resource }).allowed,
        false,
      );
    }
  });

  test("ignores removed caller-declared capability, admin, and lead bypasses", () => {
    const callerControlledInput = {
      actor: actor({
        membershipRole: "ORG_ADMIN",
        ledActiveCircleIds: ["circle-1"],
      }),
      resource: {
        organizationId: "org-1",
        zone: "CONTEXT_RESTRICTED",
        objectType: "MEETING_DRAFT",
        participantPersonIds: [],
        relatedCircleIds: ["circle-1"],
        allowOrganizationAdmin: true,
        allowLedCircle: true,
      },
      actorCapabilities: ["READ_MEETING_DRAFT"],
    };

    assert.equal(evaluateReadAccess(callerControlledInput).allowed, false);
  });
});

describe("fail-closed read classification", () => {
  test("denies forbidden data for every actor", () => {
    assert.equal(
      evaluateReadAccess({
        actor: actor({ membershipRole: "ORG_ADMIN" }),
        resource: {
          organizationId: "org-1",
          zone: "FORBIDDEN",
          objectType: "SESSION",
          ownerPersonId: "person-1",
          relatedPersonIds: ["person-1"],
        },
      }).allowed,
      false,
    );
  });

  test("denies cross-organization contextual relationships", () => {
    assert.equal(
      evaluateReadAccess({
        actor: actor({ membershipRole: "ORG_ADMIN" }),
        resource: {
          organizationId: "org-2",
          zone: "CONTEXT_RESTRICTED",
          objectType: "UNRESOLVED_TENSION",
          ownerPersonId: "person-1",
        },
      }).allowed,
      false,
    );
  });

  test("denies unknown zones and object types", () => {
    assert.equal(
      evaluateReadAccess({
        actor: actor(),
        resource: {
          organizationId: "org-1",
          zone: "UNKNOWN_ZONE",
          objectType: "CIRCLE",
        },
      }).allowed,
      false,
    );
    assert.equal(
      evaluateReadAccess({
        actor: actor(),
        resource: {
          organizationId: "org-1",
          zone: "ORGANIZATION_TRANSPARENT",
          objectType: "UNKNOWN_OBJECT",
        },
      }).allowed,
      false,
    );
  });

  test("denies a known object mislabeled into a more permissive zone", () => {
    assert.equal(
      evaluateReadAccess({
        actor: actor(),
        resource: {
          organizationId: "org-1",
          zone: "ORGANIZATION_TRANSPARENT",
          objectType: "PRIVATE_BRAIN_CONVERSATION",
          ownerPersonId: "person-1",
        },
      }).allowed,
      false,
    );
  });
});
