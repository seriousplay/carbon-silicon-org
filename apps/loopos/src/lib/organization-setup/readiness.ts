export const ORGANIZATION_SETUP_HARD_GATE_CODES = [
  "ORGANIZATION_PURPOSE_DEFINED",
  "EXACTLY_ONE_ROOT_STRUCTURE",
  "ACTIVE_ROLE_EXISTS",
] as const;

export type OrganizationSetupHardGateCode = (typeof ORGANIZATION_SETUP_HARD_GATE_CODES)[number];

export const ORGANIZATION_SETUP_WARNING_CODES = [
  "VACANT_ROLES",
  "INCOMPLETE_ROLE_DEFINITIONS",
  "STRUCTURE_LEAD_MISSING",
  "KEY_ROLE_ASSIGNED",
  "GOAL_CYCLE_MISSING",
  "ORGANIZATION_GOAL_MISSING",
  "MEETING_CADENCE_MISSING",
  "BRAIN_MODEL_UNAVAILABLE",
  "HELD_INVITATIONS_PENDING",
] as const;

export type OrganizationSetupWarningCode = (typeof ORGANIZATION_SETUP_WARNING_CODES)[number];

export type OrganizationSetupStructure = Readonly<{
  id: string;
  parentId: string | null;
  active: boolean;
  hasLead: boolean;
}>;

export type OrganizationSetupRole = Readonly<{
  id: string;
  active: boolean;
  key: boolean;
  purpose: string | null;
  accountabilities: string | null;
  assigneeCount: number;
  humanAssigneeCount: number;
}>;

export type OrganizationSetupReadinessInput = Readonly<{
  organizationPurpose: string | null;
  structures: readonly OrganizationSetupStructure[];
  roles: readonly OrganizationSetupRole[];
  hasGoalCycle: boolean;
  hasOrganizationGoal: boolean;
  meetingCadenceConfigured: boolean;
  brainModelAvailable: boolean;
  heldInvitationCount: number;
}>;

export type OrganizationSetupReadiness = Readonly<{
  readyToActivate: boolean;
  hardGates: Readonly<Record<OrganizationSetupHardGateCode, boolean>>;
  failedHardGateCodes: readonly OrganizationSetupHardGateCode[];
  warningCodes: readonly OrganizationSetupWarningCode[];
}>;

function hasText(value: string | null): boolean {
  return Boolean(value?.trim());
}

export function evaluateOrganizationSetupReadiness(
  input: OrganizationSetupReadinessInput,
): OrganizationSetupReadiness {
  const activeStructures = input.structures.filter((structure) => structure.active);
  const activeRoles = input.roles.filter((role) => role.active);

  const hardGates: Record<OrganizationSetupHardGateCode, boolean> = {
    ORGANIZATION_PURPOSE_DEFINED: hasText(input.organizationPurpose),
    EXACTLY_ONE_ROOT_STRUCTURE: activeStructures.filter((structure) => structure.parentId === null).length === 1,
    ACTIVE_ROLE_EXISTS: activeRoles.length > 0,
  };

  const failedHardGateCodes = ORGANIZATION_SETUP_HARD_GATE_CODES.filter((code) => !hardGates[code]);
  const warningCodes: OrganizationSetupWarningCode[] = [];

  if (activeRoles.some((role) => role.assigneeCount === 0)) warningCodes.push("VACANT_ROLES");
  if (activeRoles.some((role) => !hasText(role.purpose) || !hasText(role.accountabilities))) {
    warningCodes.push("INCOMPLETE_ROLE_DEFINITIONS");
  }
  if (activeStructures.some((structure) => structure.parentId !== null && !structure.hasLead)) {
    warningCodes.push("STRUCTURE_LEAD_MISSING");
  }
  if (!activeRoles.some((role) => role.key && role.humanAssigneeCount > 0)) {
    warningCodes.push("KEY_ROLE_ASSIGNED");
  }
  if (!input.hasGoalCycle) warningCodes.push("GOAL_CYCLE_MISSING");
  if (!input.hasOrganizationGoal) warningCodes.push("ORGANIZATION_GOAL_MISSING");
  if (!input.meetingCadenceConfigured) warningCodes.push("MEETING_CADENCE_MISSING");
  if (!input.brainModelAvailable) warningCodes.push("BRAIN_MODEL_UNAVAILABLE");
  if (input.heldInvitationCount > 0) warningCodes.push("HELD_INVITATIONS_PENDING");

  return {
    readyToActivate: failedHardGateCodes.length === 0,
    hardGates,
    failedHardGateCodes,
    warningCodes,
  };
}
