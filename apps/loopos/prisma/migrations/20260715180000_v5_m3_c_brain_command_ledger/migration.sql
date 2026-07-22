BEGIN;

CREATE TYPE "BrainCommandOperationStatus" AS ENUM (
  'PREVIEWED',
  'SUCCEEDED',
  'REJECTED',
  'EXPIRED'
);

CREATE TABLE "brain_command_operations" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "userMessageId" TEXT NOT NULL,
  "commandName" TEXT NOT NULL,
  "commandSchemaVersion" INTEGER NOT NULL DEFAULT 1,
  "serverPayload" JSONB NOT NULL,
  "payloadHash" CHAR(64) NOT NULL,
  "sourceBindings" JSONB NOT NULL,
  "sourceBindingHash" CHAR(64) NOT NULL,
  "humanDiff" JSONB NOT NULL,
  "previewExpiresAt" TIMESTAMP(3) NOT NULL,
  "mutationKey" TEXT,
  "status" "BrainCommandOperationStatus" NOT NULL DEFAULT 'PREVIEWED',
  "terminalCode" TEXT,
  "terminalResult" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "brain_command_operations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "brain_command_operations_command_check" CHECK (
    "commandName" IN (
      'goal_proposal.create_draft',
      'goal_proposal.append_returned_revision',
      'goal_check_in.append',
      'tension.raise',
      'tactical_outcome.submit_proposal',
      'meeting_notes.update'
    )
  ),
  CONSTRAINT "brain_command_operations_schema_version_check" CHECK (
    "commandSchemaVersion" = 1
  ),
  CONSTRAINT "brain_command_operations_payload_hash_check" CHECK (
    "payloadHash" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "brain_command_operations_source_bindings_hash_check" CHECK (
    "sourceBindingHash" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "brain_command_operations_mutation_key_check" CHECK (
    "mutationKey" IS NULL OR btrim("mutationKey") <> ''
  ),
  CONSTRAINT "brain_command_operations_expiry_check" CHECK (
    "previewExpiresAt" = "createdAt" + INTERVAL '15 minutes'
  ),
  CONSTRAINT "brain_command_operations_lifecycle_check" CHECK (
    (
      "status" = 'PREVIEWED'
      AND "mutationKey" IS NULL
      AND "terminalCode" IS NULL
      AND "terminalResult" IS NULL
      AND "confirmedAt" IS NULL
      AND "completedAt" IS NULL
    )
    OR (
      "status" = 'SUCCEEDED'
      AND "mutationKey" IS NOT NULL
      AND "terminalCode" = 'SUCCEEDED'
      AND "terminalResult" IS NOT NULL
      AND "confirmedAt" IS NOT NULL
      AND "completedAt" IS NOT NULL
    )
    OR (
      "status" = 'REJECTED'
      AND "mutationKey" IS NOT NULL
      AND "terminalCode" IS NOT NULL
      AND "confirmedAt" IS NOT NULL
      AND "completedAt" IS NOT NULL
    )
    OR (
      "status" = 'EXPIRED'
      AND "mutationKey" IS NULL
      AND "terminalCode" = 'PREVIEW_EXPIRED'
      AND "terminalResult" IS NOT NULL
      AND "confirmedAt" IS NULL
      AND "completedAt" IS NOT NULL
    )
  ),
  CONSTRAINT "brain_command_operations_organization_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "brain_command_operations_owner_user_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "brain_command_operations_owner_membership_fkey"
    FOREIGN KEY ("ownerUserId", "organizationId") REFERENCES "memberships"("userId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "brain_command_operations_actor_fkey"
    FOREIGN KEY ("actorId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "brain_command_operations_conversation_fkey"
    FOREIGN KEY ("conversationId", "organizationId") REFERENCES "brain_conversations"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "brain_command_operations_user_message_fkey"
    FOREIGN KEY ("userMessageId", "conversationId", "organizationId") REFERENCES "brain_messages"("id", "conversationId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "brain_command_operations_organization_mutation_key_key"
  ON "brain_command_operations"("organizationId", "mutationKey");
CREATE INDEX "brain_command_operations_owner_created_idx"
  ON "brain_command_operations"("ownerUserId", "createdAt");
CREATE INDEX "brain_command_operations_org_status_expiry_idx"
  ON "brain_command_operations"("organizationId", "status", "previewExpiresAt");
CREATE INDEX "brain_command_operations_conversation_message_idx"
  ON "brain_command_operations"("organizationId", "conversationId", "userMessageId");

CREATE FUNCTION brain_command_operations_prevent_preview_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
    OR OLD."ownerUserId" IS DISTINCT FROM NEW."ownerUserId"
    OR OLD."actorId" IS DISTINCT FROM NEW."actorId"
    OR OLD."conversationId" IS DISTINCT FROM NEW."conversationId"
    OR OLD."userMessageId" IS DISTINCT FROM NEW."userMessageId"
    OR OLD."commandName" IS DISTINCT FROM NEW."commandName"
    OR OLD."commandSchemaVersion" IS DISTINCT FROM NEW."commandSchemaVersion"
    OR OLD."serverPayload" IS DISTINCT FROM NEW."serverPayload"
    OR OLD."payloadHash" IS DISTINCT FROM NEW."payloadHash"
    OR OLD."sourceBindings" IS DISTINCT FROM NEW."sourceBindings"
    OR OLD."sourceBindingHash" IS DISTINCT FROM NEW."sourceBindingHash"
    OR OLD."humanDiff" IS DISTINCT FROM NEW."humanDiff"
    OR OLD."previewExpiresAt" IS DISTINCT FROM NEW."previewExpiresAt"
    OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt"
  THEN
    RAISE EXCEPTION 'BrainCommandOperation preview binding columns are immutable';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER brain_command_operations_prevent_preview_mutation
BEFORE UPDATE ON "brain_command_operations"
FOR EACH ROW
EXECUTE FUNCTION brain_command_operations_prevent_preview_mutation();

REVOKE ALL ON TABLE "brain_command_operations" FROM PUBLIC;

COMMIT;
