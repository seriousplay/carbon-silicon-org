import { GovernanceDecisionError } from "./governance-decision";

export const GOVERNANCE_CHANGE_TYPES = [
  "ROLE_CREATED",
  "ROLE_MODIFIED",
  "ROLE_ARCHIVED",
  "ROLE_ASSIGNMENT",
  "ROLE_UNASSIGNMENT",
  "CIRCLE_CREATED",
  "CIRCLE_MODIFIED",
  "HOME_CHANGE",
  "AGENT_CREATED",
  "CHARTER_CREATED",
  "CHARTER_AMENDED",
] as const;

export type GovernanceChangeType = (typeof GOVERNANCE_CHANGE_TYPES)[number];

export type GovernanceStructuralChange = Readonly<{
  schemaVersion: 1;
  operation: GovernanceChangeType;
  targetId?: string | null;
  applicationId?: string;
  personId?: string;
  roleId?: string;
  ownershipType?: "HOME";
  name?: string;
  purpose?: string;
  domain?: string | null;
  accountabilities?: string;
  category?: "CIRCLE_LEAD" | "EXPERT" | "OPERATIONS" | "COACH";
  circleId?: string;
  number?: "ZERO" | "ONE" | "TWO" | "THREE" | "FOUR" | "CUSTOM";
  type?: "STRATEGY" | "PRODUCTION" | "INFRA" | "CROSSCUTTING";
  parentId?: string | null;
  homeCircleId?: string;
  agentModel?: string;
  agentEndpoint?: string | null;
  agentAbilities?: string;
  agentConfig?: string | null;
  guardianRoleId?: string | null;
  version?: string;
  content?: string;
  changeSummary?: string | null;
  previousVersionId?: string | null;
}>;

const MAX_TEXT = 16_000;

function text(value: unknown, code = "INVALID_CHANGE_PAYLOAD"): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > MAX_TEXT) throw new GovernanceDecisionError(code);
  return value;
}

function optionalText(value: unknown, code = "INVALID_CHANGE_PAYLOAD"): string | null | undefined {
  if (value === undefined || value === null) return value;
  return text(value, code);
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  const actual = Object.keys(value).sort().join(",");
  const expected = [...allowed].sort().join(",");
  if (actual !== expected) throw new GovernanceDecisionError("INVALID_CHANGE_PAYLOAD");
}

function exactKeysWithOptionalTargetId(value: Record<string, unknown>, allowed: readonly string[]): void {
  const withTarget = value.targetId === undefined ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== "targetId")) : value;
  const withoutTargetAllowed = allowed.filter((key) => key !== "targetId");
  exactKeys(withTarget, value.targetId === undefined ? withoutTargetAllowed : allowed);
}

function nullTargetId(value: unknown): null {
  if (value !== undefined && value !== null) throw new GovernanceDecisionError("INVALID_CHANGE_PAYLOAD");
  return null;
}

function oneOf<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new GovernanceDecisionError("INVALID_CHANGE_PAYLOAD");
  return value as T;
}

export function parseGovernanceStructuralChange(value: unknown): GovernanceStructuralChange {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new GovernanceDecisionError("INVALID_CHANGE_PAYLOAD");
  const input = value as Record<string, unknown>;
  if (input.schemaVersion !== 1 || typeof input.operation !== "string" || !GOVERNANCE_CHANGE_TYPES.includes(input.operation as GovernanceChangeType)) {
    throw new GovernanceDecisionError("INVALID_CHANGE_PAYLOAD");
  }
  const operation = input.operation as GovernanceChangeType;
  if (operation === "ROLE_CREATED") {
    exactKeysWithOptionalTargetId(input, ["accountabilities", "category", "circleId", "domain", "name", "operation", "ownershipType", "purpose", "schemaVersion", "targetId"]);
    if (input.ownershipType !== "HOME") throw new GovernanceDecisionError("INVALID_CHANGE_PAYLOAD");
    if (!(["CIRCLE_LEAD", "EXPERT", "OPERATIONS", "COACH"] as const).includes(input.category as never)) throw new GovernanceDecisionError("INVALID_CHANGE_PAYLOAD");
    return { schemaVersion: 1, operation, targetId: nullTargetId(input.targetId), name: text(input.name), purpose: text(input.purpose), domain: optionalText(input.domain), accountabilities: text(input.accountabilities), category: input.category as GovernanceStructuralChange["category"], circleId: text(input.circleId), ownershipType: "HOME" };
  }
  if (operation === "ROLE_MODIFIED") {
    exactKeys(input, ["accountabilities", "domain", "name", "operation", "purpose", "schemaVersion", "targetId"]);
    return { schemaVersion: 1, operation, targetId: text(input.targetId), name: text(input.name), purpose: text(input.purpose), domain: optionalText(input.domain), accountabilities: text(input.accountabilities) };
  }
  if (operation === "ROLE_ARCHIVED") {
    exactKeys(input, ["operation", "schemaVersion", "targetId"]);
    return { schemaVersion: 1, operation, targetId: text(input.targetId) };
  }
  if (operation === "ROLE_ASSIGNMENT") {
    exactKeys(input, ["applicationId", "operation", "personId", "roleId", "schemaVersion"]);
    return { schemaVersion: 1, operation, targetId: text(input.applicationId), applicationId: text(input.applicationId), personId: text(input.personId), roleId: text(input.roleId) };
  }
  if (operation === "ROLE_UNASSIGNMENT") {
    exactKeys(input, ["operation", "personId", "roleId", "schemaVersion"]);
    return { schemaVersion: 1, operation, targetId: text(input.roleId), personId: text(input.personId), roleId: text(input.roleId) };
  }
  if (operation === "CIRCLE_CREATED") {
    exactKeysWithOptionalTargetId(input, ["domain", "name", "number", "operation", "parentId", "purpose", "schemaVersion", "targetId", "type"]);
    return { schemaVersion: 1, operation, targetId: nullTargetId(input.targetId), name: text(input.name), purpose: text(input.purpose), domain: optionalText(input.domain), number: oneOf(input.number, ["ZERO", "ONE", "TWO", "THREE", "FOUR", "CUSTOM"] as const), type: oneOf(input.type, ["STRATEGY", "PRODUCTION", "INFRA", "CROSSCUTTING"] as const), parentId: optionalText(input.parentId) };
  }
  if (operation === "CIRCLE_MODIFIED") {
    exactKeys(input, ["domain", "name", "operation", "purpose", "schemaVersion", "targetId"]);
    return { schemaVersion: 1, operation, targetId: text(input.targetId), name: text(input.name), purpose: text(input.purpose), domain: optionalText(input.domain) };
  }
  if (operation === "AGENT_CREATED") {
    exactKeysWithOptionalTargetId(input, ["agentAbilities", "agentConfig", "agentEndpoint", "agentModel", "circleId", "guardianRoleId", "name", "operation", "schemaVersion", "targetId"]);
    return { schemaVersion: 1, operation, targetId: nullTargetId(input.targetId), name: text(input.name), agentModel: text(input.agentModel), agentEndpoint: optionalText(input.agentEndpoint), agentAbilities: text(input.agentAbilities), agentConfig: optionalText(input.agentConfig), circleId: text(input.circleId), guardianRoleId: optionalText(input.guardianRoleId) };
  }
  if (operation === "CHARTER_CREATED") {
    exactKeysWithOptionalTargetId(input, ["changeSummary", "content", "operation", "previousVersionId", "schemaVersion", "targetId", "version"]);
    return { schemaVersion: 1, operation, targetId: nullTargetId(input.targetId), version: text(input.version), content: text(input.content), changeSummary: optionalText(input.changeSummary), previousVersionId: optionalText(input.previousVersionId) };
  }
  if (operation === "CHARTER_AMENDED") {
    exactKeys(input, ["changeSummary", "content", "operation", "schemaVersion", "targetId", "version"]);
    return { schemaVersion: 1, operation, targetId: text(input.targetId), version: text(input.version), content: text(input.content), changeSummary: optionalText(input.changeSummary) };
  }
  exactKeys(input, ["homeCircleId", "operation", "schemaVersion", "targetId"]);
  return { schemaVersion: 1, operation, targetId: text(input.targetId), homeCircleId: text(input.homeCircleId) };
}
