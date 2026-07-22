/* eslint-disable @typescript-eslint/no-require-imports */
const { randomBytes } = require("node:crypto");
const { mkdirSync, readdirSync, readFileSync, writeFileSync } = require("node:fs");
const { fileURLToPath } = require("node:url");
const { spawn } = require("node:child_process");
const bcrypt = require("bcryptjs");
const { chromium } = require("playwright");
const { Client } = require("pg");

const adminDatabaseUrl = process.env.M4B4_ADMIN_DATABASE_URL ?? "postgresql://heyiqing@localhost:5432/postgres";
const port = Number(process.env.M4B4_BROWSER_PORT ?? 3227);
const baseUrl = `http://127.0.0.1:${port}`;
const evidenceDir = process.env.M4B4_EVIDENCE_DIR ?? `/tmp/loopos-m4b4-browser-${Date.now()}`;
const password = "M4B4-browser-pass-2026";
const suffix = `${Date.now()}_${randomBytes(3).toString("hex")}`;
const database = `loopos_m4b4_browser_${suffix}`;
const migrationsRoot = fileURLToPath(new URL("../prisma/migrations/", `file://${__filename}`));
const migrations = readdirSync(migrationsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .sort((left, right) => left.name.localeCompare(right.name))
  .map((entry) => ({
    name: entry.name,
    sql: readFileSync(`${migrationsRoot}/${entry.name}/migration.sql`, "utf8"),
  }));

const ids = {
  org: "org-m4b4",
  ownerUser: "user-m4b4-owner",
  reviewerUser: "user-m4b4-reviewer",
  adminUser: "user-m4b4-admin",
  otherUser: "user-m4b4-other",
  ownerMembership: "membership-m4b4-owner",
  reviewerMembership: "membership-m4b4-reviewer",
  adminMembership: "membership-m4b4-admin",
  otherMembership: "membership-m4b4-other",
  circle: "circle-m4b4",
  otherCircle: "circle-m4b4-other",
  ownerPerson: "person-m4b4-owner",
  reviewerPerson: "person-m4b4-reviewer",
  adminPerson: "person-m4b4-admin",
  otherPerson: "person-m4b4-other",
  ownerRole: "role-m4b4-owner",
  meeting: "meeting-m4b4",
  cycle: "cycle-m4b4",
  proposal: "goal-proposal-m4b4",
  proposalTarget: "proposal-target-m4b4",
  decision: "goal-decision-m4b4",
  goal: "goal-m4b4",
  target: "target-m4b4",
  confirmCandidate: "candidate-m4b4-confirm",
  rejectCandidate: "candidate-m4b4-reject",
};

const accounts = {
  owner: { email: `m4b4-owner-${suffix}@loopos.test`, name: "M4B4 Owner" },
  reviewer: { email: `m4b4-reviewer-${suffix}@loopos.test`, name: "M4B4 Reviewer" },
  admin: { email: `m4b4-admin-${suffix}@loopos.test`, name: "M4B4 Admin" },
  other: { email: `m4b4-other-${suffix}@loopos.test`, name: "M4B4 Other" },
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
  const now = "2026-07-15 12:00:00";
  const sourceRefs = JSON.stringify([{
    type: "goal",
    id: ids.goal,
    label: "M4B4 Source Goal",
    applicationUrl: "/app/goals",
    observedAt: "2026-07-15T12:00:00.000Z",
  }]);
  const submittedBy = JSON.stringify({
    type: "person",
    id: ids.ownerPerson,
    label: "Current actor",
  });

  await withClient(connectionString, async (client) => {
    await client.query("BEGIN");
    await client.query("SET CONSTRAINTS ALL DEFERRED");
    await client.query(`INSERT INTO "organizations" ("id", "name", "slug", "createdAt", "updatedAt")
      VALUES ($1, 'M4B4 Browser Org', $2, TIMESTAMP '${now}', TIMESTAMP '${now}')`, [
      ids.org,
      `m4b4-browser-${suffix}`,
    ]);
    await client.query(`INSERT INTO "users" ("id", "email", "name", "passwordHash", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, TIMESTAMP '${now}', TIMESTAMP '${now}'),
             ($5, $6, $7, $4, TIMESTAMP '${now}', TIMESTAMP '${now}'),
             ($8, $9, $10, $4, TIMESTAMP '${now}', TIMESTAMP '${now}'),
             ($11, $12, $13, $4, TIMESTAMP '${now}', TIMESTAMP '${now}')`, [
      ids.ownerUser,
      accounts.owner.email,
      accounts.owner.name,
      passwordHash,
      ids.reviewerUser,
      accounts.reviewer.email,
      accounts.reviewer.name,
      ids.adminUser,
      accounts.admin.email,
      accounts.admin.name,
      ids.otherUser,
      accounts.other.email,
      accounts.other.name,
    ]);
    await client.query(`INSERT INTO "memberships" ("id", "userId", "organizationId", "role", "createdAt")
      VALUES ($1, $2, $3, 'ORG_MEMBER', TIMESTAMP '${now}'),
             ($4, $5, $3, 'ORG_MEMBER', TIMESTAMP '${now}'),
             ($6, $7, $3, 'ORG_ADMIN', TIMESTAMP '${now}'),
             ($8, $9, $3, 'ORG_MEMBER', TIMESTAMP '${now}')`, [
      ids.ownerMembership,
      ids.ownerUser,
      ids.org,
      ids.reviewerMembership,
      ids.reviewerUser,
      ids.adminMembership,
      ids.adminUser,
      ids.otherMembership,
      ids.otherUser,
    ]);
    await client.query(`INSERT INTO "circles" ("id", "organizationId", "name", "number", "type", "purpose", "parentId", "createdAt", "updatedAt")
      VALUES ($1, $2, 'M4B4 来源回路', 'CUSTOM', 'PRODUCTION', 'Source-authority review evidence', NULL, TIMESTAMP '${now}', TIMESTAMP '${now}'),
             ($3, $2, 'M4B4 旁观回路', 'CUSTOM', 'PRODUCTION', 'No review authority', $1, TIMESTAMP '${now}', TIMESTAMP '${now}')`, [
      ids.circle,
      ids.org,
      ids.otherCircle,
    ]);
    await client.query(`INSERT INTO "people" ("id", "organizationId", "name", "email", "userId", "homeCircleId", "joinedAt", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, TIMESTAMP '${now}', TIMESTAMP '${now}', TIMESTAMP '${now}'),
             ($7, $2, $8, $9, $10, $6, TIMESTAMP '${now}', TIMESTAMP '${now}', TIMESTAMP '${now}'),
             ($11, $2, $12, $13, $14, $6, TIMESTAMP '${now}', TIMESTAMP '${now}', TIMESTAMP '${now}'),
             ($15, $2, $16, $17, $18, $19, TIMESTAMP '${now}', TIMESTAMP '${now}', TIMESTAMP '${now}')`, [
      ids.ownerPerson,
      ids.org,
      accounts.owner.name,
      accounts.owner.email,
      ids.ownerUser,
      ids.circle,
      ids.reviewerPerson,
      accounts.reviewer.name,
      accounts.reviewer.email,
      ids.reviewerUser,
      ids.adminPerson,
      accounts.admin.name,
      accounts.admin.email,
      ids.adminUser,
      ids.otherPerson,
      accounts.other.name,
      accounts.other.email,
      ids.otherUser,
      ids.otherCircle,
    ]);
    await client.query(`UPDATE "circles" SET "leadPersonId" = $1 WHERE "id" = $2`, [
      ids.reviewerPerson,
      ids.circle,
    ]);
    await client.query(`INSERT INTO "role_defs" ("id", "organizationId", "name", "purpose", "accountabilities", "category", "status", "circleId", "createdAt", "updatedAt")
      VALUES ($1, $2, 'M4B4 Goal Owner', 'Own source memory goal', 'Maintain source-authority review evidence', 'OPERATIONS', 'ACTIVE', $3, TIMESTAMP '${now}', TIMESTAMP '${now}')`, [
      ids.ownerRole,
      ids.org,
      ids.circle,
    ]);
    await client.query(`INSERT INTO "_PersonRoles" ("A", "B") VALUES ($1, $2)`, [ids.ownerPerson, ids.ownerRole]);
    await client.query(`INSERT INTO "meetings" ("id", "organizationId", "title", "type", "agenda", "notes", "notesRevision", "durationMin", "startedAt", "circleId", "createdAt")
      VALUES ($1, $2, 'M4B4 Goal Adoption', 'TACTICAL', '[]', 'Adopt M4B4 goal', 0, 30, TIMESTAMP '${now}', $3, TIMESTAMP '${now}')`, [
      ids.meeting,
      ids.org,
      ids.circle,
    ]);
    await client.query(`INSERT INTO "_MeetingToPerson" ("A", "B") VALUES ($1, $2), ($1, $3)`, [
      ids.meeting,
      ids.ownerPerson,
      ids.reviewerPerson,
    ]);
    await client.query(`INSERT INTO "goal_cycles" ("id", "organizationId", "name", "status", "startAt", "endAt", "checkInCadenceDays", "createdAt", "updatedAt")
      VALUES ($1, $2, 'M4B4 Cycle', 'PLANNED', TIMESTAMP '2026-07-01 00:00:00', TIMESTAMP '2026-09-30 00:00:00', 7, TIMESTAMP '${now}', TIMESTAMP '${now}')`, [
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
      ids.circle,
      ids.ownerPerson,
    ]);
    await client.query(`INSERT INTO "goal_proposal_revisions" ("organizationId", "proposalId", "revision", "title", "intendedOutcome", "ownerRoleId", "authoredById", "createdAt")
      VALUES ($1, $2, 1, 'M4B4 来源审核目标', 'Browser can confirm and reject submitted memory candidates', $3, $4, TIMESTAMP '2026-07-01 01:10:00')`, [
      ids.org,
      ids.proposal,
      ids.ownerRole,
      ids.ownerPerson,
    ]);
    await client.query(`INSERT INTO "goal_proposal_targets" ("id", "organizationId", "proposalId", "revision", "position", "label", "kind", "acceptanceCriteria", "createdAt")
      VALUES ($1, $2, $3, 1, 1, 'M4B4 Review Target', 'MILESTONE', 'Browser review evidence exists', TIMESTAMP '2026-07-01 01:20:00')`, [
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
      VALUES ($1, $2, $3, 1, 'ADOPTED', $4, $5, 'm4b4-goal-adopt', TIMESTAMP '2026-07-01 01:30:00')`, [
      ids.decision,
      ids.org,
      ids.proposal,
      ids.meeting,
      ids.reviewerPerson,
    ]);
    await client.query(`INSERT INTO "goals" ("id", "organizationId", "cycleId", "circleId", "title", "intendedOutcome", "ownerRoleId", "status", "adoptedDecisionId", "createdAt")
      VALUES ($1, $2, $3, $4, 'M4B4 来源审核目标', 'Browser can confirm and reject submitted memory candidates', $5, 'ACTIVE', $6, TIMESTAMP '2026-07-01 02:00:00')`, [
      ids.goal,
      ids.org,
      ids.cycle,
      ids.circle,
      ids.ownerRole,
      ids.decision,
    ]);
    await client.query(`INSERT INTO "goal_targets" ("id", "organizationId", "goalId", "sourceProposalTargetId", "position", "label", "kind", "acceptanceCriteria", "createdAt")
      VALUES ($1, $2, $3, $4, 1, 'M4B4 Review Target', 'MILESTONE', 'Browser review evidence exists', TIMESTAMP '2026-07-01 02:10:00')`, [
      ids.target,
      ids.org,
      ids.goal,
      ids.proposalTarget,
    ]);
    await client.query(`INSERT INTO "memory_candidates" (
        "id", "organizationId", "ownerPersonId", "claim", "rationale", "sourceRefs",
        "authorityRouteKind", "authorityRouteLabel", "authorityRouteUrl", "status",
        "submittedBy", "createdAt", "updatedAt"
      ) VALUES
        ($1, $2, $3, 'M4B4 确认路径候选事实', 'This candidate should be confirmed by the source authority.', $4::jsonb, 'GOAL_STRATEGY', 'Strategic or Goal process', '/app/goals', 'SUBMITTED', $5::jsonb, TIMESTAMP '${now}', TIMESTAMP '${now}'),
        ($6, $2, $3, 'M4B4 拒绝路径候选事实', 'This candidate should be rejected by the source authority.', $4::jsonb, 'GOAL_STRATEGY', 'Strategic or Goal process', '/app/goals', 'SUBMITTED', $5::jsonb, TIMESTAMP '${now}', TIMESTAMP '${now}')`, [
      ids.confirmCandidate,
      ids.org,
      ids.ownerPerson,
      sourceRefs,
      submittedBy,
      ids.rejectCandidate,
    ]);
    await client.query(`INSERT INTO "memory_candidate_audit_events" ("id", "organizationId", "candidateId", "type", "actor", "reason", "occurredAt")
      VALUES
        ('audit-m4b4-confirm-created', $1, $2, 'CREATED', $4::jsonb, NULL, TIMESTAMP '2026-07-15 11:55:00'),
        ('audit-m4b4-confirm-submitted', $1, $2, 'SUBMITTED', $4::jsonb, 'Seeded submitted candidate.', TIMESTAMP '${now}'),
        ('audit-m4b4-reject-created', $1, $3, 'CREATED', $4::jsonb, NULL, TIMESTAMP '2026-07-15 11:56:00'),
        ('audit-m4b4-reject-submitted', $1, $3, 'SUBMITTED', $4::jsonb, 'Seeded submitted candidate.', TIMESTAMP '${now}')`, [
      ids.org,
      ids.confirmCandidate,
      ids.rejectCandidate,
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
      "id",
      "status"::text AS status,
      "authorityRouteKind"::text AS "authorityRouteKind",
      "confirmedBy",
      jsonb_array_length("sourceRefs")::integer AS "sourceCount"
      FROM "memory_candidates"
      ORDER BY "id" ASC`);
    const events = await client.query(`SELECT "candidateId", "type"::text AS type, "actor"
      FROM "memory_candidate_audit_events"
      ORDER BY "candidateId" ASC, "occurredAt" ASC`);
    return { candidates: result.rows, events: events.rows };
  });
}

async function runBrowser(connectionString) {
  mkdirSync(evidenceDir, { recursive: true });
  const beforeCounts = await objectCounts(connectionString);
  const browser = await chromium.launch({ headless: true });
  const ownerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const reviewerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const otherContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const owner = await ownerContext.newPage();
  const reviewer = await reviewerContext.newPage();
  const admin = await adminContext.newPage();
  const other = await otherContext.newPage();
  observe(owner, "owner");
  observe(reviewer, "reviewer");
  observe(admin, "admin");
  observe(other, "other-mobile");
  try {
    await login(owner, accounts.owner);
    await owner.goto(`${baseUrl}/app/brain`);
    await owner.getByLabel("私人简报").getByText("仅你可见").waitFor({ timeout: 30_000 });
    if (await owner.getByText("候选记忆审核").count()) {
      throw new Error("Candidate owner can see source-authority review surface");
    }
    if (await owner.getByText("M4B4 确认路径候选事实").count()) {
      throw new Error("Candidate owner can self-review submitted source candidate");
    }
    await owner.screenshot({ path: `${evidenceDir}/01-owner-no-self-review.png`, fullPage: true });

    await login(admin, accounts.admin);
    await admin.goto(`${baseUrl}/app/brain`);
    await admin.getByLabel("私人简报").getByText("仅你可见").waitFor({ timeout: 30_000 });
    if (await admin.getByText("候选记忆审核").count()) {
      throw new Error("Central admin can see source-authority review surface without route authority");
    }
    if (await admin.getByText("M4B4 确认路径候选事实").count()) {
      throw new Error("Central admin can approve submitted source candidate without route authority");
    }
    await admin.screenshot({ path: `${evidenceDir}/02-admin-no-central-review.png`, fullPage: true });

    await login(reviewer, accounts.reviewer);
    await reviewer.goto(`${baseUrl}/app/brain`);
    await reviewer.getByLabel("候选记忆审核").getByText("M4B4 确认路径候选事实").waitFor({ timeout: 30_000 });
    await reviewer.getByLabel("候选记忆审核").getByText("M4B4 拒绝路径候选事实").waitFor();
    await reviewer.screenshot({ path: `${evidenceDir}/03-reviewer-reviewable-candidates.png`, fullPage: true });

    await reviewer.getByRole("article")
      .filter({ hasText: "M4B4 确认路径候选事实" })
      .getByRole("button", { name: "确认候选记忆：M4B4 确认路径候选事实" })
      .click();
    await reviewer.getByRole("article")
      .filter({ hasText: "M4B4 确认路径候选事实" })
      .getByText("已确认")
      .waitFor({ timeout: 30_000 });

    await reviewer.getByRole("article")
      .filter({ hasText: "M4B4 拒绝路径候选事实" })
      .getByRole("button", { name: "拒绝候选记忆：M4B4 拒绝路径候选事实" })
      .click();
    await reviewer.getByRole("article")
      .filter({ hasText: "M4B4 拒绝路径候选事实" })
      .getByText("已拒绝")
      .waitFor({ timeout: 30_000 });
    await reviewer.screenshot({ path: `${evidenceDir}/04-reviewer-decided-candidates.png`, fullPage: true });

    await login(other, accounts.other);
    await other.goto(`${baseUrl}/app/brain`);
    await other.getByLabel("私人简报").getByText("仅你可见").waitFor({ timeout: 30_000 });
    if (await other.getByText("候选记忆审核").count()) {
      throw new Error("Unrelated member can see source-authority review surface");
    }
    if (await other.getByText("M4B4 确认路径候选事实").count()) {
      throw new Error("Unrelated member can see submitted source candidate");
    }
    await other.screenshot({ path: `${evidenceDir}/05-other-no-review-surface-mobile.png`, fullPage: true });

    const afterCounts = await objectCounts(connectionString);
    const rows = await candidateRows(connectionString);
    writeFileSync(`${evidenceDir}/db-counts.json`, JSON.stringify({ beforeCounts, afterCounts, rows }, null, 2));
    writeFileSync(`${evidenceDir}/network-ledger.json`, JSON.stringify(ledger, null, 2));

    const byId = Object.fromEntries(rows.candidates.map((candidate) => [candidate.id, candidate]));
    if (byId[ids.confirmCandidate]?.status !== "CONFIRMED") {
      throw new Error(`Confirmation candidate not confirmed: ${JSON.stringify(rows.candidates)}`);
    }
    if (byId[ids.rejectCandidate]?.status !== "REJECTED") {
      throw new Error(`Rejection candidate not rejected: ${JSON.stringify(rows.candidates)}`);
    }
    if (byId[ids.confirmCandidate]?.confirmedBy?.id !== `goal:${ids.reviewerPerson}`) {
      throw new Error(`Confirmation actor did not use goal process authority: ${JSON.stringify(rows.candidates)}`);
    }
    if (JSON.stringify(rows).includes("Brain") || JSON.stringify(rows).includes("brain:")) {
      throw new Error(`Brain appeared as candidate confirmer: ${JSON.stringify(rows)}`);
    }
    const eventSequence = rows.events.map((event) => `${event.candidateId}:${event.type}`).join(",");
    if (!eventSequence.includes(`${ids.confirmCandidate}:CONFIRMED`)) {
      throw new Error(`Missing confirmation audit event: ${eventSequence}`);
    }
    if (!eventSequence.includes(`${ids.rejectCandidate}:REJECTED`)) {
      throw new Error(`Missing rejection audit event: ${eventSequence}`);
    }
    if (afterCounts.memoryCandidates !== beforeCounts.memoryCandidates) {
      throw new Error(`Review should not create extra candidates: ${JSON.stringify({ beforeCounts, afterCounts })}`);
    }
    if (afterCounts.memoryCandidateAuditEvents !== beforeCounts.memoryCandidateAuditEvents + 2) {
      throw new Error(`Expected CONFIRMED and REJECTED audit events: ${JSON.stringify({ beforeCounts, afterCounts })}`);
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
