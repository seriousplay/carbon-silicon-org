BEGIN;

DO $loopos$
DECLARE
  reader_role record;
  foundation_view_count integer;
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
      'loopos_brain_reader must be provisioned before applying the B2b migration';
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
  INTO foundation_view_count
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
      'private_messages'
    ]::text[])
    AND class.reloptions @> ARRAY['security_barrier=true']::text[]
    AND pg_catalog.has_table_privilege(reader_role.oid, class.oid, 'SELECT');

  IF foundation_view_count <> 6
    OR NOT pg_catalog.has_schema_privilege(
      reader_role.oid,
      'brain_read',
      'USAGE'
    )
  THEN
    RAISE EXCEPTION
      'the complete B2a brain_read foundation must exist before applying B2b';
  END IF;
END
$loopos$;

CREATE VIEW brain_read.circles
WITH (security_barrier = true) AS
SELECT
  circle."id",
  circle."organizationId",
  circle."name",
  circle."number"::text AS "number",
  circle."type"::text AS "type",
  circle."purpose",
  circle."domain",
  circle."status"::text AS "status",
  circle."phase"::text AS "phase",
  circle."parentId",
  circle."leadPersonId",
  circle."tacticalCadence",
  circle."createdAt",
  circle."updatedAt"
FROM public.circles AS circle
JOIN brain_read.current_actor AS actor
  ON actor."organizationId" = circle."organizationId"
WHERE circle."status" <> 'ARCHIVED';

CREATE VIEW brain_read.role_definitions
WITH (security_barrier = true) AS
SELECT
  role_definition."id",
  role_definition."organizationId",
  role_definition."name",
  role_definition."purpose",
  role_definition."domain",
  role_definition."accountabilities",
  role_definition."ownershipType"::text AS "ownershipType",
  role_definition."category"::text AS "category",
  role_definition."status"::text AS "status",
  role_definition."circleId",
  role_definition."createdAt",
  role_definition."updatedAt"
FROM public.role_defs AS role_definition
JOIN brain_read.current_actor AS actor
  ON actor."organizationId" = role_definition."organizationId"
WHERE role_definition."status" = 'ACTIVE';

CREATE VIEW brain_read.projects
WITH (security_barrier = true) AS
SELECT
  project."id",
  project."organizationId",
  project."name",
  project."goal",
  project."expectedResult",
  project."status",
  project."circleId",
  project."bearerId",
  project."sourceTensionId",
  project."createdAt",
  project."updatedAt",
  project."completedAt",
  project."completedById"
FROM public.projects AS project
JOIN brain_read.current_actor AS actor
  ON actor."organizationId" = project."organizationId"
JOIN public.tactical_outcome_proposals AS proposal
  ON proposal."organizationId" = project."organizationId"
  AND proposal."outcomeProjectId" = project."id"
  AND proposal."kind" = 'PROJECT'
  AND proposal."status" = 'APPROVED'
  AND proposal."outcomeActionId" IS NULL;

CREATE VIEW brain_read.actions
WITH (security_barrier = true) AS
SELECT
  action."id",
  action."organizationId",
  action."title",
  action."description",
  action."type"::text AS "type",
  action."source"::text AS "source",
  action."conflictLevel"::text AS "conflictLevel",
  action."handlingMode"::text AS "handlingMode",
  action."status"::text AS "status",
  action."acceptanceCriteria",
  action."deadline",
  action."resolvedAt",
  action."raiserId",
  action."ownerId",
  action."circleId",
  action."roleId",
  action."actionContext",
  action."projectId",
  action."createdAt",
  action."updatedAt"
FROM public.tensions AS action
JOIN brain_read.current_actor AS actor
  ON actor."organizationId" = action."organizationId"
JOIN public.tactical_outcome_proposals AS proposal
  ON proposal."organizationId" = action."organizationId"
  AND proposal."outcomeActionId" = action."id"
  AND proposal."kind" = 'ACTION'
  AND proposal."status" = 'APPROVED'
  AND proposal."outcomeProjectId" IS NULL;

CREATE VIEW brain_read.unresolved_tensions
WITH (security_barrier = true) AS
SELECT
  tension."id",
  tension."organizationId",
  tension."title",
  tension."description",
  tension."type"::text AS "type",
  tension."source"::text AS "source",
  tension."conflictLevel"::text AS "conflictLevel",
  tension."handlingMode"::text AS "handlingMode",
  tension."status"::text AS "status",
  tension."acceptanceCriteria",
  tension."deadline",
  tension."raiserId",
  tension."ownerId",
  tension."circleId",
  tension."roleId",
  tension."actionContext",
  tension."projectId",
  tension."createdAt",
  tension."updatedAt"
FROM public.tensions AS tension
JOIN brain_read.current_actor AS actor
  ON actor."organizationId" = tension."organizationId"
WHERE tension."status" = 'OPEN'
  AND NOT EXISTS (
    SELECT 1
    FROM public.tactical_outcome_proposals AS approved_action
    WHERE approved_action."organizationId" = tension."organizationId"
      AND approved_action."kind" = 'ACTION'
      AND approved_action."status" = 'APPROVED'
      AND approved_action."outcomeActionId" = tension."id"
      AND approved_action."outcomeProjectId" IS NULL
  )
  AND (
    tension."ownerId" = actor."personId"
    OR tension."raiserId" = actor."personId"
    OR actor."membershipRole" = 'ORG_ADMIN'
    OR EXISTS (
      SELECT 1
      FROM public.circles AS authorized_circle
      WHERE authorized_circle."organizationId" = tension."organizationId"
        AND authorized_circle."status" <> 'ARCHIVED'
        AND authorized_circle."leadPersonId" = actor."personId"
        AND (
          authorized_circle."id" = tension."circleId"
          OR EXISTS (
            SELECT 1
            FROM public."_TensionCircle" AS related_circle
            WHERE related_circle."A" = authorized_circle."id"
              AND related_circle."B" = tension."id"
          )
        )
    )
  );

CREATE VIEW brain_read.meeting_drafts
WITH (security_barrier = true) AS
SELECT
  meeting."id",
  meeting."organizationId",
  meeting."title",
  meeting."type"::text AS "type",
  meeting."agenda",
  meeting."notes",
  meeting."notesRevision",
  meeting."durationMin",
  meeting."startedAt",
  meeting."endedAt",
  meeting."circleId",
  meeting."createdAt"
FROM public.meetings AS meeting
JOIN brain_read.current_actor AS actor
  ON actor."organizationId" = meeting."organizationId"
JOIN public."_MeetingToPerson" AS participant
  ON participant."A" = meeting."id"
  AND participant."B" = actor."personId";

CREATE VIEW brain_read.approved_tactical_outcomes
WITH (security_barrier = true) AS
SELECT
  proposal."id",
  proposal."organizationId",
  proposal."tensionId",
  proposal."meetingId",
  proposal."proposerId",
  proposal."kind"::text AS "kind",
  proposal."title",
  proposal."expectedResult",
  proposal."acceptanceCriteria",
  proposal."circleId",
  proposal."responsiblePersonId",
  proposal."deadline",
  proposal."status"::text AS "status",
  proposal."revision",
  proposal."recordedById",
  proposal."meetingDecisionNote",
  proposal."recordedAt",
  proposal."outcomeProjectId",
  proposal."outcomeActionId",
  proposal."createdAt",
  proposal."updatedAt"
FROM public.tactical_outcome_proposals AS proposal
JOIN brain_read.current_actor AS actor
  ON actor."organizationId" = proposal."organizationId"
LEFT JOIN public.projects AS outcome_project
  ON proposal."kind" = 'PROJECT'
  AND outcome_project."organizationId" = proposal."organizationId"
  AND outcome_project."id" = proposal."outcomeProjectId"
LEFT JOIN public.tensions AS outcome_action
  ON proposal."kind" = 'ACTION'
  AND outcome_action."organizationId" = proposal."organizationId"
  AND outcome_action."id" = proposal."outcomeActionId"
WHERE proposal."status" = 'APPROVED'
  AND (
    (
      proposal."kind" = 'PROJECT'
      AND proposal."outcomeProjectId" IS NOT NULL
      AND proposal."outcomeActionId" IS NULL
      AND outcome_project."id" = proposal."outcomeProjectId"
    )
    OR
    (
      proposal."kind" = 'ACTION'
      AND proposal."outcomeActionId" IS NOT NULL
      AND proposal."outcomeProjectId" IS NULL
      AND outcome_action."id" = proposal."outcomeActionId"
    )
  );

CREATE VIEW brain_read.adopted_governance_decisions
WITH (security_barrier = true) AS
SELECT
  process."id",
  process."organizationId",
  process."sourceTensionId",
  process."meetingId",
  process."proposerId",
  process."state"::text AS "state",
  process."currentRevision",
  process."recordedById",
  process."recordedAt",
  process."resultNote",
  process."outcomeRoleId",
  process."decisionId",
  process."changeLogId",
  process."createdAt",
  process."updatedAt",
  decision."title" AS "decisionTitle",
  decision."type"::text AS "decisionType",
  decision."content" AS "decisionContent",
  decision."rationale" AS "decisionRationale",
  decision."status"::text AS "decisionStatus",
  decision."effectiveAt" AS "decisionEffectiveAt",
  decision."decisionMakerId",
  decision."createdAt" AS "decisionCreatedAt",
  change."type"::text AS "changeType",
  change."objectDesc" AS "changedObject",
  change."beforeValue",
  change."afterValue",
  change."impactAssessment",
  change."effectiveAt" AS "changeEffectiveAt",
  change."initiatorId" AS "changeInitiatorId",
  change."createdAt" AS "changeCreatedAt"
FROM public.governance_decision_processes AS process
JOIN brain_read.current_actor AS actor
  ON actor."organizationId" = process."organizationId"
JOIN public.role_defs AS outcome_role
  ON outcome_role."organizationId" = process."organizationId"
  AND outcome_role."id" = process."outcomeRoleId"
JOIN public.decision_records AS decision
  ON decision."organizationId" = process."organizationId"
  AND decision."id" = process."decisionId"
  AND decision."meetingId" = process."meetingId"
JOIN public.change_logs AS change
  ON change."organizationId" = process."organizationId"
  AND change."id" = process."changeLogId"
  AND change."decisionId" = decision."id"
WHERE process."state" = 'ADOPTED'
  AND process."recordedById" IS NOT NULL
  AND process."recordedAt" IS NOT NULL
  AND process."outcomeRoleId" IS NOT NULL
  AND process."decisionId" IS NOT NULL
  AND process."changeLogId" IS NOT NULL;

CREATE VIEW brain_read.published_governance_logs
WITH (security_barrier = true) AS
SELECT
  governance_log."id",
  governance_log."organizationId",
  governance_log."period",
  governance_log."title",
  governance_log."content",
  governance_log."patterns",
  governance_log."risks",
  governance_log."status",
  governance_log."credibilityScore",
  governance_log."createdAt",
  governance_log."updatedAt",
  governance_log."publishedAt",
  governance_log."confirmedById"
FROM public.governance_logs AS governance_log
JOIN brain_read.current_actor AS actor
  ON actor."organizationId" = governance_log."organizationId"
WHERE governance_log."status" = 'published'
  AND governance_log."publishedAt" IS NOT NULL;

GRANT SELECT ON brain_read.circles TO loopos_brain_reader;
GRANT SELECT ON brain_read.role_definitions TO loopos_brain_reader;
GRANT SELECT ON brain_read.projects TO loopos_brain_reader;
GRANT SELECT ON brain_read.actions TO loopos_brain_reader;
GRANT SELECT ON brain_read.unresolved_tensions TO loopos_brain_reader;
GRANT SELECT ON brain_read.meeting_drafts TO loopos_brain_reader;
GRANT SELECT ON brain_read.approved_tactical_outcomes TO loopos_brain_reader;
GRANT SELECT ON brain_read.adopted_governance_decisions TO loopos_brain_reader;
GRANT SELECT ON brain_read.published_governance_logs TO loopos_brain_reader;

COMMIT;
