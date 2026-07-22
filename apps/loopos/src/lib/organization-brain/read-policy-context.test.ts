import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { ActorContext } from "../authorization/actor-context-resolver";
import { toBrainReadPolicyContext } from "./read-policy-context";

describe("V5-M1-B2 Brain read policy context", () => {
  test("derives only immutable database identity from resolved ActorContext", () => {
    const actor: ActorContext = {
      organizationId: "org-1",
      userId: "user-1",
      personId: "person-1",
      membershipRole: "ORG_ADMIN",
      homeCircleId: "circle-home",
      assignedActiveRoleDefIds: ["role-1"],
      ledActiveCircleIds: ["circle-led"],
    };

    const context = toBrainReadPolicyContext(actor);

    assert.deepEqual(context, {
      organizationId: "org-1",
      userId: "user-1",
      personId: "person-1",
    });
    assert.deepEqual(Object.keys(context).sort(), [
      "organizationId",
      "personId",
      "userId",
    ]);
    assert.equal(Object.isFrozen(context), true);
  });
});
