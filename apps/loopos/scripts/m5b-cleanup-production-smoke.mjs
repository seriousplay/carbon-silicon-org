#!/usr/bin/env node

import { Pool } from "pg";

function parseArgs(argv) {
  const options = {
    email: "",
    orgName: "",
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--email") {
      options.email = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--org-name") {
      options.orgName = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--json") {
      options.json = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!options.email.endsWith("@loopos.test")) {
    throw new Error("--email must be a loopos.test smoke account");
  }
  if (!options.orgName.startsWith("M5B Smoke ")) {
    throw new Error("--org-name must be an M5B Smoke organization");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("begin");
    const target = await client.query(
      `
        select
          u.id as "userId",
          coalesce(p."organizationId", m."organizationId", o.id) as "organizationId"
        from users u
        left join people p on p."userId" = u.id
        left join memberships m on m."userId" = u.id
        left join organizations o on o.name = $2
        where u.email = $1
      `,
      [options.email, options.orgName],
    );
    const userIds = [...new Set(target.rows.map((row) => row.userId).filter(Boolean))];
    const organizationIds = [...new Set(target.rows.map((row) => row.organizationId).filter(Boolean))];

    const deleted = {
      organizations: 0,
      users: 0,
    };

    if (organizationIds.length > 0) {
      const result = await client.query(
        `delete from organizations where id = any($1::text[])`,
        [organizationIds],
      );
      deleted.organizations = result.rowCount ?? 0;
    }

    if (userIds.length > 0) {
      const result = await client.query(
        `delete from users where id = any($1::text[])`,
        [userIds],
      );
      deleted.users = result.rowCount ?? 0;
    }

    const residue = await client.query(
      `
        select
          (select count(*)::int from users where email = $1) as users,
          (select count(*)::int from people where email = $1) as people,
          (select count(*)::int from organizations where name = $2) as organizations,
          (select count(*)::int from sessions s join users u on u.id = s."userId" where u.email = $1) as sessions,
          (select count(*)::int from accounts a join users u on u.id = a."userId" where u.email = $1) as accounts
      `,
      [options.email, options.orgName],
    );
    await client.query("commit");

    const output = {
      ok: Object.values(residue.rows[0]).every((count) => count === 0),
      email: options.email,
      orgName: options.orgName,
      found: {
        users: userIds.length,
        organizations: organizationIds.length,
      },
      deleted,
      residue: residue.rows[0],
    };
    console.log(options.json ? JSON.stringify(output, null, 2) : output);
    if (!output.ok) process.exit(1);
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
