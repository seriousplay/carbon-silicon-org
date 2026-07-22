import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL(
    "../../../prisma/migrations/20260720120000_v6_m1a_setup_lifecycle/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const rollback = readFileSync(
  new URL(
    "../../../prisma/migrations/20260720120000_v6_m1a_setup_lifecycle/rollback.sql",
    import.meta.url,
  ),
  "utf8",
);
const registrationActions = readFileSync(
  new URL("../../app/(auth)/actions.ts", import.meta.url),
  "utf8",
);

function block(kind: "enum" | "model", name: string): string {
  return schema.match(new RegExp(`^${kind} ${name} \\{[\\s\\S]*?^\\}`, "m"))?.[0] ?? "";
}

describe("V6-M1-A setup lifecycle persistence", () => {
  test("defines explicit SETUP and ACTIVE lifecycle fields", () => {
    assert.match(block("enum", "OrganizationLifecycleStatus"), /\bSETUP\b[\s\S]*\bACTIVE\b/);
    const organization = block("model", "Organization");
    assert.match(organization, /purpose\s+String\?/);
    assert.match(organization, /lifecycleStatus\s+OrganizationLifecycleStatus\s+@default\(SETUP\)/);
    assert.match(organization, /setupStartedAt\s+DateTime\s+@default\(now\(\)\)/);
    assert.match(organization, /activatedAt\s+DateTime\?/);
    assert.match(organization, /activatedById\s+String\?/);
    assert.match(organization, /activatedByOrganizationId\s+String\?/);
    assert.match(organization, /fields:\s*\[activatedById, activatedByOrganizationId\]/);
  });

  test("backfills existing organizations ACTIVE before defaulting new organizations SETUP", () => {
    const backfill = migration.indexOf('UPDATE "organizations"');
    const active = migration.indexOf('"lifecycleStatus" = \'ACTIVE\'', backfill);
    const setupDefault = migration.indexOf('ALTER COLUMN "lifecycleStatus" SET DEFAULT \'SETUP\'');

    assert.ok(backfill >= 0);
    assert.ok(active > backfill);
    assert.ok(setupDefault > active);
    assert.match(migration, /"setupStartedAt" = "createdAt"/);
    assert.match(migration, /"activatedAt" = "createdAt"/);
  });

  test("new registrations use the persisted SETUP default", () => {
    const organizationCreate = registrationActions.match(
      /tx\.organization\.create\(\{[\s\S]*?\n\s*\}\);/,
    )?.[0] ?? "";

    assert.match(organizationCreate, /data:\s*\{[\s\S]*name:\s*orgName,[\s\S]*slug,/);
    assert.doesNotMatch(organizationCreate, /lifecycleStatus\s*:\s*["']ACTIVE["']/);
    assert.match(block("model", "Organization"), /lifecycleStatus\s+OrganizationLifecycleStatus\s+@default\(SETUP\)/);
    assert.match(migration, /ALTER COLUMN "lifecycleStatus" SET DEFAULT 'SETUP'/);
    assert.match(migration, /CREATE TRIGGER "organizations_lifecycle_insert_guard"/);
    assert.match(migration, /BEFORE INSERT ON "organizations"/);
    assert.match(migration, /New organizations must start in SETUP/);
  });

  test("persists one immutable activation snapshot and append-only setup events", () => {
    assert.match(block("model", "OrganizationSetupEvent"), /payload\s+Json/);
    assert.match(block("model", "OrganizationActivationSnapshot"), /organizationId\s+String\s+@unique/);
    for (const field of ["readiness", "organizationSnapshot", "checksum", "actorPersonId", "activatedAt"]) {
      assert.match(block("model", "OrganizationActivationSnapshot"), new RegExp(`\\b${field}\\s+`));
    }

    assert.match(migration, /CREATE TRIGGER "organization_setup_events_append_only"/);
    assert.match(migration, /CREATE TRIGGER "organization_activation_snapshots_append_only"/);
    assert.match(migration, /BEFORE UPDATE OR DELETE ON "organization_setup_events"/);
    assert.match(migration, /BEFORE UPDATE OR DELETE ON "organization_activation_snapshots"/);
  });

  test("prevents lifecycle reversal and removes every lifecycle artifact on rollback", () => {
    assert.match(migration, /OLD\."lifecycleStatus" = 'ACTIVE'/);
    assert.match(migration, /Organization activation is irreversible/);
    assert.match(migration, /Activation timestamp and actor are required/);
    for (const artifact of [
      'DROP TRIGGER "organization_activation_snapshots_append_only"',
      'DROP TRIGGER "organization_setup_events_append_only"',
      "DROP FUNCTION v6_m1a_reject_evidence_mutation()",
      'DROP TRIGGER "organizations_lifecycle_update_guard"',
      "DROP FUNCTION v6_m1a_guard_organization_lifecycle_update()",
      'DROP TRIGGER "organizations_lifecycle_insert_guard"',
      "DROP FUNCTION v6_m1a_guard_organization_lifecycle_insert()",
      'DROP TABLE "organization_activation_snapshots"',
      'DROP TABLE "organization_setup_events"',
      'DROP CONSTRAINT "organizations_lifecycle_state_check"',
      'DROP CONSTRAINT "organizations_activation_actor_organization_check"',
      'DROP CONSTRAINT "organizations_activatedById_activatedByOrganizationId_fkey"',
      'DROP COLUMN "activatedByOrganizationId"',
      'DROP COLUMN "activatedById"',
      'DROP COLUMN "activatedAt"',
      'DROP COLUMN "setupStartedAt"',
      'DROP COLUMN "lifecycleStatus"',
      'DROP COLUMN "purpose"',
      'DROP TYPE "OrganizationSetupEventType"',
      'DROP TYPE "OrganizationLifecycleStatus"',
    ]) {
      assert.match(rollback, new RegExp(artifact.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), artifact);
    }
  });
});
