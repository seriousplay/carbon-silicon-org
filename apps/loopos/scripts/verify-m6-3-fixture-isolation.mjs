import { Pool } from "pg";

const PREFIX = "m6-3-acceptance-";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const organizations = await pool.query(
    `SELECT id, name, slug
       FROM organizations
      WHERE name LIKE $1 OR slug LIKE $1
      ORDER BY name, id`,
    [`${PREFIX}%`],
  );
  const organizationIds = organizations.rows.map((row) => row.id);
  const accounts = organizationIds.length === 0
    ? { rows: [] }
    : await pool.query(
        `SELECT u.email, m."organizationId" AS "organizationId"
           FROM users u
           JOIN memberships m ON m."userId" = u.id
          WHERE m."organizationId" = ANY($1::text[])
          ORDER BY u.email`,
        [organizationIds],
      );
  const governance = organizationIds.length === 0
    ? { rows: [] }
    : await pool.query(
        `SELECT "organizationId", count(*)::int AS count
           FROM governance_proposal_revisions
          WHERE "organizationId" = ANY($1::text[])
          GROUP BY "organizationId"
          ORDER BY "organizationId"`,
        [organizationIds],
      );

  const invalidAccounts = accounts.rows.filter(
    (row) => typeof row.email !== "string" || !row.email.startsWith(PREFIX),
  );
  const invalidOrganizations = organizations.rows.filter(
    (row) => !String(row.name).startsWith(PREFIX) && !String(row.slug).startsWith(PREFIX),
  );
  const result = {
    ok: invalidAccounts.length === 0 && invalidOrganizations.length === 0,
    prefix: PREFIX,
    organizations: organizations.rows,
    accounts: accounts.rows,
    governanceRevisionCounts: governance.rows,
    invalidAccounts,
    invalidOrganizations,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
} finally {
  await pool.end();
}
