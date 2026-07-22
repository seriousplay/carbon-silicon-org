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

async function seedRoleAndAgent(databaseUrl, email, suffix) {
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
    if (!row) throw new Error("M4-B fixture person not found after registration");
    const circle = await client.query(`
      SELECT id
      FROM circles
      WHERE "organizationId" = $1
      ORDER BY "createdAt" ASC
      LIMIT 1
    `, [row.organizationId]);
    const circleId = circle.rows[0]?.id;
    if (!circleId) throw new Error("M4-B fixture circle not found after registration");

    const roleId = `m4b-role-${suffix}`;
    const agentId = `m4b-agent-${suffix}`;
    await client.query(`
      INSERT INTO people ("id", "organizationId", "name", "email", "entityType", "homeCircleId", "createdAt", "updatedAt")
      VALUES ($1, $2, 'M4-B AI Agent', $3, 'AGENT', $4, now(), now())
    `, [agentId, row.organizationId, `m4b-agent-${suffix}@loopos.test`, circleId]);
    await client.query(`
      INSERT INTO role_defs ("id", "organizationId", "name", "purpose", "accountabilities", "ownershipType", "category", "status", "circleId", "createdAt", "updatedAt")
      VALUES ($1, $2, 'M4-B AI 协作角色', '验证 AI 共同承担配置', '维护 AI 共同承担策略', 'HOME', 'EXPERT', 'ACTIVE', $3, now(), now())
    `, [roleId, row.organizationId, circleId]);
    return { organizationId: row.organizationId, personId: row.personId, roleId, agentId };
  } finally {
    client.release();
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
      for (const table of [
        "ai_role_co_assignment_policies",
        "role_assignment_history",
        "role_assignment_applications",
        "role_nominations",
        "role_defs",
        "circles",
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
        (SELECT count(*)::int FROM ai_role_co_assignment_policies WHERE "organizationId" = any($3::text[])) AS policies
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

async function main() {
  const baseUrl = option("--base-url", "http://127.0.0.1:3001").replace(/\/+$/, "");
  const screenshotDir = option("--screenshot-dir", `/tmp/loopos-m4b-${Date.now()}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  mkdirSync(screenshotDir, { recursive: true });

  const suffix = String(Date.now());
  const email = `m4b-admin-${suffix}@loopos.test`;
  const password = `M4b-admin-${suffix}!`;
  const orgName = `M4-B Admin ${suffix}`;
  const ledger = { console: [], page: [], http: [] };
  const browser = await chromium.launch({ headless: true });
  let output;
  let residue = null;
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    observe(page, baseUrl, ledger);
    await page.goto(`${baseUrl}/register`, { waitUntil: "networkidle" });
    await page.getByLabel("组织名称").fill(orgName);
    await page.getByLabel("你的姓名").fill("M4-B Admin");
    await page.getByLabel("邮箱").fill(email);
    await page.getByLabel("密码").fill(password);
    await page.getByRole("button", { name: "创建组织" }).click();
    await page.waitForURL(`${baseUrl}/app`, { timeout: 30_000 });

    const fixture = await seedRoleAndAgent(databaseUrl, email, suffix);
    await page.goto(`${baseUrl}/app/roles/${fixture.roleId}`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "AI 共同承担策略" }).waitFor();
    await page.getByText("这个角色还没有 AI 共同承担策略。").waitFor();
    await page.locator('select[name="aiPersonId"]').selectOption(fixture.agentId);
    await page.locator('select[name="accountableHumanPersonId"]').selectOption(fixture.personId);
    await page.locator('select[name="maxRiskLevel"]').selectOption("L2");
    await page.getByRole("button", { name: "保存提议" }).click();
    await page.getByText("已配置").waitFor();
    const policyCard = page.locator(".rounded-input", { hasText: "M4-B AI Agent" }).filter({ hasText: "PROPOSED" });
    await policyCard.getByText("M4-B AI Agent").waitFor();
    await policyCard.getByText("M4-B Admin").waitFor();
    await policyCard.getByText("L2").waitFor();
    await policyCard.getByText("PROPOSED").waitFor();
    await policyCard.getByRole("button", { name: "批准" }).click();
    await page.getByText("APPROVED").waitFor();
    await page.getByText("未来执行准备就绪").waitFor();
    const approvedCard = page.locator(".rounded-input", { hasText: "M4-B AI Agent" }).filter({ hasText: "APPROVED" });
    await approvedCard.locator('input[name="reason"]').first().fill("M4-C lifecycle pause");
    await approvedCard.getByRole("button", { name: "暂停" }).click();
    await page.getByText("SUSPENDED").waitFor();
    const suspendedCard = page.locator(".rounded-input", { hasText: "M4-B AI Agent" }).filter({ hasText: "SUSPENDED" });
    await suspendedCard.locator('input[name="reason"]').fill("M4-C lifecycle revoke");
    await suspendedCard.getByRole("button", { name: "撤销" }).click();
    await page.getByText("REVOKED").waitFor();
    await page.getByText("执行准备度：POLICY_NOT_APPROVED").waitFor();
    await page.getByText("不会触发 AI 自动执行").waitFor();
    await page.getByText("M4-C lifecycle revoke").waitFor();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    await page.screenshot({ path: `${screenshotDir}/role-ai-coassignee.png`, fullPage: true });
    residue = await cleanup(databaseUrl, email, orgName);
    output = { ok: true, fixture, overflow, ledger, residue, screenshotDir };
  } catch (error) {
    residue = await cleanup(databaseUrl, email, orgName).catch((cleanupError) => ({ cleanupError: cleanupError.message }));
    output = { ok: false, error: error.message, ledger, residue, screenshotDir };
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
