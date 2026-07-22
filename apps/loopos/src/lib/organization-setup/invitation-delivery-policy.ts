export const INVITATION_DELIVERY_DENIAL_CODE = {
  INVITATION_UNAVAILABLE: "INVITATION_UNAVAILABLE",
  ORG_ADMIN_REQUIRED: "ORG_ADMIN_REQUIRED",
} as const;

export type InvitationDeliveryMode = "HELD" | "IMMEDIATE";

export type InvitationDeliveryDecision =
  | Readonly<{ allowed: true; action: "HOLD"; mode: "HELD" }>
  | Readonly<{ allowed: true; action: "QUEUE"; mode: "IMMEDIATE" }>
  | Readonly<{
      allowed: false;
      action: "DENY";
      code: (typeof INVITATION_DELIVERY_DENIAL_CODE)[keyof typeof INVITATION_DELIVERY_DENIAL_CODE];
    }>;

export type InvitationDeliveryPolicyInput = Readonly<{
  lifecycleStatus: unknown;
  actorIsOrgAdmin: boolean;
  requestedMode: InvitationDeliveryMode | undefined;
  revoked: boolean;
  consumed: boolean;
  expiresAt: Date;
  now: Date;
}>;

const HOLD = Object.freeze({ allowed: true, action: "HOLD", mode: "HELD" } as const);
const QUEUE = Object.freeze({ allowed: true, action: "QUEUE", mode: "IMMEDIATE" } as const);
const DENY_UNAVAILABLE = Object.freeze({
  allowed: false,
  action: "DENY",
  code: INVITATION_DELIVERY_DENIAL_CODE.INVITATION_UNAVAILABLE,
} as const);
const DENY_ADMIN_REQUIRED = Object.freeze({
  allowed: false,
  action: "DENY",
  code: INVITATION_DELIVERY_DENIAL_CODE.ORG_ADMIN_REQUIRED,
} as const);

export function evaluateInvitationDelivery(
  input: InvitationDeliveryPolicyInput,
): InvitationDeliveryDecision {
  const expiresAt = input.expiresAt instanceof Date ? input.expiresAt.getTime() : Number.NaN;
  const now = input.now instanceof Date ? input.now.getTime() : Number.NaN;
  const invitationUnavailable =
    input.revoked ||
    input.consumed ||
    !Number.isFinite(expiresAt) ||
    !Number.isFinite(now) ||
    expiresAt <= now;

  if (
    invitationUnavailable ||
    (input.lifecycleStatus !== "SETUP" && input.lifecycleStatus !== "ACTIVE") ||
    (input.requestedMode !== undefined &&
      input.requestedMode !== "HELD" &&
      input.requestedMode !== "IMMEDIATE")
  ) {
    return DENY_UNAVAILABLE;
  }

  if (input.lifecycleStatus === "ACTIVE") {
    return QUEUE;
  }

  if (input.requestedMode === "IMMEDIATE") {
    return input.actorIsOrgAdmin ? QUEUE : DENY_ADMIN_REQUIRED;
  }

  return HOLD;
}
