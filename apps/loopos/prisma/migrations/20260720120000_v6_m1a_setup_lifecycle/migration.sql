-- CreateEnum
CREATE TYPE "OrganizationLifecycleStatus" AS ENUM ('SETUP', 'ACTIVE');
CREATE TYPE "OrganizationSetupEventType" AS ENUM ('SETUP_STARTED', 'SETUP_CHANGED', 'ACTIVATED');

-- Add explicit lifecycle state. Existing organizations are backfilled before
-- the SETUP default is installed for future registrations.
ALTER TABLE "organizations"
  ADD COLUMN "purpose" TEXT,
  ADD COLUMN "lifecycleStatus" "OrganizationLifecycleStatus",
  ADD COLUMN "setupStartedAt" TIMESTAMP(3),
  ADD COLUMN "activatedAt" TIMESTAMP(3),
  ADD COLUMN "activatedById" TEXT,
  ADD COLUMN "activatedByOrganizationId" TEXT;

UPDATE "organizations"
SET
  "lifecycleStatus" = 'ACTIVE',
  "setupStartedAt" = "createdAt",
  "activatedAt" = "createdAt";

ALTER TABLE "organizations"
  ALTER COLUMN "lifecycleStatus" SET DEFAULT 'SETUP',
  ALTER COLUMN "lifecycleStatus" SET NOT NULL,
  ALTER COLUMN "setupStartedAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "setupStartedAt" SET NOT NULL;

ALTER TABLE "organizations"
  ADD CONSTRAINT "organizations_lifecycle_state_check" CHECK (
    (
      "lifecycleStatus" = 'SETUP'
      AND "activatedAt" IS NULL
      AND "activatedById" IS NULL
      AND "activatedByOrganizationId" IS NULL
    )
    OR (
      "lifecycleStatus" = 'ACTIVE'
      AND "activatedAt" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "organizations_activation_actor_organization_check" CHECK (
    "activatedByOrganizationId" IS NULL OR "activatedByOrganizationId" = "id"
  );

-- CreateTable
CREATE TABLE "organization_setup_events" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "type" "OrganizationSetupEventType" NOT NULL,
  "actorPersonId" TEXT,
  "payload" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "organization_setup_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organization_activation_snapshots" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorPersonId" TEXT NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "readiness" JSONB NOT NULL,
  "organizationSnapshot" JSONB NOT NULL,
  "checksum" TEXT NOT NULL,
  "activatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "organization_activation_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_activation_snapshots_schema_version_check" CHECK ("schemaVersion" > 0),
  CONSTRAINT "organization_activation_snapshots_checksum_check" CHECK (btrim("checksum") <> '')
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_setup_events_id_organizationId_key"
  ON "organization_setup_events"("id", "organizationId");
CREATE INDEX "organization_setup_events_organizationId_occurredAt_id_idx"
  ON "organization_setup_events"("organizationId", "occurredAt", "id");
CREATE UNIQUE INDEX "organization_activation_snapshots_organizationId_key"
  ON "organization_activation_snapshots"("organizationId");
CREATE UNIQUE INDEX "organization_activation_snapshots_id_organizationId_key"
  ON "organization_activation_snapshots"("id", "organizationId");
CREATE INDEX "organization_activation_snapshots_organizationId_activatedAt_idx"
  ON "organization_activation_snapshots"("organizationId", "activatedAt");

-- AddForeignKey
ALTER TABLE "organizations"
  ADD CONSTRAINT "organizations_activatedById_activatedByOrganizationId_fkey"
  FOREIGN KEY ("activatedById", "activatedByOrganizationId") REFERENCES "people"("id", "organizationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "organization_setup_events"
  ADD CONSTRAINT "organization_setup_events_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "organization_setup_events"
  ADD CONSTRAINT "organization_setup_events_actorPersonId_organizationId_fkey"
  FOREIGN KEY ("actorPersonId", "organizationId") REFERENCES "people"("id", "organizationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "organization_activation_snapshots"
  ADD CONSTRAINT "organization_activation_snapshots_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "organization_activation_snapshots"
  ADD CONSTRAINT "organization_activation_snapshots_actorPersonId_organizationId_fkey"
  FOREIGN KEY ("actorPersonId", "organizationId") REFERENCES "people"("id", "organizationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Historical organizations were backfilled above. Every organization created
-- after this migration must enter through SETUP, including direct SQL writes.
CREATE FUNCTION v6_m1a_guard_organization_lifecycle_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW."lifecycleStatus" <> 'SETUP'
    OR NEW."activatedAt" IS NOT NULL
    OR NEW."activatedById" IS NOT NULL
    OR NEW."activatedByOrganizationId" IS NOT NULL
  THEN
    RAISE EXCEPTION 'New organizations must start in SETUP' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER "organizations_lifecycle_insert_guard"
BEFORE INSERT ON "organizations"
FOR EACH ROW EXECUTE FUNCTION v6_m1a_guard_organization_lifecycle_insert();

-- Lifecycle can advance once and activation identity is immutable afterwards.
CREATE FUNCTION v6_m1a_guard_organization_lifecycle_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW."setupStartedAt" IS DISTINCT FROM OLD."setupStartedAt" THEN
    RAISE EXCEPTION 'Organization setup start is immutable' USING ERRCODE = '55000';
  END IF;

  IF OLD."lifecycleStatus" = 'ACTIVE' AND (
    NEW."lifecycleStatus" IS DISTINCT FROM OLD."lifecycleStatus"
    OR NEW."activatedAt" IS DISTINCT FROM OLD."activatedAt"
    OR NEW."activatedById" IS DISTINCT FROM OLD."activatedById"
    OR NEW."activatedByOrganizationId" IS DISTINCT FROM OLD."activatedByOrganizationId"
  ) THEN
    RAISE EXCEPTION 'Organization activation is irreversible' USING ERRCODE = '55000';
  END IF;

  IF OLD."lifecycleStatus" = 'SETUP' AND NEW."lifecycleStatus" = 'ACTIVE' AND (
    NEW."activatedAt" IS NULL
    OR NEW."activatedById" IS NULL
    OR NEW."activatedByOrganizationId" IS NULL
  ) THEN
    RAISE EXCEPTION 'Activation timestamp and actor are required' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER "organizations_lifecycle_update_guard"
BEFORE UPDATE ON "organizations"
FOR EACH ROW EXECUTE FUNCTION v6_m1a_guard_organization_lifecycle_update();

-- Setup events and activation snapshots are evidence ledgers, not mutable state.
CREATE FUNCTION v6_m1a_reject_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION '% rows are append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$function$;

CREATE TRIGGER "organization_setup_events_append_only"
BEFORE UPDATE OR DELETE ON "organization_setup_events"
FOR EACH ROW EXECUTE FUNCTION v6_m1a_reject_evidence_mutation();

CREATE TRIGGER "organization_activation_snapshots_append_only"
BEFORE UPDATE OR DELETE ON "organization_activation_snapshots"
FOR EACH ROW EXECUTE FUNCTION v6_m1a_reject_evidence_mutation();
