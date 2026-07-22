import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  INVITATION_DELIVERY_DENIAL_CODE,
  evaluateInvitationDelivery,
  type InvitationDeliveryPolicyInput,
} from "./invitation-delivery-policy";

const now = new Date("2026-07-20T10:00:00.000Z");

function input(
  overrides: Partial<InvitationDeliveryPolicyInput> = {},
): InvitationDeliveryPolicyInput {
  return {
    lifecycleStatus: "SETUP",
    actorIsOrgAdmin: false,
    requestedMode: undefined,
    revoked: false,
    consumed: false,
    expiresAt: new Date("2026-07-21T10:00:00.000Z"),
    now,
    ...overrides,
  };
}

describe("invitation delivery policy", () => {
  test("holds valid SETUP invitations by default or explicit HELD mode", () => {
    for (const requestedMode of [undefined, "HELD"] as const) {
      const decision = evaluateInvitationDelivery(input({ requestedMode }));
      assert.deepEqual(decision, { allowed: true, action: "HOLD", mode: "HELD" });
      assert.ok(Object.isFrozen(decision));
    }
  });

  test("queues explicit IMMEDIATE delivery in SETUP only for ORG_ADMIN", () => {
    assert.deepEqual(
      evaluateInvitationDelivery(
        input({ requestedMode: "IMMEDIATE", actorIsOrgAdmin: true }),
      ),
      { allowed: true, action: "QUEUE", mode: "IMMEDIATE" },
    );
    assert.deepEqual(
      evaluateInvitationDelivery(
        input({ requestedMode: "IMMEDIATE", actorIsOrgAdmin: false }),
      ),
      {
        allowed: false,
        action: "DENY",
        code: INVITATION_DELIVERY_DENIAL_CODE.ORG_ADMIN_REQUIRED,
      },
    );
  });

  test("queues every valid ACTIVE invitation regardless of requested mode", () => {
    for (const requestedMode of [undefined, "HELD", "IMMEDIATE"] as const) {
      assert.deepEqual(
        evaluateInvitationDelivery(input({ lifecycleStatus: "ACTIVE", requestedMode })),
        { allowed: true, action: "QUEUE", mode: "IMMEDIATE" },
      );
    }
  });

  test("denies revoked, consumed, expired, and invalid-date invitations", () => {
    const unavailableInputs = [
      { revoked: true },
      { consumed: true },
      { expiresAt: now },
      { expiresAt: new Date("invalid") },
      { now: new Date("invalid") },
    ] satisfies Array<Partial<InvitationDeliveryPolicyInput>>;

    for (const overrides of unavailableInputs) {
      const decision = evaluateInvitationDelivery(input(overrides));
      assert.deepEqual(decision, {
        allowed: false,
        action: "DENY",
        code: INVITATION_DELIVERY_DENIAL_CODE.INVITATION_UNAVAILABLE,
      });
      assert.ok(Object.isFrozen(decision));
    }
  });

  test("fails closed for missing or unknown lifecycle and runtime mode values", () => {
    for (const lifecycleStatus of [undefined, null, "UNKNOWN"] as const) {
      assert.deepEqual(evaluateInvitationDelivery(input({ lifecycleStatus })), {
        allowed: false,
        action: "DENY",
        code: INVITATION_DELIVERY_DENIAL_CODE.INVITATION_UNAVAILABLE,
      });
    }

    assert.deepEqual(
      evaluateInvitationDelivery(
        input({ requestedMode: "UNKNOWN" as InvitationDeliveryPolicyInput["requestedMode"] }),
      ),
      {
        allowed: false,
        action: "DENY",
        code: INVITATION_DELIVERY_DENIAL_CODE.INVITATION_UNAVAILABLE,
      },
    );
  });
});
