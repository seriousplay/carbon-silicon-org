#!/usr/bin/env node

import { createRequire } from "node:module";

const require = createRequire(process.env.LOOPOS_APP_PACKAGE ?? import.meta.url);
const { Client } = require("pg");
const READER_ROLE = "loopos_brain_reader";
const STATEMENT_TIMEOUT = "5000ms";
const EXPECTED_VIEW_COUNT = 20;

const IDENTITY_SQL = `SELECT
  session_user AS "sessionUser",
  current_user AS "currentUser",
  pg_has_role(session_user, 'loopos_brain_reader', 'MEMBER') AS "isReaderMember",
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members AS membership
    JOIN pg_catalog.pg_roles AS reader_role
      ON reader_role.oid = membership.roleid
      AND reader_role.rolname = 'loopos_brain_reader'
    JOIN pg_catalog.pg_roles AS login_role
      ON login_role.oid = membership.member
      AND login_role.rolname = session_user
    WHERE NOT membership.admin_option
  ) AS "isDirectReaderMember",
  (
    SELECT count(*)::integer
    FROM pg_catalog.pg_auth_members AS membership
    JOIN pg_catalog.pg_roles AS login_role
      ON login_role.oid = membership.member
      AND login_role.rolname = session_user
  ) AS "loginMembershipCount",
  (
    SELECT count(*)::integer
    FROM pg_catalog.pg_auth_members AS membership
    JOIN pg_catalog.pg_roles AS reader_role
      ON reader_role.oid = membership.roleid
      AND reader_role.rolname = 'loopos_brain_reader'
  ) AS "readerMemberCount",
  (
    SELECT count(*)::integer
    FROM pg_catalog.pg_auth_members AS membership
    JOIN pg_catalog.pg_roles AS reader_role
      ON reader_role.oid = membership.member
      AND reader_role.rolname = 'loopos_brain_reader'
  ) AS "readerParentMembershipCount",
  login_role.rolcanlogin AS "canLogin",
  login_role.rolinherit AS "inheritsPrivileges",
  login_role.rolsuper AS "isSuperuser",
  login_role.rolcreatedb AS "canCreateDatabase",
  login_role.rolcreaterole AS "canCreateRole",
  login_role.rolreplication AS "canReplicate",
  login_role.rolbypassrls AS "bypassesRowSecurity",
  reader_role.rolcanlogin AS "readerCanLogin",
  reader_role.rolinherit AS "readerInheritsPrivileges",
  reader_role.rolsuper AS "readerIsSuperuser",
  reader_role.rolcreatedb AS "readerCanCreateDatabase",
  reader_role.rolcreaterole AS "readerCanCreateRole",
  reader_role.rolreplication AS "readerCanReplicate",
  reader_role.rolbypassrls AS "readerBypassesRowSecurity"
FROM pg_catalog.pg_roles AS login_role
JOIN pg_catalog.pg_roles AS reader_role
  ON reader_role.rolname = 'loopos_brain_reader'
WHERE login_role.rolname = session_user`;

const PRIVILEGE_SQL = `WITH expected_views(name) AS (
  SELECT unnest(ARRAY[
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
), checked_roles AS (
  SELECT role.oid, role.rolname,
    CASE WHEN role.rolname = 'loopos_brain_reader' THEN 'reader' ELSE 'login' END AS kind
  FROM pg_catalog.pg_roles AS role
  WHERE role.rolname IN (session_user, 'loopos_brain_reader')
), application_namespaces AS (
  SELECT namespace.*
  FROM pg_catalog.pg_namespace AS namespace
  WHERE namespace.nspname !~ '^pg_'
    AND namespace.nspname <> 'information_schema'
), allowed_views AS (
  SELECT class.oid
  FROM pg_catalog.pg_class AS class
  JOIN application_namespaces AS namespace ON namespace.oid = class.relnamespace
  JOIN expected_views AS expected ON expected.name = class.relname
  CROSS JOIN pg_catalog.pg_roles AS reader
  WHERE namespace.nspname = 'brain_read'
    AND class.relkind = 'v'
    AND class.reloptions @> ARRAY['security_barrier=true']::text[]
    AND reader.rolname = 'loopos_brain_reader'
    AND pg_catalog.has_table_privilege(reader.oid, class.oid, 'SELECT')
    AND NOT pg_catalog.has_table_privilege(
      reader.oid,
      class.oid,
      'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    )
    AND NOT pg_catalog.has_any_column_privilege(
      reader.oid,
      class.oid,
      'INSERT,UPDATE,REFERENCES'
    )
), unsafe_schema_privileges AS (
  SELECT 1
  FROM application_namespaces AS namespace
  CROSS JOIN checked_roles AS checked
  WHERE pg_catalog.has_schema_privilege(checked.oid, namespace.oid, 'CREATE')
    OR (
      namespace.nspname <> 'brain_read'
      AND pg_catalog.has_schema_privilege(checked.oid, namespace.oid, 'USAGE')
    )
), unsafe_relation_privileges AS (
  SELECT 1
  FROM pg_catalog.pg_class AS class
  JOIN application_namespaces AS namespace ON namespace.oid = class.relnamespace
  CROSS JOIN checked_roles AS checked
  WHERE (
      class.relkind = 'S'
      AND pg_catalog.has_sequence_privilege(checked.oid, class.oid, 'USAGE,SELECT,UPDATE')
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
      AND NOT (
        class.oid IN (SELECT oid FROM allowed_views)
      )
    )
), unsafe_function_privileges AS (
  SELECT 1
  FROM pg_catalog.pg_proc AS procedure
  JOIN application_namespaces AS namespace ON namespace.oid = procedure.pronamespace
  CROSS JOIN checked_roles AS checked
  WHERE pg_catalog.has_function_privilege(checked.oid, procedure.oid, 'EXECUTE')
), unsafe_direct_acl AS (
  SELECT 1
  FROM pg_catalog.pg_database AS database
  CROSS JOIN LATERAL pg_catalog.aclexplode(database.datacl) AS acl
  JOIN checked_roles AS checked ON checked.oid = acl.grantee
  WHERE database.datname = current_database()
    AND NOT (
      checked.kind = 'login'
      AND acl.privilege_type = 'CONNECT'
      AND NOT acl.is_grantable
    )
  UNION ALL
  SELECT 1
  FROM application_namespaces AS namespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(namespace.nspacl) AS acl
  JOIN checked_roles AS checked ON checked.oid = acl.grantee
  WHERE NOT (
    checked.kind = 'reader'
    AND namespace.nspname = 'brain_read'
    AND acl.privilege_type = 'USAGE'
    AND NOT acl.is_grantable
  )
  UNION ALL
  SELECT 1
  FROM pg_catalog.pg_class AS class
  JOIN application_namespaces AS namespace ON namespace.oid = class.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(class.relacl) AS acl
  JOIN checked_roles AS checked ON checked.oid = acl.grantee
  WHERE NOT (
    checked.kind = 'reader'
    AND class.oid IN (SELECT oid FROM allowed_views)
    AND acl.privilege_type = 'SELECT'
    AND NOT acl.is_grantable
  )
  UNION ALL
  SELECT 1
  FROM pg_catalog.pg_attribute AS attribute
  JOIN pg_catalog.pg_class AS class ON class.oid = attribute.attrelid
  JOIN application_namespaces AS namespace ON namespace.oid = class.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS acl
  JOIN checked_roles AS checked ON checked.oid = acl.grantee
  UNION ALL
  SELECT 1
  FROM pg_catalog.pg_proc AS procedure
  JOIN application_namespaces AS namespace ON namespace.oid = procedure.pronamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(procedure.proacl) AS acl
  JOIN checked_roles AS checked ON checked.oid = acl.grantee
  UNION ALL
  SELECT 1
  FROM pg_catalog.pg_default_acl AS default_acl
  CROSS JOIN LATERAL pg_catalog.aclexplode(default_acl.defaclacl) AS acl
  JOIN checked_roles AS checked ON checked.oid = acl.grantee
), unsafe_public_function AS (
  SELECT 1
  FROM pg_catalog.pg_proc AS procedure
  JOIN application_namespaces AS namespace ON namespace.oid = procedure.pronamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
  ) AS acl
  WHERE procedure.prokind IN ('f', 'w')
    AND acl.grantee = 0
    AND acl.privilege_type = 'EXECUTE'
), database_owner_function_default AS (
  SELECT default_acl.*
  FROM pg_catalog.pg_default_acl AS default_acl
  JOIN pg_catalog.pg_database AS database ON database.datdba = default_acl.defaclrole
  WHERE database.datname = current_database()
    AND default_acl.defaclobjtype = 'f'
    AND default_acl.defaclnamespace = 0
), unsafe_database_owner_function_default AS (
  SELECT 1
  WHERE NOT EXISTS (SELECT 1 FROM database_owner_function_default)
  UNION ALL
  SELECT 1
  FROM database_owner_function_default AS default_acl
  CROSS JOIN LATERAL pg_catalog.aclexplode(default_acl.defaclacl) AS acl
  WHERE acl.grantee = 0
    AND acl.privilege_type = 'EXECUTE'
)
SELECT
  (SELECT count(*)::integer FROM expected_views) AS "expectedViewCount",
  (SELECT count(*)::integer FROM allowed_views) AS "allowedViewCount",
  pg_catalog.has_schema_privilege(
    'loopos_brain_reader',
    'brain_read',
    'USAGE'
  ) AS "readerSchemaUsage",
  (
    pg_catalog.has_database_privilege(session_user, current_database(), 'CONNECT')
    AND NOT pg_catalog.has_database_privilege(session_user, current_database(), 'CREATE')
    AND NOT pg_catalog.has_database_privilege(session_user, current_database(), 'TEMPORARY')
  ) AS "loginDatabasePrivilegesSafe",
  (
    NOT pg_catalog.has_database_privilege('loopos_brain_reader', current_database(), 'CONNECT')
    AND NOT pg_catalog.has_database_privilege('loopos_brain_reader', current_database(), 'CREATE')
    AND NOT pg_catalog.has_database_privilege('loopos_brain_reader', current_database(), 'TEMPORARY')
  ) AS "readerDatabasePrivilegesSafe",
  (SELECT count(*)::integer FROM unsafe_schema_privileges) AS "unsafeSchemaPrivilegeCount",
  (SELECT count(*)::integer FROM unsafe_relation_privileges) AS "unsafeRelationPrivilegeCount",
  (SELECT count(*)::integer FROM unsafe_function_privileges) AS "unsafeFunctionPrivilegeCount",
  (SELECT count(*)::integer FROM unsafe_direct_acl) AS "unsafeDirectAclCount",
  (SELECT count(*)::integer FROM unsafe_public_function) AS "unsafePublicFunctionCount",
  (SELECT count(*)::integer FROM unsafe_database_owner_function_default) AS "unsafeFunctionDefaultCount"`;

function parseArgs(argv) {
  const options = {
    brainDatabaseUrl: process.env.BRAIN_DATABASE_URL,
    appDatabaseUrl: process.env.DATABASE_URL,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--brain-database-url") {
      const value = argv[index + 1];
      if (!value) throw new Error("--brain-database-url requires a value");
      options.brainDatabaseUrl = value;
      index += 1;
    } else if (arg === "--app-database-url") {
      const value = argv[index + 1];
      if (!value) throw new Error("--app-database-url requires a value");
      options.appDatabaseUrl = value;
      index += 1;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/verify-production-brain-reader-readiness.mjs [options]

Options:
  --brain-database-url <url>  Dedicated Brain reader URL. Default: BRAIN_DATABASE_URL
  --app-database-url <url>    Application URL for credential separation check. Default: DATABASE_URL
  --json                      Print JSON output

This is a read-only readiness verifier for the future production dynamic-read
gate. It should pass only after an operator-approved dedicated reader login is
configured. It does not provision roles and does not modify data.
`);
}

function redactedUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.password) url.password = "REDACTED";
    return `${url.protocol}//${url.username ? `${url.username}@` : ""}${url.host}${url.pathname}`;
  } catch {
    return "<unparseable>";
  }
}

function comparableUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function identityIsDedicated(identity) {
  return Boolean(identity)
    && typeof identity.sessionUser === "string"
    && identity.sessionUser.length > 0
    && identity.sessionUser !== READER_ROLE
    && identity.currentUser === identity.sessionUser
    && identity.isReaderMember === true
    && identity.isDirectReaderMember === true
    && identity.loginMembershipCount === 1
    && identity.readerMemberCount === 1
    && identity.readerParentMembershipCount === 0
    && identity.canLogin === true
    && identity.inheritsPrivileges === false
    && identity.isSuperuser === false
    && identity.canCreateDatabase === false
    && identity.canCreateRole === false
    && identity.canReplicate === false
    && identity.bypassesRowSecurity === false
    && identity.readerCanLogin === false
    && identity.readerInheritsPrivileges === false
    && identity.readerIsSuperuser === false
    && identity.readerCanCreateDatabase === false
    && identity.readerCanCreateRole === false
    && identity.readerCanReplicate === false
    && identity.readerBypassesRowSecurity === false;
}

function privilegesAreBounded(privileges) {
  return Boolean(privileges)
    && privileges.expectedViewCount === EXPECTED_VIEW_COUNT
    && privileges.allowedViewCount === EXPECTED_VIEW_COUNT
    && privileges.readerSchemaUsage === true
    && privileges.loginDatabasePrivilegesSafe === true
    && privileges.readerDatabasePrivilegesSafe === true
    && privileges.unsafeSchemaPrivilegeCount === 0
    && privileges.unsafeRelationPrivilegeCount === 0
    && privileges.unsafeFunctionPrivilegeCount === 0
    && privileges.unsafeDirectAclCount === 0
    && privileges.unsafePublicFunctionCount === 0
    && privileges.unsafeFunctionDefaultCount === 0;
}

async function runReadinessProbe(client) {
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    await client.query("SET TRANSACTION READ ONLY");
    const identityResult = await client.query(IDENTITY_SQL);
    const identity = identityResult.rows[0] ?? null;
    const privilegeResult = await client.query(PRIVILEGE_SQL);
    const privileges = privilegeResult.rows[0] ?? null;
    await client.query(`SET LOCAL ROLE ${READER_ROLE}`);
    await client.query("SELECT set_config('statement_timeout', $1, true)", [STATEMENT_TIMEOUT]);
    await client.query("SELECT set_config('loopos.organization_id', $1, true)", ["readiness-organization"]);
    await client.query("SELECT set_config('loopos.user_id', $1, true)", ["readiness-user"]);
    await client.query("SELECT set_config('loopos.person_id', $1, true)", ["readiness-person"]);
    const forgedActorResult = await client.query("SELECT 1 FROM brain_read.current_actor LIMIT 1");
    const forgedOrganizationResult = await client.query("SELECT 1 FROM brain_read.organization_identity LIMIT 1");
    await client.query("ROLLBACK");
    transactionOpen = false;
    return {
      identity,
      privileges,
      setLocalRoleOk: true,
      forgedActorRejected: forgedActorResult.rowCount === 0
        && forgedOrganizationResult.rowCount === 0,
    };
  } catch (error) {
    if (transactionOpen) {
      await client.query("ROLLBACK").catch(() => undefined);
    }
    throw error;
  }
}

function buildResult(options, probe) {
  const appComparable = comparableUrl(options.appDatabaseUrl);
  const brainComparable = comparableUrl(options.brainDatabaseUrl);
  const credentialSeparated = Boolean(
    brainComparable && (!appComparable || appComparable !== brainComparable),
  );
  const checks = [
    {
      name: "brain-database-url-present",
      ok: Boolean(options.brainDatabaseUrl),
      detail: "BRAIN_DATABASE_URL is configured",
    },
    {
      name: "credential-separated-from-app",
      ok: credentialSeparated,
      detail: "BRAIN_DATABASE_URL is not the application DATABASE_URL",
    },
    {
      name: "dedicated-reader-identity",
      ok: identityIsDedicated(probe.identity),
      detail: "connection uses one dedicated login with exact loopos_brain_reader membership",
    },
    {
      name: "set-local-reader-role",
      ok: probe.setLocalRoleOk,
      detail: "SET LOCAL ROLE loopos_brain_reader succeeds inside a read-only transaction",
    },
    {
      name: "reader-role-and-acl-bounded",
      ok: privilegesAreBounded(probe.privileges),
      detail: "reader attributes and effective schema, view, relation, sequence, function, and default ACLs match the exact allowlist",
    },
    {
      name: "forged-actor-context-rejected",
      ok: probe.forgedActorRejected,
      detail: "nonexistent actor context returns no current actor or organization rows",
    },
  ];

  return {
    ok: checks.every((check) => check.ok),
    ready: checks.every((check) => check.ok),
    mode: "production-brain-reader-readiness",
    databaseUrls: {
      app: redactedUrl(options.appDatabaseUrl),
      brain: redactedUrl(options.brainDatabaseUrl),
    },
    checks,
    identity: probe.identity,
    privileges: probe.privileges,
  };
}

function printHuman(result) {
  for (const check of result.checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`);
  }
  console.log(`INFO session-user: ${result.identity?.sessionUser ?? "<none>"}`);
  console.log(`INFO ready: ${result.ready ? "yes" : "no"}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.brainDatabaseUrl) {
    throw new Error("BRAIN_DATABASE_URL or --brain-database-url is required");
  }

  const client = new Client({ connectionString: options.brainDatabaseUrl });
  await client.connect();
  try {
    const probe = await runReadinessProbe(client);
    const result = buildResult(options, probe);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printHuman(result);
    }
    if (!result.ok) process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
