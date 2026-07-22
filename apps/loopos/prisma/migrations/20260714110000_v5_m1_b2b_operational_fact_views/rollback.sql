BEGIN;

REVOKE SELECT ON brain_read.published_governance_logs FROM loopos_brain_reader;
REVOKE SELECT ON brain_read.adopted_governance_decisions FROM loopos_brain_reader;
REVOKE SELECT ON brain_read.approved_tactical_outcomes FROM loopos_brain_reader;
REVOKE SELECT ON brain_read.meeting_drafts FROM loopos_brain_reader;
REVOKE SELECT ON brain_read.unresolved_tensions FROM loopos_brain_reader;
REVOKE SELECT ON brain_read.actions FROM loopos_brain_reader;
REVOKE SELECT ON brain_read.projects FROM loopos_brain_reader;
REVOKE SELECT ON brain_read.role_definitions FROM loopos_brain_reader;
REVOKE SELECT ON brain_read.circles FROM loopos_brain_reader;

DROP VIEW brain_read.published_governance_logs;
DROP VIEW brain_read.adopted_governance_decisions;
DROP VIEW brain_read.approved_tactical_outcomes;
DROP VIEW brain_read.meeting_drafts;
DROP VIEW brain_read.unresolved_tensions;
DROP VIEW brain_read.actions;
DROP VIEW brain_read.projects;
DROP VIEW brain_read.role_definitions;
DROP VIEW brain_read.circles;

COMMIT;
