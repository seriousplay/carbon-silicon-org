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

async function cleanup(databaseUrl, email, orgName, updatedName) {
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
      LEFT JOIN organizations o ON o.name = any($2::text[])
      WHERE u.email = $1
    `, [email, [orgName, updatedName]]);
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
        (SELECT count(*)::int FROM organizations WHERE name = any($2::text[])) AS organizations
    `, [email, [orgName, updatedName]]);
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

async function readOrganization(databaseUrl, name) {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const result = await pool.query('SELECT id, name, purpose FROM organizations WHERE name = $1', [name]);
    return result.rows[0] ?? null;
  } finally {
    await pool.end();
  }
}

async function main() {
  const baseUrl = option("--base-url", "http://127.0.0.1:3233").replace(/\/+$/, "");
  const screenshotDir = option("--screenshot-dir", `/tmp/loopos-m2b-${Date.now()}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  mkdirSync(screenshotDir, { recursive: true });

  const suffix = String(Date.now());
  const email = `m2b-smoke-${suffix}@loopos.test`;
  const password = `M2b-smoke-${suffix}!`;
  const orgName = `M2-B Smoke ${suffix}`;
  const updatedName = `M2-B Edited ${suffix}`;
  const updatedPurpose = `M2-B purpose ${suffix}`;
  const personName = `M2-B User ${suffix}`;
  const ledger = { console: [], page: [], http: [] };
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
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

    const requiredHeadings = [
      "组织设置工作台",
      "01 组织身份",
      "02 组织结构",
      "07 系统配置",
      "组织基本配置",
      "组织语言",
      "治理规则",
      "组织大脑模型",
      "03 组织目标",
      "04 角色定义",
      "05 成员邀请",
      "06 角色任命",
      "下一步准备度",
    ];
    for (const heading of requiredHeadings) {
      await page.getByRole("heading", { name: heading }).waitFor();
    }
    await page.getByText("用「精益团队」初始化").first().waitFor();
    await page.getByRole("link", { name: "打开目标工作区" }).waitFor();
    await page.getByRole("link", { name: "管理成员邀请" }).waitFor();
    await page.getByRole("link", { name: "打开角色市场" }).waitFor();
    await page.getByText("填写组织名称和目的").waitFor();
    await page.getByText(/个缺口/).waitFor();
    const setupStepHrefs = await page.locator("a").evaluateAll(
      (links) => links.map((link) => `${new URL(link.href).pathname}${new URL(link.href).hash}`),
    );
    if (setupStepHrefs.some((href) => href === "/app/setup" || href.includes("/app/setup"))) {
      throw new Error(`organization setup workspace still links to old setup route: ${setupStepHrefs.join(",")}`);
    }
    for (const href of ["/app/organization#organization-identity", "/app/organization#system-configuration"]) {
      if (!setupStepHrefs.includes(href)) {
        throw new Error(`organization setup workspace missing in-page setup href: ${href}`);
      }
    }

    await page.getByLabel("组织名称").fill(updatedName);
    await page.getByLabel("组织目的").fill(updatedPurpose);
    await page.getByRole("button", { name: "保存组织配置" }).click();
    await page.getByText("已生成新配置版本。").waitFor({ timeout: 15_000 });
    const updatedOrganization = await readOrganization(databaseUrl, updatedName);
    if (!updatedOrganization) throw new Error("organization profile save did not persist updated name");
    if (updatedOrganization.purpose !== updatedPurpose) {
      throw new Error("organization profile save did not persist updated purpose");
    }
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("heading", { name: updatedName }).waitFor();
    await page.getByText("名称和目的已填写").waitFor();

    const desktopOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    await page.screenshot({ path: `${screenshotDir}/desktop-organization-editable-workspace.png`, fullPage: true });

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    observe(mobile, baseUrl, ledger);
    await mobile.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    await mobile.getByLabel("邮箱").fill(email);
    await mobile.getByLabel("密码").fill(password);
    await mobile.getByRole("button", { name: "登录" }).click();
    await mobile.waitForURL(`${baseUrl}/app`, { timeout: 30_000 });
    await mobile.goto(`${baseUrl}/app/organization`, { waitUntil: "networkidle" });
    await mobile.getByRole("heading", { name: "组织设置工作台" }).waitFor();
    await mobile.getByRole("heading", { name: "组织基本配置" }).waitFor();
    await mobile.getByRole("heading", { name: "下一步准备度" }).waitFor();
    await mobile.getByRole("heading", { name: "03 组织目标" }).waitFor();
    await mobile.getByRole("heading", { name: "06 角色任命" }).waitFor();
    const mobileOverflow = await mobile.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    await mobile.screenshot({ path: `${screenshotDir}/mobile-organization-editable-workspace.png`, fullPage: true });
    await mobile.close();

    output = {
      ok: !desktopOverflow && !mobileOverflow
        && ledger.console.length === 0 && ledger.page.length === 0 && ledger.http.length === 0,
      baseUrl,
      screenshotDir,
      requiredHeadings,
      persistedOrganization: {
        id: updatedOrganization.id,
        name: updatedOrganization.name,
        purpose: updatedOrganization.purpose,
      },
      purposeReady: true,
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
    residue = await cleanup(databaseUrl, email, orgName, updatedName);
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
