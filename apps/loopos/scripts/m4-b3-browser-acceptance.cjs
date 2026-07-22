/* eslint-disable @typescript-eslint/no-require-imports */
const { randomBytes } = require("node:crypto");
const { mkdirSync, readdirSync, readFileSync, writeFileSync } = require("node:fs");
const { fileURLToPath } = require("node:url");
const { spawn } = require("node:child_process");
const bcrypt = require("bcryptjs");
const { chromium } = require("playwright");
const { Client } = require("pg");

const adminDatabaseUrl = process.env.M4B3_ADMIN_DATABASE_URL ?? "postgresql://heyiqing@localhost:5432/postgres";
const port = Number(process.env.M4B3_BROWSER_PORT ?? 3226);
const baseUrl = `http://127.0.0.1:${port}`;
const evidenceDir = process.env.M4B3_EVIDENCE_DIR ?? `/tmp/loopos-m4b3-browser-${Date.now()}`;
const password = "M4B3-browser-pass-2026";
const suffix = `${Date.now()}_${randomBytes(3).toString("hex")}`;
const database = `loopos_m4b3_browser_${suffix}`;
const migrationsRoot = fileURLToPath(new URL("../prisma/migrations/", `file://${__filename}`));
const migrations = readdirSync(migrationsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .sort((left, right) => left.name.localeCompare(right.name))
  .map((entry) => ({
    name: entry.name,
    sql: readFileSync(`${migrationsRoot}/${entry.name}/migration.sql`, "utf8"),
  }));

const ids = {
  org: "org-m4b3",
  ownerUser: "user-m4b3-owner",
  otherUser: "user-m4b3-other",
  ownerMembership: "membership-m4b3-owner",
  otherMembership: "membership-m4b3-other",
  ownerCircle: "circle-m4b3-owner",
  otherCircle: "circle-m4b3-other",
  ownerPerson: "person-m4b3-owner",
  otherPerson: "person-m4b3-other",
  ownerRole: "role-m4b3-owner",
  meeting: "meeting-m4b3",
  cycle: "cycle-m4b3",
  proposal: "goal-proposal-m4b3",
  proposalTarget: "proposal-target-m4b3",
  decision: "goal-decision-m4b3",
  goal: "goal-m4b3",
  target: "target-m4b3",
};

const accounts = {
  owner: { email: `m4b3-owner-${suffix}@loopos.test`, name: "M4B3 Owner" },
  other: { email: `m4b3-other-${suffix}@loopos.test`, name: "M4B3 Other" },
};

const ledger = {
  failedRequests: [],
  badResponses: [],
  consoleErrors: [],
  pageErrors: [],
  serverOutput: [],
};

function quotedIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function databaseUrl(databaseName) {
  const url = new URL(adminDatabaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function withClient(connectionString, work) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

async function provisionDatabase() {
  let roleCreated = false;
  await withClient(adminDatabaseUrl, async (admin) => {
    await admin.query(`DROP DATABASE IF EXISTS ${quotedIdentifier(database)} WITH (FORCE)`);
    const existingRole = await admin.query(
      `SELECT count(*)::integer AS count FROM pg_catalog.pg_roles WHERE rolname = 'loopos_brain_reader'`,
    );
    if (existingRole.rows[0].count === 0) {
      await admin.query("CREATE ROLE loopos_brain_reader NOLOGIN NOINHERIT");
      roleCreated = true;
    }
    await admin.query(`CREATE DATABASE ${quotedIdentifier(database)}`);
  });

  const connectionString = databaseUrl(database);
  await withClient(connectionString, async (client) => {
    for (const migration of migrations) await client.query(migration.sql);
  });
  return { connectionString, roleCreated };
}

async function cleanupDatabase(roleCreated) {
  await withClient(adminDatabaseUrl, async (admin) => {
    await admin.query(`DROP DATABASE IF EXISTS ${quotedIdentifier(database)} WITH (FORCE)`);
    if (roleCreated) await admin.query("DROP ROLE IF EXISTS loopos_brain_reader");
    const residue = await admin.query(
      `SELECT count(*)::integer AS count FROM pg_catalog.pg_database WHERE datname = $1`,
      [database],
    );
    if (residue.rows[0].count !== 0) throw new Error(`Database cleanup failed: ${database}`);
  });
}

async function seedFixture(connectionString) {
  const passwordHash = await bcrypt.hash(password, 12);
  const now = "2026-07-15 12:00:00";
  await withClient(connectionString, async (client) => {
    await client.query("BEGIN");
    await client.query("SET CONSTRAINTS ALL DEFERRED");
    await client.query(`INSERT INTO "organizations" ("id", "name", "slug", "createdAt", "updatedAt")
      VALUES ($1, 'M4B3 Browser Org', $2, TIMESTAMP '${now}', TIMESTAMP '${now}')`, [
      ids.org,
      `m4b3-browser-${suffix}`,
    ]);
    await client.query(`INSERT INTO "users" ("id", "email", "name", "passwordHash", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, TIMESTAMP '${now}', TIMESTAMP '${now}'),
             ($5, $6, $7, $4, TIMESTAMP '${now}', TIMESTAMP '${now}')`, [
      ids.ownerUser,
      accounts.owner.email,
      accounts.owner.name,
      passwordHash,
      ids.otherUser,
      accounts.other.email,
      accounts.other.name,
    ]);
    await client.query(`INSERT INTO "memberships" ("id", "userId", "organizationId", "role", "createdAt")
      VALUES ($1, $2, $3, 'ORG_MEMBER', TIMESTAMP '${now}'),
             ($4, $5, $3, 'ORG_MEMBER', TIMESTAMP '${now}')`, [
      ids.ownerMembership,
      ids.ownerUser,
      ids.org,
      ids.otherMembership,
      ids.otherUser,
    ]);
    await client.query(`INSERT INTO "circles" ("id", "organizationId", "name", "number", "type", "purpose", "parentId", "createdAt", "updatedAt")
      VALUES ($1, $2, 'M4B3 目标回路', 'CUSTOM', 'PRODUCTION', 'Memory candidate browser evidence', NULL, TIMESTAMP '${now}', TIMESTAMP '${now}'),
             ($3, $2, 'M4B3 旁观回路', 'CUSTOM', 'PRODUCTION', 'No private goal access', $1, TIMESTAMP '${now}', TIMESTAMP '${now}')`, [
      ids.ownerCircle,
      ids.org,
      ids.otherCircle,
    ]);
    await client.query(`INSERT INTO "people" ("id", "organizationId", "name", "email", "userId", "homeCircleId", "joinedAt", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, TIMESTAMP '${now}', TIMESTAMP '${now}', TIMESTAMP '${now}'),
             ($7, $2, $8, $9, $10, $11, TIMESTAMP '${now}', TIMESTAMP '${now}', TIMESTAMP '${now}')`, [
      ids.ownerPerson,
      ids.org,
      accounts.owner.name,
      accounts.owner.email,
      ids.ownerUser,
      ids.ownerCircle,
      ids.otherPerson,
      accounts.other.name,
      accounts.other.email,
      ids.otherUser,
      ids.otherCircle,
    ]);
    await client.query(`INSERT INTO "role_defs" ("id", "organizationId", "name", "purpose", "accountabilities", "category", "status", "circleId", "createdAt", "updatedAt")
      VALUES ($1, $2, 'M4B3 Goal Owner', 'Own memory candidate evidence goal', 'Maintain private brief evidence', 'OPERATIONS', 'ACTIVE', $3, TIMESTAMP '${now}', TIMESTAMP '${now}')`, [
      ids.ownerRole,
      ids.org,
      ids.ownerCircle,
    ]);
    await client.query(`INSERT INTO "_PersonRoles" ("A", "B") VALUES ($1, $2)`, [ids.ownerPerson, ids.ownerRole]);
    await client.query(`INSERT INTO "meetings" ("id", "organizationId", "title", "type", "agenda", "notes", "notesRevision", "durationMin", "startedAt", "circleId", "createdAt")
      VALUES ($1, $2, 'M4B3 Goal Adoption', 'TACTICAL', '[]', 'Adopt M4B3 goal', 0, 30, TIMESTAMP '${now}', $3, TIMESTAMP '${now}')`, [
      ids.meeting,
      ids.org,
      ids.ownerCircle,
    ]);
    await client.query(`INSERT INTO "_MeetingToPerson" ("A", "B") VALUES ($1, $2)`, [ids.meeting, ids.ownerPerson]);
    await client.query(`INSERT INTO "goal_cycles" ("id", "organizationId", "name", "status", "startAt", "endAt", "checkInCadenceDays", "createdAt", "updatedAt")
      VALUES ($1, $2, 'M4B3 Cycle', 'PLANNED', TIMESTAMP '2026-07-01 00:00:00', TIMESTAMP '2026-09-30 00:00:00', 7, TIMESTAMP '${now}', TIMESTAMP '${now}')`, [
      ids.cycle,
      ids.org,
    ]);
    await client.query(`UPDATE "goal_cycles"
      SET "status" = 'ACTIVE', "activatedAt" = TIMESTAMP '2026-07-01 00:05:00', "updatedAt" = TIMESTAMP '2026-07-01 00:05:00'
      WHERE "id" = $1`, [ids.cycle]);
    await client.query(`INSERT INTO "goal_proposals" ("id", "organizationId", "cycleId", "circleId", "proposerId", "kind", "status", "currentRevision", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, 'CREATE', 'DRAFT', 1, TIMESTAMP '2026-07-01 01:00:00', TIMESTAMP '2026-07-01 01:00:00')`, [
      ids.proposal,
      ids.org,
      ids.cycle,
      ids.ownerCircle,
      ids.ownerPerson,
    ]);
    await client.query(`INSERT INTO "goal_proposal_revisions" ("organizationId", "proposalId", "revision", "title", "intendedOutcome", "ownerRoleId", "authoredById", "createdAt")
      VALUES ($1, $2, 1, 'M4B3 私人简报目标', 'Browser can submit private drift signals', $3, $4, TIMESTAMP '2026-07-01 01:10:00')`, [
      ids.org,
      ids.proposal,
      ids.ownerRole,
      ids.ownerPerson,
    ]);
    await client.query(`INSERT INTO "goal_proposal_targets" ("id", "organizationId", "proposalId", "revision", "position", "label", "kind", "acceptanceCriteria", "createdAt")
      VALUES ($1, $2, $3, 1, 1, 'M4B3 Evidence Target', 'MILESTONE', 'Browser evidence exists', TIMESTAMP '2026-07-01 01:20:00')`, [
      ids.proposalTarget,
      ids.org,
      ids.proposal,
    ]);
    await client.query(`UPDATE "goal_proposals"
      SET "status" = 'SUBMITTED', "submittedAt" = TIMESTAMP '2026-07-01 01:25:00', "updatedAt" = TIMESTAMP '2026-07-01 01:25:00'
      WHERE "id" = $1`, [ids.proposal]);
    await client.query(`UPDATE "goal_proposals"
      SET "status" = 'ADOPTED', "terminalAt" = TIMESTAMP '2026-07-01 01:28:00', "updatedAt" = TIMESTAMP '2026-07-01 01:28:00'
      WHERE "id" = $1`, [ids.proposal]);
    await client.query(`INSERT INTO "goal_decisions" ("id", "organizationId", "proposalId", "revision", "outcome", "meetingId", "recorderId", "mutationKey", "decidedAt")
      VALUES ($1, $2, $3, 1, 'ADOPTED', $4, $5, 'm4b3-goal-adopt', TIMESTAMP '2026-07-01 01:30:00')`, [
      ids.decision,
      ids.org,
      ids.proposal,
      ids.meeting,
      ids.ownerPerson,
    ]);
    await client.query(`INSERT INTO "goals" ("id", "organizationId", "cycleId", "circleId", "title", "intendedOutcome", "ownerRoleId", "status", "adoptedDecisionId", "createdAt")
      VALUES ($1, $2, $3, $4, 'M4B3 私人简报目标', 'Browser can submit private drift signals', $5, 'ACTIVE', $6, TIMESTAMP '2026-07-01 02:00:00')`, [
      ids.goal,
      ids.org,
      ids.cycle,
      ids.ownerCircle,
      ids.ownerRole,
      ids.decision,
    ]);
    await client.query(`INSERT INTO "goal_targets" ("id", "organizationId", "goalId", "sourceProposalTargetId", "position", "label", "kind", "acceptanceCriteria", "createdAt")
      VALUES ($1, $2, $3, $4, 1, 'M4B3 Evidence Target', 'MILESTONE', 'Browser evidence exists', TIMESTAMP '2026-07-01 02:10:00')`, [
      ids.target,
      ids.org,
      ids.goal,
      ids.proposalTarget,
    ]);
    await client.query("COMMIT");
  });
}

function startServer(connectionString) {
  const child = spawn(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["next", "start", "--port", String(port), "--hostname", "127.0.0.1"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: connectionString,
        AUTH_URL: baseUrl,
        NEXTAUTH_URL: baseUrl,
        PORT: String(port),
        HOSTNAME: "127.0.0.1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (chunk) => ledger.serverOutput.push(chunk.toString()));
  child.stderr.on("data", (chunk) => ledger.serverOutput.push(chunk.toString()));
  return child;
}

async function waitForServer(child) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 60_000) {
    if (child.exitCode !== null) throw new Error(`Next server exited early: ${child.exitCode}\n${ledger.serverOutput.join("")}`);
    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.ok) return;
    } catch {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${baseUrl}/login\n${ledger.serverOutput.join("")}`);
}

function observe(page, name) {
  page.on("requestfailed", (request) => {
    const error = request.failure()?.errorText;
    if (error !== "net::ERR_ABORTED") ledger.failedRequests.push({ page: name, url: request.url(), error });
  });
  page.on("response", (response) => {
    const url = response.url();
    if (response.status() >= 400 && !url.includes("/_next/static/")) {
      ledger.badResponses.push({ page: name, status: response.status(), url });
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") ledger.consoleErrors.push({ page: name, text: message.text() });
  });
  page.on("pageerror", (error) => ledger.pageErrors.push({ page: name, text: error.message }));
}

async function login(page, account) {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel("邮箱").fill(account.email);
  await page.getByLabel("密码").fill(password);
  await Promise.all([
    page.waitForURL(`${baseUrl}/app`, { timeout: 30_000 }),
    page.getByRole("button", { name: "登录" }).click(),
  ]);
}

async function objectCounts(connectionString) {
  return withClient(connectionString, async (client) => {
    const result = await client.query(`SELECT
      (SELECT count(*)::integer FROM "memory_candidates") AS "memoryCandidates",
      (SELECT count(*)::integer FROM "memory_candidate_audit_events") AS "memoryCandidateAuditEvents",
      (SELECT count(*)::integer FROM "brain_conversations") AS "brainConversations",
      (SELECT count(*)::integer FROM "brain_messages") AS "brainMessages"`);
    return result.rows[0];
  });
}

async function candidateRows(connectionString) {
  return withClient(connectionString, async (client) => {
    const result = await client.query(`SELECT
      "status"::text AS status,
      "ownerPersonId",
      "authorityRouteKind"::text AS "authorityRouteKind",
      "claim",
      jsonb_array_length("sourceRefs")::integer AS "sourceCount"
      FROM "memory_candidates"
      ORDER BY "createdAt" ASC`);
    const events = await client.query(`SELECT "type"::text AS type FROM "memory_candidate_audit_events" ORDER BY "occurredAt" ASC`);
    return { candidates: result.rows, events: events.rows };
  });
}

async function runBrowser(connectionString) {
  mkdirSync(evidenceDir, { recursive: true });
  const beforeCounts = await objectCounts(connectionString);
  const browser = await chromium.launch({ headless: true });
  const ownerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const otherContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const owner = await ownerContext.newPage();
  const other = await otherContext.newPage();
  observe(owner, "owner");
  observe(other, "other-mobile");
  try {
    await login(owner, accounts.owner);
    await owner.goto(`${baseUrl}/app/brain`);
    await owner.getByLabel("私人简报").getByText("仅你可见").waitFor({ timeout: 30_000 });
    await owner.getByText("目标需要更新证据：M4B3 私人简报目标").waitFor();
    await owner.getByRole("article")
      .filter({ hasText: "目标需要更新证据：M4B3 私人简报目标" })
      .getByRole("button", { name: "作为候选记忆提交" })
      .click();
    await owner.getByLabel("候选记忆草稿").getByText("提交前仅你可见").waitFor();
    await owner.getByLabel("候选事实").fill("M4B3 私人简报目标缺少进展证据");
    await owner.getByLabel("提交理由").fill("该目标在浏览器验收夹具中没有任何 check-in，需要来源权威审核是否纳入组织记忆。");
    await owner.screenshot({ path: `${evidenceDir}/01-owner-draft-review.png`, fullPage: true });
    await owner.getByRole("button", { name: "提交候选记忆" }).click();
    await owner.getByLabel("候选记忆草稿").getByText("已提交").waitFor({ timeout: 30_000 });
    await owner.getByLabel("候选记忆草稿").getByText("来源权威：Strategic or Goal process").waitFor();
    await owner.screenshot({ path: `${evidenceDir}/02-owner-submitted-candidate.png`, fullPage: true });

    await login(other, accounts.other);
    await other.goto(`${baseUrl}/app/brain`);
    await other.getByLabel("私人简报").getByText("仅你可见").waitFor({ timeout: 30_000 });
    if (await other.getByText("M4B3 私人简报目标").count()) {
      throw new Error("Unrelated member can see owner private brief signal");
    }
    if (await other.getByText("候选记忆").count()) {
      throw new Error("Unrelated member can see owner candidate surface");
    }
    await other.getByText("暂无需要处理的私人信号").waitFor();
    await other.screenshot({ path: `${evidenceDir}/03-other-empty-private-brief-mobile.png`, fullPage: true });

    const afterCounts = await objectCounts(connectionString);
    const rows = await candidateRows(connectionString);
    writeFileSync(`${evidenceDir}/db-counts.json`, JSON.stringify({ beforeCounts, afterCounts, rows }, null, 2));
    writeFileSync(`${evidenceDir}/network-ledger.json`, JSON.stringify(ledger, null, 2));
    if (afterCounts.memoryCandidates !== beforeCounts.memoryCandidates + 1) {
      throw new Error(`Expected one submitted memory candidate: ${JSON.stringify({ beforeCounts, afterCounts })}`);
    }
    if (afterCounts.memoryCandidateAuditEvents !== beforeCounts.memoryCandidateAuditEvents + 2) {
      throw new Error(`Expected CREATED and SUBMITTED audit events: ${JSON.stringify({ beforeCounts, afterCounts })}`);
    }
    if (
      rows.candidates.length !== 1 ||
      rows.candidates[0].status !== "SUBMITTED" ||
      rows.candidates[0].ownerPersonId !== ids.ownerPerson ||
      rows.candidates[0].authorityRouteKind !== "GOAL_STRATEGY" ||
      rows.candidates[0].sourceCount !== 1
    ) {
      throw new Error(`Unexpected memory candidate row: ${JSON.stringify(rows)}`);
    }
    if (rows.events.map((event) => event.type).join(",") !== "CREATED,SUBMITTED") {
      throw new Error(`Unexpected audit event sequence: ${JSON.stringify(rows.events)}`);
    }
    if (ledger.failedRequests.length || ledger.badResponses.length || ledger.consoleErrors.length || ledger.pageErrors.length) {
      throw new Error(`Browser ledger not clean: ${JSON.stringify(ledger, null, 2)}`);
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  mkdirSync(evidenceDir, { recursive: true });
  let server = null;
  let roleCreated = false;
  try {
    const provisioned = await provisionDatabase();
    roleCreated = provisioned.roleCreated;
    await seedFixture(provisioned.connectionString);
    server = startServer(provisioned.connectionString);
    await waitForServer(server);
    await runBrowser(provisioned.connectionString);
    console.log(JSON.stringify({
      ok: true,
      database,
      baseUrl,
      evidenceDir,
      accounts,
    }, null, 2));
  } finally {
    if (server) {
      server.kill("SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (server.exitCode === null) server.kill("SIGKILL");
    }
    await cleanupDatabase(roleCreated);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
