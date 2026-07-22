\set ON_ERROR_STOP on

\if :{?brain_login_role}
\else
  \echo 'brain_login_role is required (use --set=brain_login_role=<existing-login-role>)'
  DO $failure$ BEGIN RAISE EXCEPTION 'brain_login_role psql variable is required'; END $failure$;
\endif

SELECT EXISTS (
  SELECT 1
  FROM pg_catalog.pg_roles AS role
  WHERE role.rolname = 'loopos_brain_reader'
) AS brain_reader_exists
\gset

\if :brain_reader_exists
  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles AS role
    WHERE role.rolname = :'brain_login_role'
      AND role.rolcanlogin
  ) AS brain_login_exists
  \gset

  \if :brain_login_exists
  \else
    \echo 'brain_login_role must name the existing dedicated LOGIN role'
    DO $failure$ BEGIN RAISE EXCEPTION 'brain_login_role does not exist'; END $failure$;
  \endif

  BEGIN;
  REVOKE loopos_brain_reader FROM :"brain_login_role";

  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members AS membership
    JOIN pg_catalog.pg_roles AS granted_role
      ON granted_role.oid = membership.roleid
    WHERE granted_role.rolname = 'loopos_brain_reader'
  ) AS brain_reader_has_other_members
  \gset

  \if :brain_reader_has_other_members
    \echo 'loopos_brain_reader still has members; refusing to drop the shared role'
    DO $failure$ BEGIN RAISE EXCEPTION 'loopos_brain_reader still has members'; END $failure$;
  \endif

  \echo 'Dropping loopos_brain_reader; PostgreSQL will fail explicitly if any database dependency remains'
  DROP ROLE loopos_brain_reader;
  COMMIT;
\else
  \echo 'loopos_brain_reader is already absent'
\endif
