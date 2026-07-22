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

async function cleanup(databaseUrl, fixtures) {
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL session_replication_role = replica");
    for (const fixture of fixtures) {
      const target = await client.query(`
        SELECT u.id AS "userId", coalesce(p."organizationId", m."organizationId", o.id) AS "organizationId"
        FROM users u
        LEFT JOIN people p ON p."userId" = u.id
        LEFT JOIN memberships m ON m."userId" = u.id
        LEFT JOIN organizations o ON o.name = $2
        WHERE u.email = $1
      `, [fixture.email, fixture.orgName]);
      const userIds = [...new Set(target.rows.map((row) => row.userId).filter(Boolean))];
      const organizationIds = [...new Set(target.rows.map((row) => row.organizationId).filter(Boolean))];
      if (organizationIds.length > 0) {
        await client.query('DELETE FROM organizations WHERE id = any($1::text[])', [organizationIds]);
      }
      if (userIds.length > 0) {
        await client.query("DELETE FROM people WHERE id = any($1::text[]) OR email = $2", [userIds, fixture.email]);
        await client.query("DELETE FROM users WHERE id = any($1::text[])", [userIds]);
      }
    }
    const residue = await client.query(`
      SELECT
        (SELECT count(*)::int FROM users WHERE email = any($1::text[])) AS users,
        (SELECT count(*)::int FROM people WHERE email = any($1::text[])) AS people,
        (SELECT count(*)::int FROM organizations WHERE name = any($2::text[])) AS organizations
    `, [fixtures.map((fixture) => fixture.email), fixtures.map((fixture) => fixture.orgName)]);
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

async function register(page, baseUrl, fixture) {
  await page.goto(`${baseUrl}/register`, { waitUntil: "networkidle" });
  await page.getByLabel("组织名称").fill(fixture.orgName);
  await page.getByLabel("你的姓名").fill(fixture.personName);
  await page.getByLabel("邮箱").fill(fixture.email);
  await page.getByLabel("密码").fill(fixture.password);
  await page.getByRole("button", { name: "创建组织" }).click();
  await page.waitForURL(`${baseUrl}/app`, { timeout: 30_000 });
}

async function login(page, baseUrl, fixture) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("邮箱").fill(fixture.email);
  await page.getByLabel("密码").fill(fixture.password);
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL(`${baseUrl}/app`, { timeout: 30_000 });
}

async function seedFallbackFixture(databaseUrl, email, suffix) {
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
    if (!row) throw new Error("M3-C fallback fixture person not found after registration");
    const organizationId = row.organizationId;
    const sourceCircleId = `m3c-fallback-source-${suffix}`;
    const targetCircleId = `m3c-fallback-target-${suffix}`;
    await client.query(`
      INSERT INTO circles ("id", "organizationId", "name", "number", "type", "purpose", "status", "phase", "createdAt", "updatedAt")
      VALUES
        ($2, $1, '交付圈子', 'ONE', 'PRODUCTION', '交付客户承诺', 'NORMAL', 'PHASE_0', now(), now()),
        ($3, $1, '增长圈子', 'TWO', 'PRODUCTION', '识别新增机会', 'NORMAL', 'PHASE_0', now(), now())
    `, [organizationId, sourceCircleId, targetCircleId]);
    await client.query(`
      INSERT INTO circle_interfaces (
        "id", "organizationId", "name", "contractContent", "sla", "acceptanceCriteria",
        "status", "fromCircleId", "toCircleId", "ownerId", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, '交付反馈流', '交付圈子把客户反馈同步给增长圈子。', '每周同步', '增长圈子确认已接收', 'READY', $3, $4, $5, now(), now())
    `, [`m3c-fallback-interface-${suffix}`, organizationId, sourceCircleId, targetCircleId, row.personId]);
  } finally {
    client.release();
    await pool.end();
  }
}

async function seedPersistedFixture(databaseUrl, email, suffix) {
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
    if (!row) throw new Error("M3-C persisted fixture person not found after registration");
    const organizationId = row.organizationId;
    const sourceCircleId = `m3c-persisted-source-${suffix}`;
    const targetCircleId = `m3c-persisted-target-${suffix}`;
    const roleId = `m3c-persisted-role-${suffix}`;
    const interfaceId = `m3c-persisted-interface-${suffix}`;
    const loopId = `m3c-persisted-loop-${suffix}`;
    const versionId = `m3c-persisted-version-${suffix}`;
    await client.query(`
      INSERT INTO circles ("id", "organizationId", "name", "number", "type", "purpose", "status", "phase", "createdAt", "updatedAt")
      VALUES
        ($2, $1, '需求发现团队', 'ONE', 'PRODUCTION', '发现可验证需求', 'NORMAL', 'PHASE_0', now(), now()),
        ($3, $1, '模型交付团队', 'TWO', 'PRODUCTION', '把需求转化为模型能力', 'NORMAL', 'PHASE_0', now(), now())
    `, [organizationId, sourceCircleId, targetCircleId]);
    await client.query(`
      INSERT INTO role_defs ("id", "organizationId", "name", "purpose", "accountabilities", "ownershipType", "category", "status", "circleId", "createdAt", "updatedAt")
      VALUES ($1, $2, '需求编排者', '把需求转化为可执行输入', '维护需求证据', 'HOME', 'EXPERT', 'ACTIVE', $3, now(), now())
    `, [roleId, organizationId, sourceCircleId]);
    await client.query(`
      INSERT INTO circle_interfaces (
        "id", "organizationId", "name", "contractContent", "sla", "acceptanceCriteria",
        "status", "fromCircleId", "toCircleId", "ownerId", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, '需求到训练数据流', '需求发现团队输出训练数据需求。', '每周同步', '模型交付团队确认可训练', 'READY', $3, $4, $5, now(), now())
    `, [interfaceId, organizationId, sourceCircleId, targetCircleId, row.personId]);
    await client.query(`
      INSERT INTO business_loops ("id", "organizationId", "name", "purpose", "status", "createdAt", "updatedAt")
      VALUES ($1, $2, '需求到模型能力闭环', '从用户需求证据到模型能力上线的端到端闭环。', 'ACTIVE', now(), now())
    `, [loopId, organizationId]);
    await client.query(`
      INSERT INTO business_loop_versions ("id", "organizationId", "businessLoopId", "version", "status", "summary", "publishedAt", "createdAt")
      VALUES ($1, $2, $3, 1, 'PUBLISHED', '首次发布业务回路', now(), now())
    `, [versionId, organizationId, loopId]);
    await client.query(`
      INSERT INTO business_loop_activities ("id", "organizationId", "businessLoopId", "versionId", "circleId", "ownerRoleId", "name", "activityType", "description", "position", "createdAt", "updatedAt")
      VALUES
        ($1, $3, $4, $5, $6, $8, '收集高价值需求', 'WORK', '从真实客户场景收集证据。', 1, now(), now()),
        ($2, $3, $4, $5, $7, null, '交付模型能力', 'WORK', '把需求转化为可验证能力。', 2, now(), now())
    `, [`m3c-activity-1-${suffix}`, `m3c-activity-2-${suffix}`, organizationId, loopId, versionId, sourceCircleId, targetCircleId, roleId]);
    await client.query(`
      INSERT INTO business_loop_edges ("id", "organizationId", "businessLoopId", "versionId", "fromCircleId", "toCircleId", "interfaceId", "edgeType", "label", "position", "createdAt", "updatedAt")
      VALUES
        ($1, $3, $4, $5, $6, $7, $8, 'DATA', '需求证据进入训练数据准备', 1, now(), now()),
        ($2, $3, $4, $5, $7, $6, null, 'VALUE', '模型能力反馈给需求发现', 2, now(), now())
    `, [`m3c-edge-1-${suffix}`, `m3c-edge-2-${suffix}`, organizationId, loopId, versionId, sourceCircleId, targetCircleId, interfaceId]);
    await client.query(`
      INSERT INTO business_loop_evidence_refs ("id", "organizationId", "businessLoopId", "versionId", "kind", "targetId", "label", "createdAt")
      VALUES ($1, $2, $3, $4, 'CIRCLE_INTERFACE', $5, '接口契约证据', now())
    `, [`m3c-evidence-${suffix}`, organizationId, loopId, versionId, interfaceId]);
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const baseUrl = option("--base-url", "http://127.0.0.1:3001").replace(/\/+$/, "");
  const screenshotDir = option("--screenshot-dir", `/tmp/loopos-m3c-${Date.now()}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  mkdirSync(screenshotDir, { recursive: true });

  const suffix = String(Date.now());
  const fixtures = [
    {
      email: `m3c-persisted-${suffix}@loopos.test`,
      password: `M3c-persisted-${suffix}!`,
      orgName: `M3-C Persisted ${suffix}`,
      personName: `M3-C Persisted User ${suffix}`,
    },
    {
      email: `m3c-fallback-${suffix}@loopos.test`,
      password: `M3c-fallback-${suffix}!`,
      orgName: `M3-C Fallback ${suffix}`,
      personName: `M3-C Fallback User ${suffix}`,
    },
  ];
  const ledger = { console: [], page: [], http: [] };
  const browser = await chromium.launch({ headless: true });
  let output;
  let residue = null;
  try {
    const persisted = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    observe(persisted, baseUrl, ledger);
    await register(persisted, baseUrl, fixtures[0]);
    await seedPersistedFixture(databaseUrl, fixtures[0].email, suffix);
    await persisted.goto(`${baseUrl}/app/organization/business-loops`, { waitUntil: "networkidle" });
    await persisted.getByRole("heading", { name: "业务回路", exact: true }).waitFor();
    await persisted.getByText("正式业务回路数据").waitFor();
    await persisted.getByText("需求到模型能力闭环").waitFor();
    await persisted.getByText("收集高价值需求").waitFor();
    await persisted.getByText("交付模型能力").waitFor();
    await persisted.getByText("需求证据进入训练数据准备").waitFor();
    await persisted.getByRole("link", { name: "需求编排者" }).waitFor();
    await persisted.getByRole("link", { name: "需求到训练数据流" }).waitFor();
    const persistedStats = await persisted.locator("section").first().locator(".text-2xl").evaluateAll(
      (items) => items.map((item) => item.textContent?.trim() ?? ""),
    );
    if (persistedStats.join(",") !== "3,2,2,1") {
      throw new Error(`unexpected persisted stats: ${persistedStats.join(",")}`);
    }
    const persistedOverflow = await persisted.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    await persisted.screenshot({ path: `${screenshotDir}/desktop-persisted-business-loop.png`, fullPage: true });
    await persisted.close();

    const fallback = await browser.newPage({ viewport: { width: 390, height: 844 } });
    observe(fallback, baseUrl, ledger);
    await register(fallback, baseUrl, fixtures[1]);
    await seedFallbackFixture(databaseUrl, fixtures[1].email, suffix);
    await fallback.goto(`${baseUrl}/app/organization/business-loops`, { waitUntil: "networkidle" });
    await fallback.getByRole("heading", { name: "业务回路", exact: true }).waitFor();
    await fallback.getByText("只读观察视图").waitFor();
    await fallback.getByText("交付反馈流").waitFor();
    const fallbackStats = await fallback.locator("section").first().locator(".text-2xl").evaluateAll(
      (items) => items.map((item) => item.textContent?.trim() ?? ""),
    );
    if (fallbackStats.join(",") !== "3,1,3,0") {
      throw new Error(`unexpected fallback stats: ${fallbackStats.join(",")}`);
    }
    const fallbackOverflow = await fallback.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    await fallback.screenshot({ path: `${screenshotDir}/mobile-fallback-business-loop.png`, fullPage: true });
    await fallback.close();

    output = {
      ok: !persistedOverflow && !fallbackOverflow
        && ledger.console.length === 0 && ledger.page.length === 0 && ledger.http.length === 0,
      baseUrl,
      screenshotDir,
      persistedStats,
      fallbackStats,
      persistedOverflow,
      fallbackOverflow,
      ledger,
    };
  } catch (error) {
    output = {
      ok: false,
      baseUrl,
      screenshotDir,
      error: error instanceof Error ? error.message : String(error),
      ledger,
    };
  } finally {
    await browser.close();
    residue = await cleanup(databaseUrl, fixtures);
  }
  const cleanupOk = Object.values(residue).every((count) => count === 0);
  const finalOutput = { ...output, cleanupOk, residue };
  console.log(JSON.stringify(finalOutput, null, 2));
  if (!finalOutput.ok || !cleanupOk) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
