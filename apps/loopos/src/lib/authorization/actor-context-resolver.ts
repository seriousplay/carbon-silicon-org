export type MembershipRole = "ORG_ADMIN" | "ORG_MEMBER";

export type ActorContext = Readonly<{
  organizationId: string;
  userId: string;
  personId: string;
  membershipRole: MembershipRole;
  homeCircleId: string;
  assignedActiveRoleDefIds: readonly string[];
  ledActiveCircleIds: readonly string[];
}>;

type RoleStatus = "ACTIVE" | "PAUSED" | "ARCHIVED";
type CircleStatus = "NORMAL" | "WARNING" | "HALTED" | "ARCHIVED";

export type ActorContextUserSnapshot = {
  id: string;
  memberships: Array<{
    userId: string;
    organizationId: string;
    role: string;
  }>;
  person: {
    id: string;
    userId: string | null;
    organizationId: string;
    homeCircleId: string;
    organization: { id: string } | null;
    homeCircle: { id: string; organizationId: string } | null;
    roles: Array<{
      id: string;
      organizationId: string;
      status: RoleStatus;
    }>;
    leadingCircles: Array<{
      id: string;
      organizationId: string;
      status: CircleStatus;
    }>;
  } | null;
};

export type ActorContextResolutionErrorCode =
  | "MISSING_SESSION"
  | "MISSING_USER"
  | "USER_MISMATCH"
  | "MISSING_PERSON"
  | "PERSON_USER_MISMATCH"
  | "MISSING_ORGANIZATION"
  | "ORGANIZATION_MISMATCH"
  | "MISSING_MEMBERSHIP"
  | "CONFLICTING_MEMBERSHIP"
  | "MEMBERSHIP_MISMATCH"
  | "INVALID_MEMBERSHIP_ROLE"
  | "MISSING_HOME_CIRCLE"
  | "HOME_CIRCLE_MISMATCH";

export class ActorContextResolutionError extends Error {
  constructor(public readonly code: ActorContextResolutionErrorCode) {
    super(`Actor context resolution failed: ${code}`);
    this.name = "ActorContextResolutionError";
  }
}

export type ActorContextResolverDependencies = {
  getAuthenticatedUserId(): Promise<string | null>;
  loadUser(userId: string): Promise<ActorContextUserSnapshot | null>;
};

function fail(code: ActorContextResolutionErrorCode): never {
  throw new ActorContextResolutionError(code);
}

function isMembershipRole(value: string): value is MembershipRole {
  return value === "ORG_ADMIN" || value === "ORG_MEMBER";
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

export function createActorContextResolver(
  dependencies: ActorContextResolverDependencies,
): () => Promise<ActorContext> {
  return async () => {
    const sessionUserId = await dependencies.getAuthenticatedUserId();
    if (!sessionUserId) fail("MISSING_SESSION");

    const user = await dependencies.loadUser(sessionUserId);
    if (!user) fail("MISSING_USER");
    if (user.id !== sessionUserId) fail("USER_MISMATCH");

    const person = user.person;
    if (!person) fail("MISSING_PERSON");
    if (person.userId !== sessionUserId) fail("PERSON_USER_MISMATCH");

    if (!person.organization) fail("MISSING_ORGANIZATION");
    if (
      !person.organizationId ||
      person.organization.id !== person.organizationId
    ) {
      fail("ORGANIZATION_MISMATCH");
    }

    const exactMemberships = user.memberships.filter(
      (membership) => membership.organizationId === person.organizationId,
    );
    if (exactMemberships.length === 0) fail("MISSING_MEMBERSHIP");
    if (exactMemberships.length > 1) fail("CONFLICTING_MEMBERSHIP");

    const membership = exactMemberships[0];
    if (membership.userId !== sessionUserId) fail("MEMBERSHIP_MISMATCH");
    if (!isMembershipRole(membership.role)) fail("INVALID_MEMBERSHIP_ROLE");

    if (!person.homeCircle) fail("MISSING_HOME_CIRCLE");
    if (
      person.homeCircle.id !== person.homeCircleId ||
      person.homeCircle.organizationId !== person.organizationId
    ) {
      fail("HOME_CIRCLE_MISMATCH");
    }

    return {
      organizationId: person.organizationId,
      userId: sessionUserId,
      personId: person.id,
      membershipRole: membership.role,
      homeCircleId: person.homeCircleId,
      assignedActiveRoleDefIds: uniqueSorted(
        person.roles
          .filter(
            (role) =>
              role.organizationId === person.organizationId &&
              role.status === "ACTIVE",
          )
          .map((role) => role.id),
      ),
      ledActiveCircleIds: uniqueSorted(
        person.leadingCircles
          .filter(
            (circle) =>
              circle.organizationId === person.organizationId &&
              circle.status !== "ARCHIVED",
          )
          .map((circle) => circle.id),
      ),
    };
  };
}
