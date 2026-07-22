BEGIN;

CREATE TYPE "BrainArtifactStatus" AS ENUM (
  'DRAFT',
  'READY',
  'EXECUTING',
  'SUCCEEDED',
  'FAILED'
);

CREATE TYPE "BrainArtifactAuditEventType" AS ENUM (
  'CREATED',
  'READY',
  'EXECUTION_STARTED',
  'SUCCEEDED',
  'FAILED'
);

CREATE UNIQUE INDEX "brain_command_operations_id_organization_key"
  ON "brain_command_operations"("id", "organizationId");

CREATE UNIQUE INDEX "brain_conversations_id_organization_owner_key"
  ON "brain_conversations"("id", "organizationId", "ownerId");

CREATE FUNCTION brain_artifact_source_refs_valid(source_refs JSONB, artifact_organization_id TEXT, artifact_owner_person_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_typeof(source_refs) = 'array'
    AND jsonb_array_length(source_refs) > 0
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(source_refs) AS source
      WHERE source->>'organizationId' IS DISTINCT FROM artifact_organization_id
        OR (source->>'ownerPersonId' IS NOT NULL AND source->>'ownerPersonId' IS DISTINCT FROM artifact_owner_person_id)
    );
$$;

CREATE TABLE "brain_artifacts" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "ownerPersonId" TEXT NOT NULL,
  "conversationId" TEXT,
  "sourceMessageId" TEXT,
  "linkedCommandOperationId" TEXT,
  "supersedesArtifactId" TEXT,
  "artifactType" TEXT NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "payload" JSONB NOT NULL,
  "sourceRefs" JSONB NOT NULL,
  "status" "BrainArtifactStatus" NOT NULL DEFAULT 'DRAFT',
  "expiresAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "terminalResult" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "readyAt" TIMESTAMP(3),
  "executionStartedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "brain_artifacts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "brain_artifacts_id_organization_key" UNIQUE ("id", "organizationId"),
  CONSTRAINT "brain_artifacts_id_organization_owner_key" UNIQUE ("id", "organizationId", "ownerPersonId"),
  CONSTRAINT "brain_artifacts_input_check" CHECK (
    "artifactType" = 'TENSION_DRAFT'
    AND "schemaVersion" = 1
    AND jsonb_typeof("payload") = 'object'
    AND jsonb_typeof("payload"->'title') = 'string'
    AND btrim("payload"->>'title') <> ''
    AND brain_artifact_source_refs_valid("sourceRefs", "organizationId", "ownerPersonId")
    AND ("expiresAt" IS NULL OR "expiresAt" > "createdAt")
    AND ("readyAt" IS NULL OR "readyAt" >= "createdAt")
    AND ("executionStartedAt" IS NULL OR ("readyAt" IS NOT NULL AND "executionStartedAt" >= "readyAt"))
    AND ("completedAt" IS NULL OR ("executionStartedAt" IS NOT NULL AND "completedAt" >= "executionStartedAt"))
  ),
  CONSTRAINT "brain_artifacts_lifecycle_check" CHECK (
    ("status" = 'DRAFT' AND "readyAt" IS NULL AND "executionStartedAt" IS NULL AND "completedAt" IS NULL AND "failureCode" IS NULL AND "terminalResult" IS NULL)
    OR ("status" = 'READY' AND "readyAt" IS NOT NULL AND "executionStartedAt" IS NULL AND "completedAt" IS NULL AND "failureCode" IS NULL AND "terminalResult" IS NULL)
    OR ("status" = 'EXECUTING' AND "readyAt" IS NOT NULL AND "executionStartedAt" IS NOT NULL AND "completedAt" IS NULL AND "failureCode" IS NULL AND "terminalResult" IS NULL)
    OR ("status" = 'SUCCEEDED' AND "readyAt" IS NOT NULL AND "executionStartedAt" IS NOT NULL AND "completedAt" IS NOT NULL AND "failureCode" IS NULL AND "terminalResult" IS NOT NULL)
    OR ("status" = 'FAILED' AND "readyAt" IS NOT NULL AND "executionStartedAt" IS NOT NULL AND "completedAt" IS NOT NULL AND "failureCode" IS NOT NULL AND "terminalResult" IS NULL)
  ),
  CONSTRAINT "brain_artifacts_organization_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "brain_artifacts_owner_fkey"
    FOREIGN KEY ("ownerPersonId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "brain_artifacts_conversation_fkey"
    FOREIGN KEY ("conversationId", "organizationId") REFERENCES "brain_conversations"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "brain_artifacts_owner_conversation_fkey"
    FOREIGN KEY ("conversationId", "organizationId", "ownerPersonId") REFERENCES "brain_conversations"("id", "organizationId", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "brain_artifacts_source_message_fkey"
    FOREIGN KEY ("sourceMessageId", "conversationId", "organizationId") REFERENCES "brain_messages"("id", "conversationId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "brain_artifacts_command_operation_fkey"
    FOREIGN KEY ("linkedCommandOperationId", "organizationId") REFERENCES "brain_command_operations"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "brain_artifacts_supersedes_fkey"
    FOREIGN KEY ("supersedesArtifactId", "organizationId", "ownerPersonId") REFERENCES "brain_artifacts"("id", "organizationId", "ownerPersonId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "brain_artifacts_owner_status_updated_idx"
  ON "brain_artifacts"("organizationId", "ownerPersonId", "status", "updatedAt");
CREATE INDEX "brain_artifacts_conversation_created_idx"
  ON "brain_artifacts"("organizationId", "conversationId", "createdAt");
CREATE INDEX "brain_artifacts_command_operation_idx"
  ON "brain_artifacts"("organizationId", "linkedCommandOperationId");

CREATE FUNCTION brain_artifacts_enforce_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'DRAFT' THEN
      RAISE EXCEPTION 'brain artifacts must be inserted as DRAFT';
    END IF;
    RETURN NEW;
  END IF;
  IF (OLD."status", NEW."status") NOT IN (
    ('DRAFT', 'READY'),
    ('READY', 'EXECUTING'),
    ('EXECUTING', 'SUCCEEDED'),
    ('EXECUTING', 'FAILED')
  ) THEN
    RAISE EXCEPTION 'invalid brain artifact status transition';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER brain_artifacts_enforce_transition
BEFORE INSERT OR UPDATE OF "status" ON "brain_artifacts"
FOR EACH ROW EXECUTE FUNCTION brain_artifacts_enforce_transition();

CREATE FUNCTION brain_artifacts_prevent_terminal_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" IN ('SUCCEEDED', 'FAILED') THEN
      RAISE EXCEPTION 'terminal brain artifact rows are immutable';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD."status" IN ('SUCCEEDED', 'FAILED') THEN
    IF OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
      OR OLD."ownerPersonId" IS DISTINCT FROM NEW."ownerPersonId"
      OR OLD."conversationId" IS DISTINCT FROM NEW."conversationId"
      OR OLD."sourceMessageId" IS DISTINCT FROM NEW."sourceMessageId"
      OR OLD."linkedCommandOperationId" IS DISTINCT FROM NEW."linkedCommandOperationId"
      OR OLD."supersedesArtifactId" IS DISTINCT FROM NEW."supersedesArtifactId"
      OR OLD."artifactType" IS DISTINCT FROM NEW."artifactType"
      OR OLD."schemaVersion" IS DISTINCT FROM NEW."schemaVersion"
      OR OLD."payload" IS DISTINCT FROM NEW."payload"
      OR OLD."sourceRefs" IS DISTINCT FROM NEW."sourceRefs"
      OR OLD."status" IS DISTINCT FROM NEW."status"
      OR OLD."expiresAt" IS DISTINCT FROM NEW."expiresAt"
      OR OLD."failureCode" IS DISTINCT FROM NEW."failureCode"
      OR OLD."terminalResult" IS DISTINCT FROM NEW."terminalResult"
      OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt"
      OR OLD."readyAt" IS DISTINCT FROM NEW."readyAt"
      OR OLD."executionStartedAt" IS DISTINCT FROM NEW."executionStartedAt"
      OR OLD."completedAt" IS DISTINCT FROM NEW."completedAt"
      OR OLD."updatedAt" IS DISTINCT FROM NEW."updatedAt"
    THEN
      RAISE EXCEPTION 'terminal brain artifact rows are immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER brain_artifacts_prevent_terminal_mutation
BEFORE UPDATE OR DELETE ON "brain_artifacts"
FOR EACH ROW EXECUTE FUNCTION brain_artifacts_prevent_terminal_mutation();

CREATE TABLE "brain_artifact_audit_events" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "artifactId" TEXT NOT NULL,
  "type" "BrainArtifactAuditEventType" NOT NULL,
  "actor" JSONB NOT NULL,
  "actorPersonId" TEXT NOT NULL,
  "reason" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "brain_artifact_audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "brain_artifact_audit_events_actor_check" CHECK (
    jsonb_typeof("actor") = 'object'
    AND "actor"->>'type' = 'person'
    AND "actor"->>'id' = "actorPersonId"
  ),
  CONSTRAINT "brain_artifact_audit_events_organization_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "brain_artifact_audit_events_actor_fkey"
    FOREIGN KEY ("actorPersonId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "brain_artifact_audit_events_artifact_fkey"
    FOREIGN KEY ("artifactId", "organizationId") REFERENCES "brain_artifacts"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "brain_artifact_audit_events_artifact_occurred_idx"
  ON "brain_artifact_audit_events"("organizationId", "artifactId", "occurredAt");

CREATE FUNCTION brain_artifact_audit_events_prevent_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'brain artifact audit event rows are immutable';
END;
$$;

CREATE TRIGGER brain_artifact_audit_events_prevent_mutation
BEFORE UPDATE OR DELETE ON "brain_artifact_audit_events"
FOR EACH ROW EXECUTE FUNCTION brain_artifact_audit_events_prevent_mutation();

REVOKE ALL ON TABLE "brain_artifact_audit_events" FROM PUBLIC;

REVOKE ALL ON TABLE "brain_artifacts" FROM PUBLIC;

COMMIT;
