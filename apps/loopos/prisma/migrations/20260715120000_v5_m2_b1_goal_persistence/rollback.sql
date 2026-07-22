BEGIN;

LOCK TABLE "goal_cycles", "goal_proposals", "goal_proposal_revisions", "goal_proposal_targets",
  "goal_decisions", "goals", "goal_targets", "goal_check_ins", "goal_work_links"
IN ACCESS EXCLUSIVE MODE;

DO $rollback_guard$
BEGIN
  IF EXISTS (SELECT 1 FROM "goal_work_links")
    OR EXISTS (SELECT 1 FROM "goal_check_ins")
    OR EXISTS (SELECT 1 FROM "goal_targets")
    OR EXISTS (SELECT 1 FROM "goals")
    OR EXISTS (SELECT 1 FROM "goal_decisions")
    OR EXISTS (SELECT 1 FROM "goal_proposal_targets")
    OR EXISTS (SELECT 1 FROM "goal_proposal_revisions")
    OR EXISTS (SELECT 1 FROM "goal_proposals")
    OR EXISTS (SELECT 1 FROM "goal_cycles") THEN
    RAISE EXCEPTION 'Rollback blocked: Goal persistence contains business rows and requires a forward fix';
  END IF;
END
$rollback_guard$;

DROP TRIGGER v5_m2_b1_circle_hierarchy_guard ON "circles";
DROP TRIGGER v5_m2_b1_goal_cycle_lifecycle_guard ON "goal_cycles";
DROP TRIGGER v5_m2_b1_goal_proposal_lifecycle_guard ON "goal_proposals";
DROP TRIGGER v5_m2_b1_goal_proposal_decision_guard ON "goal_proposals";
DROP TRIGGER v5_m2_b1_goal_proposal_revision_insert_guard ON "goal_proposal_revisions";
DROP TRIGGER v5_m2_b1_goal_proposal_revision_immutable ON "goal_proposal_revisions";
DROP TRIGGER v5_m2_b1_goal_revision_current_guard ON "goal_proposal_revisions";
DROP TRIGGER v5_m2_b1_goal_revision_targets_guard ON "goal_proposal_revisions";
DROP TRIGGER v5_m2_b1_goal_proposal_target_insert_guard ON "goal_proposal_targets";
DROP TRIGGER v5_m2_b1_goal_proposal_target_immutable ON "goal_proposal_targets";
DROP TRIGGER v5_m2_b1_goal_decision_immutable ON "goal_decisions";
DROP TRIGGER v5_m2_b1_goal_decision_effects_guard ON "goal_decisions";
DROP TRIGGER v5_m2_b1_goal_insert_guard ON "goals";
DROP TRIGGER v5_m2_b1_goal_lifecycle_guard ON "goals";
DROP TRIGGER v5_m2_b1_goal_terminal_decision_guard ON "goals";
DROP TRIGGER v5_m2_b1_goal_target_insert_guard ON "goal_targets";
DROP TRIGGER v5_m2_b1_goal_target_immutable ON "goal_targets";
DROP TRIGGER v5_m2_b1_goal_targets_guard ON "goals";
DROP TRIGGER v5_m2_b1_goal_check_in_insert_guard ON "goal_check_ins";
DROP TRIGGER v5_m2_b1_goal_check_in_immutable ON "goal_check_ins";
DROP TRIGGER v5_m2_b1_goal_work_link_lifecycle_guard ON "goal_work_links";

DROP FUNCTION v5_m2_b1_guard_circle_hierarchy();
DROP FUNCTION v5_m2_b1_guard_cycle_lifecycle();
DROP FUNCTION v5_m2_b1_guard_proposal_lifecycle();
DROP FUNCTION v5_m2_b1_assert_proposal_decision();
DROP FUNCTION v5_m2_b1_guard_proposal_revision_insert();
DROP FUNCTION v5_m2_b1_assert_revision_current();
DROP FUNCTION v5_m2_b1_assert_revision_targets();
DROP FUNCTION v5_m2_b1_guard_proposal_target_insert();
DROP FUNCTION v5_m2_b1_guard_goal_insert();
DROP FUNCTION v5_m2_b1_guard_goal_lifecycle();
DROP FUNCTION v5_m2_b1_assert_goal_terminal_decision();
DROP FUNCTION v5_m2_b1_guard_goal_target_insert();
DROP FUNCTION v5_m2_b1_assert_goal_targets();
DROP FUNCTION v5_m2_b1_guard_check_in_insert();
DROP FUNCTION v5_m2_b1_assert_decision_effects();
DROP FUNCTION v5_m2_b1_guard_work_link_lifecycle();
DROP FUNCTION v5_m2_b1_deny_immutable_mutation();

ALTER TABLE "goal_proposals" DROP CONSTRAINT "goal_proposals_replacedGoalId_organizationId_cycleId_circl_fkey";
ALTER TABLE "goal_proposals" DROP CONSTRAINT "goal_proposals_organizationId_id_currentRevision_fkey";
ALTER TABLE "goal_proposal_revisions" DROP CONSTRAINT "goal_proposal_revisions_parentGoalId_organizationId_fkey";
ALTER TABLE "goals" DROP CONSTRAINT "goals_adoptedDecisionId_organizationId_fkey";
ALTER TABLE "goals" DROP CONSTRAINT "goals_terminalDecisionId_organizationId_fkey";

DROP TABLE "goal_work_links";
DROP TABLE "goal_check_ins";
DROP TABLE "goal_targets";
DROP TABLE "goal_decisions";
DROP TABLE "goal_proposal_targets";
DROP TABLE "goal_proposal_revisions";
DROP TABLE "goals";
DROP TABLE "goal_proposals";
DROP TABLE "goal_cycles";

DROP INDEX "metrics_id_organizationId_key";
ALTER TABLE "circles" DROP CONSTRAINT "circles_parentId_organizationId_fkey";
ALTER TABLE "circles" DROP CONSTRAINT "circles_parent_not_self_check";

DROP TYPE "GoalWorkLinkStatus";
DROP TYPE "GoalWorkLinkKind";
DROP TYPE "GoalCheckInAssessment";
DROP TYPE "GoalTargetKind";
DROP TYPE "GoalStatus";
DROP TYPE "GoalDecisionOutcome";
DROP TYPE "GoalCloseResult";
DROP TYPE "GoalProposalStatus";
DROP TYPE "GoalProposalKind";
DROP TYPE "GoalCycleStatus";

ALTER TABLE "circles" ADD CONSTRAINT "circles_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "circles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
