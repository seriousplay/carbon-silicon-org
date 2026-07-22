import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createCircleAction } from "@/app/app/circles/actions";
import { editCircleAction } from "@/app/app/circles/[id]/edit-action";
import { createRoleAction } from "@/app/app/circles/[id]/roles/actions";
import { createCharterAction, ratifyCharterAction } from "@/app/app/governance/charter/actions";
import { createInterfaceAction } from "@/app/app/interfaces/actions";
import { createAgentAction } from "@/app/app/people/agent-action";
import {
  DIRECT_STRUCTURE_MUTATION_DENIAL,
  canApplyBootstrapTemplate,
  type BootstrapAuthoritySnapshot,
} from "../bootstrap-authority";

const pristine: BootstrapAuthoritySnapshot = {
  circleCount: 1,
  rootCircleCount: 1,
  roleCount: 0,
  interfaceCount: 0,
  charterCount: 0,
  changeLogCount: 0,
  meetingCount: 0,
  decisionCount: 0,
  governanceProposalCount: 0,
  tacticalOutcomeProposalCount: 0,
  projectCount: 0,
  tensionCount: 0,
};

describe("pristine organization bootstrap authority", () => {
  test("allows the dedicated template exactly on the registration baseline", () => {
    assert.equal(canApplyBootstrapTemplate(pristine), true);
  });

  test("cannot reopen after initialization changes structure", () => {
    assert.equal(
      canApplyBootstrapTemplate({ ...pristine, circleCount: 2, roleCount: 1 }),
      false
    );
    assert.equal(
      canApplyBootstrapTemplate({ ...pristine, changeLogCount: 1 }),
      false
    );
  });

  test("denies every kind of operational history", () => {
    const historyFields: Array<keyof BootstrapAuthoritySnapshot> = [
      "meetingCount",
      "changeLogCount",
      "decisionCount",
      "governanceProposalCount",
      "tacticalOutcomeProposalCount",
      "projectCount",
      "tensionCount",
    ];

    for (const field of historyFields) {
      assert.equal(
        canApplyBootstrapTemplate({ ...pristine, [field]: 1 }),
        false,
        field
      );
    }
  });

  test("denies pre-existing structure and any non-baseline root shape", () => {
    for (const snapshot of [
      { ...pristine, circleCount: 0, rootCircleCount: 0 },
      { ...pristine, rootCircleCount: 2 },
      { ...pristine, roleCount: 1 },
      { ...pristine, interfaceCount: 1 },
      { ...pristine, charterCount: 1 },
    ]) {
      assert.equal(canApplyBootstrapTemplate(snapshot), false);
    }
  });
});

describe("retired direct structure action matrix", () => {
  const formData = new FormData();
  const expected = { error: DIRECT_STRUCTURE_MUTATION_DENIAL };

  test("returns one stable denial before any former write dependency", async () => {
    const results = await Promise.all([
      createCircleAction(undefined, formData),
      editCircleAction("circle", undefined, formData),
      createRoleAction(undefined, formData),
      createInterfaceAction(undefined, formData),
      createAgentAction(undefined, formData),
      createCharterAction(undefined, formData),
      ratifyCharterAction("charter"),
    ]);

    assert.deepEqual(results, Array.from({ length: results.length }, () => expected));
  });
});
