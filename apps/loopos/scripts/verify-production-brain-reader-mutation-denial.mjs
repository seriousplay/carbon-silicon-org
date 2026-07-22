#!/usr/bin/env node

import { createRequire } from "node:module";

const require = createRequire(process.env.LOOPOS_APP_PACKAGE ?? import.meta.url);
const { Client } = require("pg");
const READER_ROLE = "loopos_brain_reader";
const EXPECTED_DENIAL_SQL_STATE = "42501";

const WRITE_PRIVILEGE_SQL = `WITH application_namespaces AS (
  SELECT namespace.*
  FROM pg_catalog.pg_namespace AS namespace
  WHERE namespace.nspname !~ '^pg_'
    AND namespace.nspname <> 'information_schema'
)
SELECT
  (
    SELECT count(*)::integer
    FROM pg_catalog.pg_database AS database
    WHERE database.datname = current_database()
      AND (
        pg_catalog.has_database_privilege(current_user, database.oid, 'CREATE')
        OR pg_catalog.has_database_privilege(current_user, database.oid, 'TEMPORARY')
      )
  ) AS "unsafeDatabasePrivilegeCount",
  (
    SELECT count(*)::integer
    FROM application_namespaces AS namespace
    WHERE pg_catalog.has_schema_privilege(current_user, namespace.oid, 'CREATE')
      OR (
        namespace.nspname <> 'brain_read'
        AND pg_catalog.has_schema_privilege(current_user, namespace.oid, 'USAGE')
      )
  ) AS "unsafeSchemaPrivilegeCount",
  (
    SELECT count(*)::integer
    FROM pg_catalog.pg_class AS class
    JOIN application_namespaces AS namespace ON namespace.oid = class.relnamespace
    WHERE (
        class.relkind = 'S'
        AND pg_catalog.has_sequence_privilege(current_user, class.oid, 'USAGE,SELECT,UPDATE')
      )
      OR (
        class.relkind IN ('r', 'p', 'v', 'm', 'f')
        AND (
          pg_catalog.has_table_privilege(
            current_user,
            class.oid,
            'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
          )
          OR pg_catalog.has_any_column_privilege(
            current_user,
            class.oid,
            'INSERT,UPDATE,REFERENCES'
          )
        )
      )
  ) AS "unsafeRelationWriteCount",
  (
    SELECT count(*)::integer
    FROM pg_catalog.pg_proc AS procedure
    JOIN application_namespaces AS namespace ON namespace.oid = procedure.pronamespace
    WHERE pg_catalog.has_function_privilege(current_user, procedure.oid, 'EXECUTE')
  ) AS "unsafeFunctionExecuteCount",
  (
    SELECT count(*)::integer
    FROM pg_catalog.pg_default_acl AS default_acl
    CROSS JOIN LATERAL pg_catalog.aclexplode(default_acl.defaclacl) AS acl
    WHERE acl.grantee = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)
  ) AS "unsafeDefaultAclCount"`;

function parseArgs(argv) {
  const options = {
    brainDatabaseUrl: process.env.BRAIN_DATABASE_URL,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--brain-database-url") {
      const value = argv[index + 1];
      if (!value) throw new Error("--brain-database-url requires a value");
      options.brainDatabaseUrl = value;
      index += 1;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/verify-production-brain-reader-mutation-denial.mjs [options]

Options:
  --brain-database-url <url>  Dedicated Brain URL. Default: BRAIN_DATABASE_URL
  --json                      Print JSON output

Runs read-only privilege inspection and an update attempt that must fail. The
transaction is always rolled back.`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

async function inspectAndProbe(client) {
  await client.query("BEGIN");
  try {
    await client.query(`SET LOCAL ROLE ${READER_ROLE}`);
    await client.query("SELECT set_config('statement_timeout', '5000ms', true)");

    const identityResult = await client.query(`
      SELECT session_user AS "sessionUser", current_user AS "currentUser"
    `);
    const privilegeResult = await client.query(`
      SELECT
        has_schema_privilege(current_user, namespace.oid, 'USAGE') AS "publicUsage",
        has_table_privilege(current_user, relation.oid, 'SELECT') AS "organizationSelect",
        has_table_privilege(current_user, relation.oid, 'INSERT') AS "organizationInsert",
        has_table_privilege(current_user, relation.oid, 'UPDATE') AS "organizationUpdate",
        has_table_privilege(current_user, relation.oid, 'DELETE') AS "organizationDelete"
      FROM pg_catalog.pg_class AS relation
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND relation.relname = 'organizations'
    `);
    const writePrivilegeResult = await client.query(WRITE_PRIVILEGE_SQL);

    let mutationDenied = false;
    let mutationSqlState = null;
    try {
      await client.query(`
        UPDATE public.organizations
        SET name = name
        WHERE false
      `);
    } catch (error) {
      mutationDenied = true;
      mutationSqlState = typeof error?.code === "string" ? error.code : null;
    }

    await client.query("ROLLBACK").catch(() => undefined);
    return {
      identity: identityResult.rows[0] ?? null,
      privileges: privilegeResult.rows[0] ?? null,
      writePrivileges: writePrivilegeResult.rows[0] ?? null,
      mutationDenied,
      mutationSqlState,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

function buildResult(probe) {
  const writePrivilegesBounded = Boolean(probe.writePrivileges)
    && probe.writePrivileges.unsafeDatabasePrivilegeCount === 0
    && probe.writePrivileges.unsafeSchemaPrivilegeCount === 0
    && probe.writePrivileges.unsafeRelationWriteCount === 0
    && probe.writePrivileges.unsafeFunctionExecuteCount === 0
    && probe.writePrivileges.unsafeDefaultAclCount === 0;
  const checks = [
    {
      name: "reader-role-active",
      ok: probe.identity?.currentUser === READER_ROLE,
      detail: "the transaction assumes loopos_brain_reader",
    },
    {
      name: "no-public-schema-usage",
      ok: probe.privileges?.publicUsage === false,
      detail: "reader cannot use the application schema",
    },
    {
      name: "no-organization-table-read",
      ok: probe.privileges?.organizationSelect === false,
      detail: "reader cannot read the canonical organization table directly",
    },
    {
      name: "no-organization-table-write",
      ok: probe.privileges?.organizationInsert === false
        && probe.privileges?.organizationUpdate === false
        && probe.privileges?.organizationDelete === false,
      detail: "reader has no direct organization mutation privilege",
    },
    {
      name: "no-effective-write-surface",
      ok: writePrivilegesBounded,
      detail: "reader has no effective database, schema, relation, sequence, function, or default-ACL write surface",
    },
    {
      name: "mutation-attempt-denied",
      ok: probe.mutationDenied && probe.mutationSqlState === EXPECTED_DENIAL_SQL_STATE,
      detail: `a no-row UPDATE fails specifically with ${EXPECTED_DENIAL_SQL_STATE} and the transaction is rolled back`,
    },
  ];

  return {
    ok: checks.every((check) => check.ok),
    mode: "production-brain-reader-mutation-denial",
    checks,
    identity: probe.identity,
    privileges: probe.privileges,
    writePrivileges: probe.writePrivileges,
    mutation: {
      denied: probe.mutationDenied,
      sqlState: probe.mutationSqlState,
    },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.brainDatabaseUrl) {
    throw new Error("BRAIN_DATABASE_URL or --brain-database-url is required");
  }

  const client = new Client({ connectionString: options.brainDatabaseUrl });
  await client.connect();
  try {
    const result = buildResult(await inspectAndProbe(client));
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      for (const check of result.checks) {
        console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`);
      }
      console.log(`INFO mutation-sql-state: ${result.mutation.sqlState ?? "<none>"}`);
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
