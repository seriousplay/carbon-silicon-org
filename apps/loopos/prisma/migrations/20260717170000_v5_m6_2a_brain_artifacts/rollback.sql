BEGIN;

DROP TRIGGER IF EXISTS brain_artifact_audit_events_prevent_mutation ON "brain_artifact_audit_events";
DROP FUNCTION IF EXISTS brain_artifact_audit_events_prevent_mutation();
DROP TABLE IF EXISTS "brain_artifact_audit_events";
DROP TRIGGER IF EXISTS brain_artifacts_enforce_transition ON "brain_artifacts";
DROP FUNCTION IF EXISTS brain_artifacts_enforce_transition();
DROP TRIGGER IF EXISTS brain_artifacts_prevent_terminal_mutation ON "brain_artifacts";
DROP FUNCTION IF EXISTS brain_artifacts_prevent_terminal_mutation();
DROP TABLE IF EXISTS "brain_artifacts";
DROP TYPE IF EXISTS "BrainArtifactStatus";
DROP TYPE IF EXISTS "BrainArtifactAuditEventType";
DROP INDEX IF EXISTS "brain_command_operations_id_organization_key";
DROP INDEX IF EXISTS "brain_conversations_id_organization_owner_key";
DROP FUNCTION IF EXISTS brain_artifact_source_refs_valid(JSONB, TEXT, TEXT);

COMMIT;
