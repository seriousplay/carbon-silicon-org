CREATE VIEW brain_read.current_actor_role_applications
WITH (security_barrier = true) AS
SELECT
  application."id",
  application."organizationId",
  actor."personId",
  application."roleId",
  role_definition."name" AS "roleName",
  application."status"::text AS "status",
  application."motivation",
  application."capabilitySummary",
  application."commitment",
  application."createdAt",
  application."updatedAt"
FROM brain_read.current_actor AS actor
JOIN public.role_assignment_applications AS application
  ON application."organizationId" = actor."organizationId"
  AND application."applicantId" = actor."personId"
JOIN public.role_defs AS role_definition
  ON role_definition."id" = application."roleId"
  AND role_definition."organizationId" = application."organizationId";

GRANT SELECT ON brain_read.current_actor_role_applications TO loopos_brain_reader;
