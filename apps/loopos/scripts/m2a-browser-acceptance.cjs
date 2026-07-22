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
      await client.query('DELETE FROM organizations WHERE id = any($1::text[])', [organizationIds]);
    }
    if (userIds.length > 0) {
      await client.query("DELETE FROM people WHERE id = any($1::text[]) OR email = $2", [userIds, email]);
      await client.query("DELETE FROM users WHERE id = any($1::text[])", [userIds]);
    }
    const residue = await client.query(`
      SELECT
        (SELECT count(*)::int FROM users WHERE email = $1) AS users,
        (SELECT count(*)::int FROM people WHERE email = $1) AS people,
        (SELECT count(*)::int FROM organizations WHERE name = $2) AS organizations
    `, [email, orgName]);
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
  const baseUrl = option("--base-url", "http://127.0.0.1:3232").replace(/\/+$/, "");
  const screenshotDir = option("--screenshot-dir", `/tmp/loopos-m2a-${Date.now()}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  mkdirSync(screenshotDir, { recursive: true });

  const suffix = String(Date.now());
  const email = `m2a-smoke-${suffix}@loopos.test`;
  const password = `M2a-smoke-${suffix}!`;
  const orgName = `M2-A Smoke ${suffix}`;
  const personName = `M2-A User ${suffix}`;
  const ledger = { console: [], page: [], http: [] };
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  observe(page, baseUrl, ledger);
  let output;
  let residue = null;
  try {
    await page.goto(`${baseUrl}/register`, { waitUntil: "networkidle" });
    await page.getByLabel("组织名称").fill(orgName);
    await page.getByLabel("你的姓名").fill(personName);
    await page.getByLabel("邮箱").fill(email);
    await page.getByLabel("密码").fill(password);
    await page.getByRole("button", { name: "创建组织" }).click();
    await page.waitForURL(`${baseUrl}/app`, { timeout: 30_000 });
    await page.goto(`${baseUrl}/app/organization`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "组织设置工作台" }).waitFor();
    const labels = ["组织身份", "组织结构", "组织目标", "角色定义", "成员邀请", "角色任命", "系统配置"];
    for (const label of labels) await page.getByText(label).first().waitFor();
    const desktopOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    await page.screenshot({ path: `${screenshotDir}/desktop-organization-workspace.png`, fullPage: true });

    const routeChecks = [
      ["组织身份", "/app/setup"],
      ["组织结构", "/app/circles/map"],
      ["组织目标", "/app/goals"],
      ["角色定义", "/app/circles/map"],
      ["成员邀请", "/app/people"],
      ["角色任命", "/app/roles/market"],
      ["系统配置", "/app/setup"],
    ];
    const routeResults = [];
    for (const [label, path] of routeChecks) {
      await page.goto(`${baseUrl}/app/organization`, { waitUntil: "networkidle" });
      await page.getByText(label).first().click();
      await page.waitForURL((url) => url.pathname === path, { timeout: 10_000 });
      routeResults.push({ label, path, ok: true });
    }

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    observe(mobile, baseUrl, ledger);
    await mobile.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    await mobile.getByLabel("邮箱").fill(email);
    await mobile.getByLabel("密码").fill(password);
    await mobile.getByRole("button", { name: "登录" }).click();
    await mobile.waitForURL(`${baseUrl}/app`, { timeout: 30_000 });
    await mobile.goto(`${baseUrl}/app/organization`, { waitUntil: "networkidle" });
    await mobile.getByRole("heading", { name: "组织设置工作台" }).waitFor();
    const mobileOverflow = await mobile.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    await mobile.screenshot({ path: `${screenshotDir}/mobile-organization-workspace.png`, fullPage: true });
    await mobile.close();

    output = {
      ok: routeResults.every((item) => item.ok) && !desktopOverflow && !mobileOverflow
        && ledger.console.length === 0 && ledger.page.length === 0 && ledger.http.length === 0,
      baseUrl,
      screenshotDir,
      labels,
      routeResults,
      desktopOverflow,
      mobileOverflow,
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
    residue = await cleanup(databaseUrl, email, orgName);
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
