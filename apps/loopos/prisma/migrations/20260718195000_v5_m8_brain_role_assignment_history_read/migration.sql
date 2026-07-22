CREATE VIEW brain_read.current_actor_role_assignment_history
WITH (security_barrier = true)
AS
SELECT
  h."id",
  h."organizationId",
  h."personId",
  h."roleId",
  r."name" AS "roleName",
  h."eventType",
  h."effectiveAt",
  h."decisionId",
  h."changeLogId"
FROM "role_assignment_history" h
JOIN "role_defs" r ON r."id" = h."roleId" AND r."organizationId" = h."organizationId"
JOIN brain_read.current_actor actor ON actor."organizationId" = h."organizationId" AND actor."personId" = h."personId";

GRANT SELECT ON brain_read.current_actor_role_assignment_history TO loopos_brain_reader;
