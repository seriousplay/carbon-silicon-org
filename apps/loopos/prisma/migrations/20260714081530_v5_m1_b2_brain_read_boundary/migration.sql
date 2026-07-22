DO $loopos$
DECLARE
  reader_role record;
BEGIN
  SELECT
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
      'loopos_brain_reader must be provisioned before applying the B2a migration';
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
END
$loopos$;

CREATE SCHEMA brain_read;
REVOKE ALL ON SCHEMA brain_read FROM PUBLIC;

CREATE VIEW brain_read.current_actor
WITH (security_barrier = true) AS
SELECT
  person."organizationId",
  person."id" AS "personId",
  person."name",
  person."entityType",
  person."homeCircleId",
  home_circle."name" AS "homeCircleName",
  membership."role"::text AS "membershipRole"
FROM public.people AS person
JOIN public.memberships AS membership
  ON membership."userId" = person."userId"
  AND membership."organizationId" = person."organizationId"
JOIN public.organizations AS organization
  ON organization."id" = person."organizationId"
JOIN public.circles AS home_circle
  ON home_circle."id" = person."homeCircleId"
  AND home_circle."organizationId" = person."organizationId"
WHERE person."organizationId" = current_setting('loopos.organization_id', true)
  AND person."userId" = current_setting('loopos.user_id', true)
  AND person."id" = current_setting('loopos.person_id', true);

CREATE VIEW brain_read.organization_identity
WITH (security_barrier = true) AS
SELECT
  organization."id",
  organization."name",
  organization."slug",
  organization."createdAt",
  organization."updatedAt"
FROM public.organizations AS organization
JOIN brain_read.current_actor AS actor
  ON actor."organizationId" = organization."id";

CREATE VIEW brain_read.organization_brain_profile
WITH (security_barrier = true) AS
SELECT
  profile."id",
  profile."organizationId",
  profile."name",
  profile."avatarUrl",
  profile."tonePreferences",
  profile."terminologyPreferences",
  profile."enabledCapabilities",
  profile."createdAt",
  profile."updatedAt"
FROM public.organization_brain_profiles AS profile
JOIN brain_read.current_actor AS actor
  ON actor."organizationId" = profile."organizationId";

CREATE VIEW brain_read.current_actor_role_assignments
WITH (security_barrier = true) AS
SELECT
  role_definition."organizationId",
  actor."personId",
  role_definition."id" AS "roleDefinitionId",
  role_definition."name" AS "roleDefinitionName",
  role_definition."circleId",
  circle."name" AS "circleName",
  role_definition."ownershipType"::text AS "ownershipType",
  role_definition."category"::text AS "category"
FROM brain_read.current_actor AS actor
JOIN public."_PersonRoles" AS assignment
  ON assignment."A" = actor."personId"
JOIN public.role_defs AS role_definition
  ON role_definition."id" = assignment."B"
  AND role_definition."organizationId" = actor."organizationId"
  AND role_definition."status" = 'ACTIVE'
JOIN public.circles AS circle
  ON circle."id" = role_definition."circleId"
  AND circle."organizationId" = role_definition."organizationId";

CREATE VIEW brain_read.private_conversations
WITH (security_barrier = true) AS
SELECT
  conversation."id",
  conversation."organizationId",
  conversation."ownerId",
  conversation."title",
  conversation."createdAt",
  conversation."updatedAt"
FROM public.brain_conversations AS conversation
JOIN brain_read.current_actor AS actor
  ON actor."organizationId" = conversation."organizationId"
WHERE conversation."ownerId" = actor."personId";

CREATE VIEW brain_read.private_messages
WITH (security_barrier = true) AS
SELECT
  message."id",
  message."organizationId",
  message."conversationId",
  message."role"::text AS "role",
  message."content",
  message."createdAt",
  message."updatedAt"
FROM public.brain_messages AS message
JOIN public.brain_conversations AS conversation
  ON conversation."id" = message."conversationId"
  AND conversation."organizationId" = message."organizationId"
JOIN brain_read.current_actor AS actor
  ON actor."organizationId" = message."organizationId"
WHERE conversation."ownerId" = actor."personId";

GRANT USAGE ON SCHEMA brain_read TO loopos_brain_reader;
GRANT SELECT ON brain_read.current_actor TO loopos_brain_reader;
GRANT SELECT ON brain_read.organization_identity TO loopos_brain_reader;
GRANT SELECT ON brain_read.organization_brain_profile TO loopos_brain_reader;
GRANT SELECT ON brain_read.current_actor_role_assignments TO loopos_brain_reader;
GRANT SELECT ON brain_read.private_conversations TO loopos_brain_reader;
GRANT SELECT ON brain_read.private_messages TO loopos_brain_reader;
