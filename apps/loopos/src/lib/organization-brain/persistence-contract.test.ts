import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";

const readIfPresent = (url: URL) => (existsSync(url) ? readFileSync(url, "utf8") : "");

const schema = readIfPresent(new URL("../../../prisma/schema.prisma", import.meta.url));
const migration = readIfPresent(
  new URL(
    "../../../prisma/migrations/20260714074405_v5_m1_b1_brain_persistence/migration.sql",
    import.meta.url,
  ),
);
const rollback = readIfPresent(
  new URL(
    "../../../prisma/migrations/20260714074405_v5_m1_b1_brain_persistence/rollback.sql",
    import.meta.url,
  ),
);

function schemaBlock(kind: "enum" | "model", name: string): string {
  return schema.match(new RegExp(`${kind} ${name} \\{[\\s\\S]*?^\\}`, "m"))?.[0] ?? "";
}

function matches(source: string, pattern: RegExp): string[] {
  return Array.from(source.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`)), (match) => match[0]);
}

describe("V5-M1-B1 Organization Brain persistence contract", () => {
  test("defines one configurable profile per organization without control bypasses", () => {
    const profile = schemaBlock("model", "OrganizationBrainProfile");

    assert.match(profile, /organizationId\s+String\s+@unique/);
    assert.match(profile, /name\s+String/);
    assert.match(profile, /avatarUrl\s+String\?/);
    assert.match(profile, /tonePreferences\s+Json/);
    assert.match(profile, /terminologyPreferences\s+Json/);
    assert.match(profile, /enabledCapabilities\s+String\[\]/);
    assert.match(profile, /createdAt\s+DateTime\s+@default\(now\(\)\)/);
    assert.match(profile, /updatedAt\s+DateTime\s+@updatedAt/);
    assert.doesNotMatch(profile, /(bypass|disable).*(permission|provenance|audit)/i);
  });

  test("pins private conversations to an owner in the same organization", () => {
    const conversation = schemaBlock("model", "BrainConversation");

    assert.match(conversation, /ownerId\s+String/);
    assert.match(conversation, /title\s+String\?/);
    assert.match(
      conversation,
      /owner\s+Person\s+@relation\([^\n]*fields: \[ownerId, organizationId\], references: \[id, organizationId\], onDelete: Restrict\)/,
    );
    assert.match(conversation, /@@unique\(\[id, organizationId\]\)/);
    assert.match(conversation, /@@index\(\[organizationId, ownerId, updatedAt\]\)/);
  });

  test("stores USER and BRAIN messages under a tenant-safe conversation", () => {
    const role = schemaBlock("enum", "BrainMessageRole");
    const message = schemaBlock("model", "BrainMessage");

    assert.match(role, /\bUSER\b/);
    assert.match(role, /\bBRAIN\b/);
    assert.match(message, /role\s+BrainMessageRole/);
    assert.match(message, /content\s+String/);
    assert.match(
      message,
      /conversation\s+BrainConversation\s+@relation\([^\n]*fields: \[conversationId, organizationId\], references: \[id, organizationId\], onDelete: Cascade\)/,
    );
    assert.match(message, /@@unique\(\[id, conversationId, organizationId\]\)/);
    assert.match(message, /@@index\(\[organizationId, conversationId, createdAt\]\)/);
  });

  test("records bounded query audit data with tenant-safe actor and response links", () => {
    const status = schemaBlock("enum", "BrainQueryAuditStatus");
    const audit = schemaBlock("model", "BrainQueryAudit");

    assert.match(status, /\bSUCCEEDED\b/);
    assert.match(status, /\bREJECTED\b/);
    assert.match(status, /\bFAILED\b/);
    for (const field of ["purpose", "scope", "resultCount", "status", "errorCode"]) {
      assert.match(audit, new RegExp(`\\b${field}\\s+`));
    }
    assert.match(
      audit,
      /actor\s+Person\s+@relation\([^\n]*fields: \[actorId, organizationId\], references: \[id, organizationId\], onDelete: Restrict\)/,
    );
    assert.match(
      audit,
      /conversation\s+BrainConversation\?\s+@relation\([^\n]*fields: \[conversationId, organizationId\], references: \[id, organizationId\], onDelete: Restrict\)/,
    );
    assert.match(
      audit,
      /message\s+BrainMessage\?\s+@relation\([^\n]*fields: \[messageId, conversationId, organizationId\], references: \[id, conversationId, organizationId\], onDelete: Restrict\)/,
    );
    assert.doesNotMatch(audit, /(password|credential|secret|token|rawError)/i);
  });

  test("migration creates only the four B1 tables and their bounded enums", () => {
    assert.deepEqual(
      matches(migration, /CREATE TABLE "[^"]+"/).sort(),
      [
        'CREATE TABLE "brain_conversations"',
        'CREATE TABLE "brain_messages"',
        'CREATE TABLE "brain_query_audits"',
        'CREATE TABLE "organization_brain_profiles"',
      ],
    );
    assert.deepEqual(
      matches(migration, /CREATE TYPE "[^"]+"/).sort(),
      ['CREATE TYPE "BrainMessageRole"', 'CREATE TYPE "BrainQueryAuditStatus"'],
    );
    assert.doesNotMatch(migration, /CREATE (ROLE|POLICY|VIEW)|ROW LEVEL SECURITY|GRANT |REVOKE /i);
    assert.match(migration, /brain_query_audits_result_count_check/);
    assert.match(migration, /CHECK \("resultCount" >= 0\)/);
    assert.match(migration, /brain_query_audits_message_conversation_check/);
    assert.match(migration, /CHECK \("messageId" IS NULL OR "conversationId" IS NOT NULL\)/);
  });

  test("migration and rollback preserve tenant integrity in reversible order", () => {
    assert.match(
      migration,
      /FOREIGN KEY \("ownerId", "organizationId"\) REFERENCES "people"\("id", "organizationId"\) ON DELETE RESTRICT/,
    );
    assert.match(
      migration,
      /FOREIGN KEY \("conversationId", "organizationId"\) REFERENCES "brain_conversations"\("id", "organizationId"\) ON DELETE CASCADE/,
    );
    assert.match(
      migration,
      /FOREIGN KEY \("messageId", "conversationId", "organizationId"\) REFERENCES "brain_messages"\("id", "conversationId", "organizationId"\) ON DELETE RESTRICT/,
    );
    assert.match(
      rollback,
      /DROP TABLE "brain_query_audits";[\s\S]*DROP TABLE "brain_messages";[\s\S]*DROP TABLE "brain_conversations";[\s\S]*DROP TABLE "organization_brain_profiles";/,
    );
    assert.match(
      rollback,
      /DROP TYPE "BrainQueryAuditStatus";[\s\S]*DROP TYPE "BrainMessageRole";/,
    );
    assert.deepEqual(matches(rollback, /DROP TABLE "[^"]+"/), [
      'DROP TABLE "brain_query_audits"',
      'DROP TABLE "brain_messages"',
      'DROP TABLE "brain_conversations"',
      'DROP TABLE "organization_brain_profiles"',
    ]);
  });
});
