\set ON_ERROR_STOP on

\if :{?brain_allowed_databases}
\else
  DO $failure$ BEGIN RAISE EXCEPTION 'brain_allowed_databases psql variable is required'; END $failure$;
\endif

\if :{?brain_migration_owner_role}
\else
  DO $failure$ BEGIN RAISE EXCEPTION 'brain_migration_owner_role psql variable is required'; END $failure$;
\endif

BEGIN;

WITH allowed_database_names AS (
  SELECT value AS datname
  FROM pg_catalog.jsonb_array_elements_text(
    :'brain_allowed_databases'::pg_catalog.jsonb
  ) AS allowed(value)
), migration_owner_role AS (
  SELECT role.oid
  FROM pg_catalog.pg_roles AS role
  WHERE role.rolname = :'brain_migration_owner_role'
)
SELECT
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
  EXISTS (SELECT 1 FROM migration_owner_role) AS brain_migration_owner_exists
\gset

\if :brain_allowlist_valid
\else
  DO $failure$ BEGIN RAISE EXCEPTION 'brain database allowlist is invalid for the current database'; END $failure$;
\endif

\if :brain_migration_owner_exists
\else
  DO $failure$ BEGIN RAISE EXCEPTION 'brain_migration_owner_role does not exist'; END $failure$;
\endif

SELECT pg_catalog.format(
  'REVOKE ALL PRIVILEGES ON SCHEMA %I FROM PUBLIC',
  namespace.nspname
)
FROM pg_catalog.pg_namespace AS namespace
WHERE namespace.nspname !~ '^pg_'
  AND namespace.nspname <> 'information_schema'
ORDER BY namespace.nspname
\gexec

SELECT pg_catalog.format(
  'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA %I FROM PUBLIC',
  namespace.nspname
)
FROM pg_catalog.pg_namespace AS namespace
WHERE namespace.nspname !~ '^pg_'
  AND namespace.nspname <> 'information_schema'
ORDER BY namespace.nspname
\gexec

SELECT pg_catalog.format(
  'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA %I FROM PUBLIC',
  namespace.nspname
)
FROM pg_catalog.pg_namespace AS namespace
WHERE namespace.nspname !~ '^pg_'
  AND namespace.nspname <> 'information_schema'
ORDER BY namespace.nspname
\gexec

SELECT pg_catalog.format(
  'REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA %I FROM PUBLIC',
  namespace.nspname
)
FROM pg_catalog.pg_namespace AS namespace
WHERE namespace.nspname !~ '^pg_'
  AND namespace.nspname <> 'information_schema'
ORDER BY namespace.nspname
\gexec

SELECT pg_catalog.format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC',
  :'brain_migration_owner_role'
)
\gexec

WITH migration_owner_role AS (
  SELECT role.oid
  FROM pg_catalog.pg_roles AS role
  WHERE role.rolname = :'brain_migration_owner_role'
), global_function_default AS (
  SELECT default_acl.*
  FROM pg_catalog.pg_default_acl AS default_acl
  JOIN migration_owner_role AS migration_owner
    ON migration_owner.oid = default_acl.defaclrole
  WHERE default_acl.defaclobjtype = 'f'
    AND default_acl.defaclnamespace = 0
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
), unsafe_migration_owner_function_default AS (
  SELECT 1
  WHERE NOT EXISTS (SELECT 1 FROM global_function_default)
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
  NOT EXISTS (
    SELECT 1 FROM unsafe_public_function
  ) AS brain_existing_functions_safe,
  NOT EXISTS (
    SELECT 1 FROM unsafe_migration_owner_function_default
  ) AS brain_function_defaults_safe
\gset

\if :brain_existing_functions_safe
\else
  DO $failure$ BEGIN RAISE EXCEPTION 'database has unsafe PUBLIC function EXECUTE after hardening'; END $failure$;
\endif

\if :brain_function_defaults_safe
  COMMIT;
\else
  DO $failure$ BEGIN RAISE EXCEPTION 'migration owner function defaults are unsafe after hardening'; END $failure$;
\endif
