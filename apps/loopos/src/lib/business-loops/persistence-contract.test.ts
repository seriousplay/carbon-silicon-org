import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL(
    "../../../prisma/migrations/20260720220000_v6_m3b_business_loop_persistence_skeleton/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const page = readFileSync(
  new URL("../../app/app/organization/business-loops/page.tsx", import.meta.url),
  "utf8",
);

const enums = {
  BusinessLoopStatus: ["DRAFT", "ACTIVE", "ARCHIVED"],
  BusinessLoopVersionStatus: ["DRAFT", "PUBLISHED", "SUPERSEDED"],
  BusinessLoopActivityType: ["WORK", "DECISION", "HANDOFF", "SIGNAL"],
  BusinessLoopEdgeType: ["VALUE", "DATA", "DECISION_SIGNAL", "EVIDENCE"],
  BusinessLoopEvidenceKind: [
    "CIRCLE",
    "ROLE",
    "CIRCLE_INTERFACE",
    "GOAL",
    "METRIC",
    "PROJECT",
    "ACTION",
    "TENSION",
    "MEETING",
    "EXTERNAL_NOTE",
  ],
} as const;

const models = [
  "BusinessLoop",
  "BusinessLoopVersion",
  "BusinessLoopActivity",
  "BusinessLoopEdge",
  "BusinessLoopEvidenceRef",
] as const;

const tables = [
  "business_loops",
  "business_loop_versions",
  "business_loop_activities",
  "business_loop_edges",
  "business_loop_evidence_refs",
] as const;

function captures(source: string, pattern: RegExp): string[] {
  return Array.from(source.matchAll(pattern), (match) => match[1]);
}

function schemaBlock(kind: "enum" | "model", name: string): string {
  return schema.match(new RegExp(`^${kind} ${name} \\{[\\s\\S]*?^\\}`, "m"))?.[0] ?? "";
}

function schemaEnumValues(name: string): string[] {
  return schemaBlock("enum", name)
    .split("\n")
    .slice(1, -1)
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/)[0]);
}

function compact(source: string): string {
  return source.replace(/\s+/g, " ").trim();
}

describe("V6-M3-B Business Loop persistence contract", () => {
  test("defines the accepted Business Loop enums and models", () => {
    assert.deepEqual(captures(schema, /^enum (BusinessLoop\w+) \{/gm), Object.keys(enums));
    for (const [name, values] of Object.entries(enums)) {
      assert.deepEqual(schemaEnumValues(name), values);
    }

    assert.deepEqual(captures(schema, /^model (BusinessLoop\w*) \{/gm), models);
  });

  test("keeps Business Loop persistence additive and separate from CircleInterface", () => {
    assert.deepEqual(captures(migration, /^CREATE TABLE "([^"]+)"/gm), tables);
    assert.deepEqual(captures(migration, /^CREATE TYPE "([^"]+)"/gm), Object.keys(enums));
    assert.doesNotMatch(migration, /^ALTER TABLE "(circles|circle_interfaces|role_defs)"/gm);
    assert.doesNotMatch(migration, /^(?:INSERT\s+INTO|UPDATE\s+"|DELETE\s+FROM|COPY\s+)/im);
    assert.doesNotMatch(migration, /\bRENAME\s+(?:TO|COLUMN)\b/i);
    assert.match(schemaBlock("model", "CircleInterface"), /@@map\("circle_interfaces"\)/);
  });

  test("uses tenant-scoped relations to organization, structure, roles, interfaces, versions, and evidence", () => {
    const source = compact(schema);
    for (const table of tables) {
      assert.match(migration, new RegExp(`CREATE TABLE "${table}"`));
    }

    assert.match(source, /model BusinessLoop \{.*@@unique\(\[id, organizationId\]\).*@@map\("business_loops"\)/);
    assert.match(source, /model BusinessLoopVersion \{.*@@unique\(\[businessLoopId, organizationId, version\]\).*@@map\("business_loop_versions"\)/);
    assert.match(source, /model BusinessLoopActivity \{.*circle\s+Circle\?.*references: \[id, organizationId\].*ownerRole\s+RoleDef\?.*references: \[id, organizationId\].*@@map\("business_loop_activities"\)/);
    assert.match(source, /model BusinessLoopEdge \{.*fromCircle\s+Circle\?.*references: \[id, organizationId\].*toCircle\s+Circle\?.*references: \[id, organizationId\].*interface\s+CircleInterface\?.*references: \[id, organizationId\].*@@map\("business_loop_edges"\)/);
    assert.match(source, /model BusinessLoopEvidenceRef \{.*kind\s+BusinessLoopEvidenceKind.*targetId\s+String.*@@index\(\[organizationId, kind, targetId\]\).*@@map\("business_loop_evidence_refs"\)/);
  });

  test("does not activate Business Loop writes, governance routing, candidate tensions, or BioCoach access", () => {
    assert.doesNotMatch(page, /<form|useActionState|createBusinessLoop|updateBusinessLoop|deleteBusinessLoop/);
    assert.doesNotMatch(`${schema}\n${migration}\n${page}`, /biocoach|bio_coach|candidate[_-]?tension|governance[_-]?impact/i);
  });
});
