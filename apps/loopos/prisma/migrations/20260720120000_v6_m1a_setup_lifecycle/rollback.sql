DROP TRIGGER "organization_activation_snapshots_append_only" ON "organization_activation_snapshots";
DROP TRIGGER "organization_setup_events_append_only" ON "organization_setup_events";
DROP FUNCTION v6_m1a_reject_evidence_mutation();

DROP TRIGGER "organizations_lifecycle_update_guard" ON "organizations";
DROP FUNCTION v6_m1a_guard_organization_lifecycle_update();
DROP TRIGGER "organizations_lifecycle_insert_guard" ON "organizations";
DROP FUNCTION v6_m1a_guard_organization_lifecycle_insert();

DROP TABLE "organization_activation_snapshots";
DROP TABLE "organization_setup_events";

ALTER TABLE "organizations" DROP CONSTRAINT "organizations_lifecycle_state_check";
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_activation_actor_organization_check";
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_activatedById_activatedByOrganizationId_fkey";
ALTER TABLE "organizations"
  DROP COLUMN "activatedByOrganizationId",
  DROP COLUMN "activatedById",
  DROP COLUMN "activatedAt",
  DROP COLUMN "setupStartedAt",
  DROP COLUMN "lifecycleStatus",
  DROP COLUMN "purpose";

DROP TYPE "OrganizationSetupEventType";
DROP TYPE "OrganizationLifecycleStatus";
