import type { ActorContext } from "./actor-context-resolver";

export type ReadDataZone =
  | "ORGANIZATION_TRANSPARENT"
  | "CONTEXT_RESTRICTED"
  | "PERSONAL_PRIVATE"
  | "FORBIDDEN";

const OBJECT_ZONE = {
  ORGANIZATION: "ORGANIZATION_TRANSPARENT",
  GOAL: "ORGANIZATION_TRANSPARENT",
  CIRCLE: "ORGANIZATION_TRANSPARENT",
  ROLE_DEFINITION: "ORGANIZATION_TRANSPARENT",
  CONFIRMED_MEETING_RESULT: "ORGANIZATION_TRANSPARENT",
  PROJECT: "ORGANIZATION_TRANSPARENT",
  ACTION: "ORGANIZATION_TRANSPARENT",
  GOVERNANCE_RECORD: "ORGANIZATION_TRANSPARENT",
  PUBLISHED_DECISION: "ORGANIZATION_TRANSPARENT",
  UNRESOLVED_TENSION: "CONTEXT_RESTRICTED",
  MEETING_DRAFT: "CONTEXT_RESTRICTED",
  INTERFACE_RUNTIME: "CONTEXT_RESTRICTED",
  PERSONAL_WORK: "CONTEXT_RESTRICTED",
  PRIVATE_BRAIN_CONVERSATION: "PERSONAL_PRIVATE",
  PERSONAL_DRAFT: "PERSONAL_PRIVATE",
  PASSWORD_MATERIAL: "FORBIDDEN",
  SESSION: "FORBIDDEN",
  TOKEN: "FORBIDDEN",
  CREDENTIAL: "FORBIDDEN",
  SECRET: "FORBIDDEN",
  INTERNAL_SECURITY_CONFIGURATION: "FORBIDDEN",
  RAW_CONNECTOR_CREDENTIAL: "FORBIDDEN",
} as const satisfies Record<string, ReadDataZone>;

export type ReadObjectType = keyof typeof OBJECT_ZONE;

type ContextReadObjectType =
  | "UNRESOLVED_TENSION"
  | "MEETING_DRAFT"
  | "INTERFACE_RUNTIME"
  | "PERSONAL_WORK";

type ContextRelation =
  | "OWNER"
  | "RELATED_PERSON"
  | "PARTICIPANT"
  | "ASSIGNED_RELATED_ROLE_DEF"
  | "LED_RELATED_CIRCLE"
  | "ORGANIZATION_ADMIN";

const CONTEXT_RELATION_POLICY = {
  UNRESOLVED_TENSION: [
    "OWNER",
    "RELATED_PERSON",
    "LED_RELATED_CIRCLE",
    "ORGANIZATION_ADMIN",
  ],
  MEETING_DRAFT: ["PARTICIPANT"],
  INTERFACE_RUNTIME: [
    "OWNER",
    "RELATED_PERSON",
    "ASSIGNED_RELATED_ROLE_DEF",
    "LED_RELATED_CIRCLE",
    "ORGANIZATION_ADMIN",
  ],
  PERSONAL_WORK: ["OWNER"],
} as const satisfies Record<ContextReadObjectType, readonly ContextRelation[]>;

export type ReadPolicyResource = {
  organizationId: string;
  zone: string;
  objectType: string;
  ownerPersonId?: string | null;
  participantPersonIds?: readonly string[];
  relatedPersonIds?: readonly string[];
  relatedCircleIds?: readonly string[];
  relatedRoleDefIds?: readonly string[];
};

export type ReadAccessBasis =
  | "CURRENT_ORGANIZATION_MEMBER"
  | "OWNER"
  | "RELATED_PERSON"
  | "PARTICIPANT"
  | "ASSIGNED_RELATED_ROLE_DEF"
  | "LED_RELATED_CIRCLE"
  | "ORGANIZATION_ADMIN";

export type ReadAccessDenialReason =
  | "UNKNOWN_ZONE"
  | "UNKNOWN_OBJECT_TYPE"
  | "ZONE_MISMATCH"
  | "FORBIDDEN"
  | "CROSS_ORGANIZATION"
  | "NOT_OWNER"
  | "MISSING_REQUIRED_RELATIONSHIP";

export type ReadAccessDecision =
  | { allowed: true; basis: ReadAccessBasis }
  | { allowed: false; reason: ReadAccessDenialReason };

export type ReadPolicyEvaluationInput = {
  actor: ActorContext;
  resource: ReadPolicyResource;
};

function isReadDataZone(value: string): value is ReadDataZone {
  return (
    value === "ORGANIZATION_TRANSPARENT" ||
    value === "CONTEXT_RESTRICTED" ||
    value === "PERSONAL_PRIVATE" ||
    value === "FORBIDDEN"
  );
}

function isReadObjectType(value: string): value is ReadObjectType {
  return Object.prototype.hasOwnProperty.call(OBJECT_ZONE, value);
}

function isContextReadObjectType(
  value: ReadObjectType,
): value is ContextReadObjectType {
  return Object.prototype.hasOwnProperty.call(CONTEXT_RELATION_POLICY, value);
}

function intersects(
  actorValues: readonly string[],
  resourceValues: readonly string[] | undefined,
): boolean {
  return resourceValues?.some((value) => actorValues.includes(value)) ?? false;
}

function evaluateContextRelation(
  relation: ContextRelation,
  actor: ActorContext,
  resource: ReadPolicyResource,
): ReadAccessBasis | null {
  if (relation === "OWNER" && resource.ownerPersonId === actor.personId) {
    return "OWNER";
  }
  if (
    relation === "RELATED_PERSON" &&
    resource.relatedPersonIds?.includes(actor.personId)
  ) {
    return "RELATED_PERSON";
  }
  if (
    relation === "PARTICIPANT" &&
    resource.participantPersonIds?.includes(actor.personId)
  ) {
    return "PARTICIPANT";
  }
  if (
    relation === "ASSIGNED_RELATED_ROLE_DEF" &&
    intersects(actor.assignedActiveRoleDefIds, resource.relatedRoleDefIds)
  ) {
    return "ASSIGNED_RELATED_ROLE_DEF";
  }
  if (
    relation === "LED_RELATED_CIRCLE" &&
    intersects(actor.ledActiveCircleIds, resource.relatedCircleIds)
  ) {
    return "LED_RELATED_CIRCLE";
  }
  if (
    relation === "ORGANIZATION_ADMIN" &&
    actor.membershipRole === "ORG_ADMIN"
  ) {
    return "ORGANIZATION_ADMIN";
  }
  return null;
}

// Pure policy evaluation is not an enforcement boundary; production uses read-policy.ts.
export function evaluateReadAccess({
  actor,
  resource,
}: ReadPolicyEvaluationInput): ReadAccessDecision {
  if (!isReadDataZone(resource.zone)) {
    return { allowed: false, reason: "UNKNOWN_ZONE" };
  }
  if (!isReadObjectType(resource.objectType)) {
    return { allowed: false, reason: "UNKNOWN_OBJECT_TYPE" };
  }
  if (OBJECT_ZONE[resource.objectType] !== resource.zone) {
    return { allowed: false, reason: "ZONE_MISMATCH" };
  }
  if (resource.zone === "FORBIDDEN") {
    return { allowed: false, reason: "FORBIDDEN" };
  }
  if (resource.organizationId !== actor.organizationId) {
    return { allowed: false, reason: "CROSS_ORGANIZATION" };
  }
  if (resource.zone === "ORGANIZATION_TRANSPARENT") {
    return { allowed: true, basis: "CURRENT_ORGANIZATION_MEMBER" };
  }
  if (resource.zone === "PERSONAL_PRIVATE") {
    return resource.ownerPersonId === actor.personId
      ? { allowed: true, basis: "OWNER" }
      : { allowed: false, reason: "NOT_OWNER" };
  }

  if (!isContextReadObjectType(resource.objectType)) {
    return { allowed: false, reason: "ZONE_MISMATCH" };
  }
  for (const relation of CONTEXT_RELATION_POLICY[resource.objectType]) {
    const basis = evaluateContextRelation(relation, actor, resource);
    if (basis) return { allowed: true, basis };
  }

  return { allowed: false, reason: "MISSING_REQUIRED_RELATIONSHIP" };
}
