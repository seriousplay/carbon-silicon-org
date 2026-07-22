#!/usr/bin/env node

import pg from "pg";

const { Client } = pg;

function parseArgs(argv) {
  const options = {
    databaseUrl: process.env.DATABASE_URL,
    brainDatabaseUrl: process.env.BRAIN_DATABASE_URL,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--database-url") {
      const value = argv[index + 1];
      if (!value) throw new Error("--database-url requires a value");
      options.databaseUrl = value;
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
  console.log(`Usage: node scripts/verify-production-brain-reader-boundary.mjs [options]

Options:
  --database-url <url>  Database URL to inspect. Default: DATABASE_URL
  --json                Print JSON output

This is a read-only M5-B boundary verifier. It proves the current production
state is safely blocked rather than ready: BRAIN_DATABASE_URL must be absent,
the shared reader role must be safe and non-login, and no dedicated login role
may be present.
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

function roleIsSafeNonLogin(role) {
  return Boolean(role)
    && role.rolcanlogin === false
    && role.rolinherit === false
    && role.rolsuper === false
    && role.rolcreatedb === false
    && role.rolcreaterole === false
    && role.rolreplication === false
    && role.rolbypassrls === false
    && Number(role.rolconnlimit) === 0;
}

async function inspect(client) {
  const currentDatabase = await client.query("select current_database() as database");
  const roleRows = await client.query(`
    select
      rolname,
      rolcanlogin,
      rolinherit,
      rolsuper,
      rolcreatedb,
      rolcreaterole,
      rolreplication,
      rolbypassrls,
      rolconnlimit
    from pg_catalog.pg_roles
    where rolname in ('loopos_brain_reader', 'loopos_brain_login')
    order by rolname
  `);
  const schemaRows = await client.query(`
    select nspname
    from pg_catalog.pg_namespace
    where nspname = 'brain_read'
  `);
  const publicAclRows = await client.query(`
    select
      database.datname,
      database.datacl::text as datacl,
      bool_or(acl.privilege_type = 'CONNECT') as public_connect,
      bool_or(acl.privilege_type = 'TEMPORARY') as public_temporary
    from pg_catalog.pg_database database
    cross join lateral pg_catalog.aclexplode(database.datacl) acl
    where database.datistemplate = false
      and acl.grantee = 0
      and acl.privilege_type in ('CONNECT', 'TEMPORARY')
    group by database.datname, database.datacl
    order by database.datname
  `);

  return {
    currentDatabase: currentDatabase.rows[0]?.database ?? null,
    roles: roleRows.rows,
    brainReadSchemaExists: schemaRows.rowCount === 1,
    explicitPublicDatabaseAcls: publicAclRows.rows,
  };
}

function buildResult(options, facts) {
  const reader = facts.roles.find((role) => role.rolname === "loopos_brain_reader") ?? null;
  const login = facts.roles.find((role) => role.rolname === "loopos_brain_login") ?? null;
  const checks = [
    {
      name: "database-url-present",
      ok: Boolean(options.databaseUrl),
      detail: "DATABASE_URL is available for read-only inspection",
    },
    {
      name: "brain-database-url-absent",
      ok: !options.brainDatabaseUrl,
      detail: "M5-B boundary mode must not configure BRAIN_DATABASE_URL",
    },
    {
      name: "brain-read-schema-present",
      ok: facts.brainReadSchemaExists,
      detail: "brain_read schema exists in the inspected database",
    },
    {
      name: "reader-role-safe-nonlogin",
      ok: roleIsSafeNonLogin(reader),
      detail: "loopos_brain_reader exists and has only safe non-login attributes",
    },
    {
      name: "login-role-absent",
      ok: !login,
      detail: "loopos_brain_login is absent in the current blocked boundary state",
    },
  ];

  return {
    ok: checks.every((check) => check.ok),
    ready: false,
    mode: "m5b-safe-blocked-boundary",
    database: {
      current: facts.currentDatabase,
      url: redactedUrl(options.databaseUrl),
    },
    brainDatabaseUrlConfigured: Boolean(options.brainDatabaseUrl),
    checks,
    roles: facts.roles,
    explicitPublicDatabaseAcls: facts.explicitPublicDatabaseAcls,
    notes: [
      "This verifier does not prove production Brain dynamic reads are ready.",
      "A future readiness verifier must run after an operator-approved dedicated reader login is configured.",
    ],
  };
}

function printHuman(result) {
  for (const check of result.checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`);
  }
  console.log(`INFO current-database: ${result.database.current ?? "<unknown>"}`);
  console.log(`INFO brain-database-url-configured: ${result.brainDatabaseUrlConfigured ? "yes" : "no"}`);
  for (const acl of result.explicitPublicDatabaseAcls) {
    console.log(
      `INFO explicit-public-acl: ${acl.datname} connect=${acl.public_connect} temporary=${acl.public_temporary} acl=${acl.datacl}`,
    );
  }
  console.log(`INFO ready: ${result.ready ? "yes" : "no"}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.databaseUrl) {
    throw new Error("DATABASE_URL or --database-url is required");
  }

  const client = new Client({ connectionString: options.databaseUrl });
  await client.connect();
  try {
    const facts = await inspect(client);
    const result = buildResult(options, facts);
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
