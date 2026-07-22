#!/usr/bin/env node

import { createRequire } from "node:module";

const require = createRequire(process.env.LOOPOS_APP_PACKAGE ?? import.meta.url);
const { Client } = require("pg");
const DISALLOWED_DATABASES = Object.freeze(["biocoach", "postgres"]);
const EXPECTED_DENIAL_SQL_STATE = "42501";

function parseArgs(argv) {
  const options = {
    brainDatabaseUrl: process.env.BRAIN_DATABASE_URL,
    applicationDatabaseUrl: process.env.DATABASE_URL,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--brain-database-url") {
      const value = argv[index + 1];
      if (!value) throw new Error("--brain-database-url requires a value");
      options.brainDatabaseUrl = value;
      index += 1;
    } else if (arg === "--application-database-url") {
      const value = argv[index + 1];
      if (!value) throw new Error("--application-database-url requires a value");
      options.applicationDatabaseUrl = value;
      index += 1;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/verify-production-brain-reader-isolation.mjs [options]

Options:
  --brain-database-url <url>  Dedicated Brain URL. Default: BRAIN_DATABASE_URL
  --application-database-url <url>
                              LoopOS app URL. Default: DATABASE_URL
  --json                      Print JSON output

Proves the production Brain and LoopOS application credentials can connect to
LoopOS but are denied access to the unrelated biocoach and postgres databases.`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function databaseUrl(source, database) {
  const url = new URL(source);
  url.pathname = `/${database}`;
  url.searchParams.set("connect_timeout", "5");
  return url.toString();
}

async function probeAllowed(source) {
  const client = new Client({ connectionString: source, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT current_database() AS database, session_user AS "sessionUser"
    `);
    return result.rows[0] ?? null;
  } finally {
    await client.end();
  }
}

async function probeDenied(source, credential, database) {
  const client = new Client({
    connectionString: databaseUrl(source, database),
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    return { credential, database, denied: false, sqlState: null };
  } catch (error) {
    return {
      credential,
      database,
      denied: true,
      sqlState: typeof error?.code === "string" ? error.code : null,
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.brainDatabaseUrl) {
    throw new Error("BRAIN_DATABASE_URL or --brain-database-url is required");
  }
  if (!options.applicationDatabaseUrl) {
    throw new Error("DATABASE_URL or --application-database-url is required");
  }

  const allowed = {
    brain: await probeAllowed(options.brainDatabaseUrl),
    application: await probeAllowed(options.applicationDatabaseUrl),
  };
  const denied = [];
  for (const [credential, source] of Object.entries({
    brain: options.brainDatabaseUrl,
    application: options.applicationDatabaseUrl,
  })) {
    for (const database of DISALLOWED_DATABASES) {
      denied.push(await probeDenied(source, credential, database));
    }
  }

  const checks = [
    {
      name: "brain-loopos-connection-allowed",
      ok: allowed.brain?.database === "loopos"
        && allowed.brain?.sessionUser === "loopos_brain_login",
      detail: "the dedicated credential connects to LoopOS as the dedicated login",
    },
    {
      name: "application-loopos-connection-allowed",
      ok: allowed.application?.database === "loopos"
        && allowed.application?.sessionUser === "loopos_app",
      detail: "the LoopOS application credential connects only as loopos_app",
    },
    ...denied.map((probe) => ({
      name: `${probe.credential}-${probe.database}-connection-denied`,
      ok: probe.denied && probe.sqlState === EXPECTED_DENIAL_SQL_STATE,
      detail: `${probe.credential} cannot connect to ${probe.database} and PostgreSQL returns ${EXPECTED_DENIAL_SQL_STATE}`,
    })),
  ];
  const result = {
    ok: checks.every((check) => check.ok),
    mode: "production-brain-reader-cross-database-isolation",
    checks,
    allowed,
    denied,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const check of checks) {
      console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`);
    }
  }
  if (!result.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
