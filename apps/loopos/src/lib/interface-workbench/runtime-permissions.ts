export type RuntimePermissionActor = {
  organizationId: string;
  personId: string;
  membershipRole: "ORG_ADMIN" | "ORG_MEMBER" | null;
  assignedRoleDefIds: readonly string[];
};

export type RuntimePermissionInterface = {
  organizationId: string;
  ownerId: string;
  fromCircleLeadPersonId: string | null;
  toCircleLeadPersonId: string | null;
  supportPersonIds: readonly string[];
  supportRoleDefIds: readonly string[];
};

export type RuntimeWaitingBinding = {
  organizationId: string;
  personId: string | null;
  roleDefId: string | null;
};

export type RuntimeAdvancePermission = {
  allowed: boolean;
  requiresTakeoverEvent: boolean;
};

export type RuntimeAdvanceOptions = {
  takeover?: boolean;
};

export function canStartInterfaceWorkflow(
  actor: RuntimePermissionActor,
  interfaceContext: RuntimePermissionInterface,
): boolean {
  return canAccessInterfaceWorkflow(actor, interfaceContext);
}

export function canViewInterfaceWorkflow(
  actor: RuntimePermissionActor,
  interfaceContext: RuntimePermissionInterface,
): boolean {
  return canAccessInterfaceWorkflow(actor, interfaceContext);
}

export function canAdvanceInterfaceWorkflow(
  actor: RuntimePermissionActor,
  interfaceContext: RuntimePermissionInterface,
  waitingBinding: RuntimeWaitingBinding,
  options: RuntimeAdvanceOptions = {},
): RuntimeAdvancePermission {
  if (
    actor.organizationId !== interfaceContext.organizationId ||
    waitingBinding.organizationId !== interfaceContext.organizationId
  ) {
    return deniedAdvance();
  }

  const isWaitingPerson = waitingBinding.personId === actor.personId;
  const isWaitingRoleAssignee =
    waitingBinding.roleDefId !== null && actor.assignedRoleDefIds.includes(waitingBinding.roleDefId);

  if (isWaitingPerson || isWaitingRoleAssignee) {
    return { allowed: true, requiresTakeoverEvent: false };
  }

  const mayTakeOver = actor.membershipRole === "ORG_ADMIN" || actor.personId === interfaceContext.ownerId;
  if (options.takeover === true && mayTakeOver) {
    return { allowed: true, requiresTakeoverEvent: true };
  }

  return deniedAdvance();
}

function canAccessInterfaceWorkflow(
  actor: RuntimePermissionActor,
  interfaceContext: RuntimePermissionInterface,
): boolean {
  if (actor.organizationId !== interfaceContext.organizationId) return false;
  if (actor.membershipRole === "ORG_ADMIN") return true;

  if (
    actor.personId === interfaceContext.ownerId ||
    actor.personId === interfaceContext.fromCircleLeadPersonId ||
    actor.personId === interfaceContext.toCircleLeadPersonId ||
    interfaceContext.supportPersonIds.includes(actor.personId)
  ) {
    return true;
  }

  return actor.assignedRoleDefIds.some((roleDefId) =>
    interfaceContext.supportRoleDefIds.includes(roleDefId),
  );
}

function deniedAdvance(): RuntimeAdvancePermission {
  return { allowed: false, requiresTakeoverEvent: false };
}
