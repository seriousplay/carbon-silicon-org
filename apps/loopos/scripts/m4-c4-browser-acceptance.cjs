/* eslint-disable @typescript-eslint/no-require-imports */
const { randomBytes } = require("node:crypto");
const { mkdirSync, readdirSync, readFileSync, writeFileSync } = require("node:fs");
const { fileURLToPath } = require("node:url");
const { spawn } = require("node:child_process");
const bcrypt = require("bcryptjs");
const { chromium } = require("playwright");
const { Client } = require("pg");

const adminDatabaseUrl = process.env.M4C4_ADMIN_DATABASE_URL ?? "postgresql://heyiqing@localhost:5432/postgres";
const port = Number(process.env.M4C4_BROWSER_PORT ?? 3228);
const baseUrl = `http://127.0.0.1:${port}`;
const evidenceDir = process.env.M4C4_EVIDENCE_DIR ?? `/tmp/loopos-m4c4-browser-${Date.now()}`;
const password = "M4C4-browser-pass-2026";
const suffix = `${Date.now()}_${randomBytes(3).toString("hex")}`;
const database = `loopos_m4c4_browser_${suffix}`;
const claim = "M4C4 memory policy is confirmed through source authority.";
const question = "M4C4 memory policy 是什么？";
const migrationsRoot = fileURLToPath(new URL("../prisma/migrations/", `file://${__filename}`));
const migrations = readdirSync(migrationsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .sort((left, right) => left.name.localeCompare(right.name))
  .map((entry) => ({
    name: entry.name,
    sql: readFileSync(`${migrationsRoot}/${entry.name}/migration.sql`, "utf8"),
  }));

const ids = {
  org: "org-m4c4",
  tenantOrg: "org-m4c4-tenant-b",
  reviewerUser: "user-m4c4-reviewer",
  otherUser: "user-m4c4-other",
  tenantUser: "user-m4c4-tenant",
  reviewerMembership: "membership-m4c4-reviewer",
  otherMembership: "membership-m4c4-other",
  tenantMembership: "membership-m4c4-tenant",
  circle: "circle-m4c4",
  otherCircle: "circle-m4c4-other",
  tenantCircle: "circle-m4c4-tenant",
  reviewerPerson: "person-m4c4-reviewer",
  otherPerson: "person-m4c4-other",
  tenantPerson: "person-m4c4-tenant",
  meeting: "meeting-m4c4-source",
  candidate: "candidate-m4c4-confirmed",
};

const accounts = {
  reviewer: { email: `m4c4-reviewer-${suffix}@loopos.test`, name: "M4C4 Reviewer" },
  other: { email: `m4c4-other-${suffix}@loopos.test`, name: "M4C4 Other" },
  tenant: { email: `m4c4-tenant-${suffix}@loopos.test`, name: "M4C4 Tenant" },
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
      "SELECT count(*)::integer AS count FROM pg_catalog.pg_roles WHERE rolname = 'loopos_brain_reader'",
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
      "SELECT count(*)::integer AS count FROM pg_catalog.pg_database WHERE datname = $1",
      [database],
    );
    if (residue.rows[0].count !== 0) throw new Error(`Database cleanup failed: ${database}`);
  });
}

async function seedFixture(connectionString) {
  const passwordHash = await bcrypt.hash(password, 12);
  const now = "2026-07-16 09:00:00";
  const sourceRefs = JSON.stringify([{
    type: "meeting",
    id: ids.meeting,
    label: "M4C4 source-authority meeting",
    applicationUrl: `/app/meetings/${ids.meeting}`,
    observedAt: "2026-07-16T09:00:00.000Z",
  }]);
  const submittedBy = JSON.stringify({
    type: "person",
    id: ids.otherPerson,
    label: accounts.other.name,
  });

  await withClient(connectionString, async (client) => {
    await client.query("BEGIN");
    await client.query("SET CONSTRAINTS ALL DEFERRED");
    await client.query(`INSERT INTO "organizations" ("id", "name", "slug", "createdAt", "updatedAt")
      VALUES ($1, 'M4C4 Browser Org', $2, TIMESTAMP '${now}', TIMESTAMP '${now}'),
             ($3, 'M4C4 Tenant B Org', $4, TIMESTAMP '${now}', TIMESTAMP '${now}')`, [
      ids.org,
      `m4c4-browser-${suffix}`,
      ids.tenantOrg,
      `m4c4-tenant-${suffix}`,
    ]);
    await client.query(`INSERT INTO "users" ("id", "email", "name", "passwordHash", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, TIMESTAMP '${now}', TIMESTAMP '${now}'),
             ($5, $6, $7, $4, TIMESTAMP '${now}', TIMESTAMP '${now}'),
             ($8, $9, $10, $4, TIMESTAMP '${now}', TIMESTAMP '${now}')`, [
      ids.reviewerUser,
      accounts.reviewer.email,
      accounts.reviewer.name,
      passwordHash,
      ids.otherUser,
      accounts.other.email,
      accounts.other.name,
      ids.tenantUser,
      accounts.tenant.email,
      accounts.tenant.name,
    ]);
    await client.query(`INSERT INTO "memberships" ("id", "userId", "organizationId", "role", "createdAt")
      VALUES ($1, $2, $3, 'ORG_MEMBER', TIMESTAMP '${now}'),
             ($4, $5, $3, 'ORG_MEMBER', TIMESTAMP '${now}'),
             ($6, $7, $8, 'ORG_MEMBER', TIMESTAMP '${now}')`, [
      ids.reviewerMembership,
      ids.reviewerUser,
      ids.org,
      ids.otherMembership,
      ids.otherUser,
      ids.tenantMembership,
      ids.tenantUser,
      ids.tenantOrg,
    ]);
    await client.query(`INSERT INTO "circles" ("id", "organizationId", "name", "number", "type", "purpose", "parentId", "createdAt", "updatedAt")
      VALUES ($1, $2, 'M4C4 来源会议回路', 'CUSTOM', 'PRODUCTION', 'Browser memory retrieval evidence', NULL, TIMESTAMP '${now}', TIMESTAMP '${now}'),
             ($3, $2, 'M4C4 旁观回路', 'CUSTOM', 'PRODUCTION', 'No source access', $1, TIMESTAMP '${now}', TIMESTAMP '${now}'),
             ($4, $5, 'M4C4 Tenant 回路', 'CUSTOM', 'PRODUCTION', 'Tenant isolation', NULL, TIMESTAMP '${now}', TIMESTAMP '${now}')`, [
      ids.circle,
      ids.org,
      ids.otherCircle,
      ids.tenantCircle,
      ids.tenantOrg,
    ]);
    await client.query(`INSERT INTO "people" ("id", "organizationId", "name", "email", "userId", "homeCircleId", "joinedAt", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, TIMESTAMP '${now}', TIMESTAMP '${now}', TIMESTAMP '${now}'),
             ($7, $2, $8, $9, $10, $11, TIMESTAMP '${now}', TIMESTAMP '${now}', TIMESTAMP '${now}'),
             ($12, $13, $14, $15, $16, $17, TIMESTAMP '${now}', TIMESTAMP '${now}', TIMESTAMP '${now}')`, [
      ids.reviewerPerson,
      ids.org,
      accounts.reviewer.name,
      accounts.reviewer.email,
      ids.reviewerUser,
      ids.circle,
      ids.otherPerson,
      accounts.other.name,
      accounts.other.email,
      ids.otherUser,
      ids.otherCircle,
      ids.tenantPerson,
      ids.tenantOrg,
      accounts.tenant.name,
      accounts.tenant.email,
      ids.tenantUser,
      ids.tenantCircle,
    ]);
    await client.query(`INSERT INTO "meetings" ("id", "organizationId", "title", "type", "agenda", "notes", "notesRevision", "durationMin", "startedAt", "circleId", "createdAt")
      VALUES ($1, $2, 'M4C4 Source Authority Meeting', 'TACTICAL', '[]', 'Confirmed source authority for M4C4 memory.', 0, 30, TIMESTAMP '${now}', $3, TIMESTAMP '${now}')`, [
      ids.meeting,
      ids.org,
      ids.circle,
    ]);
    await client.query(`INSERT INTO "_MeetingToPerson" ("A", "B") VALUES ($1, $2)`, [
      ids.meeting,
      ids.reviewerPerson,
    ]);
    await client.query(`INSERT INTO "memory_candidates" (
        "id", "organizationId", "ownerPersonId", "claim", "rationale", "sourceRefs",
        "authorityRouteKind", "authorityRouteLabel", "authorityRouteUrl", "status",
        "submittedBy", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, 'Confirmed memory must be retrieved only for source-authorized actors.', $5::jsonb,
        'MEETING_RECORD', 'Meeting record authority', $6, 'SUBMITTED', $7::jsonb, TIMESTAMP '${now}', TIMESTAMP '${now}')`, [
      ids.candidate,
      ids.org,
      ids.otherPerson,
      claim,
      sourceRefs,
      `/app/meetings/${ids.meeting}`,
      submittedBy,
    ]);
    await client.query(`INSERT INTO "memory_candidate_audit_events" ("id", "organizationId", "candidateId", "type", "actor", "reason", "occurredAt")
      VALUES ('audit-m4c4-created', $1, $2, 'CREATED', $3::jsonb, NULL, TIMESTAMP '2026-07-16 08:58:00'),
             ('audit-m4c4-submitted', $1, $2, 'SUBMITTED', $3::jsonb, 'Seeded submitted candidate.', TIMESTAMP '${now}')`, [
      ids.org,
      ids.candidate,
      submittedBy,
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
    if (child.exitCode !== null) {
      throw new Error(`Next server exited early: ${child.exitCode}\n${ledger.serverOutput.join("")}`);
    }
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

async function askBrain(page, expectedClaim) {
  await page.goto(`${baseUrl}/app/brain`);
  await page.getByLabel("向组织大脑提问").fill(question);
  await page.getByRole("button", { name: "发送问题" }).click();
  if (expectedClaim) {
    await page.getByText("已确认组织记忆").waitFor({ timeout: 30_000 });
    await page.getByText(claim).nth(1).waitFor();
    await page.getByText("会议记录确认").waitFor();
    await page.getByText("M4C4 source-authority meeting").nth(1).waitFor();
  } else {
    await page.getByText(question).waitFor({ timeout: 45_000 });
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes("证据不足") ||
        text.includes("模型不可用") ||
        text.includes("处理失败") ||
        text.includes("请求未通过") ||
        text.includes("本次回答没有可展示的授权证据。");
    }, null, { timeout: 45_000 });
    await page.waitForTimeout(500);
    if (await page.getByText(claim).count()) {
      throw new Error("Unauthorized actor received confirmed memory claim");
    }
  }
}

async function objectCounts(connectionString) {
  return withClient(connectionString, async (client) => {
    const result = await client.query(`SELECT
      (SELECT count(*)::integer FROM "memory_candidates") AS "memoryCandidates",
      (SELECT count(*)::integer FROM "memory_candidate_audit_events") AS "memoryCandidateAuditEvents",
      (SELECT count(*)::integer FROM "brain_conversations") AS "brainConversations",
      (SELECT count(*)::integer FROM "brain_messages") AS "brainMessages",
      (SELECT count(*)::integer FROM "brain_query_audits" WHERE "purpose" = 'M4_C_SHARED_MEMORY_RETRIEVAL') AS "retrievalAudits",
      (SELECT count(*)::integer FROM "tensions") AS "tensions"`);
    return result.rows[0];
  });
}

async function evidenceRows(connectionString) {
  return withClient(connectionString, async (client) => {
    const candidate = await client.query(`SELECT "status"::text AS status, "confirmedBy", "validFrom", "sourceRefs"
      FROM "memory_candidates" WHERE "id" = $1`, [ids.candidate]);
    const events = await client.query(`SELECT "type"::text AS type, "actor" FROM "memory_candidate_audit_events"
      WHERE "candidateId" = $1 ORDER BY "occurredAt" ASC`, [ids.candidate]);
    const audits = await client.query(`SELECT "actorId", "status"::text AS status, "resultCount", "scope"
      FROM "brain_query_audits" WHERE "purpose" = 'M4_C_SHARED_MEMORY_RETRIEVAL'
      ORDER BY "createdAt" ASC`);
    const brainMessages = await client.query(`SELECT "role"::text AS role, "content" FROM "brain_messages"
      ORDER BY "createdAt" ASC`);
    return {
      candidate: candidate.rows[0],
      events: events.rows,
      audits: audits.rows,
      brainMessages: brainMessages.rows,
    };
  });
}

async function runBrowser(connectionString) {
  mkdirSync(evidenceDir, { recursive: true });
  const beforeCounts = await objectCounts(connectionString);
  const browser = await chromium.launch({ headless: true });
  const reviewerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const otherContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const tenantContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const reviewer = await reviewerContext.newPage();
  const other = await otherContext.newPage();
  const tenant = await tenantContext.newPage();
  observe(reviewer, "reviewer");
  observe(other, "other-mobile");
  observe(tenant, "tenant");
  try {
    await login(reviewer, accounts.reviewer);
    await reviewer.goto(`${baseUrl}/app/brain`);
    await reviewer.getByLabel("候选记忆审核").getByText(claim).waitFor({ timeout: 30_000 });
    await reviewer.screenshot({ path: `${evidenceDir}/01-reviewer-source-authority-candidate.png`, fullPage: true });
    await reviewer.getByRole("article")
      .filter({ hasText: claim })
      .getByRole("button", { name: `确认候选记忆：${claim}` })
      .click();
    await reviewer.getByRole("article")
      .filter({ hasText: claim })
      .getByText("已确认")
      .waitFor({ timeout: 30_000 });
    await reviewer.screenshot({ path: `${evidenceDir}/02-reviewer-confirmed-candidate.png`, fullPage: true });

    await askBrain(reviewer, true);
    await reviewer.screenshot({ path: `${evidenceDir}/03-reviewer-brain-confirmed-memory.png`, fullPage: true });
    await Promise.all([
      reviewer.waitForURL(new RegExp(`${baseUrl.replaceAll(".", "\\.")}/app/tensions/new\\?memoryCandidateId=`), { timeout: 30_000 }),
      reviewer.getByRole("link", { name: "提出纠偏张力" }).click(),
    ]);
    await reviewer.screenshot({ path: `${evidenceDir}/04-reviewer-correction-tension-entry.png`, fullPage: true });

    await login(other, accounts.other);
    await askBrain(other, false);
    await other.screenshot({ path: `${evidenceDir}/05-other-no-memory-mobile.png`, fullPage: true });

    await login(tenant, accounts.tenant);
    await askBrain(tenant, false);
    await tenant.screenshot({ path: `${evidenceDir}/06-tenant-no-memory.png`, fullPage: true });

    const afterCounts = await objectCounts(connectionString);
    const rows = await evidenceRows(connectionString);
    writeFileSync(`${evidenceDir}/db-counts.json`, JSON.stringify({ beforeCounts, afterCounts, rows }, null, 2));
    writeFileSync(`${evidenceDir}/network-ledger.json`, JSON.stringify(ledger, null, 2));

    if (rows.candidate.status !== "CONFIRMED") throw new Error(`Candidate not confirmed: ${JSON.stringify(rows.candidate)}`);
    if (rows.candidate.confirmedBy?.id !== `meeting:${ids.reviewerPerson}`) {
      throw new Error(`Unexpected confirmation actor: ${JSON.stringify(rows.candidate.confirmedBy)}`);
    }
    if (!rows.events.map((event) => event.type).includes("CONFIRMED")) {
      throw new Error(`Missing confirmation audit event: ${JSON.stringify(rows.events)}`);
    }
    if (afterCounts.memoryCandidates !== beforeCounts.memoryCandidates) {
      throw new Error(`Browser acceptance should not create candidates: ${JSON.stringify({ beforeCounts, afterCounts })}`);
    }
    if (afterCounts.memoryCandidateAuditEvents !== beforeCounts.memoryCandidateAuditEvents + 1) {
      throw new Error(`Expected one confirmation audit event: ${JSON.stringify({ beforeCounts, afterCounts })}`);
    }
    if (afterCounts.tensions !== beforeCounts.tensions) {
      throw new Error(`Correction affordance should not directly create a tension: ${JSON.stringify({ beforeCounts, afterCounts })}`);
    }
    if (afterCounts.retrievalAudits !== beforeCounts.retrievalAudits + 3) {
      throw new Error(`Expected three shared-memory retrieval audits: ${JSON.stringify({ beforeCounts, afterCounts, audits: rows.audits })}`);
    }
    if (afterCounts.brainConversations !== beforeCounts.brainConversations + 3 || afterCounts.brainMessages !== beforeCounts.brainMessages + 6) {
      throw new Error(`Expected three complete Brain turns: ${JSON.stringify({ beforeCounts, afterCounts, messages: rows.brainMessages })}`);
    }
    const resultCounts = rows.audits.map((audit) => audit.resultCount);
    if (resultCounts.filter((count) => count === 1).length !== 1 || resultCounts.filter((count) => count === 0).length !== 2) {
      throw new Error(`Expected one positive and two zero-result retrieval audits: ${JSON.stringify(rows.audits)}`);
    }
    const brainContent = rows.brainMessages.map((message) => message.content).join("\n");
    if (!brainContent.includes(claim)) throw new Error("Permitted Brain answer did not persist confirmed memory claim");
    if ((brainContent.match(new RegExp(claim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length !== 1) {
      throw new Error("Confirmed memory claim leaked into more than one Brain answer");
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
