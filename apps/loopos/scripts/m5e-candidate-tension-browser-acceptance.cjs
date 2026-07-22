#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const { mkdirSync } = require("node:fs");
const { chromium } = require("playwright");
const { Pool } = require("pg");

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value) throw new Error(`${name} requires a value`);
  return value;
}

function observe(page, baseUrl, ledger) {
  page.on("console", (message) => {
    if (!["error", "warning"].includes(message.type())) return;
    if (message.text().includes("/_next/webpack-hmr")) return;
    ledger.console.push({ type: message.type(), text: message.text().slice(0, 500) });
  });
  page.on("pageerror", (error) => ledger.page.push(error.message.slice(0, 500)));
  page.on("response", (response) => {
    if (response.url().startsWith(baseUrl) && response.status() >= 400) {
      ledger.http.push({ status: response.status(), url: response.url() });
    }
  });
}

async function seedCandidateTensions(databaseUrl, email, suffix) {
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    const actor = await client.query(`
      SELECT p."organizationId", p.id AS "personId"
      FROM people p
      WHERE p.email = $1
      LIMIT 1
    `, [email]);
    const row = actor.rows[0];
    if (!row) throw new Error("M5-E fixture person not found after registration");
    const circle = await client.query(`
      SELECT id
      FROM circles
      WHERE "organizationId" = $1
      ORDER BY "createdAt" ASC
      LIMIT 1
    `, [row.organizationId]);
    const circleId = circle.rows[0]?.id;
    if (!circleId) throw new Error("M5-E fixture circle not found after registration");

    const ownerRoleId = `m5e-owner-role-${suffix}`;
    const readOnlyRoleId = `m5e-readonly-role-${suffix}`;
    const detectorId = `m5e-agent-${suffix}`;
    const formalTensionId = `m5e-formal-tension-${suffix}`;
    const candidateId = `m5e-candidate-owned-${suffix}`;
    const readOnlyCandidateId = `m5e-candidate-readonly-${suffix}`;
    const mergeTargetId = `m5e-candidate-merge-target-${suffix}`;

    await client.query(`
      INSERT INTO people ("id", "organizationId", "name", "email", "entityType", "homeCircleId", "createdAt", "updatedAt")
      VALUES ($1, $2, 'M5-E Detector Agent', $3, 'AGENT', $4, now(), now())
    `, [detectorId, row.organizationId, `m5e-agent-${suffix}@loopos.test`, circleId]);
    await client.query(`
      INSERT INTO role_defs ("id", "organizationId", "name", "purpose", "accountabilities", "ownershipType", "category", "status", "circleId", "createdAt", "updatedAt")
      VALUES
        ($1, $3, '候选张力负责人', '确认 AI 候选张力', '确认或驳回候选张力', 'HOME', 'EXPERT', 'ACTIVE', $4, now(), now()),
        ($2, $3, '只读候选角色', '验证非承担者只读状态', '不应被当前人处理', 'HOME', 'EXPERT', 'ACTIVE', $4, now(), now())
    `, [ownerRoleId, readOnlyRoleId, row.organizationId, circleId]);
    await client.query('INSERT INTO "_PersonRoles" ("A", "B") VALUES ($1, $2)', [row.personId, ownerRoleId]);
    await client.query(`
      INSERT INTO tensions (
        "id", "organizationId", "title", "description", "type", "source", "status",
        "raiserId", "ownerId", "handlingMode", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, '正式张力：目标证据不足', '用于确认候选张力的正式张力。', 'PROBLEMATIC', 'FORM', 'OPEN', $3, $3, 'TACTICAL', now(), now())
    `, [formalTensionId, row.organizationId, row.personId]);
    await client.query(`
      INSERT INTO candidate_tensions (
        "id", "organizationId", "title", "evidenceSummary", "sourceKind", "sourceRef",
        "ownerRoleId", "detectedById", "status", "suggestedMode", "detectedAt", "updatedAt"
      )
      VALUES
        ($1, $4, '候选张力：目标进展缺少证据', '连续两周没有目标进展证据。', 'GOAL', '{"goalId":"goal-m5e","evidenceId":"ev-m5e"}'::jsonb, $5, $7, 'DETECTED', 'TACTICAL', now(), now()),
        ($2, $4, '候选张力：只读角色信号', '当前用户不承担这个角色。', 'ROLE', '{"roleId":"readonly-role","source":"fixture"}'::jsonb, $6, $7, 'DETECTED', 'GOVERNANCE', now(), now()),
        ($3, $4, '候选张力：可合并目标', '用于验证合并下拉候选。', 'MEETING', '{"meetingId":"meeting-m5e"}'::jsonb, $5, $7, 'DETECTED', 'TACTICAL', now(), now())
    `, [candidateId, readOnlyCandidateId, mergeTargetId, row.organizationId, ownerRoleId, readOnlyRoleId, detectorId]);
    return { organizationId: row.organizationId, candidateId, readOnlyCandidateId, mergeTargetId, formalTensionId };
  } finally {
    client.release();
    await pool.end();
  }
}

async function fetchCandidateState(databaseUrl, organizationId, candidateId) {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const result = await pool.query(`
      SELECT
        c.status,
        c."confirmedTensionId",
        c."confirmedById",
        (SELECT count(*)::int FROM candidate_tension_audit_events e WHERE e."organizationId" = c."organizationId" AND e."candidateId" = c.id) AS audit_events
      FROM candidate_tensions c
      WHERE c."organizationId" = $1 AND c.id = $2
    `, [organizationId, candidateId]);
    return result.rows[0];
  } finally {
    await pool.end();
  }
}

async function cleanup(databaseUrl, email, orgName) {
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL session_replication_role = replica");
    const target = await client.query(`
      SELECT u.id AS "userId", coalesce(p."organizationId", m."organizationId", o.id) AS "organizationId"
      FROM users u
      LEFT JOIN people p ON p."userId" = u.id
      LEFT JOIN memberships m ON m."userId" = u.id
      LEFT JOIN organizations o ON o.name = $2
      WHERE u.email = $1
    `, [email, orgName]);
    const userIds = [...new Set(target.rows.map((row) => row.userId).filter(Boolean))];
    const organizationIds = [...new Set(target.rows.map((row) => row.organizationId).filter(Boolean))];
    if (organizationIds.length > 0) {
      const roleResult = await client.query('SELECT id FROM role_defs WHERE "organizationId" = any($1::text[])', [organizationIds]);
      const circleResult = await client.query('SELECT id FROM circles WHERE "organizationId" = any($1::text[])', [organizationIds]);
      const tensionResult = await client.query('SELECT id FROM tensions WHERE "organizationId" = any($1::text[])', [organizationIds]);
      const roleIds = roleResult.rows.map((row) => row.id);
      const circleIds = circleResult.rows.map((row) => row.id);
      const tensionIds = tensionResult.rows.map((row) => row.id);
      if (roleIds.length > 0) {
        await client.query('DELETE FROM "_PersonRoles" WHERE "B" = any($1::text[])', [roleIds]);
      }
      if (circleIds.length > 0 || tensionIds.length > 0) {
        await client.query('DELETE FROM "_TensionCircle" WHERE "A" = any($1::text[]) OR "B" = any($2::text[])', [circleIds, tensionIds]);
      }
      for (const table of [
        "candidate_tension_audit_events",
        "candidate_tensions",
        "tensions",
        "ai_execution_audit_events",
        "ai_role_co_assignment_policies",
        "role_assignment_history",
        "role_assignment_applications",
        "role_nominations",
        "role_defs",
        "setup_events",
        "organization_model_settings",
        "memberships",
        "people",
      ]) {
        const exists = await client.query("SELECT to_regclass($1) AS table_name", [`public.${table}`]);
        if (exists.rows[0]?.table_name) {
          await client.query(`DELETE FROM ${table} WHERE "organizationId" = any($1::text[])`, [organizationIds]);
        }
      }
      await client.query("DELETE FROM circles WHERE \"organizationId\" = any($1::text[])", [organizationIds]);
      await client.query("DELETE FROM organizations WHERE id = any($1::text[])", [organizationIds]);
    }
    if (userIds.length > 0) {
      await client.query("DELETE FROM users WHERE id = any($1::text[])", [userIds]);
    }
    const residue = await client.query(`
      SELECT
        (SELECT count(*)::int FROM users WHERE email = $1) AS users,
        (SELECT count(*)::int FROM people WHERE email = $1) AS people,
        (SELECT count(*)::int FROM organizations WHERE name = $2) AS organizations,
        (SELECT count(*)::int FROM candidate_tensions WHERE "organizationId" = any($3::text[])) AS candidate_tensions,
        (SELECT count(*)::int FROM candidate_tension_audit_events WHERE "organizationId" = any($3::text[])) AS candidate_audit_events
    `, [email, orgName, organizationIds]);
    await client.query("COMMIT");
    return residue.rows[0];
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function fetchDefaultResidue(defaultDatabaseUrl) {
  const pool = new Pool({ connectionString: defaultDatabaseUrl });
  try {
    const result = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM users WHERE email LIKE 'm5e-admin-%') AS users,
        (SELECT count(*)::int FROM people WHERE email LIKE 'm5e-admin-%') AS people,
        (SELECT count(*)::int FROM organizations WHERE name LIKE 'M5-E Admin %') AS organizations
    `);
    return result.rows[0];
  } finally {
    await pool.end();
  }
}

async function tempDatabaseExists(defaultDatabaseUrl, databaseName) {
  const adminUrl = defaultDatabaseUrl.replace(/\/[^/?]+(\?.*)?$/, "/postgres$1");
  const pool = new Pool({ connectionString: adminUrl });
  try {
    const result = await pool.query("SELECT count(*)::int AS count FROM pg_database WHERE datname = $1", [databaseName]);
    return result.rows[0]?.count ?? 0;
  } finally {
    await pool.end();
  }
}

async function dropTempDatabase(defaultDatabaseUrl, databaseName) {
  const adminUrl = defaultDatabaseUrl.replace(/\/[^/?]+(\?.*)?$/, "/postgres$1");
  const pool = new Pool({ connectionString: adminUrl });
  try {
    await pool.query(`DROP DATABASE IF EXISTS ${databaseName}`);
  } finally {
    await pool.end();
  }
}

async function main() {
  const baseUrl = option("--base-url", "http://127.0.0.1:3001").replace(/\/+$/, "");
  const screenshotDir = option("--screenshot-dir", `/tmp/loopos-m5e-${Date.now()}`);
  const defaultDatabaseUrl = option("--default-database-url", process.env.DEFAULT_DATABASE_URL ?? process.env.DATABASE_URL);
  const tempDatabaseName = option("--temp-db-name", "loopos_m5e_browser_20260721_1");
  const dropTempAfterCleanup = option("--drop-temp-db-after-cleanup", "false") === "true";
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  mkdirSync(screenshotDir, { recursive: true });

  const suffix = String(Date.now());
  const email = `m5e-admin-${suffix}@loopos.test`;
  const password = `M5e-admin-${suffix}!`;
  const orgName = `M5-E Admin ${suffix}`;
  const ledger = { console: [], page: [], http: [] };
  const browser = await chromium.launch({ headless: true });
  let output;
  let residue = null;
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    observe(page, baseUrl, ledger);
    await page.goto(`${baseUrl}/register`, { waitUntil: "networkidle" });
    await page.getByLabel("组织名称").fill(orgName);
    await page.getByLabel("你的姓名").fill("M5-E Admin");
    await page.getByLabel("邮箱").fill(email);
    await page.getByLabel("密码").fill(password);
    await page.getByRole("button", { name: "创建组织" }).click();
    await page.waitForURL(`${baseUrl}/app`, { timeout: 30_000 });
    const fixture = await seedCandidateTensions(databaseUrl, email, suffix);

    await page.goto(`${baseUrl}/app/tensions`, { waitUntil: "networkidle" });
    await page.getByText("AI 候选张力").waitFor();
    await page.getByRole("heading", { name: "候选张力：目标进展缺少证据" }).waitFor();
    await page.getByText("goalId: goal-m5e").waitFor();
    await page.getByText("只读候选角色").waitFor();
    const readOnlyCard = page
      .getByRole("heading", { name: "候选张力：只读角色信号" })
      .locator("xpath=ancestor::article[1]");
    await readOnlyCard.getByText("只有该候选张力归属角色的人类承担者可以处理。").waitFor();

    const ownedCard = page
      .getByRole("heading", { name: "候选张力：目标进展缺少证据" })
      .locator("xpath=ancestor::article[1]");
    await ownedCard.getByText("确认为正式张力").waitFor();
    await ownedCard.locator('select[name="confirmedTensionId"]').selectOption(fixture.formalTensionId);
    await ownedCard.getByRole("button", { name: "确认" }).click();
    await page.locator("span").filter({ hasText: /^已确认$/ }).waitFor();
    await page.getByRole("link", { name: /已确认为：正式张力：目标证据不足/ }).waitFor();

    const state = await fetchCandidateState(databaseUrl, fixture.organizationId, fixture.candidateId);
    if (state.status !== "CONFIRMED" || state.confirmedTensionId !== fixture.formalTensionId || state.audit_events !== 1) {
      throw new Error(`unexpected candidate state: ${JSON.stringify(state)}`);
    }

    if (ledger.console.length || ledger.page.length || ledger.http.length) {
      throw new Error(`dirty browser ledger: ${JSON.stringify(ledger)}`);
    }
    residue = await cleanup(databaseUrl, email, orgName);
    const cleanupOk = Object.values(residue).every((value) => Number(value) === 0);
    if (!cleanupOk) throw new Error(`cleanup residue: ${JSON.stringify(residue)}`);
    if (dropTempAfterCleanup && defaultDatabaseUrl) {
      await dropTempDatabase(defaultDatabaseUrl, tempDatabaseName);
    }
    const defaultResidue = defaultDatabaseUrl ? await fetchDefaultResidue(defaultDatabaseUrl) : null;
    const tempDbExists = defaultDatabaseUrl ? await tempDatabaseExists(defaultDatabaseUrl, tempDatabaseName) : null;
    output = {
      ok: true,
      cleanupOk,
      residue,
      defaultResidue,
      tempDbExists,
      ledger,
      screenshotDir,
      fixture: { organizationId: fixture.organizationId },
    };
  } finally {
    await browser.close();
    if (!residue) {
      residue = await cleanup(databaseUrl, email, orgName).catch((error) => ({ cleanupError: error.message }));
    }
  }
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
