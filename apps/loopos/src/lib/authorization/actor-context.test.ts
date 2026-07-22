import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ActorContextResolutionError,
  createActorContextResolver,
  type ActorContextUserSnapshot,
} from "./actor-context-resolver";

function userSnapshot(
  overrides: Partial<ActorContextUserSnapshot> = {},
): ActorContextUserSnapshot {
  return {
    id: "user-1",
    memberships: [
      {
        userId: "user-1",
        organizationId: "org-1",
        role: "ORG_MEMBER",
      },
    ],
    person: {
      id: "person-1",
      userId: "user-1",
      organizationId: "org-1",
      homeCircleId: "circle-home",
      organization: { id: "org-1" },
      homeCircle: { id: "circle-home", organizationId: "org-1" },
      roles: [],
      leadingCircles: [],
    },
    ...overrides,
  };
}

function resolverFor(input: {
  sessionUserId?: string | null;
  user?: ActorContextUserSnapshot | null;
}) {
  let loadUserCalls = 0;
  const resolver = createActorContextResolver({
    getAuthenticatedUserId: async () => input.sessionUserId ?? null,
    loadUser: async () => {
      loadUserCalls += 1;
      return input.user ?? null;
    },
  });

  return { resolver, getLoadUserCalls: () => loadUserCalls };
}

async function rejectsWithCode(
  promise: Promise<unknown>,
  code: ActorContextResolutionError["code"],
) {
  await assert.rejects(promise, (error: unknown) => {
    return error instanceof ActorContextResolutionError && error.code === code;
  });
}

describe("ActorContext invalid input", () => {
  test("fails before database lookup when the authenticated Session is missing", async () => {
    const fixture = resolverFor({ sessionUserId: null });

    await rejectsWithCode(fixture.resolver(), "MISSING_SESSION");
    assert.equal(fixture.getLoadUserCalls(), 0);
  });

  test("fails when the authenticated User is missing", async () => {
    const fixture = resolverFor({ sessionUserId: "user-1", user: null });

    await rejectsWithCode(fixture.resolver(), "MISSING_USER");
  });

  test("fails when the loaded User does not match the Session", async () => {
    const fixture = resolverFor({
      sessionUserId: "user-1",
      user: userSnapshot({ id: "user-2" }),
    });

    await rejectsWithCode(fixture.resolver(), "USER_MISMATCH");
  });

  test("fails when the User has no Person", async () => {
    const fixture = resolverFor({
      sessionUserId: "user-1",
      user: userSnapshot({ person: null }),
    });

    await rejectsWithCode(fixture.resolver(), "MISSING_PERSON");
  });

  test("fails when Person belongs to a different User", async () => {
    const snapshot = userSnapshot();
    snapshot.person!.userId = "user-2";
    const fixture = resolverFor({ sessionUserId: "user-1", user: snapshot });

    await rejectsWithCode(fixture.resolver(), "PERSON_USER_MISMATCH");
  });

  test("fails when Person has no matching organization", async () => {
    const snapshot = userSnapshot();
    snapshot.person!.organization = null;
    const fixture = resolverFor({ sessionUserId: "user-1", user: snapshot });

    await rejectsWithCode(fixture.resolver(), "MISSING_ORGANIZATION");
  });

  test("fails when Person and organization disagree", async () => {
    const snapshot = userSnapshot();
    snapshot.person!.organization = { id: "org-2" };
    const fixture = resolverFor({ sessionUserId: "user-1", user: snapshot });

    await rejectsWithCode(fixture.resolver(), "ORGANIZATION_MISMATCH");
  });

  test("fails when no Membership exactly matches Person.organizationId", async () => {
    const fixture = resolverFor({
      sessionUserId: "user-1",
      user: userSnapshot({
        memberships: [
          { userId: "user-1", organizationId: "org-2", role: "ORG_ADMIN" },
          { userId: "user-1", organizationId: "org-3", role: "ORG_MEMBER" },
        ],
      }),
    });

    await rejectsWithCode(fixture.resolver(), "MISSING_MEMBERSHIP");
  });

  test("fails when more than one Membership matches Person.organizationId", async () => {
    const exactMembership = {
      userId: "user-1",
      organizationId: "org-1",
      role: "ORG_MEMBER" as const,
    };
    const fixture = resolverFor({
      sessionUserId: "user-1",
      user: userSnapshot({ memberships: [exactMembership, exactMembership] }),
    });

    await rejectsWithCode(fixture.resolver(), "CONFLICTING_MEMBERSHIP");
  });

  test("fails when the exact Membership belongs to another User", async () => {
    const fixture = resolverFor({
      sessionUserId: "user-1",
      user: userSnapshot({
        memberships: [
          { userId: "user-2", organizationId: "org-1", role: "ORG_MEMBER" },
        ],
      }),
    });

    await rejectsWithCode(fixture.resolver(), "MEMBERSHIP_MISMATCH");
  });

  test("fails when the exact Membership has an invalid role", async () => {
    const snapshot = userSnapshot();
    snapshot.memberships[0].role = "ORG_OWNER";
    const fixture = resolverFor({ sessionUserId: "user-1", user: snapshot });

    await rejectsWithCode(fixture.resolver(), "INVALID_MEMBERSHIP_ROLE");
  });

  test("fails when Person has no home Circle", async () => {
    const snapshot = userSnapshot();
    snapshot.person!.homeCircle = null;
    const fixture = resolverFor({ sessionUserId: "user-1", user: snapshot });

    await rejectsWithCode(fixture.resolver(), "MISSING_HOME_CIRCLE");
  });

  test("fails when homeCircleId does not match the same-organization Circle", async () => {
    const snapshot = userSnapshot();
    snapshot.person!.homeCircle = {
      id: "circle-other",
      organizationId: "org-1",
    };
    const fixture = resolverFor({ sessionUserId: "user-1", user: snapshot });

    await rejectsWithCode(fixture.resolver(), "HOME_CIRCLE_MISMATCH");
  });

  test("fails when the home Circle is outside the active organization", async () => {
    const snapshot = userSnapshot();
    snapshot.person!.homeCircle = {
      id: "circle-home",
      organizationId: "org-2",
    };
    const fixture = resolverFor({ sessionUserId: "user-1", user: snapshot });

    await rejectsWithCode(fixture.resolver(), "HOME_CIRCLE_MISMATCH");
  });
});

describe("ActorContext exact organization resolution", () => {
  test("uses the one exact Membership while allowing unrelated Memberships", async () => {
    const snapshot = userSnapshot({
      memberships: [
        { userId: "user-1", organizationId: "org-2", role: "ORG_MEMBER" },
        { userId: "user-1", organizationId: "org-1", role: "ORG_ADMIN" },
      ],
    });
    snapshot.person!.roles = [
      { id: "role-active", organizationId: "org-1", status: "ACTIVE" },
      { id: "role-paused", organizationId: "org-1", status: "PAUSED" },
      { id: "role-foreign", organizationId: "org-2", status: "ACTIVE" },
      { id: "role-active", organizationId: "org-1", status: "ACTIVE" },
    ];
    snapshot.person!.leadingCircles = [
      { id: "circle-warning", organizationId: "org-1", status: "WARNING" },
      { id: "circle-normal", organizationId: "org-1", status: "NORMAL" },
      { id: "circle-archived", organizationId: "org-1", status: "ARCHIVED" },
      { id: "circle-foreign", organizationId: "org-2", status: "NORMAL" },
    ];
    const fixture = resolverFor({ sessionUserId: "user-1", user: snapshot });

    assert.deepEqual(await fixture.resolver(), {
      organizationId: "org-1",
      userId: "user-1",
      personId: "person-1",
      membershipRole: "ORG_ADMIN",
      homeCircleId: "circle-home",
      assignedActiveRoleDefIds: ["role-active"],
      ledActiveCircleIds: ["circle-normal", "circle-warning"],
    });
  });
});
