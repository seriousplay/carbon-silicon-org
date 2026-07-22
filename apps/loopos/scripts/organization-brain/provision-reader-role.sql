\set ON_ERROR_STOP on

\if :{?brain_login_role}
\else
  DO $failure$ BEGIN RAISE EXCEPTION 'brain_login_role psql variable is required'; END $failure$;
\endif

\if :{?brain_allowed_databases}
\else
  DO $failure$ BEGIN RAISE EXCEPTION 'brain_allowed_databases psql variable is required'; END $failure$;
\endif

\if :{?brain_migration_owner_role}
\else
  DO $failure$ BEGIN RAISE EXCEPTION 'brain_migration_owner_role psql variable is required'; END $failure$;
\endif

BEGIN;

DO $loopos$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles AS role
    WHERE role.rolname = 'loopos_brain_reader'
  ) THEN
    CREATE ROLE loopos_brain_reader;
  END IF;
END
$loopos$;

ALTER ROLE loopos_brain_reader
  NOLOGIN
  NOINHERIT
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOBYPASSRLS
  CONNECTION LIMIT 0;

WITH login_role AS (
  SELECT role.*
  FROM pg_catalog.pg_roles AS role
  WHERE role.rolname = :'brain_login_role'
), reader_role AS (
  SELECT role.*
  FROM pg_catalog.pg_roles AS role
  WHERE role.rolname = 'loopos_brain_reader'
), migration_owner_role AS (
  SELECT role.*
  FROM pg_catalog.pg_roles AS role
  WHERE role.rolname = :'brain_migration_owner_role'
), allowed_database_names AS (
  SELECT value AS datname
  FROM pg_catalog.jsonb_array_elements_text(
    :'brain_allowed_databases'::pg_catalog.jsonb
  ) AS allowed(value)
), checked_roles AS (
  SELECT role.oid, 'login'::text AS kind
  FROM login_role AS role
  UNION ALL
  SELECT role.oid, 'reader'::text AS kind
  FROM reader_role AS role
), current_database_role AS (
  SELECT database.*
  FROM pg_catalog.pg_database AS database
  WHERE database.datname = current_database()
), invalid_direct_acl AS (
  SELECT checked.kind
  FROM current_database_role AS database
  CROSS JOIN LATERAL pg_catalog.aclexplode(database.datacl) AS acl
  JOIN checked_roles AS checked ON checked.oid = acl.grantee
  WHERE NOT (
    checked.kind = 'login'
    AND acl.privilege_type = 'CONNECT'
    AND NOT acl.is_grantable
  )
  UNION ALL
  SELECT checked.kind
  FROM pg_catalog.pg_namespace AS namespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(namespace.nspacl) AS acl
  JOIN checked_roles AS checked ON checked.oid = acl.grantee
  WHERE namespace.nspname !~ '^pg_'
    AND namespace.nspname <> 'information_schema'
    AND NOT (
      checked.kind = 'reader'
      AND namespace.nspname = 'brain_read'
      AND acl.privilege_type = 'USAGE'
      AND NOT acl.is_grantable
    )
  UNION ALL
  SELECT checked.kind
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = class.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(class.relacl) AS acl
  JOIN checked_roles AS checked ON checked.oid = acl.grantee
  WHERE namespace.nspname !~ '^pg_'
    AND namespace.nspname <> 'information_schema'
    AND NOT (
      checked.kind = 'reader'
      AND namespace.nspname = 'brain_read'
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
      AND acl.privilege_type = 'SELECT'
      AND NOT acl.is_grantable
    )
  UNION ALL
  SELECT checked.kind
  FROM pg_catalog.pg_attribute AS attribute
  JOIN pg_catalog.pg_class AS class
    ON class.oid = attribute.attrelid
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = class.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS acl
  JOIN checked_roles AS checked ON checked.oid = acl.grantee
  WHERE namespace.nspname !~ '^pg_'
    AND namespace.nspname <> 'information_schema'
  UNION ALL
  SELECT checked.kind
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = procedure.pronamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(procedure.proacl) AS acl
  JOIN checked_roles AS checked ON checked.oid = acl.grantee
  WHERE namespace.nspname !~ '^pg_'
    AND namespace.nspname <> 'information_schema'
  UNION ALL
  SELECT checked.kind
  FROM pg_catalog.pg_default_acl AS default_acl
  CROSS JOIN LATERAL pg_catalog.aclexplode(default_acl.defaclacl) AS acl
  JOIN checked_roles AS checked ON checked.oid = acl.grantee
), invalid_effective_acl AS (
  SELECT checked.kind
  FROM current_database_role AS database
  CROSS JOIN checked_roles AS checked
  WHERE pg_catalog.has_database_privilege(checked.oid, database.oid, 'CREATE')
    OR pg_catalog.has_database_privilege(checked.oid, database.oid, 'TEMPORARY')
  UNION ALL
  SELECT checked.kind
  FROM pg_catalog.pg_namespace AS namespace
  CROSS JOIN checked_roles AS checked
  WHERE namespace.nspname !~ '^pg_'
    AND namespace.nspname <> 'information_schema'
    AND (
      pg_catalog.has_schema_privilege(checked.oid, namespace.oid, 'CREATE')
      OR (
        namespace.nspname <> 'brain_read'
        AND pg_catalog.has_schema_privilege(checked.oid, namespace.oid, 'USAGE')
      )
    )
  UNION ALL
  SELECT checked.kind
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = class.relnamespace
  CROSS JOIN checked_roles AS checked
  WHERE namespace.nspname !~ '^pg_'
    AND namespace.nspname <> 'information_schema'
    AND (
      (
        class.relkind = 'S'
        AND pg_catalog.has_sequence_privilege(
          checked.oid,
          class.oid,
          'USAGE,SELECT,UPDATE'
        )
      )
      OR (
        class.relkind IN ('r', 'p', 'v', 'm', 'f')
        AND (
          pg_catalog.has_table_privilege(
            checked.oid,
            class.oid,
            'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
          )
          OR pg_catalog.has_any_column_privilege(
            checked.oid,
            class.oid,
            'SELECT,INSERT,UPDATE,REFERENCES'
          )
        )
      )
    )
    AND NOT (
      namespace.nspname = 'brain_read'
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
      AND pg_catalog.has_table_privilege(checked.oid, class.oid, 'SELECT')
      AND NOT pg_catalog.has_table_privilege(
        checked.oid,
        class.oid,
        'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
      )
      AND NOT pg_catalog.has_any_column_privilege(
        checked.oid,
        class.oid,
        'INSERT,UPDATE,REFERENCES'
      )
    )
  UNION ALL
  SELECT checked.kind
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = procedure.pronamespace
  CROSS JOIN checked_roles AS checked
  WHERE namespace.nspname !~ '^pg_'
    AND namespace.nspname <> 'information_schema'
    AND pg_catalog.has_function_privilege(checked.oid, procedure.oid, 'EXECUTE')
), unsafe_public_function AS (
  SELECT 1
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = procedure.pronamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(
      procedure.proacl,
      pg_catalog.acldefault('f', procedure.proowner)
    )
  ) AS acl
  WHERE namespace.nspname !~ '^pg_'
    AND namespace.nspname <> 'information_schema'
    AND procedure.prokind IN ('f', 'w')
    AND acl.grantee = 0
    AND acl.privilege_type = 'EXECUTE'
), migration_owner_global_function_default AS (
  SELECT default_acl.*
  FROM pg_catalog.pg_default_acl AS default_acl
  JOIN migration_owner_role AS migration_owner
    ON migration_owner.oid = default_acl.defaclrole
  WHERE default_acl.defaclobjtype = 'f'
    AND default_acl.defaclnamespace = 0
), unsafe_migration_owner_function_default AS (
  SELECT 1
  WHERE NOT EXISTS (SELECT 1 FROM migration_owner_global_function_default)
  UNION ALL
  SELECT 1
  FROM pg_catalog.pg_default_acl AS default_acl
  JOIN migration_owner_role AS migration_owner
    ON migration_owner.oid = default_acl.defaclrole
  CROSS JOIN LATERAL pg_catalog.aclexplode(default_acl.defaclacl) AS acl
  WHERE default_acl.defaclobjtype = 'f'
    AND acl.grantee = 0
    AND acl.privilege_type = 'EXECUTE'
)
SELECT
  EXISTS (SELECT 1 FROM login_role) AS brain_login_exists,
  EXISTS (SELECT 1 FROM migration_owner_role) AS brain_migration_owner_exists,
  COALESCE(
    (
      SELECT
        count(*) > 0
        AND count(*) = count(DISTINCT allowed.datname)
        AND pg_catalog.bool_and(allowed.datname <> '')
        AND pg_catalog.bool_or(allowed.datname = current_database())
      FROM allowed_database_names AS allowed
    ),
    false
  )
  AND NOT EXISTS (
    SELECT 1
    FROM allowed_database_names AS allowed
    LEFT JOIN pg_catalog.pg_database AS database
      ON database.datname = allowed.datname
    WHERE database.oid IS NULL
      OR database.datistemplate
      OR NOT database.datallowconn
  ) AS brain_allowlist_valid,
  COALESCE(NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_database AS database
    CROSS JOIN login_role AS login
    WHERE NOT database.datistemplate
      AND NOT EXISTS (
        SELECT 1
        FROM allowed_database_names AS allowed
        WHERE allowed.datname = database.datname
      )
      AND (
        pg_catalog.has_database_privilege(login.oid, database.oid, 'CONNECT')
        OR pg_catalog.has_database_privilege(login.oid, database.oid, 'CREATE')
        OR pg_catalog.has_database_privilege(login.oid, database.oid, 'TEMPORARY')
      )
  ), false) AS brain_outside_database_privileges_safe,
  COALESCE((
    SELECT
      role.rolname <> 'loopos_brain_reader'
      AND role.rolcanlogin
      AND NOT role.rolinherit
      AND NOT role.rolsuper
      AND NOT role.rolcreatedb
      AND NOT role.rolcreaterole
      AND NOT role.rolreplication
      AND NOT role.rolbypassrls
    FROM login_role AS role
  ), false) AS brain_login_attributes_safe,
  COALESCE((
    SELECT
      NOT role.rolcanlogin
      AND NOT role.rolinherit
      AND NOT role.rolsuper
      AND NOT role.rolcreatedb
      AND NOT role.rolcreaterole
      AND NOT role.rolreplication
      AND NOT role.rolbypassrls
    FROM reader_role AS role
  ), false) AS brain_reader_attributes_safe,
  COALESCE(NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members AS membership
    CROSS JOIN login_role AS login
    CROSS JOIN reader_role AS reader
    WHERE membership.member = login.oid
      AND (
        membership.roleid <> reader.oid
        OR membership.admin_option
      )
  ), false) AS brain_login_memberships_safe,
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members AS membership
    CROSS JOIN reader_role AS reader
    CROSS JOIN login_role AS login
    WHERE membership.member = reader.oid
      OR (
        membership.roleid = reader.oid
        AND (
          membership.member <> login.oid
          OR membership.admin_option
        )
      )
  ) AS brain_reader_memberships_safe,
  NOT EXISTS (
    SELECT 1 FROM invalid_direct_acl WHERE kind = 'login'
    UNION ALL
    SELECT 1 FROM invalid_effective_acl WHERE kind = 'login'
  )
  AND EXISTS (
    SELECT 1
    FROM current_database_role AS database
    CROSS JOIN login_role AS login
    WHERE pg_catalog.has_database_privilege(login.oid, database.oid, 'CONNECT')
  ) AS brain_login_privileges_safe,
  NOT EXISTS (
    SELECT 1 FROM invalid_direct_acl WHERE kind = 'reader'
    UNION ALL
    SELECT 1 FROM invalid_effective_acl WHERE kind = 'reader'
  ) AS brain_reader_privileges_safe,
  NOT EXISTS (
    SELECT 1 FROM unsafe_public_function
  ) AS brain_public_functions_safe,
  NOT EXISTS (
    SELECT 1 FROM unsafe_migration_owner_function_default
  ) AS brain_migration_owner_function_defaults_safe
\gset

\if :brain_login_exists
\else
  DO $failure$ BEGIN RAISE EXCEPTION 'brain_login_role does not exist'; END $failure$;
\endif
\if :brain_migration_owner_exists
\else
  DO $failure$ BEGIN RAISE EXCEPTION 'brain_migration_owner_role does not exist'; END $failure$;
\endif
\if :brain_allowlist_valid
\else
  DO $failure$ BEGIN RAISE EXCEPTION 'brain database allowlist is invalid for the current database'; END $failure$;
\endif
\if :brain_outside_database_privileges_safe
\else
  DO $failure$ BEGIN RAISE EXCEPTION 'brain_login_role has CONNECT, CREATE, or TEMPORARY outside the database allowlist'; END $failure$;
\endif
\if :brain_login_attributes_safe
\else
  DO $failure$ BEGIN RAISE EXCEPTION 'brain_login_role has unsafe attributes'; END $failure$;
\endif
\if :brain_reader_attributes_safe
\else
  DO $failure$ BEGIN RAISE EXCEPTION 'loopos_brain_reader has unsafe attributes'; END $failure$;
\endif
\if :brain_login_memberships_safe
\else
  DO $failure$ BEGIN RAISE EXCEPTION 'brain_login_role has contaminated memberships'; END $failure$;
\endif
\if :brain_reader_memberships_safe
\else
  DO $failure$ BEGIN RAISE EXCEPTION 'loopos_brain_reader has contaminated memberships'; END $failure$;
\endif
\if :brain_public_functions_safe
\else
  DO $failure$ BEGIN RAISE EXCEPTION 'database has unsafe PUBLIC function EXECUTE'; END $failure$;
\endif
\if :brain_migration_owner_function_defaults_safe
\else
  DO $failure$ BEGIN RAISE EXCEPTION 'migration owner function defaults are unsafe'; END $failure$;
\endif
\if :brain_login_privileges_safe
\else
  DO $failure$ BEGIN RAISE EXCEPTION 'brain_login_role has contaminated privileges'; END $failure$;
\endif
\if :brain_reader_privileges_safe
\else
  DO $failure$ BEGIN RAISE EXCEPTION 'loopos_brain_reader has contaminated privileges'; END $failure$;
\endif

GRANT loopos_brain_reader TO :"brain_login_role";

WITH login_role AS (
  SELECT role.*
  FROM pg_catalog.pg_roles AS role
  WHERE role.rolname = :'brain_login_role'
), reader_role AS (
  SELECT role.*
  FROM pg_catalog.pg_roles AS role
  WHERE role.rolname = 'loopos_brain_reader'
)
SELECT
  (
    SELECT count(*)
    FROM pg_catalog.pg_auth_members AS membership
    CROSS JOIN login_role AS login
    WHERE membership.member = login.oid
  ) = 1
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members AS membership
    CROSS JOIN login_role AS login
    CROSS JOIN reader_role AS reader
    WHERE membership.member = login.oid
      AND membership.roleid = reader.oid
      AND NOT membership.admin_option
  )
  AND (
    SELECT count(*)
    FROM pg_catalog.pg_auth_members AS membership
    CROSS JOIN reader_role AS reader
    WHERE membership.roleid = reader.oid
  ) = 1
  AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members AS membership
    CROSS JOIN reader_role AS reader
    WHERE membership.member = reader.oid
  ) AS brain_post_provision_exact
\gset

\if :brain_post_provision_exact
  COMMIT;
\else
  DO $failure$ BEGIN RAISE EXCEPTION 'reader provisioning invariant failed'; END $failure$;
\endif
