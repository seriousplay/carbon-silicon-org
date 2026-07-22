import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { authorizeTrackerTensionMutation } from "@/lib/domain-operations";
import { withTrackerActionTestDependencies } from "../action-dependencies";
import { editTensionAction } from "./edit-action";

class RedirectSignal extends Error {
  constructor(readonly destination: string) {
    super(destination);
  }
}

function editForm(): FormData {
  const formData = new FormData();
  formData.set("title", "Edited action");
  formData.set("description", "Edited through the actual Server Action");
  formData.set("acceptanceCriteria", "A durable result exists");
  return formData;
}

function fixture(actorId: string) {
  const tension: Record<string, unknown> = {
    id: "action",
    organizationId: "org",
    ownerId: "owner",
    title: "Original action",
    description: "Original description",
  };
  const proposal = {
    id: "proposal",
    organizationId: "org",
    tensionId: "action",
    status: "APPROVED",
    kind: "ACTION",
    outcomeActionId: "action",
  };
  let writes = 0;
  const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => row[key] === value);
  const prisma = {
    tension: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => matches(tension, where) ? tension : null,
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if (!matches(tension, where)) return { count: 0 };
        Object.assign(tension, data);
        writes += 1;
        return { count: 1 };
      },
    },
    tacticalOutcomeProposal: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => matches(proposal, where) ? proposal : null,
    },
  };
  return {
    dependencies: {
      prisma,
      getCurrentOrgId: async () => "org",
      getCurrentPerson: async () => ({ id: actorId, organizationId: "org" }),
      authorizeTrackerTensionMutation,
      revalidatePath: () => {},
      redirect: (destination: string): never => { throw new RedirectSignal(destination); },
      beforeTrackerWrite: async () => {},
    },
    tension,
    get writes() { return writes; },
  };
}

describe("editTensionAction direct production boundary", () => {
  test("the approved ACTION owner edits through the actual action and reaches its redirect", async () => {
    const owner = fixture("owner");
    await assert.rejects(
      withTrackerActionTestDependencies(
        owner.dependencies,
        () => editTensionAction("action", undefined, editForm()),
      ),
      (error) => error instanceof RedirectSignal && error.destination === "/app/tracker/action",
    );
    assert.equal(owner.writes, 1);
    assert.equal(owner.tension.title, "Edited action");
  });

  test("a nonowner is denied by the actual action with zero writes", async () => {
    const nonowner = fixture("nonowner");
    const result = await withTrackerActionTestDependencies(
      nonowner.dependencies,
      () => editTensionAction("action", undefined, editForm()),
    );
    assert.ok(result?.error);
    assert.equal(nonowner.writes, 0);
    assert.equal(nonowner.tension.title, "Original action");
  });
});
