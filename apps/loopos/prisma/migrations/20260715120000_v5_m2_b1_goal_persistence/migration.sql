DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "circles" AS child
    JOIN "circles" AS parent ON parent."id" = child."parentId"
    WHERE child."organizationId" <> parent."organizationId"
  ) THEN
    RAISE EXCEPTION 'Goal persistence migration blocked: cross-tenant Circle parent detected';
  END IF;

  IF EXISTS (SELECT 1 FROM "circles" WHERE "parentId" = "id") THEN
    RAISE EXCEPTION 'Goal persistence migration blocked: self-parent Circle detected';
  END IF;

  IF EXISTS (
    WITH RECURSIVE hierarchy AS (
      SELECT circle."id" AS start_id, circle."parentId" AS next_id, ARRAY[circle."id"] AS path
      FROM "circles" AS circle
      WHERE circle."parentId" IS NOT NULL
      UNION ALL
      SELECT hierarchy.start_id, parent."parentId", hierarchy.path || parent."id"
      FROM hierarchy
      JOIN "circles" AS parent ON parent."id" = hierarchy.next_id
      WHERE hierarchy.next_id IS NOT NULL
        AND NOT hierarchy.next_id = ANY(hierarchy.path)
    )
    SELECT 1 FROM hierarchy WHERE next_id = ANY(path)
  ) THEN
    RAISE EXCEPTION 'Goal persistence migration blocked: Circle hierarchy cycle detected';
  END IF;
END
$preflight$;

CREATE TYPE "GoalCycleStatus" AS ENUM ('PLANNED', 'ACTIVE', 'CLOSED', 'CANCELLED');
CREATE TYPE "GoalProposalKind" AS ENUM ('CREATE', 'REPLACE', 'CLOSE');
CREATE TYPE "GoalProposalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ADOPTED', 'RETURNED', 'DECLINED', 'WITHDRAWN');
CREATE TYPE "GoalCloseResult" AS ENUM ('ACHIEVED', 'NOT_ACHIEVED');
CREATE TYPE "GoalDecisionOutcome" AS ENUM ('ADOPTED', 'RETURNED', 'DECLINED');
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'ACHIEVED', 'NOT_ACHIEVED');
CREATE TYPE "GoalTargetKind" AS ENUM ('NUMERIC', 'MILESTONE');
CREATE TYPE "GoalCheckInAssessment" AS ENUM ('ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'ACHIEVED');
CREATE TYPE "GoalWorkLinkKind" AS ENUM ('PROJECT', 'ACTION', 'BLOCKING_TENSION');
CREATE TYPE "GoalWorkLinkStatus" AS ENUM ('ACTIVE', 'REMOVED');

CREATE TABLE "goal_cycles" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "GoalCycleStatus" NOT NULL DEFAULT 'PLANNED',
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "checkInCadenceDays" INTEGER NOT NULL,
  "activatedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "goal_cycles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goal_cycles_dates_check" CHECK ("startAt" < "endAt" AND "checkInCadenceDays" > 0),
  CONSTRAINT "goal_cycles_timestamps_check" CHECK (
    ("status" = 'PLANNED' AND "activatedAt" IS NULL AND "closedAt" IS NULL AND "cancelledAt" IS NULL)
    OR ("status" = 'ACTIVE' AND "activatedAt" IS NOT NULL AND "closedAt" IS NULL AND "cancelledAt" IS NULL)
    OR ("status" = 'CLOSED' AND "activatedAt" IS NOT NULL AND "closedAt" IS NOT NULL
      AND "cancelledAt" IS NULL AND "closedAt" >= "activatedAt")
    OR ("status" = 'CANCELLED' AND "activatedAt" IS NULL AND "closedAt" IS NULL AND "cancelledAt" IS NOT NULL)
  )
);

CREATE TABLE "goal_proposals" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "circleId" TEXT NOT NULL,
  "proposerId" TEXT NOT NULL,
  "kind" "GoalProposalKind" NOT NULL,
  "status" "GoalProposalStatus" NOT NULL DEFAULT 'DRAFT',
  "replacedGoalId" TEXT,
  "currentRevision" INTEGER NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "terminalAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "goal_proposals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goal_proposals_kind_check" CHECK (
    ("kind" = 'CREATE' AND "replacedGoalId" IS NULL)
    OR ("kind" IN ('REPLACE', 'CLOSE') AND "replacedGoalId" IS NOT NULL)
  ),
  CONSTRAINT "goal_proposals_revision_check" CHECK ("currentRevision" > 0),
  CONSTRAINT "goal_proposals_timestamps_check" CHECK (
    (("status" IN ('ADOPTED', 'DECLINED', 'WITHDRAWN')) = ("terminalAt" IS NOT NULL))
    AND ("status" NOT IN ('SUBMITTED', 'ADOPTED', 'RETURNED', 'DECLINED') OR "submittedAt" IS NOT NULL)
    AND ("submittedAt" IS NULL OR "submittedAt" >= "createdAt")
    AND ("terminalAt" IS NULL OR "terminalAt" >= COALESCE("submittedAt", "createdAt"))
  )
);

CREATE TABLE "goal_proposal_revisions" (
  "organizationId" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "title" TEXT,
  "intendedOutcome" TEXT,
  "ownerRoleId" TEXT,
  "parentGoalId" TEXT,
  "closeResult" "GoalCloseResult",
  "conclusion" TEXT,
  "authoredById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "goal_proposal_revisions_pkey" PRIMARY KEY ("organizationId", "proposalId", "revision"),
  CONSTRAINT "goal_proposal_revisions_revision_check" CHECK ("revision" > 0)
);

CREATE TABLE "goal_proposal_targets" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "kind" "GoalTargetKind" NOT NULL,
  "baselineValue" DECIMAL(30,10),
  "desiredValue" DECIMAL(30,10),
  "unit" TEXT,
  "acceptanceCriteria" TEXT,
  "metricId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "goal_proposal_targets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goal_proposal_targets_position_check" CHECK ("position" >= 0 AND btrim("label") <> ''),
  CONSTRAINT "goal_proposal_targets_kind_check" CHECK (
    ("kind" = 'NUMERIC' AND "baselineValue" IS NOT NULL AND "desiredValue" IS NOT NULL
      AND "baselineValue" <> "desiredValue" AND "unit" IS NOT NULL AND btrim("unit") <> ''
      AND "acceptanceCriteria" IS NULL)
    OR ("kind" = 'MILESTONE' AND "baselineValue" IS NULL AND "desiredValue" IS NULL
      AND "unit" IS NULL AND "metricId" IS NULL
      AND "acceptanceCriteria" IS NOT NULL AND btrim("acceptanceCriteria") <> '')
  )
);

CREATE TABLE "goal_decisions" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "outcome" "GoalDecisionOutcome" NOT NULL,
  "meetingId" TEXT NOT NULL,
  "recorderId" TEXT NOT NULL,
  "mutationKey" TEXT NOT NULL,
  "note" TEXT,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "goal_decisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goal_decisions_mutation_key_check" CHECK (btrim("mutationKey") <> '')
);

CREATE TABLE "goals" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "circleId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "intendedOutcome" TEXT NOT NULL,
  "ownerRoleId" TEXT NOT NULL,
  "parentGoalId" TEXT,
  "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
  "adoptedDecisionId" TEXT NOT NULL,
  "terminalDecisionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "terminalAt" TIMESTAMP(3),
  CONSTRAINT "goals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goals_content_check" CHECK (btrim("title") <> '' AND btrim("intendedOutcome") <> ''),
  CONSTRAINT "goals_parent_check" CHECK ("parentGoalId" IS NULL OR "parentGoalId" <> "id"),
  CONSTRAINT "goals_terminal_check" CHECK (
    ("status" = 'ACTIVE' AND "terminalDecisionId" IS NULL AND "terminalAt" IS NULL)
    OR ("status" <> 'ACTIVE' AND "terminalDecisionId" IS NOT NULL AND "terminalAt" IS NOT NULL
      AND "terminalAt" >= "createdAt")
  )
);

CREATE TABLE "goal_targets" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "goalId" TEXT NOT NULL,
  "sourceProposalTargetId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "kind" "GoalTargetKind" NOT NULL,
  "baselineValue" DECIMAL(30,10),
  "desiredValue" DECIMAL(30,10),
  "unit" TEXT,
  "acceptanceCriteria" TEXT,
  "metricId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "goal_targets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goal_targets_position_check" CHECK ("position" >= 0 AND btrim("label") <> ''),
  CONSTRAINT "goal_targets_kind_check" CHECK (
    ("kind" = 'NUMERIC' AND "baselineValue" IS NOT NULL AND "desiredValue" IS NOT NULL
      AND "baselineValue" <> "desiredValue" AND "unit" IS NOT NULL AND btrim("unit") <> ''
      AND "acceptanceCriteria" IS NULL)
    OR ("kind" = 'MILESTONE' AND "baselineValue" IS NULL AND "desiredValue" IS NULL
      AND "unit" IS NULL AND "metricId" IS NULL
      AND "acceptanceCriteria" IS NOT NULL AND btrim("acceptanceCriteria") <> '')
  )
);

CREATE TABLE "goal_check_ins" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "goalId" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "fact" TEXT NOT NULL,
  "evidenceSummary" TEXT NOT NULL,
  "currentValue" DECIMAL(30,10),
  "milestoneCompleted" BOOLEAN,
  "acceptanceEvidence" TEXT,
  "assessment" "GoalCheckInAssessment" NOT NULL,
  "recorderId" TEXT NOT NULL,
  "meetingId" TEXT,
  "sourceUrl" TEXT,
  "supersedesCheckInId" TEXT,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "goal_check_ins_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goal_check_ins_content_check" CHECK (btrim("fact") <> '' AND btrim("evidenceSummary") <> ''),
  CONSTRAINT "goal_check_ins_correction_check" CHECK ("supersedesCheckInId" IS NULL OR "supersedesCheckInId" <> "id")
);

CREATE TABLE "goal_work_links" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "goalId" TEXT NOT NULL,
  "kind" "GoalWorkLinkKind" NOT NULL,
  "status" "GoalWorkLinkStatus" NOT NULL DEFAULT 'ACTIVE',
  "projectId" TEXT,
  "tensionId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdMeetingId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedById" TEXT,
  "removedMeetingId" TEXT,
  "removedAt" TIMESTAMP(3),
  "removalReason" TEXT,
  CONSTRAINT "goal_work_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goal_work_links_kind_check" CHECK (
    ("kind" = 'PROJECT' AND "projectId" IS NOT NULL AND "tensionId" IS NULL)
    OR ("kind" IN ('ACTION', 'BLOCKING_TENSION') AND "projectId" IS NULL AND "tensionId" IS NOT NULL)
  ),
  CONSTRAINT "goal_work_links_removal_check" CHECK (
    ("status" = 'ACTIVE' AND "removedById" IS NULL AND "removedMeetingId" IS NULL
      AND "removedAt" IS NULL AND "removalReason" IS NULL)
    OR ("status" = 'REMOVED' AND "removedById" IS NOT NULL AND "removedAt" IS NOT NULL
      AND "removalReason" IS NOT NULL AND btrim("removalReason") <> '' AND "removedAt" >= "createdAt")
  )
);

CREATE UNIQUE INDEX "goal_cycles_id_organizationId_key" ON "goal_cycles"("id", "organizationId");
CREATE INDEX "goal_cycles_organizationId_startAt_endAt_idx" ON "goal_cycles"("organizationId", "startAt", "endAt");
CREATE UNIQUE INDEX "goal_cycles_one_active_per_organization_key" ON "goal_cycles"("organizationId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "goal_proposals_id_organizationId_key" ON "goal_proposals"("id", "organizationId");
CREATE UNIQUE INDEX "goal_proposals_organizationId_id_currentRevision_key" ON "goal_proposals"("organizationId", "id", "currentRevision");
CREATE INDEX "goal_proposals_organizationId_cycleId_circleId_status_idx" ON "goal_proposals"("organizationId", "cycleId", "circleId", "status");
CREATE INDEX "goal_proposals_organizationId_proposerId_status_idx" ON "goal_proposals"("organizationId", "proposerId", "status");
CREATE INDEX "goal_proposal_revisions_organizationId_authoredById_created_idx" ON "goal_proposal_revisions"("organizationId", "authoredById", "createdAt");
CREATE UNIQUE INDEX "goal_proposal_targets_id_organizationId_key" ON "goal_proposal_targets"("id", "organizationId");
CREATE UNIQUE INDEX "goal_proposal_targets_organizationId_proposalId_revision_po_key" ON "goal_proposal_targets"("organizationId", "proposalId", "revision", "position");
CREATE INDEX "goal_proposal_targets_organizationId_metricId_idx" ON "goal_proposal_targets"("organizationId", "metricId");
CREATE UNIQUE INDEX "goal_decisions_id_organizationId_key" ON "goal_decisions"("id", "organizationId");
CREATE UNIQUE INDEX "goal_decisions_organizationId_proposalId_revision_key" ON "goal_decisions"("organizationId", "proposalId", "revision");
CREATE UNIQUE INDEX "goal_decisions_organizationId_mutationKey_key" ON "goal_decisions"("organizationId", "mutationKey");
CREATE INDEX "goal_decisions_organizationId_meetingId_decidedAt_idx" ON "goal_decisions"("organizationId", "meetingId", "decidedAt");
CREATE UNIQUE INDEX "goals_adoptedDecisionId_key" ON "goals"("adoptedDecisionId");
CREATE UNIQUE INDEX "goals_terminalDecisionId_key" ON "goals"("terminalDecisionId");
CREATE UNIQUE INDEX "goals_id_organizationId_key" ON "goals"("id", "organizationId");
CREATE UNIQUE INDEX "goals_id_organizationId_cycleId_circleId_key" ON "goals"("id", "organizationId", "cycleId", "circleId");
CREATE UNIQUE INDEX "goals_adoptedDecisionId_organizationId_key" ON "goals"("adoptedDecisionId", "organizationId");
CREATE UNIQUE INDEX "goals_terminalDecisionId_organizationId_key" ON "goals"("terminalDecisionId", "organizationId");
CREATE INDEX "goals_organizationId_cycleId_circleId_status_idx" ON "goals"("organizationId", "cycleId", "circleId", "status");
CREATE INDEX "goals_organizationId_parentGoalId_idx" ON "goals"("organizationId", "parentGoalId");
CREATE UNIQUE INDEX "goals_one_active_per_circle_cycle_key" ON "goals"("organizationId", "cycleId", "circleId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "goal_targets_id_organizationId_key" ON "goal_targets"("id", "organizationId");
CREATE UNIQUE INDEX "goal_targets_id_organizationId_goalId_key" ON "goal_targets"("id", "organizationId", "goalId");
CREATE UNIQUE INDEX "goal_targets_sourceProposalTargetId_organizationId_key" ON "goal_targets"("sourceProposalTargetId", "organizationId");
CREATE UNIQUE INDEX "goal_targets_organizationId_goalId_position_key" ON "goal_targets"("organizationId", "goalId", "position");
CREATE INDEX "goal_targets_organizationId_metricId_idx" ON "goal_targets"("organizationId", "metricId");
CREATE UNIQUE INDEX "goal_check_ins_supersedesCheckInId_key" ON "goal_check_ins"("supersedesCheckInId");
CREATE UNIQUE INDEX "goal_check_ins_id_organizationId_key" ON "goal_check_ins"("id", "organizationId");
CREATE UNIQUE INDEX "goal_check_ins_id_organizationId_goalId_targetId_key" ON "goal_check_ins"("id", "organizationId", "goalId", "targetId");
CREATE UNIQUE INDEX "goal_check_ins_supersedesCheckInId_organizationId_goalId_ta_key" ON "goal_check_ins"("supersedesCheckInId", "organizationId", "goalId", "targetId");
CREATE INDEX "goal_check_ins_organizationId_goalId_targetId_recordedAt_id_idx" ON "goal_check_ins"("organizationId", "goalId", "targetId", "recordedAt", "id");
CREATE UNIQUE INDEX "goal_work_links_id_organizationId_key" ON "goal_work_links"("id", "organizationId");
CREATE INDEX "goal_work_links_organizationId_goalId_status_idx" ON "goal_work_links"("organizationId", "goalId", "status");
CREATE INDEX "goal_work_links_organizationId_projectId_idx" ON "goal_work_links"("organizationId", "projectId");
CREATE INDEX "goal_work_links_organizationId_tensionId_idx" ON "goal_work_links"("organizationId", "tensionId");
CREATE UNIQUE INDEX "goal_work_links_active_project_key" ON "goal_work_links"("organizationId", "goalId", "kind", "projectId") WHERE "status" = 'ACTIVE' AND "projectId" IS NOT NULL;
CREATE UNIQUE INDEX "goal_work_links_active_tension_key" ON "goal_work_links"("organizationId", "goalId", "kind", "tensionId") WHERE "status" = 'ACTIVE' AND "tensionId" IS NOT NULL;
CREATE UNIQUE INDEX "metrics_id_organizationId_key" ON "metrics"("id", "organizationId");

ALTER TABLE "circles" DROP CONSTRAINT "circles_parentId_fkey";
ALTER TABLE "circles" ADD CONSTRAINT "circles_parent_not_self_check" CHECK ("parentId" IS NULL OR "parentId" <> "id");
ALTER TABLE "circles" ADD CONSTRAINT "circles_parentId_organizationId_fkey" FOREIGN KEY ("parentId", "organizationId") REFERENCES "circles"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "goal_cycles" ADD CONSTRAINT "goal_cycles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_proposals" ADD CONSTRAINT "goal_proposals_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_proposals" ADD CONSTRAINT "goal_proposals_cycleId_organizationId_fkey" FOREIGN KEY ("cycleId", "organizationId") REFERENCES "goal_cycles"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_proposals" ADD CONSTRAINT "goal_proposals_circleId_organizationId_fkey" FOREIGN KEY ("circleId", "organizationId") REFERENCES "circles"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_proposals" ADD CONSTRAINT "goal_proposals_proposerId_organizationId_fkey" FOREIGN KEY ("proposerId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_proposals" ADD CONSTRAINT "goal_proposals_replacedGoalId_organizationId_cycleId_circl_fkey" FOREIGN KEY ("replacedGoalId", "organizationId", "cycleId", "circleId") REFERENCES "goals"("id", "organizationId", "cycleId", "circleId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_proposals" ADD CONSTRAINT "goal_proposals_organizationId_id_currentRevision_fkey" FOREIGN KEY ("organizationId", "id", "currentRevision") REFERENCES "goal_proposal_revisions"("organizationId", "proposalId", "revision") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "goal_proposal_revisions" ADD CONSTRAINT "goal_proposal_revisions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_proposal_revisions" ADD CONSTRAINT "goal_proposal_revisions_proposalId_organizationId_fkey" FOREIGN KEY ("proposalId", "organizationId") REFERENCES "goal_proposals"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_proposal_revisions" ADD CONSTRAINT "goal_proposal_revisions_ownerRoleId_organizationId_fkey" FOREIGN KEY ("ownerRoleId", "organizationId") REFERENCES "role_defs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_proposal_revisions" ADD CONSTRAINT "goal_proposal_revisions_parentGoalId_organizationId_fkey" FOREIGN KEY ("parentGoalId", "organizationId") REFERENCES "goals"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_proposal_revisions" ADD CONSTRAINT "goal_proposal_revisions_authoredById_organizationId_fkey" FOREIGN KEY ("authoredById", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_proposal_targets" ADD CONSTRAINT "goal_proposal_targets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_proposal_targets" ADD CONSTRAINT "goal_proposal_targets_organizationId_proposalId_revision_fkey" FOREIGN KEY ("organizationId", "proposalId", "revision") REFERENCES "goal_proposal_revisions"("organizationId", "proposalId", "revision") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_proposal_targets" ADD CONSTRAINT "goal_proposal_targets_metricId_organizationId_fkey" FOREIGN KEY ("metricId", "organizationId") REFERENCES "metrics"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_decisions" ADD CONSTRAINT "goal_decisions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_decisions" ADD CONSTRAINT "goal_decisions_proposalId_organizationId_fkey" FOREIGN KEY ("proposalId", "organizationId") REFERENCES "goal_proposals"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_decisions" ADD CONSTRAINT "goal_decisions_organizationId_proposalId_revision_fkey" FOREIGN KEY ("organizationId", "proposalId", "revision") REFERENCES "goal_proposal_revisions"("organizationId", "proposalId", "revision") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_decisions" ADD CONSTRAINT "goal_decisions_meetingId_organizationId_fkey" FOREIGN KEY ("meetingId", "organizationId") REFERENCES "meetings"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_decisions" ADD CONSTRAINT "goal_decisions_recorderId_organizationId_fkey" FOREIGN KEY ("recorderId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goals" ADD CONSTRAINT "goals_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goals" ADD CONSTRAINT "goals_cycleId_organizationId_fkey" FOREIGN KEY ("cycleId", "organizationId") REFERENCES "goal_cycles"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goals" ADD CONSTRAINT "goals_circleId_organizationId_fkey" FOREIGN KEY ("circleId", "organizationId") REFERENCES "circles"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goals" ADD CONSTRAINT "goals_ownerRoleId_organizationId_fkey" FOREIGN KEY ("ownerRoleId", "organizationId") REFERENCES "role_defs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goals" ADD CONSTRAINT "goals_parentGoalId_organizationId_fkey" FOREIGN KEY ("parentGoalId", "organizationId") REFERENCES "goals"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goals" ADD CONSTRAINT "goals_adoptedDecisionId_organizationId_fkey" FOREIGN KEY ("adoptedDecisionId", "organizationId") REFERENCES "goal_decisions"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goals" ADD CONSTRAINT "goals_terminalDecisionId_organizationId_fkey" FOREIGN KEY ("terminalDecisionId", "organizationId") REFERENCES "goal_decisions"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_targets" ADD CONSTRAINT "goal_targets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_targets" ADD CONSTRAINT "goal_targets_goalId_organizationId_fkey" FOREIGN KEY ("goalId", "organizationId") REFERENCES "goals"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_targets" ADD CONSTRAINT "goal_targets_sourceProposalTargetId_organizationId_fkey" FOREIGN KEY ("sourceProposalTargetId", "organizationId") REFERENCES "goal_proposal_targets"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_targets" ADD CONSTRAINT "goal_targets_metricId_organizationId_fkey" FOREIGN KEY ("metricId", "organizationId") REFERENCES "metrics"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_check_ins" ADD CONSTRAINT "goal_check_ins_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_check_ins" ADD CONSTRAINT "goal_check_ins_goalId_organizationId_fkey" FOREIGN KEY ("goalId", "organizationId") REFERENCES "goals"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_check_ins" ADD CONSTRAINT "goal_check_ins_targetId_organizationId_goalId_fkey" FOREIGN KEY ("targetId", "organizationId", "goalId") REFERENCES "goal_targets"("id", "organizationId", "goalId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_check_ins" ADD CONSTRAINT "goal_check_ins_recorderId_organizationId_fkey" FOREIGN KEY ("recorderId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_check_ins" ADD CONSTRAINT "goal_check_ins_meetingId_organizationId_fkey" FOREIGN KEY ("meetingId", "organizationId") REFERENCES "meetings"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_check_ins" ADD CONSTRAINT "goal_check_ins_supersedesCheckInId_organizationId_goalId_t_fkey" FOREIGN KEY ("supersedesCheckInId", "organizationId", "goalId", "targetId") REFERENCES "goal_check_ins"("id", "organizationId", "goalId", "targetId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_work_links" ADD CONSTRAINT "goal_work_links_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_work_links" ADD CONSTRAINT "goal_work_links_goalId_organizationId_fkey" FOREIGN KEY ("goalId", "organizationId") REFERENCES "goals"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_work_links" ADD CONSTRAINT "goal_work_links_projectId_organizationId_fkey" FOREIGN KEY ("projectId", "organizationId") REFERENCES "projects"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_work_links" ADD CONSTRAINT "goal_work_links_tensionId_organizationId_fkey" FOREIGN KEY ("tensionId", "organizationId") REFERENCES "tensions"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_work_links" ADD CONSTRAINT "goal_work_links_createdById_organizationId_fkey" FOREIGN KEY ("createdById", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_work_links" ADD CONSTRAINT "goal_work_links_createdMeetingId_organizationId_fkey" FOREIGN KEY ("createdMeetingId", "organizationId") REFERENCES "meetings"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_work_links" ADD CONSTRAINT "goal_work_links_removedById_organizationId_fkey" FOREIGN KEY ("removedById", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_work_links" ADD CONSTRAINT "goal_work_links_removedMeetingId_organizationId_fkey" FOREIGN KEY ("removedMeetingId", "organizationId") REFERENCES "meetings"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION v5_m2_b1_guard_circle_hierarchy() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW."id" = OLD."id"
    AND NEW."organizationId" = OLD."organizationId"
    AND NEW."parentId" IS NOT DISTINCT FROM OLD."parentId"
    AND NEW."status" = OLD."status"
  THEN
    RETURN NEW;
  END IF;

  -- Serialize hierarchy rewrites per tenant so concurrent updates cannot hide a cycle.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."organizationId", 52021));

  IF NEW."parentId" = NEW."id" THEN
    RAISE EXCEPTION 'Circle cannot be its own parent';
  END IF;

  IF NEW."parentId" IS NOT NULL AND EXISTS (
    WITH RECURSIVE ancestors AS (
      SELECT circle."id", circle."parentId", ARRAY[circle."id"] AS path
      FROM "circles" AS circle
      WHERE circle."id" = NEW."parentId" AND circle."organizationId" = NEW."organizationId"
      UNION ALL
      SELECT parent."id", parent."parentId", ancestors.path || parent."id"
      FROM ancestors
      JOIN "circles" AS parent
        ON parent."id" = ancestors."parentId"
        AND parent."organizationId" = NEW."organizationId"
      WHERE ancestors."parentId" IS NOT NULL
        AND NOT ancestors."parentId" = ANY(ancestors.path)
    )
    SELECT 1 FROM ancestors WHERE "id" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'Circle hierarchy cycle is not allowed';
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER v5_m2_b1_circle_hierarchy_guard
BEFORE INSERT OR UPDATE ON "circles"
FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_guard_circle_hierarchy();

CREATE FUNCTION v5_m2_b1_deny_immutable_mutation() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  RAISE EXCEPTION '% rows are immutable', TG_TABLE_NAME;
END
$function$;

CREATE FUNCTION v5_m2_b1_guard_cycle_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  root_count INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'PLANNED' THEN
      RAISE EXCEPTION 'Goal cycle must be created PLANNED';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'PLANNED' THEN
      RAISE EXCEPTION 'Only an unused PLANNED Goal cycle may be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" IN ('CLOSED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Terminal Goal cycle is immutable';
  END IF;
  IF NEW."id" <> OLD."id" OR NEW."organizationId" <> OLD."organizationId" OR NEW."createdAt" <> OLD."createdAt" THEN
    RAISE EXCEPTION 'Goal cycle identity is immutable';
  END IF;
  IF OLD."status" = 'ACTIVE' AND ROW(NEW."name", NEW."startAt", NEW."endAt", NEW."checkInCadenceDays", NEW."activatedAt", NEW."cancelledAt")
    IS DISTINCT FROM ROW(OLD."name", OLD."startAt", OLD."endAt", OLD."checkInCadenceDays", OLD."activatedAt", OLD."cancelledAt") THEN
    RAISE EXCEPTION 'ACTIVE Goal cycle definition is immutable';
  END IF;
  IF NEW."status" <> OLD."status" AND NOT (
    (OLD."status" = 'PLANNED' AND NEW."status" IN ('ACTIVE', 'CANCELLED'))
    OR (OLD."status" = 'ACTIVE' AND NEW."status" = 'CLOSED')
  ) THEN
    RAISE EXCEPTION 'Illegal Goal cycle lifecycle transition';
  END IF;

  IF OLD."status" = 'PLANNED' AND NEW."status" = 'ACTIVE' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW."organizationId", 52021));
    SELECT count(*) INTO root_count
    FROM "circles"
    WHERE "organizationId" = NEW."organizationId" AND "parentId" IS NULL AND "status" <> 'ARCHIVED';
    IF root_count <> 1 THEN
      RAISE EXCEPTION 'Goal cycle activation requires exactly one non-archived root Circle';
    END IF;
  END IF;
  IF OLD."status" = 'PLANNED' AND NEW."status" = 'CANCELLED' AND EXISTS (
    SELECT 1 FROM "goal_proposals"
    WHERE "organizationId" = NEW."organizationId" AND "cycleId" = NEW."id"
      AND "status" NOT IN ('ADOPTED', 'DECLINED', 'WITHDRAWN')
  ) THEN
    RAISE EXCEPTION 'PLANNED Goal cycle cannot be cancelled with non-terminal proposals';
  END IF;
  IF OLD."status" = 'ACTIVE' AND NEW."status" = 'CLOSED' AND EXISTS (
    SELECT 1 FROM "goals"
    WHERE "organizationId" = NEW."organizationId" AND "cycleId" = NEW."id" AND "status" = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'Goal cycle cannot close while an ACTIVE Goal remains';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER v5_m2_b1_goal_cycle_lifecycle_guard
BEFORE INSERT OR UPDATE OR DELETE ON "goal_cycles"
FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_guard_cycle_lifecycle();

CREATE FUNCTION v5_m2_b1_guard_proposal_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'DRAFT' OR NEW."currentRevision" <> 1 THEN
      RAISE EXCEPTION 'Goal proposal must be created as DRAFT revision 1';
    END IF;
    PERFORM 1 FROM "goal_cycles"
    WHERE "id" = NEW."cycleId" AND "organizationId" = NEW."organizationId" AND "status" IN ('PLANNED', 'ACTIVE')
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Goal proposal requires a PLANNED or ACTIVE cycle';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD."status" IN ('ADOPTED', 'DECLINED', 'WITHDRAWN') THEN
      RAISE EXCEPTION 'Terminal Goal proposal is immutable';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" IN ('ADOPTED', 'DECLINED', 'WITHDRAWN') THEN
    RAISE EXCEPTION 'Terminal Goal proposal is immutable';
  END IF;
  IF ROW(NEW."id", NEW."organizationId", NEW."cycleId", NEW."circleId", NEW."proposerId", NEW."kind", NEW."replacedGoalId", NEW."createdAt")
    IS DISTINCT FROM ROW(OLD."id", OLD."organizationId", OLD."cycleId", OLD."circleId", OLD."proposerId", OLD."kind", OLD."replacedGoalId", OLD."createdAt") THEN
    RAISE EXCEPTION 'Goal proposal identity is immutable';
  END IF;
  IF NEW."status" <> OLD."status" AND NOT (
    (OLD."status" = 'DRAFT' AND NEW."status" IN ('SUBMITTED', 'WITHDRAWN'))
    OR (OLD."status" = 'SUBMITTED' AND NEW."status" IN ('ADOPTED', 'RETURNED', 'DECLINED', 'WITHDRAWN'))
    OR (OLD."status" = 'RETURNED' AND NEW."status" IN ('DRAFT', 'WITHDRAWN'))
  ) THEN
    RAISE EXCEPTION 'Illegal Goal proposal lifecycle transition';
  END IF;
  IF NEW."currentRevision" <> OLD."currentRevision" AND NOT (
    OLD."status" = 'RETURNED' AND NEW."status" = 'DRAFT' AND NEW."currentRevision" = OLD."currentRevision" + 1
  ) THEN
    RAISE EXCEPTION 'Goal proposal current revision can advance only by one after RETURNED';
  END IF;
  IF OLD."status" = 'RETURNED' AND NEW."status" = 'DRAFT' AND NEW."currentRevision" <> OLD."currentRevision" + 1 THEN
    RAISE EXCEPTION 'RETURNED Goal proposal requires an appended revision';
  END IF;
  IF NEW."submittedAt" IS DISTINCT FROM OLD."submittedAt" AND NEW."status" <> 'SUBMITTED' THEN
    RAISE EXCEPTION 'Goal proposal submittedAt may change only on submission';
  END IF;
  IF NEW."terminalAt" IS DISTINCT FROM OLD."terminalAt" AND NEW."status" NOT IN ('ADOPTED', 'DECLINED', 'WITHDRAWN') THEN
    RAISE EXCEPTION 'Goal proposal terminalAt may change only on terminal transition';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER v5_m2_b1_goal_proposal_lifecycle_guard
BEFORE INSERT OR UPDATE OR DELETE ON "goal_proposals"
FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_guard_proposal_lifecycle();

CREATE FUNCTION v5_m2_b1_assert_proposal_decision() RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  proposal_record RECORD;
  matching_decisions INTEGER;
BEGIN
  SELECT "status", "currentRevision" INTO proposal_record
  FROM "goal_proposals"
  WHERE "id" = NEW."id" AND "organizationId" = NEW."organizationId";
  IF NOT FOUND OR proposal_record."status" NOT IN ('ADOPTED', 'RETURNED', 'DECLINED') THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO matching_decisions
  FROM "goal_decisions"
  WHERE "organizationId" = NEW."organizationId" AND "proposalId" = NEW."id"
    AND "revision" = proposal_record."currentRevision"
    AND "outcome"::text = proposal_record."status"::text;
  IF matching_decisions <> 1 THEN
    RAISE EXCEPTION 'ADOPTED/RETURNED/DECLINED proposal requires exactly one matching current-revision decision';
  END IF;
  RETURN NULL;
END
$function$;

CREATE CONSTRAINT TRIGGER v5_m2_b1_goal_proposal_decision_guard
AFTER INSERT OR UPDATE ON "goal_proposals"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_assert_proposal_decision();

CREATE FUNCTION v5_m2_b1_guard_proposal_revision_insert() RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  proposal_record RECORD;
  latest_revision INTEGER;
BEGIN
  SELECT "kind", "status", "currentRevision" INTO proposal_record
  FROM "goal_proposals"
  WHERE "id" = NEW."proposalId" AND "organizationId" = NEW."organizationId"
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Goal proposal revision has no proposal';
  END IF;

  SELECT max("revision") INTO latest_revision
  FROM "goal_proposal_revisions"
  WHERE "proposalId" = NEW."proposalId" AND "organizationId" = NEW."organizationId";
  IF NEW."revision" <> COALESCE(latest_revision + 1, 1) THEN
    RAISE EXCEPTION 'Goal proposal revisions must be strictly consecutive';
  END IF;
  IF latest_revision IS NOT NULL
    AND proposal_record."status" <> 'RETURNED'
    AND NOT (proposal_record."status" = 'DRAFT' AND proposal_record."currentRevision" = NEW."revision") THEN
    RAISE EXCEPTION 'A new Goal proposal revision requires RETURNED state';
  END IF;

  IF proposal_record."kind" IN ('CREATE', 'REPLACE') THEN
    IF NEW."title" IS NULL OR btrim(NEW."title") = ''
      OR NEW."intendedOutcome" IS NULL OR btrim(NEW."intendedOutcome") = ''
      OR NEW."ownerRoleId" IS NULL OR NEW."closeResult" IS NOT NULL OR NEW."conclusion" IS NOT NULL THEN
      RAISE EXCEPTION 'CREATE/REPLACE revision has invalid content shape';
    END IF;
  ELSE
    IF NEW."title" IS NOT NULL OR NEW."intendedOutcome" IS NOT NULL OR NEW."ownerRoleId" IS NOT NULL
      OR NEW."parentGoalId" IS NOT NULL OR NEW."closeResult" IS NULL
      OR NEW."conclusion" IS NULL OR btrim(NEW."conclusion") = '' THEN
      RAISE EXCEPTION 'CLOSE revision has invalid content shape';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER v5_m2_b1_goal_proposal_revision_insert_guard
BEFORE INSERT ON "goal_proposal_revisions"
FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_guard_proposal_revision_insert();
CREATE TRIGGER v5_m2_b1_goal_proposal_revision_immutable
BEFORE UPDATE OR DELETE ON "goal_proposal_revisions"
FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_deny_immutable_mutation();

CREATE FUNCTION v5_m2_b1_assert_revision_current() RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  proposal_record RECORD;
BEGIN
  SELECT "currentRevision", xmin::text::xid8 AS row_xid INTO proposal_record
  FROM "goal_proposals"
  WHERE "id" = NEW."proposalId" AND "organizationId" = NEW."organizationId";
  IF NOT FOUND OR proposal_record."currentRevision" <> NEW."revision" THEN
    RAISE EXCEPTION 'Inserted Goal proposal revision must be the exact current revision at commit';
  END IF;
  IF proposal_record.row_xid <> pg_current_xact_id() THEN
    RAISE EXCEPTION 'Goal proposal revision must pair with proposal creation or revision advancement in the same transaction';
  END IF;
  RETURN NULL;
END
$function$;

CREATE CONSTRAINT TRIGGER v5_m2_b1_goal_revision_current_guard
AFTER INSERT ON "goal_proposal_revisions"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_assert_revision_current();

CREATE FUNCTION v5_m2_b1_assert_revision_targets() RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  proposal_kind "GoalProposalKind";
  target_count INTEGER;
BEGIN
  SELECT proposal."kind" INTO proposal_kind
  FROM "goal_proposals" AS proposal
  WHERE proposal."id" = NEW."proposalId" AND proposal."organizationId" = NEW."organizationId";
  SELECT count(*) INTO target_count
  FROM "goal_proposal_targets"
  WHERE "organizationId" = NEW."organizationId" AND "proposalId" = NEW."proposalId" AND "revision" = NEW."revision";
  IF proposal_kind IN ('CREATE', 'REPLACE') AND target_count = 0 THEN
    RAISE EXCEPTION 'CREATE/REPLACE revision requires at least one Target';
  END IF;
  IF proposal_kind = 'CLOSE' AND target_count <> 0 THEN
    RAISE EXCEPTION 'CLOSE revision cannot contain Targets';
  END IF;
  RETURN NULL;
END
$function$;

CREATE CONSTRAINT TRIGGER v5_m2_b1_goal_revision_targets_guard
AFTER INSERT ON "goal_proposal_revisions"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_assert_revision_targets();

CREATE FUNCTION v5_m2_b1_guard_proposal_target_insert() RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  revision_xid xid8;
  proposal_circle_id TEXT;
  metric_circle_id TEXT;
BEGIN
  SELECT revision_row.xmin::text::xid8, proposal."circleId"
  INTO revision_xid, proposal_circle_id
  FROM "goal_proposal_revisions" AS revision_row
  JOIN "goal_proposals" AS proposal
    ON proposal."id" = revision_row."proposalId" AND proposal."organizationId" = revision_row."organizationId"
  WHERE revision_row."organizationId" = NEW."organizationId"
    AND revision_row."proposalId" = NEW."proposalId" AND revision_row."revision" = NEW."revision";
  IF NOT FOUND OR revision_xid <> pg_current_xact_id() THEN
    RAISE EXCEPTION 'Proposed Targets may be inserted only with their new immutable revision';
  END IF;
  IF NEW."metricId" IS NOT NULL THEN
    SELECT "circleId" INTO metric_circle_id FROM "metrics"
    WHERE "id" = NEW."metricId" AND "organizationId" = NEW."organizationId";
    IF NOT FOUND OR metric_circle_id <> proposal_circle_id THEN
      RAISE EXCEPTION 'Numeric Target Metric must belong to the proposal Circle';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER v5_m2_b1_goal_proposal_target_insert_guard
BEFORE INSERT ON "goal_proposal_targets"
FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_guard_proposal_target_insert();
CREATE TRIGGER v5_m2_b1_goal_proposal_target_immutable
BEFORE UPDATE OR DELETE ON "goal_proposal_targets"
FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_deny_immutable_mutation();

CREATE FUNCTION v5_m2_b1_guard_goal_insert() RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  circle_record RECORD;
  owner_record RECORD;
  parent_record RECORD;
  adoption_record RECORD;
  root_count INTEGER;
BEGIN
  IF NEW."status" <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Confirmed Goal must be inserted ACTIVE';
  END IF;
  PERFORM 1 FROM "goal_cycles"
  WHERE "id" = NEW."cycleId" AND "organizationId" = NEW."organizationId" AND "status" = 'ACTIVE'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Goal adoption requires an ACTIVE cycle';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."organizationId", 52021));
  SELECT count(*) INTO root_count FROM "circles"
  WHERE "organizationId" = NEW."organizationId" AND "parentId" IS NULL AND "status" <> 'ARCHIVED';
  IF root_count <> 1 THEN
    RAISE EXCEPTION 'Goal adoption requires exactly one non-archived root Circle';
  END IF;

  SELECT "parentId", "status" INTO circle_record FROM "circles"
  WHERE "id" = NEW."circleId" AND "organizationId" = NEW."organizationId";
  IF NOT FOUND OR circle_record."status" = 'ARCHIVED' THEN
    RAISE EXCEPTION 'Goal Circle must be non-archived';
  END IF;
  SELECT "circleId", "status" INTO owner_record FROM "role_defs"
  WHERE "id" = NEW."ownerRoleId" AND "organizationId" = NEW."organizationId";
  IF NOT FOUND OR owner_record."circleId" <> NEW."circleId" OR owner_record."status" <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Goal owner Role must be ACTIVE in the same Circle';
  END IF;

  IF circle_record."parentId" IS NULL THEN
    IF NEW."parentGoalId" IS NOT NULL THEN
      RAISE EXCEPTION 'Root Circle Goal cannot have parent Goal support';
    END IF;
  ELSE
    SELECT "cycleId", "circleId", "status" INTO parent_record FROM "goals"
    WHERE "id" = NEW."parentGoalId" AND "organizationId" = NEW."organizationId";
    IF NOT FOUND OR parent_record."cycleId" <> NEW."cycleId"
      OR parent_record."circleId" <> circle_record."parentId" OR parent_record."status" <> 'ACTIVE' THEN
      RAISE EXCEPTION 'Child Circle Goal requires the ACTIVE Goal of its immediate parent Circle';
    END IF;
  END IF;

  SELECT decision."outcome", decision."revision", proposal."kind", proposal."cycleId", proposal."circleId",
    proposal."currentRevision", revision_row."title", revision_row."intendedOutcome",
    revision_row."ownerRoleId", revision_row."parentGoalId"
  INTO adoption_record
  FROM "goal_decisions" AS decision
  JOIN "goal_proposals" AS proposal
    ON proposal."id" = decision."proposalId" AND proposal."organizationId" = decision."organizationId"
  JOIN "goal_proposal_revisions" AS revision_row
    ON revision_row."organizationId" = decision."organizationId"
    AND revision_row."proposalId" = decision."proposalId" AND revision_row."revision" = decision."revision"
  WHERE decision."id" = NEW."adoptedDecisionId" AND decision."organizationId" = NEW."organizationId";
  IF NOT FOUND OR adoption_record."outcome" <> 'ADOPTED' OR adoption_record."kind" NOT IN ('CREATE', 'REPLACE')
    OR adoption_record."cycleId" <> NEW."cycleId" OR adoption_record."circleId" <> NEW."circleId"
    OR adoption_record."currentRevision" <> adoption_record."revision"
    OR NEW."title" IS DISTINCT FROM adoption_record."title"
    OR NEW."intendedOutcome" IS DISTINCT FROM adoption_record."intendedOutcome"
    OR NEW."ownerRoleId" IS DISTINCT FROM adoption_record."ownerRoleId"
    OR NEW."parentGoalId" IS DISTINCT FROM adoption_record."parentGoalId" THEN
    RAISE EXCEPTION 'Goal does not match its exact adopted proposal revision';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER v5_m2_b1_goal_insert_guard
BEFORE INSERT ON "goals"
FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_guard_goal_insert();

CREATE FUNCTION v5_m2_b1_guard_goal_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Confirmed Goal cannot be deleted';
  END IF;
  IF OLD."status" <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Terminal Goal is immutable';
  END IF;
  IF ROW(NEW."id", NEW."organizationId", NEW."cycleId", NEW."circleId", NEW."title", NEW."intendedOutcome",
      NEW."ownerRoleId", NEW."parentGoalId", NEW."adoptedDecisionId", NEW."createdAt")
    IS DISTINCT FROM ROW(OLD."id", OLD."organizationId", OLD."cycleId", OLD."circleId", OLD."title", OLD."intendedOutcome",
      OLD."ownerRoleId", OLD."parentGoalId", OLD."adoptedDecisionId", OLD."createdAt") THEN
    RAISE EXCEPTION 'Goal definition is immutable';
  END IF;
  IF NEW."status" <> OLD."status" AND NEW."status" NOT IN ('SUPERSEDED', 'ACHIEVED', 'NOT_ACHIEVED') THEN
    RAISE EXCEPTION 'Illegal Goal lifecycle transition';
  END IF;
  IF NEW."status" = OLD."status"
    AND (NEW."terminalDecisionId" IS DISTINCT FROM OLD."terminalDecisionId" OR NEW."terminalAt" IS DISTINCT FROM OLD."terminalAt") THEN
    RAISE EXCEPTION 'Goal terminal fields require a lifecycle transition';
  END IF;

  IF NEW."status" = 'ACHIEVED' THEN
    -- Effective evidence excludes corrected rows and uses the required timestamp/ID tie-break.
    IF NOT EXISTS (SELECT 1 FROM "goal_targets" WHERE "organizationId" = NEW."organizationId" AND "goalId" = NEW."id")
      OR EXISTS (
        SELECT 1
        FROM "goal_targets" AS target
        LEFT JOIN LATERAL (
          SELECT check_in."assessment"
          FROM "goal_check_ins" AS check_in
          WHERE check_in."organizationId" = target."organizationId" AND check_in."goalId" = target."goalId"
            AND check_in."targetId" = target."id"
            AND NOT EXISTS (
              SELECT 1 FROM "goal_check_ins" AS correction
              WHERE correction."supersedesCheckInId" = check_in."id"
            )
          ORDER BY check_in."recordedAt" DESC, check_in."id" DESC
          LIMIT 1
        ) AS latest ON true
        WHERE target."organizationId" = NEW."organizationId" AND target."goalId" = NEW."id"
          AND latest."assessment" IS DISTINCT FROM 'ACHIEVED'::"GoalCheckInAssessment"
      ) THEN
      RAISE EXCEPTION 'Goal can be ACHIEVED only when every Target latest effective check-in is ACHIEVED';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER v5_m2_b1_goal_lifecycle_guard
BEFORE UPDATE OR DELETE ON "goals"
FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_guard_goal_lifecycle();

CREATE FUNCTION v5_m2_b1_assert_goal_terminal_decision() RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  goal_record RECORD;
  terminal_record RECORD;
BEGIN
  SELECT * INTO goal_record
  FROM "goals"
  WHERE "id" = NEW."id" AND "organizationId" = NEW."organizationId";
  IF NOT FOUND OR goal_record."status" = 'ACTIVE' THEN
    RETURN NULL;
  END IF;
  IF goal_record."terminalDecisionId" = goal_record."adoptedDecisionId" THEN
    RAISE EXCEPTION 'Goal terminal decision must differ from its adoption decision';
  END IF;

  SELECT decision."outcome" AS decision_outcome, decision."revision" AS decision_revision,
    proposal."kind" AS proposal_kind, proposal."status" AS proposal_status,
    proposal."currentRevision" AS current_revision, proposal."replacedGoalId" AS replaced_goal_id,
    proposal."cycleId" AS cycle_id, proposal."circleId" AS circle_id,
    revision_row."closeResult" AS close_result, revision_row."conclusion" AS conclusion
  INTO terminal_record
  FROM "goal_decisions" AS decision
  JOIN "goal_proposals" AS proposal
    ON proposal."id" = decision."proposalId" AND proposal."organizationId" = decision."organizationId"
  JOIN "goal_proposal_revisions" AS revision_row
    ON revision_row."organizationId" = decision."organizationId"
    AND revision_row."proposalId" = decision."proposalId" AND revision_row."revision" = decision."revision"
  WHERE decision."id" = goal_record."terminalDecisionId"
    AND decision."organizationId" = goal_record."organizationId";
  IF NOT FOUND OR terminal_record.decision_outcome <> 'ADOPTED'
    OR terminal_record.proposal_status <> 'ADOPTED'
    OR terminal_record.current_revision <> terminal_record.decision_revision
    OR terminal_record.proposal_kind NOT IN ('REPLACE', 'CLOSE')
    OR terminal_record.replaced_goal_id IS DISTINCT FROM goal_record."id"
    OR terminal_record.cycle_id <> goal_record."cycleId"
    OR terminal_record.circle_id <> goal_record."circleId" THEN
    RAISE EXCEPTION 'Goal terminal decision must adopt the exact current REPLACE or CLOSE proposal for this Goal';
  END IF;

  IF goal_record."status" = 'SUPERSEDED' THEN
    IF terminal_record.proposal_kind <> 'REPLACE' OR NOT EXISTS (
      SELECT 1 FROM "goals" AS replacement
      WHERE replacement."organizationId" = goal_record."organizationId"
        AND replacement."cycleId" = goal_record."cycleId" AND replacement."circleId" = goal_record."circleId"
        AND replacement."id" <> goal_record."id"
        AND replacement."adoptedDecisionId" = goal_record."terminalDecisionId"
    ) THEN
      RAISE EXCEPTION 'SUPERSEDED Goal decision must also adopt its exact replacement Goal';
    END IF;
  ELSIF goal_record."status" IN ('ACHIEVED', 'NOT_ACHIEVED') THEN
    IF terminal_record.proposal_kind <> 'CLOSE'
      OR terminal_record.close_result::text IS DISTINCT FROM goal_record."status"::text
      OR terminal_record.conclusion IS NULL OR btrim(terminal_record.conclusion) = '' THEN
      RAISE EXCEPTION 'Closed Goal must match the adopted CLOSE result and conclusion';
    END IF;
  END IF;
  RETURN NULL;
END
$function$;

CREATE CONSTRAINT TRIGGER v5_m2_b1_goal_terminal_decision_guard
AFTER UPDATE ON "goals"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_assert_goal_terminal_decision();

CREATE FUNCTION v5_m2_b1_guard_goal_target_insert() RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  goal_xid xid8;
  source_record RECORD;
BEGIN
  SELECT goal_row.xmin::text::xid8 INTO goal_xid FROM "goals" AS goal_row
  WHERE goal_row."id" = NEW."goalId" AND goal_row."organizationId" = NEW."organizationId";
  IF NOT FOUND OR goal_xid <> pg_current_xact_id() THEN
    RAISE EXCEPTION 'Canonical Targets may be inserted only with their new immutable Goal';
  END IF;
  SELECT source_target.*, decision."proposalId" AS decision_proposal_id, decision."revision" AS decision_revision
  INTO source_record
  FROM "goal_proposal_targets" AS source_target
  JOIN "goals" AS goal_row ON goal_row."id" = NEW."goalId" AND goal_row."organizationId" = NEW."organizationId"
  JOIN "goal_decisions" AS decision
    ON decision."id" = goal_row."adoptedDecisionId" AND decision."organizationId" = goal_row."organizationId"
  WHERE source_target."id" = NEW."sourceProposalTargetId" AND source_target."organizationId" = NEW."organizationId";
  IF NOT FOUND OR source_record."proposalId" <> source_record.decision_proposal_id
    OR source_record."revision" <> source_record.decision_revision
    OR NEW."position" IS DISTINCT FROM source_record."position"
    OR NEW."label" IS DISTINCT FROM source_record."label"
    OR NEW."kind" IS DISTINCT FROM source_record."kind"
    OR NEW."baselineValue" IS DISTINCT FROM source_record."baselineValue"
    OR NEW."desiredValue" IS DISTINCT FROM source_record."desiredValue"
    OR NEW."unit" IS DISTINCT FROM source_record."unit"
    OR NEW."acceptanceCriteria" IS DISTINCT FROM source_record."acceptanceCriteria"
    OR NEW."metricId" IS DISTINCT FROM source_record."metricId" THEN
    RAISE EXCEPTION 'Canonical Target must exactly copy its adopted proposed Target';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER v5_m2_b1_goal_target_insert_guard
BEFORE INSERT ON "goal_targets"
FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_guard_goal_target_insert();
CREATE TRIGGER v5_m2_b1_goal_target_immutable
BEFORE UPDATE OR DELETE ON "goal_targets"
FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_deny_immutable_mutation();

CREATE FUNCTION v5_m2_b1_assert_goal_targets() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "goal_targets" WHERE "organizationId" = NEW."organizationId" AND "goalId" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'Confirmed Goal requires at least one Target';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM "goal_decisions" AS decision
    JOIN "goal_proposal_targets" AS source_target
      ON source_target."organizationId" = decision."organizationId"
      AND source_target."proposalId" = decision."proposalId" AND source_target."revision" = decision."revision"
    WHERE decision."id" = NEW."adoptedDecisionId" AND decision."organizationId" = NEW."organizationId"
      AND NOT EXISTS (
        SELECT 1 FROM "goal_targets" AS canonical_target
        WHERE canonical_target."organizationId" = NEW."organizationId" AND canonical_target."goalId" = NEW."id"
          AND canonical_target."sourceProposalTargetId" = source_target."id"
      )
  ) OR EXISTS (
    SELECT 1
    FROM "goal_targets" AS canonical_target
    WHERE canonical_target."organizationId" = NEW."organizationId" AND canonical_target."goalId" = NEW."id"
      AND NOT EXISTS (
        SELECT 1
        FROM "goal_decisions" AS decision
        JOIN "goal_proposal_targets" AS source_target
          ON source_target."organizationId" = decision."organizationId"
          AND source_target."proposalId" = decision."proposalId" AND source_target."revision" = decision."revision"
        WHERE decision."id" = NEW."adoptedDecisionId" AND decision."organizationId" = NEW."organizationId"
          AND source_target."id" = canonical_target."sourceProposalTargetId"
      )
  ) THEN
    RAISE EXCEPTION 'Canonical Goal Targets must exactly match the adopted proposal Target set';
  END IF;
  RETURN NULL;
END
$function$;

CREATE CONSTRAINT TRIGGER v5_m2_b1_goal_targets_guard
AFTER INSERT ON "goals"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_assert_goal_targets();

CREATE FUNCTION v5_m2_b1_guard_check_in_insert() RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  target_record RECORD;
  superseded_at TIMESTAMP(3);
BEGIN
  SELECT target."kind", target."baselineValue", target."desiredValue", goal_row."status"
  INTO target_record
  FROM "goal_targets" AS target
  JOIN "goals" AS goal_row
    ON goal_row."id" = target."goalId" AND goal_row."organizationId" = target."organizationId"
  WHERE target."id" = NEW."targetId" AND target."organizationId" = NEW."organizationId" AND target."goalId" = NEW."goalId"
  FOR UPDATE OF goal_row;
  IF NOT FOUND OR target_record."status" <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Check-in requires an ACTIVE Goal Target';
  END IF;

  IF target_record."kind" = 'NUMERIC' THEN
    IF NEW."currentValue" IS NULL OR NEW."milestoneCompleted" IS NOT NULL OR NEW."acceptanceEvidence" IS NOT NULL THEN
      RAISE EXCEPTION 'Numeric check-in has invalid typed value shape';
    END IF;
    IF NEW."assessment" = 'ACHIEVED' AND NOT (
      (target_record."desiredValue" > target_record."baselineValue" AND NEW."currentValue" >= target_record."desiredValue")
      OR (target_record."desiredValue" < target_record."baselineValue" AND NEW."currentValue" <= target_record."desiredValue")
    ) THEN
      RAISE EXCEPTION 'Numeric ACHIEVED check-in has not reached the desired value';
    END IF;
  ELSE
    IF NEW."currentValue" IS NOT NULL OR NEW."milestoneCompleted" IS NULL THEN
      RAISE EXCEPTION 'Milestone check-in has invalid typed value shape';
    END IF;
    IF NEW."assessment" = 'ACHIEVED' AND (
      NEW."milestoneCompleted" IS NOT TRUE OR NEW."acceptanceEvidence" IS NULL OR btrim(NEW."acceptanceEvidence") = ''
    ) THEN
      RAISE EXCEPTION 'Milestone ACHIEVED requires completion and acceptance evidence';
    END IF;
  END IF;

  IF NEW."supersedesCheckInId" IS NOT NULL THEN
    SELECT "recordedAt" INTO superseded_at FROM "goal_check_ins"
    WHERE "id" = NEW."supersedesCheckInId" AND "organizationId" = NEW."organizationId"
      AND "goalId" = NEW."goalId" AND "targetId" = NEW."targetId";
    IF NOT FOUND OR NEW."recordedAt" < superseded_at THEN
      RAISE EXCEPTION 'Check-in correction must supersede the same Target at a later timestamp';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER v5_m2_b1_goal_check_in_insert_guard
BEFORE INSERT ON "goal_check_ins"
FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_guard_check_in_insert();
CREATE TRIGGER v5_m2_b1_goal_check_in_immutable
BEFORE UPDATE OR DELETE ON "goal_check_ins"
FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_deny_immutable_mutation();
CREATE TRIGGER v5_m2_b1_goal_decision_immutable
BEFORE UPDATE OR DELETE ON "goal_decisions"
FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_deny_immutable_mutation();

CREATE FUNCTION v5_m2_b1_assert_decision_effects() RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  proposal_record RECORD;
BEGIN
  SELECT proposal."kind", proposal."status", proposal."currentRevision", proposal."replacedGoalId", revision_row."closeResult"
  INTO proposal_record
  FROM "goal_proposals" AS proposal
  JOIN "goal_proposal_revisions" AS revision_row
    ON revision_row."organizationId" = proposal."organizationId" AND revision_row."proposalId" = proposal."id"
    AND revision_row."revision" = NEW."revision"
  WHERE proposal."id" = NEW."proposalId" AND proposal."organizationId" = NEW."organizationId";
  IF NOT FOUND OR proposal_record."currentRevision" <> NEW."revision" THEN
    RAISE EXCEPTION 'Goal decision must use the exact current proposal revision';
  END IF;
  IF (NEW."outcome" = 'ADOPTED' AND proposal_record."status" <> 'ADOPTED')
    OR (NEW."outcome" = 'RETURNED' AND proposal_record."status" <> 'RETURNED')
    OR (NEW."outcome" = 'DECLINED' AND proposal_record."status" <> 'DECLINED') THEN
    RAISE EXCEPTION 'Goal decision outcome and proposal lifecycle state disagree';
  END IF;

  IF NEW."outcome" = 'ADOPTED' THEN
    IF proposal_record."kind" = 'CREATE' AND NOT EXISTS (
      SELECT 1 FROM "goals" WHERE "organizationId" = NEW."organizationId" AND "adoptedDecisionId" = NEW."id"
    ) THEN
      RAISE EXCEPTION 'Adopted CREATE decision must create a Goal';
    ELSIF proposal_record."kind" = 'REPLACE' AND (
      NOT EXISTS (SELECT 1 FROM "goals" WHERE "organizationId" = NEW."organizationId" AND "adoptedDecisionId" = NEW."id")
      OR NOT EXISTS (SELECT 1 FROM "goals" WHERE "organizationId" = NEW."organizationId"
        AND "id" = proposal_record."replacedGoalId" AND "status" = 'SUPERSEDED' AND "terminalDecisionId" = NEW."id")
    ) THEN
      RAISE EXCEPTION 'Adopted REPLACE decision must supersede and replace exactly one Goal';
    ELSIF proposal_record."kind" = 'CLOSE' AND NOT EXISTS (
      SELECT 1 FROM "goals" WHERE "organizationId" = NEW."organizationId"
        AND "id" = proposal_record."replacedGoalId" AND "terminalDecisionId" = NEW."id"
        AND "status"::text = proposal_record."closeResult"::text
    ) THEN
      RAISE EXCEPTION 'Adopted CLOSE decision must apply its exact close result';
    END IF;
  ELSIF EXISTS (
    SELECT 1 FROM "goals" WHERE "organizationId" = NEW."organizationId"
      AND ("adoptedDecisionId" = NEW."id" OR "terminalDecisionId" = NEW."id")
  ) THEN
    RAISE EXCEPTION 'Non-adopted Goal decision cannot mutate canonical Goals';
  END IF;
  RETURN NULL;
END
$function$;

CREATE CONSTRAINT TRIGGER v5_m2_b1_goal_decision_effects_guard
AFTER INSERT ON "goal_decisions"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_assert_decision_effects();

CREATE FUNCTION v5_m2_b1_guard_work_link_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'ACTIVE' THEN
      RAISE EXCEPTION 'Goal work link must be created ACTIVE';
    END IF;
    PERFORM 1 FROM "goals" WHERE "id" = NEW."goalId" AND "organizationId" = NEW."organizationId" AND "status" = 'ACTIVE';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Goal work link requires an ACTIVE Goal';
    END IF;
    IF NEW."kind" = 'ACTION' AND NOT EXISTS (
      SELECT 1 FROM "tactical_outcome_proposals"
      WHERE "organizationId" = NEW."organizationId" AND "outcomeActionId" = NEW."tensionId" AND "status" = 'APPROVED'
    ) THEN
      RAISE EXCEPTION 'ACTION Goal work link requires an approved Action outcome';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Goal work link history cannot be deleted';
  END IF;
  IF OLD."status" = 'REMOVED' THEN
    RAISE EXCEPTION 'Removed Goal work link is immutable';
  END IF;
  IF NEW."status" <> 'REMOVED' THEN
    RAISE EXCEPTION 'Goal work link may move only from ACTIVE to REMOVED';
  END IF;
  IF ROW(NEW."id", NEW."organizationId", NEW."goalId", NEW."kind", NEW."projectId", NEW."tensionId",
      NEW."createdById", NEW."createdMeetingId", NEW."createdAt")
    IS DISTINCT FROM ROW(OLD."id", OLD."organizationId", OLD."goalId", OLD."kind", OLD."projectId", OLD."tensionId",
      OLD."createdById", OLD."createdMeetingId", OLD."createdAt") THEN
    RAISE EXCEPTION 'Goal work link identity is immutable';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER v5_m2_b1_goal_work_link_lifecycle_guard
BEFORE INSERT OR UPDATE OR DELETE ON "goal_work_links"
FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_guard_work_link_lifecycle();
