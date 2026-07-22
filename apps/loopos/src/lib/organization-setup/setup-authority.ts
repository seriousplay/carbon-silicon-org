export type SetupAuthorityTarget =
  | { kind: "ORGANIZATION"; organizationId: string }
  | {
      kind: "STRUCTURE";
      organizationId: string;
      structureId: string;
      ancestorIds: readonly string[];
    };

export type SetupAuthorityInput = {
  lifecycleStatus: "SETUP" | "ACTIVE";
  actorOrganizationId: string;
  actorMembershipRole: "ORG_ADMIN" | "ORG_MEMBER" | null;
  actorPersonId: string | null;
  ledStructureIds: readonly string[];
  target: SetupAuthorityTarget;
};

export type SetupAuthorityDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | "LIFECYCLE_NOT_SETUP"
        | "CROSS_ORGANIZATION"
        | "INSUFFICIENT_AUTHORITY";
    };

export function evaluateSetupAuthority(
  input: SetupAuthorityInput,
): SetupAuthorityDecision {
  if (input.lifecycleStatus !== "SETUP") {
    return { allowed: false, reason: "LIFECYCLE_NOT_SETUP" };
  }
  if (input.actorOrganizationId !== input.target.organizationId) {
    return { allowed: false, reason: "CROSS_ORGANIZATION" };
  }
  if (!input.actorPersonId) {
    return { allowed: false, reason: "INSUFFICIENT_AUTHORITY" };
  }
  if (input.actorMembershipRole === "ORG_ADMIN") {
    return { allowed: true };
  }
  if (input.target.kind === "ORGANIZATION") {
    return { allowed: false, reason: "INSUFFICIENT_AUTHORITY" };
  }

  const targetPath = new Set([
    input.target.structureId,
    ...input.target.ancestorIds,
  ]);
  return input.ledStructureIds.some((structureId) => targetPath.has(structureId))
    ? { allowed: true }
    : { allowed: false, reason: "INSUFFICIENT_AUTHORITY" };
}
