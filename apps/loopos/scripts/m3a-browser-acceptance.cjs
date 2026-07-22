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

async function seedBusinessFlowFixture(databaseUrl, email, suffix) {
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
    if (!row) throw new Error("M3-A fixture person not found after registration");
    const organizationId = row.organizationId;
    const personId = row.personId;
    const sourceCircleId = `m3a-source-${suffix}`;
    const targetCircleId = `m3a-target-${suffix}`;
    await client.query(`
      INSERT INTO circles ("id", "organizationId", "name", "number", "type", "purpose", "status", "phase", "createdAt", "updatedAt")
      VALUES
        ($2, $1, '客户成功团队', 'ONE', 'PRODUCTION', '识别客户价值并推动续约', 'NORMAL', 'PHASE_0', now(), now()),
        ($3, $1, '产品团队', 'TWO', 'PRODUCTION', '把客户洞察转化为产品改进', 'NORMAL', 'PHASE_0', now(), now())
    `, [organizationId, sourceCircleId, targetCircleId]);
    for (let index = 1; index <= 10; index += 1) {
      const status = index <= 6 ? "READY" : index <= 8 ? "DELAYED" : "BLOCKED";
      await client.query(`
        INSERT INTO circle_interfaces (
          "id", "organizationId", "name", "contractContent", "sla", "acceptanceCriteria",
          "status", "fromCircleId", "toCircleId", "ownerId", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, '每周同步', '产品团队确认可进入队列', $5, $6, $7, $8, now(), now())
      `, [
        `m3a-interface-${suffix}-${index}`,
        organizationId,
        `客户洞察流 ${String(index).padStart(2, "0")}`,
        `客户成功团队提供第 ${index} 组客户洞察和数据证据。`,
        status,
        sourceCircleId,
        targetCircleId,
        personId,
      ]);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const baseUrl = option("--base-url", "http://127.0.0.1:3238").replace(/\/+$/, "");
  const screenshotDir = option("--screenshot-dir", `/tmp/loopos-m3a-${Date.now()}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  mkdirSync(screenshotDir, { recursive: true });

  const suffix = String(Date.now());
  const email = `m3a-smoke-${suffix}@loopos.test`;
  const password = `M3a-smoke-${suffix}!`;
  const orgName = `M3-A Smoke ${suffix}`;
  const personName = `M3-A User ${suffix}`;
  const ledger = { console: [], page: [], http: [] };
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
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
    await seedBusinessFlowFixture(databaseUrl, email, suffix);

    await page.goto(`${baseUrl}/app/circles/map`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "组织结构 正式权责与角色边界" }).waitFor();
    await page.getByRole("link", { name: "业务回路 价值与数据如何流动" }).click();
    await page.waitForURL(`${baseUrl}/app/organization/business-loops`, { timeout: 30_000 });
    await page.getByRole("heading", { name: "业务回路", exact: true }).waitFor();
    await page.getByText("价值与数据流").waitFor();
    const stats = await page.locator("section").first().locator(".text-2xl").evaluateAll(
      (items) => items.map((item) => item.textContent?.trim() ?? ""),
    );
    if (stats.join(",") !== "3,10,6,4") {
      throw new Error(`unexpected business loop stats: ${stats.join(",")}`);
    }
    await page.getByText("客户成功团队").first().waitFor();
    await page.getByText("产品团队").first().waitFor();
    await page.getByText("客户洞察流 10").waitFor();
    await page.getByText("客户洞察流 03").waitFor();
    const previewRows = await page.getByText(/客户洞察流/).count();
    if (previewRows !== 8) {
      throw new Error(`expected exactly 8 preview flow rows, got ${previewRows}`);
    }
    await page.getByRole("link", { name: "组织结构 正式权责与角色边界" }).click();
    await page.waitForURL(`${baseUrl}/app/circles/map`, { timeout: 30_000 });

    const desktopOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    await page.screenshot({ path: `${screenshotDir}/desktop-business-loops-nav.png`, fullPage: true });

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    observe(mobile, baseUrl, ledger);
    await mobile.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    await mobile.getByLabel("邮箱").fill(email);
    await mobile.getByLabel("密码").fill(password);
    await mobile.getByRole("button", { name: "登录" }).click();
    await mobile.waitForURL(`${baseUrl}/app`, { timeout: 30_000 });
    await mobile.goto(`${baseUrl}/app/organization/business-loops`, { waitUntil: "networkidle" });
    await mobile.getByRole("heading", { name: "业务回路", exact: true }).waitFor();
    await mobile.getByRole("link", { name: "组织结构 正式权责与角色边界" }).waitFor();
    await mobile.getByRole("link", { name: "业务回路 价值与数据如何流动" }).waitFor();
    const mobileOverflow = await mobile.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    await mobile.screenshot({ path: `${screenshotDir}/mobile-business-loops-nav.png`, fullPage: true });
    await mobile.close();

    output = {
      ok: !desktopOverflow && !mobileOverflow
        && ledger.console.length === 0 && ledger.page.length === 0 && ledger.http.length === 0,
      baseUrl,
      screenshotDir,
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
