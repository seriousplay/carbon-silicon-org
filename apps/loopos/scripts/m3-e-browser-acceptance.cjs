/* eslint-disable @typescript-eslint/no-require-imports */
const { createHash, randomBytes } = require("node:crypto");
const { mkdirSync, readdirSync, readFileSync, writeFileSync } = require("node:fs");
const { fileURLToPath } = require("node:url");
const { spawn } = require("node:child_process");
const bcrypt = require("bcryptjs");
const { chromium } = require("playwright");
const { Client } = require("pg");

const adminDatabaseUrl = process.env.M3E_ADMIN_DATABASE_URL ?? "postgresql://heyiqing@localhost:5432/postgres";
const port = Number(process.env.M3E_BROWSER_PORT ?? 3224);
const baseUrl = `http://127.0.0.1:${port}`;
const evidenceDir = process.env.M3E_EVIDENCE_DIR ?? `/tmp/loopos-m3e-browser-${Date.now()}`;
const password = "M3E-browser-pass-2026";
const suffix = `${Date.now()}_${randomBytes(3).toString("hex")}`;
const database = `loopos_m3e_browser_${suffix}`;
const migrationsRoot = fileURLToPath(new URL("../prisma/migrations/", `file://${__filename}`));
const migrations = readdirSync(migrationsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((entry) => ({
    name: entry.name,
    sql: readFileSync(`${migrationsRoot}/${entry.name}/migration.sql`, "utf8"),
  }));

const ids = {
  org: "org-m3e",
  otherOrg: "org-m3e-other",
  ownerUser: "user-m3e-owner",
  otherUser: "user-m3e-other",
  ownerMembership: "membership-m3e-owner",
  otherMembership: "membership-m3e-other",
  circle: "circle-m3e",
  otherCircle: "circle-m3e-other",
  ownerPerson: "person-m3e-owner",
  otherPerson: "person-m3e-other",
  conversation: "conversation-m3e",
  otherConversation: "conversation-m3e-other",
  message: "message-m3e",
  otherMessage: "message-m3e-other",
  meeting: "meeting-m3e",
  validPreview: "preview-m3e-valid",
  stalePreview: "preview-m3e-stale",
  expiredPreview: "preview-m3e-expired",
};

const accounts = {
  owner: { email: `m3e-owner-${suffix}@loopos.test`, name: "M3E Owner" },
  other: { email: `m3e-other-${suffix}@loopos.test`, name: "M3E Other" },
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

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
}

function hashBrainCommandBinding(value) {
  return createHash("sha256").update(JSON.stringify(canonicalJson(value))).digest("hex");
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
    for (const migration of migrations) {
      await client.query(migration.sql);
    }
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
    await client.query(`INSERT INTO "organizations" ("id", "name", "slug", "createdAt", "updatedAt")
      VALUES ($1, 'M3E Browser Org', $2, TIMESTAMP '${now}', TIMESTAMP '${now}'),
             ($3, 'M3E Other Org', $4, TIMESTAMP '${now}', TIMESTAMP '${now}')`, [
      ids.org,
      `m3e-browser-${suffix}`,
      ids.otherOrg,
      `m3e-browser-other-${suffix}`,
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
             ($4, $5, $6, 'ORG_MEMBER', TIMESTAMP '${now}')`, [
      ids.ownerMembership,
      ids.ownerUser,
      ids.org,
      ids.otherMembership,
      ids.otherUser,
      ids.otherOrg,
    ]);
    await client.query(`INSERT INTO "circles" ("id", "organizationId", "name", "number", "type", "purpose", "createdAt", "updatedAt")
      VALUES ($1, $2, 'M3E 主回路', 'CUSTOM', 'PRODUCTION', 'Validate Brain command previews', TIMESTAMP '${now}', TIMESTAMP '${now}'),
             ($3, $4, 'M3E Other Circle', 'CUSTOM', 'PRODUCTION', 'Tenant isolation', TIMESTAMP '${now}', TIMESTAMP '${now}')`, [
      ids.circle,
      ids.org,
      ids.otherCircle,
      ids.otherOrg,
    ]);
    await client.query(`INSERT INTO "people" ("id", "organizationId", "name", "email", "userId", "homeCircleId", "joinedAt", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, TIMESTAMP '${now}', TIMESTAMP '${now}', TIMESTAMP '${now}'),
             ($7, $8, $9, $10, $11, $12, TIMESTAMP '${now}', TIMESTAMP '${now}', TIMESTAMP '${now}')`, [
      ids.ownerPerson,
      ids.org,
      accounts.owner.name,
      accounts.owner.email,
      ids.ownerUser,
      ids.circle,
      ids.otherPerson,
      ids.otherOrg,
      accounts.other.name,
      accounts.other.email,
      ids.otherUser,
      ids.otherCircle,
    ]);
    await client.query(`INSERT INTO "meetings" ("id", "organizationId", "title", "type", "agenda", "notes", "notesRevision", "durationMin", "startedAt", "circleId", "createdAt")
      VALUES ($1, $2, 'M3E Brain Notes Meeting', 'TACTICAL', '[]', 'Initial M3E notes', 0, 30, TIMESTAMP '${now}', $3, TIMESTAMP '${now}')`, [
      ids.meeting,
      ids.org,
      ids.circle,
    ]);
    await client.query(`INSERT INTO "_MeetingToPerson" ("A", "B") VALUES ($1, $2)`, [ids.meeting, ids.ownerPerson]);
    await client.query(`INSERT INTO "brain_conversations" ("id", "organizationId", "ownerId", "title", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, 'M3E Preview Conversation', TIMESTAMP '${now}', TIMESTAMP '${now}'),
             ($4, $5, $6, 'M3E Other Conversation', TIMESTAMP '${now}', TIMESTAMP '${now}')`, [
      ids.conversation,
      ids.org,
      ids.ownerPerson,
      ids.otherConversation,
      ids.otherOrg,
      ids.otherPerson,
    ]);
    await client.query(`INSERT INTO "brain_messages" ("id", "organizationId", "conversationId", "role", "content", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, 'USER', '请准备会议纪要更新', TIMESTAMP '${now}', TIMESTAMP '${now}'),
             ($4, $5, $6, 'USER', 'Other tenant message', TIMESTAMP '${now}', TIMESTAMP '${now}')`, [
      ids.message,
      ids.org,
      ids.conversation,
      ids.otherMessage,
      ids.otherOrg,
      ids.otherConversation,
    ]);

    const validPayload = {
      command: "meeting_notes.update",
      meetingId: ids.meeting,
      expectedNotesRevision: 0,
      notes: "M3E confirmed notes from browser",
    };
    const stalePayload = {
      command: "meeting_notes.update",
      meetingId: ids.meeting,
      expectedNotesRevision: 0,
      notes: "M3E stale notes must not write",
    };
    const bindings = [
      { objectType: "meeting", objectId: ids.meeting, sourceVersionAt: "notesRevision:0", revision: 0 },
    ];
    await insertPreview(client, ids.validPreview, validPayload, bindings, "M3-E valid notes");
    await insertPreview(client, ids.stalePreview, stalePayload, bindings, "M3-E stale notes");
    await insertExpiredPreview(client, ids.expiredPreview, {
      command: "meeting_notes.update",
      meetingId: ids.meeting,
      expectedNotesRevision: 0,
      notes: "M3E expired notes must not write",
    }, bindings, "M3-E expired notes");
  });
}

async function insertPreview(client, id, serverPayload, sourceBindings, label) {
  const humanDiff = [{ label: "Preview", before: null, after: label }];
  await client.query(
    `INSERT INTO "brain_command_operations" (
      "id", "organizationId", "ownerUserId", "actorId", "conversationId", "userMessageId",
      "commandName", "commandSchemaVersion", "serverPayload", "payloadHash",
      "sourceBindings", "sourceBindingHash", "humanDiff", "previewExpiresAt",
      "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      'meeting_notes.update', 1,
      $7::jsonb, $8,
      $9::jsonb, $10,
      $11::jsonb, NOW() + INTERVAL '15 minutes',
      NOW(), NOW()
    )`,
    [
      id,
      ids.org,
      ids.ownerUser,
      ids.ownerPerson,
      ids.conversation,
      ids.message,
      JSON.stringify(serverPayload),
      hashBrainCommandBinding(serverPayload),
      JSON.stringify(sourceBindings),
      hashBrainCommandBinding(sourceBindings),
      JSON.stringify(humanDiff),
    ],
  );
}

async function insertExpiredPreview(client, id, serverPayload, sourceBindings, label) {
  const humanDiff = [{ label: "Preview", before: null, after: label }];
  await client.query(
    `INSERT INTO "brain_command_operations" (
      "id", "organizationId", "ownerUserId", "actorId", "conversationId", "userMessageId",
      "commandName", "commandSchemaVersion", "serverPayload", "payloadHash",
      "sourceBindings", "sourceBindingHash", "humanDiff", "previewExpiresAt",
      "status", "terminalCode", "terminalResult", "completedAt",
      "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      'meeting_notes.update', 1,
      $7::jsonb, $8,
      $9::jsonb, $10,
      $11::jsonb, TIMESTAMP '2026-07-15 11:00:00' + INTERVAL '15 minutes',
      'EXPIRED', 'PREVIEW_EXPIRED', $12::jsonb, TIMESTAMP '2026-07-15 11:16:00',
      TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:16:00'
    )`,
    [
      id,
      ids.org,
      ids.ownerUser,
      ids.ownerPerson,
      ids.conversation,
      ids.message,
      JSON.stringify(serverPayload),
      hashBrainCommandBinding(serverPayload),
      JSON.stringify(sourceBindings),
      hashBrainCommandBinding(sourceBindings),
      JSON.stringify(humanDiff),
      JSON.stringify({
        schemaVersion: 1,
        ok: false,
        error: {
          code: "PREVIEW_EXPIRED",
          message: "The command preview expired.",
          correlationId: "m3e-browser-expired",
          previewId: id,
        },
      }),
    ],
  );
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
    if (child.exitCode !== null) throw new Error(`Next dev server exited early: ${child.exitCode}\n${ledger.serverOutput.join("")}`);
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

async function meetingRow(connectionString) {
  return withClient(connectionString, async (client) => {
    const result = await client.query(
      `SELECT "notes", "notesRevision" FROM "meetings" WHERE "id" = $1`,
      [ids.meeting],
    );
    return result.rows[0];
  });
}

async function previewRows(connectionString) {
  return withClient(connectionString, async (client) => {
    const result = await client.query(
      `SELECT "id", "status", "terminalCode", "mutationKey" FROM "brain_command_operations" ORDER BY "id"`,
    );
    return result.rows;
  });
}

async function runBrowser(connectionString) {
  mkdirSync(evidenceDir, { recursive: true });
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
    await owner.getByText("M3-E valid notes").waitFor({ timeout: 30_000 });
    await owner.getByText("M3-E stale notes").waitFor();
    await owner.getByText("M3-E expired notes").waitFor();
    await owner.getByText("已过期").waitFor();
    const before = await meetingRow(connectionString);
    if (before.notesRevision !== 0 || before.notes !== "Initial M3E notes") {
      throw new Error(`Silent execution before confirmation: ${JSON.stringify(before)}`);
    }
    await owner.screenshot({ path: `${evidenceDir}/01-owner-preview.png`, fullPage: true });

    await login(other, accounts.other);
    await other.goto(`${baseUrl}/app/brain`);
    await other.waitForLoadState("networkidle");
    if (await other.getByText("M3-E valid notes").count()) {
      throw new Error("Cross-tenant user can see owner command preview");
    }
    await other.screenshot({ path: `${evidenceDir}/02-other-no-preview-mobile.png`, fullPage: true });

    const validCard = owner.locator('section[aria-label="组织大脑命令预览"] > div', { hasText: "M3-E valid notes" });
    await validCard.getByRole("button", { name: "确认执行" }).click();
    await owner.getByText("命令已通过确认并完成。").waitFor({ timeout: 30_000 });
    await owner.screenshot({ path: `${evidenceDir}/03-owner-confirmed.png`, fullPage: true });
    const afterConfirm = await meetingRow(connectionString);
    if (afterConfirm.notesRevision !== 1 || afterConfirm.notes !== "M3E confirmed notes from browser") {
      throw new Error(`Valid confirmation did not persist once: ${JSON.stringify(afterConfirm)}`);
    }

    await owner.reload();
    await owner.getByText("命令已通过确认并完成。").waitFor({ timeout: 30_000 });
    await owner.screenshot({ path: `${evidenceDir}/04-owner-refresh-terminal.png`, fullPage: true });

    const staleCard = owner.locator('section[aria-label="组织大脑命令预览"] > div', { hasText: "M3-E stale notes" });
    await staleCard.getByRole("button", { name: "确认执行" }).click();
    await owner.getByText("The command preview is stale.").waitFor({ timeout: 30_000 });
    await owner.screenshot({ path: `${evidenceDir}/05-owner-stale-redacted.png`, fullPage: true });
    const afterStale = await meetingRow(connectionString);
    if (afterStale.notesRevision !== 1 || afterStale.notes !== "M3E confirmed notes from browser") {
      throw new Error(`Stale confirmation wrote data: ${JSON.stringify(afterStale)}`);
    }

    const expiredCard = owner.locator('section[aria-label="组织大脑命令预览"] > div', { hasText: "M3-E expired notes" });
    if (await expiredCard.getByRole("button", { name: "确认执行" }).count()) {
      throw new Error("Expired preview exposes a confirm button");
    }

    const rows = await previewRows(connectionString);
    writeFileSync(`${evidenceDir}/db-preview-rows.json`, JSON.stringify(rows, null, 2));
    writeFileSync(`${evidenceDir}/network-ledger.json`, JSON.stringify(ledger, null, 2));
    if (ledger.failedRequests.length || ledger.badResponses.length || ledger.consoleErrors.length || ledger.pageErrors.length) {
      throw new Error(`Browser ledger not clean: ${JSON.stringify(ledger, null, 2)}`);
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  if (migrations.length !== 25) throw new Error(`Expected 25 migrations, got ${migrations.length}`);
  mkdirSync(evidenceDir, { recursive: true });
  let roleCreated = false;
  let server = null;
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
