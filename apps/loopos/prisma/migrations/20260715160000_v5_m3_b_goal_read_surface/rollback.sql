BEGIN;

REVOKE SELECT ON brain_read.goal_active_work_links FROM loopos_brain_reader;
REVOKE SELECT ON brain_read.goal_effective_check_ins FROM loopos_brain_reader;
REVOKE SELECT ON brain_read.goal_targets FROM loopos_brain_reader;
REVOKE SELECT ON brain_read.goals FROM loopos_brain_reader;
REVOKE SELECT ON brain_read.goal_cycles FROM loopos_brain_reader;

DROP VIEW brain_read.goal_active_work_links;
DROP VIEW brain_read.goal_effective_check_ins;
DROP VIEW brain_read.goal_targets;
DROP VIEW brain_read.goals;
DROP VIEW brain_read.goal_cycles;

COMMIT;
