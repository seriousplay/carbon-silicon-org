import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";

const readIfPresent = (url: URL) => (existsSync(url) ? readFileSync(url, "utf8") : "");

const schema = readIfPresent(new URL("../../../prisma/schema.prisma", import.meta.url));
const migration = readIfPresent(
  new URL(
    "../../../prisma/migrations/20260715180000_v5_m3_c_brain_command_ledger/migration.sql",
    import.meta.url,
  ),
);
const rollback = readIfPresent(
  new URL(
    "../../../prisma/migrations/20260715180000_v5_m3_c_brain_command_ledger/rollback.sql",
    import.meta.url,
  ),
);

function schemaBlock(kind: "enum" | "model", name: string): string {
  return schema.match(new RegExp(`${kind} ${name} \\{[\\s\\S]*?^\\}`, "m"))?.[0] ?? "";
}

describe("V5-M3-C Brain command ledger contract", () => {
  test("adds one closed status enum and one owner-private command ledger model", () => {
    const status = schemaBlock("enum", "BrainCommandOperationStatus");
    const model = schemaBlock("model", "BrainCommandOperation");

    assert.match(status, /\bPREVIEWED\b/);
    assert.match(status, /\bSUCCEEDED\b/);
    assert.match(status, /\bREJECTED\b/);
    assert.match(status, /\bEXPIRED\b/);
    assert.match(model, /ownerUserId\s+String/);
    assert.match(model, /ownerMembership\s+Membership/);
    assert.match(model, /actorId\s+String/);
    assert.match(model, /conversationId\s+String/);
    assert.match(model, /userMessageId\s+String/);
    assert.match(model, /commandName\s+String/);
    assert.match(model, /serverPayload\s+Json/);
    assert.match(model, /payloadHash\s+String\s+@db\.Char\(64\)/);
    assert.match(model, /sourceBindings\s+Json/);
    assert.match(model, /sourceBindingHash\s+String\s+@db\.Char\(64\)/);
    assert.match(model, /humanDiff\s+Json/);
    assert.match(model, /previewExpiresAt\s+DateTime/);
    assert.match(model, /@@unique\(\[organizationId, mutationKey\]\)/);
    assert.match(model, /@@index\(\[organizationId, status, previewExpiresAt\]\)/);
    assert.match(model, /@@map\("brain_command_operations"\)/);
  });

  test("migration creates only the ledger table and enforces closed command lifecycle constraints", () => {
    assert.deepEqual(
      Array.from(migration.matchAll(/CREATE TYPE "[^"]+"/g), (match) => match[0]),
      ['CREATE TYPE "BrainCommandOperationStatus"'],
    );
    assert.deepEqual(
      Array.from(migration.matchAll(/CREATE TABLE "[^"]+"/g), (match) => match[0]),
      ['CREATE TABLE "brain_command_operations"'],
    );
    for (const command of [
      "goal_proposal.create_draft",
      "goal_proposal.append_returned_revision",
      "goal_check_in.append",
      "tension.raise",
      "tactical_outcome.submit_proposal",
      "meeting_notes.update",
    ]) {
      assert.match(migration, new RegExp(command.replace(/[.]/g, "\\.")));
    }
    assert.match(migration, /"commandSchemaVersion" = 1/);
    assert.match(migration, /"payloadHash" ~ '\^\[0-9a-f\]\{64\}\$'/);
    assert.match(migration, /"sourceBindingHash" ~ '\^\[0-9a-f\]\{64\}\$'/);
    assert.match(migration, /"mutationKey" IS NULL OR btrim\("mutationKey"\) <> ''/);
    assert.match(migration, /"previewExpiresAt" = "createdAt" \+ INTERVAL '15 minutes'/);
    assert.match(migration, /"status" = 'PREVIEWED'[\s\S]*"mutationKey" IS NULL/);
    assert.match(migration, /"status" = 'SUCCEEDED'[\s\S]*"mutationKey" IS NOT NULL/);
    assert.match(migration, /"status" = 'SUCCEEDED'[\s\S]*"terminalCode" = 'SUCCEEDED'/);
    assert.match(migration, /"status" = 'REJECTED'[\s\S]*"terminalCode" IS NOT NULL/);
    assert.match(migration, /"status" = 'EXPIRED'[\s\S]*"mutationKey" IS NULL/);
    assert.match(migration, /"status" = 'EXPIRED'[\s\S]*"terminalCode" = 'PREVIEW_EXPIRED'/);
    assert.match(migration, /"status" = 'EXPIRED'[\s\S]*"terminalResult" IS NOT NULL/);
    assert.match(migration, /"status" = 'EXPIRED'[\s\S]*"confirmedAt" IS NULL/);
    assert.match(migration, /FOREIGN KEY \("ownerUserId", "organizationId"\) REFERENCES "memberships"\("userId", "organizationId"\)/);
  });

  test("migration keeps ledger out of the Brain reader and locks preview bindings after insert", () => {
    assert.doesNotMatch(migration, /loopos_brain_reader[\s\S]*brain_command_operations/i);
    assert.match(migration, /REVOKE ALL ON TABLE "brain_command_operations" FROM PUBLIC/);
    assert.match(migration, /CREATE FUNCTION brain_command_operations_prevent_preview_mutation/);
    for (const column of [
      "serverPayload",
      "payloadHash",
      "sourceBindings",
      "sourceBindingHash",
      "humanDiff",
      "previewExpiresAt",
      "createdAt",
    ]) {
      assert.match(migration, new RegExp(`OLD\\."${column}" IS DISTINCT FROM NEW\\."${column}"`));
    }
    assert.doesNotMatch(migration, /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW/i);
    assert.doesNotMatch(migration, /GRANT\s+SELECT/i);
  });

  test("rollback refuses to delete non-empty ledger history and drops only M3-C objects", () => {
    assert.match(rollback, /IF EXISTS \(SELECT 1 FROM "brain_command_operations" LIMIT 1\)/);
    assert.match(rollback, /RAISE EXCEPTION/);
    assert.match(rollback, /DROP TRIGGER brain_command_operations_prevent_preview_mutation/);
    assert.match(rollback, /DROP FUNCTION brain_command_operations_prevent_preview_mutation\(\)/);
    assert.match(rollback, /DROP TABLE "brain_command_operations"/);
    assert.match(rollback, /DROP TYPE "BrainCommandOperationStatus"/);
    assert.doesNotMatch(rollback, /goal_|tactical_|governance_|meetings|tensions/);
  });
});
