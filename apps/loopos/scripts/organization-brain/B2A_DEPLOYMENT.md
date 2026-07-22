# B2a reader database deployment

PostgreSQL has no per-role `DENY`. Run this deployment only after the operator
has isolated the dedicated brain login from every non-template database that is
not in the explicit allowlist. The provisioning script fails if the login still
has `CONNECT`, `CREATE`, or `TEMPORARY` there, including privileges inherited
from `PUBLIC`.

Use one JSON allowlist for every allowed database in the cluster:

```sh
brain_allowed_databases='["loopos_primary","loopos_secondary"]'
brain_login_role='loopos_brain_login'
brain_migration_owner_role='loopos_migration_owner'
```

For each allowlisted database, in this order:

1. Apply the repository migrations through V5-M1-B1 as the migration owner.
2. Revoke `TEMPORARY` from `PUBLIC` on the database. Confirm the migration owner
   and application roles have the direct privileges they need before hardening.
3. Run database-local hardening:

   ```sh
   psql "$DATABASE_URL" --no-psqlrc --set=ON_ERROR_STOP=1 \
     --set=brain_allowed_databases="$brain_allowed_databases" \
     --set=brain_migration_owner_role="$brain_migration_owner_role" \
     --file scripts/organization-brain/harden-reader-database.sql
   ```

4. Provision or verify the shared reader role and dedicated login membership:

   ```sh
   psql "$DATABASE_URL" --no-psqlrc --set=ON_ERROR_STOP=1 \
     --set=brain_allowed_databases="$brain_allowed_databases" \
     --set=brain_login_role="$brain_login_role" \
     --set=brain_migration_owner_role="$brain_migration_owner_role" \
     --file scripts/organization-brain/provision-reader-role.sql
   ```

5. Apply the V5-M1-B2a migration.

The hardening script changes only the current database. It removes `PUBLIC`
privileges from non-system schemas and their existing tables, sequences, and
functions, then revokes future function `EXECUTE` from `PUBLIC` for the named
migration owner. It does not create roles, change another database, or manage a
password.

If provisioning reports access outside the allowlist, stop. Isolate those
databases at the operator level before retrying; the script does not revoke
their `PUBLIC CONNECT` automatically.

## Future database admission

Provisioning is a point-in-time check. The SQL does not continuously monitor
databases created after a successful run. Admit every future database with this
operator-controlled sequence:

1. Create it without an exposure window:

   ```sql
   CREATE DATABASE new_database WITH ALLOW_CONNECTIONS=false;
   ```

2. Before opening it, revoke the default connection and temporary-object
   privileges, plus any other dangerous privileges not required by its purpose:

   ```sql
   REVOKE CONNECT, TEMPORARY ON DATABASE new_database FROM PUBLIC;
   ```

3. From any already allowed database, rerun `provision-reader-role.sql` with the
   same JSON allowlist. The new database remains outside that list, so the
   cluster check must pass only after its unsafe privileges are removed.
4. Only after that provision check succeeds may the operator open connections:

   ```sql
   ALTER DATABASE new_database ALLOW_CONNECTIONS=true;
   ```

Opening the database does not grant the dedicated login `CONNECT`; verify that
its connection attempt is still rejected.

For removal, run the B2a rollback in every allowed database first. Run
`deprovision-reader-role.sql` only after all database-local dependencies are
gone. The dedicated login and its password remain operator-managed.
