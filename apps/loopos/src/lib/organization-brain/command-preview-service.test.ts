import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { createPrismaBrainCommandSourceValidator } from "./command-source-validator";
import type { BrainGoalCommandActor } from "./goal-command-handler";
import { createLedgerForMeetingLifecycle } from "./meeting-preview-lifecycle-gate";

const source = readFileSync(new URL("./command-preview-service.ts", import.meta.url), "utf8");
const coreSource = readFileSync(new URL("./command-preview-core.ts", import.meta.url), "utf8");

const actor: BrainGoalCommandActor = {
  organizationId: "org-a",
  userId: "user-a",
  personId: "person-a",
};

describe("M3-E Brain command preview service", () => {
  test("does not project raw payloads or source bindings to browser DTOs", () => {
    assert.match(source, /type BrainCommandPreviewSummary/);
    assert.doesNotMatch(summaryBlock(), /serverPayload|sourceBindings|payloadHash|sourceBindingHash|organizationId|ownerUserId|actorId/);
    assert.match(coreSource, /confirmGoalCommandPreview/);
    assert.doesNotMatch(`${source}\n${coreSource}`, /createGoalProposal\(|appendGoalCheckIns\(|raiseTension\(|submitTacticalOutcomeProposal\(|updateMeetingNotes\(/);
  });

  test("source validator accepts current meeting notes revision and rejects drift", async () => {
    const client = {
      meeting: {
        findFirst: async ({ where }: { where: { id: string; organizationId: string } }) =>
          where.id === "meeting-a" && where.organizationId === "org-a"
            ? { notesRevision: 2, endedAt: null, createdAt: new Date("2026-07-15T12:00:00.000Z") }
            : null,
      },
    };
    const validator = createPrismaBrainCommandSourceValidator(client as never);

    assert.deepEqual(await validator.validate({
      actor,
      command: "meeting_notes.update",
      payload: {
        command: "meeting_notes.update",
        meetingId: "meeting-a",
        expectedNotesRevision: 2,
        notes: "Updated",
      },
      sourceBindings: [
        { objectType: "meeting", objectId: "meeting-a", sourceVersionAt: "notesRevision:2", revision: 2 },
      ],
    }), { ok: true });

    assert.deepEqual(await validator.validate({
      actor,
      command: "meeting_notes.update",
      payload: {
        command: "meeting_notes.update",
        meetingId: "meeting-a",
        expectedNotesRevision: 1,
        notes: "Stale",
      },
      sourceBindings: [
        { objectType: "meeting", objectId: "meeting-a", sourceVersionAt: "notesRevision:1", revision: 1 },
      ],
    }), { ok: false, code: "STALE_PREVIEW" });
  });

  test("source validator enforces tenant-scoped object existence", async () => {
    const client = {
      circle: {
        findFirst: async ({ where }: { where: { id: string; organizationId: string } }) =>
          where.id === "circle-a" && where.organizationId === "org-a"
            ? { status: "NORMAL", updatedAt: new Date("2026-07-15T12:00:00.000Z") }
            : null,
      },
    };
    const validator = createPrismaBrainCommandSourceValidator(client as never);
    const input = {
      actor,
      command: "tension.raise" as const,
      payload: {
        command: "tension.raise" as const,
        title: "A",
        description: "B",
        type: "PROBLEMATIC" as const,
        circleIds: ["circle-a"],
        handlingMode: "UNROUTED" as const,
      },
    };

    assert.deepEqual(await validator.validate({
      ...input,
      sourceBindings: [
        { objectType: "circle", objectId: "circle-a", sourceVersionAt: "active:true" },
      ],
    }), { ok: true });

    assert.deepEqual(await validator.validate({
      ...input,
      sourceBindings: [
        { objectType: "circle", objectId: "circle-b", sourceVersionAt: "active:true" },
      ],
    }), { ok: false, code: "STALE_PREVIEW" });
  });

  test("meeting preview ledger rejects SETUP lifecycle without creating a row", async () => {
    let creates = 0;

    await assert.rejects(
      createLedgerForMeetingLifecycle("SETUP", async () => {
        creates += 1;
        return "created";
      }),
      (error: unknown) => isAccessDenied(error),
    );
    assert.equal(creates, 0);
  });

  test("meeting preview ledger rejects a missing organization without creating a row", async () => {
    let creates = 0;

    await assert.rejects(
      createLedgerForMeetingLifecycle(undefined, async () => {
        creates += 1;
        return "created";
      }),
      (error: unknown) => isAccessDenied(error),
    );
    assert.equal(creates, 0);
  });

  test("meeting preview ledger creates the existing row for ACTIVE lifecycle", async () => {
    let creates = 0;
    const row = { id: "preview-a" };

    assert.equal(await createLedgerForMeetingLifecycle("ACTIVE", async () => {
      creates += 1;
      return row;
    }), row);
    assert.equal(creates, 1);
  });

	  test("only meeting preview creators use the Serializable lifecycle gate", () => {
    const tactical = exportedFunction("createTacticalOutcomePreview", "listTensionRaiseContext");
    const tension = exportedFunction("createTensionRaisePreview", "listRoleApplicationContext");
    const role = exportedFunction("createRoleApplicationPreview", "listGovernanceProposalContext");
    const governance = exportedFunction("createGovernanceProposalPreview", "createMeetingPreviewLedger");
    const transaction = source.slice(source.indexOf("async function createMeetingPreviewLedger"));

    assert.match(tactical, /createMeetingPreviewLedger\(actor\.organizationId/);
    assert.match(governance, /createMeetingPreviewLedger\(actorContext\.organizationId/);
    assert.match(transaction, /transaction\.organization\.findUnique/);
    assert.match(transaction, /createLedgerForMeetingLifecycle/);
    assert.match(transaction, /transaction\.brainCommandOperation\.create/);
    assert.match(transaction, /Prisma\.TransactionIsolationLevel\.Serializable/);

    for (const nonMeetingPreview of [tension, role]) {
      assert.doesNotMatch(nonMeetingPreview, /createMeetingPreviewLedger|createLedgerForMeetingLifecycle/);
      assert.match(nonMeetingPreview, /prisma\.brainCommandOperation\.create/);
    }
	  });

	  test("governance proposal previews bind fresh tension versions and exact meeting participants", () => {
	    const governance = exportedFunction("createGovernanceProposalPreview", "createMeetingPreviewLedger");

	    assert.match(governance, /select:\s*\{\s*id:\s*true,\s*updatedAt:\s*true\s*\}/);
	    assert.match(governance, /sourceVersionAt:\s*tension\.updatedAt\.toISOString\(\)/);
	    assert.match(governance, /participants:\s*\{\s*some:\s*\{\s*id:\s*actorContext\.personId,\s*organizationId:\s*actorContext\.organizationId\s*\}/);
	  });
	});

function isAccessDenied(error: unknown): boolean {
  return error instanceof Error
    && error.name === "BrainCommandPreviewServiceError"
    && "code" in error
    && error.code === "ACCESS_DENIED";
}

function exportedFunction(name: string, nextName: string): string {
  const start = source.indexOf(`export async function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

function summaryBlock(): string {
  const typeSource = readFileSync(new URL("./command-preview-types.ts", import.meta.url), "utf8");
  const match = typeSource.match(/export type BrainCommandPreviewSummary[\s\S]*?^}>;/m);
  assert.ok(match);
  return match[0];
}
