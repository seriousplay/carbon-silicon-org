ALTER TABLE "governance_decision_processes"
  DROP CONSTRAINT IF EXISTS "governance_decision_processes_state_projection_check";

ALTER TABLE "governance_decision_processes"
  ADD CONSTRAINT "governance_decision_processes_state_projection_check" CHECK (
    (
      "state" = 'READY'
      AND "activeClarification" IS NULL AND "activeObjection" IS NULL AND "activeObjectionSequence" IS NULL
      AND "recordedById" IS NULL AND "recordedAt" IS NULL AND "resultNote" IS NULL
      AND "outcomeRoleId" IS NULL AND "outcomeObjectId" IS NULL AND "outcomeChangeType" IS NULL
      AND "decisionId" IS NULL AND "changeLogId" IS NULL
    ) OR (
      "state" = 'CLARIFICATION_REQUIRED'
      AND "activeClarification" IS NOT NULL AND jsonb_typeof("activeClarification") = 'object'
      AND "activeObjection" IS NULL AND "activeObjectionSequence" IS NULL
      AND "recordedById" IS NULL AND "recordedAt" IS NULL AND "resultNote" IS NULL
      AND "outcomeRoleId" IS NULL AND "outcomeObjectId" IS NULL AND "outcomeChangeType" IS NULL
      AND "decisionId" IS NULL AND "changeLogId" IS NULL
    ) OR (
      "state" IN ('OBJECTION_PENDING', 'AMENDMENT_REQUIRED')
      AND "activeClarification" IS NULL
      AND "activeObjection" IS NOT NULL AND jsonb_typeof("activeObjection") = 'object'
      AND "activeObjectionSequence" IS NOT NULL
      AND "recordedById" IS NULL AND "recordedAt" IS NULL AND "resultNote" IS NULL
      AND "outcomeRoleId" IS NULL AND "outcomeObjectId" IS NULL AND "outcomeChangeType" IS NULL
      AND "decisionId" IS NULL AND "changeLogId" IS NULL
    ) OR (
      "state" = 'NOT_ADOPTED'
      AND "activeClarification" IS NULL AND "activeObjection" IS NULL AND "activeObjectionSequence" IS NULL
      AND "recordedById" IS NOT NULL AND "recordedAt" IS NOT NULL
      AND "resultNote" IS NOT NULL AND btrim("resultNote") <> ''
      AND "outcomeRoleId" IS NULL AND "outcomeObjectId" IS NULL AND "outcomeChangeType" IS NULL
      AND "decisionId" IS NULL AND "changeLogId" IS NULL
    ) OR (
      "state" = 'ADOPTED'
      AND "activeClarification" IS NULL AND "activeObjection" IS NULL AND "activeObjectionSequence" IS NULL
      AND "recordedById" IS NOT NULL AND "recordedAt" IS NOT NULL
      AND "resultNote" IS NOT NULL AND btrim("resultNote") <> ''
      AND "decisionId" IS NOT NULL AND "changeLogId" IS NOT NULL
      AND (
        ("outcomeRoleId" IS NOT NULL AND ("outcomeObjectId" IS NULL OR "outcomeChangeType" = 'ROLE_CREATED'))
        OR ("outcomeRoleId" IS NULL AND "outcomeObjectId" IS NOT NULL AND "outcomeChangeType" IS NOT NULL)
      )
    )
  );
