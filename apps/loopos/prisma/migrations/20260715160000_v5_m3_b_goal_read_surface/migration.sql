BEGIN;

DO $loopos$
DECLARE
  reader_role record;
  existing_view_count integer;
  total_view_count integer;
BEGIN
  SELECT
    role.oid,
    role.rolcanlogin,
    role.rolinherit,
    role.rolsuper,
    role.rolcreatedb,
    role.rolcreaterole,
    role.rolreplication,
    role.rolbypassrls
  INTO reader_role
  FROM pg_catalog.pg_roles AS role
  WHERE role.rolname = 'loopos_brain_reader';

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'loopos_brain_reader must be provisioned before applying the V5-M3-B migration';
  END IF;

  IF reader_role.rolcanlogin
    OR reader_role.rolinherit
    OR reader_role.rolsuper
    OR reader_role.rolcreatedb
    OR reader_role.rolcreaterole
    OR reader_role.rolreplication
    OR reader_role.rolbypassrls
  THEN
    RAISE EXCEPTION
      'loopos_brain_reader has unsafe role attributes; run the provisioning script';
  END IF;

  SELECT count(*)::integer
  INTO existing_view_count
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'brain_read'
    AND class.relkind = 'v'
    AND class.relname = ANY (ARRAY[
      'current_actor',
      'organization_identity',
      'organization_brain_profile',
      'current_actor_role_assignments',
      'private_conversations',
      'private_messages',
      'circles',
      'role_definitions',
      'projects',
      'actions',
      'unresolved_tensions',
      'meeting_drafts',
      'approved_tactical_outcomes',
      'adopted_governance_decisions',
      'published_governance_logs'
    ]::text[])
    AND class.reloptions @> ARRAY['security_barrier=true']::text[]
    AND pg_catalog.has_table_privilege(reader_role.oid, class.oid, 'SELECT')
    AND NOT pg_catalog.has_table_privilege(
      reader_role.oid,
      class.oid,
      'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    );

  SELECT count(*)::integer
  INTO total_view_count
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'brain_read'
    AND class.relkind = 'v';

  IF existing_view_count <> 15
    OR total_view_count <> 15
    OR NOT pg_catalog.has_schema_privilege(
      reader_role.oid,
      'brain_read',
      'USAGE'
    )
    OR pg_catalog.has_schema_privilege(
      reader_role.oid,
      'brain_read',
      'CREATE'
    )
  THEN
    RAISE EXCEPTION
      'the exact 15-view Brain read boundary must exist before applying V5-M3-B';
  END IF;
END
$loopos$;

CREATE VIEW brain_read.goal_cycles
WITH (security_barrier = true) AS
SELECT
  cycle."organizationId" AS "organizationId",
  cycle."id" AS "id",
  cycle."name" AS "name",
  cycle."status"::text AS "status",
  cycle."startAt" AS "startAt",
  cycle."endAt" AS "endAt",
  cycle."checkInCadenceDays" AS "checkInCadenceDays",
  cycle."updatedAt" AS "sourceVersionAt"
FROM public.goal_cycles AS cycle
JOIN brain_read.current_actor AS actor
  ON actor."organizationId" = cycle."organizationId";

CREATE VIEW brain_read.goals
WITH (security_barrier = true) AS
SELECT
  goal."organizationId" AS "organizationId",
  goal."id" AS "id",
  goal."cycleId" AS "cycleId",
  goal."circleId" AS "circleId",
  goal."title" AS "title",
  goal."intendedOutcome" AS "intendedOutcome",
  goal."ownerRoleId" AS "ownerRoleId",
  goal."parentGoalId" AS "parentGoalId",
  goal."status"::text AS "status",
  goal."createdAt" AS "createdAt",
  adopted_decision."meetingId" AS "adoptedMeetingId",
  adopted_decision."decidedAt" AS "adoptedAt",
  CASE
    WHEN goal."terminalDecisionId" IS NULL THEN NULL
    ELSE goal."status"::text
  END AS "terminalOutcome",
  terminal_decision."meetingId" AS "terminalMeetingId",
  goal."terminalAt" AS "terminalAt",
  COALESCE(goal."terminalAt", goal."createdAt") AS "sourceVersionAt"
FROM public.goals AS goal
JOIN brain_read.current_actor AS actor
  ON actor."organizationId" = goal."organizationId"
JOIN public.goal_decisions AS adopted_decision
  ON adopted_decision."id" = goal."adoptedDecisionId"
  AND adopted_decision."organizationId" = goal."organizationId"
  AND adopted_decision."outcome" = 'ADOPTED'
LEFT JOIN public.goal_decisions AS terminal_decision
  ON terminal_decision."id" = goal."terminalDecisionId"
  AND terminal_decision."organizationId" = goal."organizationId";

CREATE VIEW brain_read.goal_targets
WITH (security_barrier = true) AS
SELECT
  target."organizationId" AS "organizationId",
  target."id" AS "id",
  goal."cycleId" AS "cycleId",
  target."goalId" AS "goalId",
  target."position" AS "position",
  target."label" AS "label",
  target."kind"::text AS "kind",
  target."baselineValue"::text AS "baselineValue",
  target."desiredValue"::text AS "desiredValue",
  target."unit" AS "unit",
  target."acceptanceCriteria" AS "acceptanceCriteria",
  target."metricId" AS "metricId",
  target."createdAt" AS "createdAt",
  target."createdAt" AS "sourceVersionAt"
FROM public.goal_targets AS target
JOIN public.goals AS goal
  ON goal."id" = target."goalId"
  AND goal."organizationId" = target."organizationId"
JOIN brain_read.current_actor AS actor
  ON actor."organizationId" = target."organizationId";

CREATE VIEW brain_read.goal_effective_check_ins
WITH (security_barrier = true) AS
SELECT DISTINCT ON (check_in."targetId")
  check_in."organizationId" AS "organizationId",
  check_in."id" AS "id",
  goal."cycleId" AS "cycleId",
  check_in."goalId" AS "goalId",
  check_in."targetId" AS "targetId",
  check_in."fact" AS "fact",
  check_in."evidenceSummary" AS "evidenceSummary",
  check_in."currentValue"::text AS "currentValue",
  CASE check_in."milestoneCompleted"
    WHEN TRUE THEN 'COMPLETED'
    WHEN FALSE THEN 'NOT_COMPLETED'
    ELSE NULL
  END AS "milestoneState",
  check_in."acceptanceEvidence" AS "acceptanceEvidence",
  check_in."assessment"::text AS "assessment",
  check_in."recorderId" AS "recorderId",
  check_in."meetingId" AS "meetingId",
  check_in."recordedAt" AS "recordedAt",
  check_in."recordedAt" AS "sourceVersionAt"
FROM public.goal_check_ins AS check_in
JOIN public.goal_targets AS target
  ON target."id" = check_in."targetId"
  AND target."organizationId" = check_in."organizationId"
  AND target."goalId" = check_in."goalId"
JOIN public.goals AS goal
  ON goal."id" = check_in."goalId"
  AND goal."organizationId" = check_in."organizationId"
JOIN brain_read.current_actor AS actor
  ON actor."organizationId" = check_in."organizationId"
WHERE NOT EXISTS (
  SELECT 1
  FROM public.goal_check_ins AS correction
  WHERE correction."organizationId" = check_in."organizationId"
    AND correction."goalId" = check_in."goalId"
    AND correction."targetId" = check_in."targetId"
    AND correction."supersedesCheckInId" = check_in."id"
)
ORDER BY
  check_in."targetId",
  check_in."recordedAt" DESC,
  check_in."id" DESC;

CREATE VIEW brain_read.goal_active_work_links
WITH (security_barrier = true) AS
SELECT
  work_link."organizationId" AS "organizationId",
  work_link."id" AS "id",
  goal."cycleId" AS "cycleId",
  work_link."goalId" AS "goalId",
  work_link."kind"::text AS "kind",
  work_link."projectId" AS "projectId",
  NULL::text AS "tensionId",
  project."name" AS "objectLabel",
  project."status" AS "objectStatus",
  work_link."createdAt" AS "createdAt",
  work_link."createdAt" AS "sourceVersionAt"
FROM public.goal_work_links AS work_link
JOIN public.goals AS goal
  ON goal."id" = work_link."goalId"
  AND goal."organizationId" = work_link."organizationId"
JOIN brain_read.projects AS project
  ON project."id" = work_link."projectId"
  AND project."organizationId" = work_link."organizationId"
JOIN brain_read.current_actor AS actor
  ON actor."organizationId" = work_link."organizationId"
WHERE work_link."status" = 'ACTIVE'
  AND work_link."kind" = 'PROJECT'
  AND work_link."tensionId" IS NULL
UNION ALL
SELECT
  work_link."organizationId" AS "organizationId",
  work_link."id" AS "id",
  goal."cycleId" AS "cycleId",
  work_link."goalId" AS "goalId",
  work_link."kind"::text AS "kind",
  NULL::text AS "projectId",
  work_link."tensionId" AS "tensionId",
  action."title" AS "objectLabel",
  action."status"::text AS "objectStatus",
  work_link."createdAt" AS "createdAt",
  work_link."createdAt" AS "sourceVersionAt"
FROM public.goal_work_links AS work_link
JOIN public.goals AS goal
  ON goal."id" = work_link."goalId"
  AND goal."organizationId" = work_link."organizationId"
JOIN brain_read.actions AS action
  ON action."id" = work_link."tensionId"
  AND action."organizationId" = work_link."organizationId"
JOIN brain_read.current_actor AS actor
  ON actor."organizationId" = work_link."organizationId"
WHERE work_link."status" = 'ACTIVE'
  AND work_link."kind" = 'ACTION'
  AND work_link."projectId" IS NULL
UNION ALL
SELECT
  work_link."organizationId" AS "organizationId",
  work_link."id" AS "id",
  goal."cycleId" AS "cycleId",
  work_link."goalId" AS "goalId",
  work_link."kind"::text AS "kind",
  NULL::text AS "projectId",
  work_link."tensionId" AS "tensionId",
  authorized_tension."title" AS "objectLabel",
  authorized_tension."status" AS "objectStatus",
  work_link."createdAt" AS "createdAt",
  work_link."createdAt" AS "sourceVersionAt"
FROM public.goal_work_links AS work_link
JOIN public.goals AS goal
  ON goal."id" = work_link."goalId"
  AND goal."organizationId" = work_link."organizationId"
JOIN brain_read.current_actor AS actor
  ON actor."organizationId" = work_link."organizationId"
JOIN brain_read.unresolved_tensions AS authorized_tension
  ON authorized_tension."id" = work_link."tensionId"
  AND authorized_tension."organizationId" = work_link."organizationId"
WHERE work_link."status" = 'ACTIVE'
  AND work_link."kind" = 'BLOCKING_TENSION'
  AND work_link."projectId" IS NULL;

GRANT SELECT ON brain_read.goal_cycles TO loopos_brain_reader;
GRANT SELECT ON brain_read.goals TO loopos_brain_reader;
GRANT SELECT ON brain_read.goal_targets TO loopos_brain_reader;
GRANT SELECT ON brain_read.goal_effective_check_ins TO loopos_brain_reader;
GRANT SELECT ON brain_read.goal_active_work_links TO loopos_brain_reader;

DO $loopos$
DECLARE
  reader_role oid;
  admitted_view_count integer;
  total_view_count integer;
BEGIN
  SELECT role.oid
  INTO reader_role
  FROM pg_catalog.pg_roles AS role
  WHERE role.rolname = 'loopos_brain_reader';

  SELECT count(*)::integer
  INTO admitted_view_count
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'brain_read'
    AND class.relkind = 'v'
    AND class.relname = ANY (ARRAY[
      'current_actor',
      'organization_identity',
      'organization_brain_profile',
      'current_actor_role_assignments',
      'private_conversations',
      'private_messages',
      'circles',
      'role_definitions',
      'projects',
      'actions',
      'unresolved_tensions',
      'meeting_drafts',
      'approved_tactical_outcomes',
      'adopted_governance_decisions',
      'published_governance_logs',
      'goal_cycles',
      'goals',
      'goal_targets',
      'goal_effective_check_ins',
      'goal_active_work_links'
    ]::text[])
    AND class.reloptions @> ARRAY['security_barrier=true']::text[]
    AND pg_catalog.has_table_privilege(reader_role, class.oid, 'SELECT')
    AND NOT pg_catalog.has_table_privilege(
      reader_role,
      class.oid,
      'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    );

  SELECT count(*)::integer
  INTO total_view_count
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'brain_read'
    AND class.relkind = 'v';

  IF admitted_view_count <> 20 OR total_view_count <> 20 THEN
    RAISE EXCEPTION
      'V5-M3-B must admit exactly the 20 accepted Brain read views';
  END IF;
END
$loopos$;

COMMIT;
