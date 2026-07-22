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

async function cleanup({ databaseUrl, email, orgName }) {
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query("begin");
    const target = await client.query(
      `
        select
          u.id as "userId",
          coalesce(p."organizationId", m."organizationId", o.id) as "organizationId"
        from users u
        left join people p on p."userId" = u.id
        left join memberships m on m."userId" = u.id
        left join organizations o on o.name = $2
        where u.email = $1
      `,
      [email, orgName],
    );
    const userIds = [...new Set(target.rows.map((row) => row.userId).filter(Boolean))];
    const organizationIds = [...new Set(target.rows.map((row) => row.organizationId).filter(Boolean))];

    if (organizationIds.length > 0) {
      await client.query("delete from organizations where id = any($1::text[])", [organizationIds]);
    }
    if (userIds.length > 0) {
      await client.query("delete from users where id = any($1::text[])", [userIds]);
    }

    const residue = await client.query(
      `
        select
          (select count(*)::int from users where email = $1) as users,
          (select count(*)::int from people where email = $1) as people,
          (select count(*)::int from organizations where name = $2) as organizations,
          (select count(*)::int from sessions s join users u on u.id = s."userId" where u.email = $1) as sessions,
          (select count(*)::int from accounts a join users u on u.id = a."userId" where u.email = $1) as accounts
      `,
      [email, orgName],
    );
    await client.query("commit");
    return residue.rows[0];
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function cleanLedger() {
  return { console: [], page: [], http: [] };
}

function observe(page, baseUrl, ledger) {
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      ledger.console.push({ type: message.type(), text: message.text().slice(0, 500) });
    }
  });
  page.on("pageerror", (error) => ledger.page.push(error.message.slice(0, 500)));
  page.on("response", (response) => {
    if (response.url().startsWith(baseUrl) && response.status() >= 400) {
      ledger.http.push({ status: response.status(), url: response.url() });
    }
  });
}

async function primaryLinks(page, selector) {
  return page.locator(selector).evaluateAll((links) =>
    links.map((link) => ({
      label: link.textContent?.trim() ?? "",
      href: link.getAttribute("href"),
    })),
  );
}

async function main() {
  const baseUrl = option("--base-url", "http://127.0.0.1:3230").replace(/\/+$/, "");
  const screenshotDir = option("--screenshot-dir", `/tmp/loopos-m6-1a-${Date.now()}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  mkdirSync(screenshotDir, { recursive: true });
  const suffix = String(Date.now());
  const email = `m6-1a-smoke-${suffix}@loopos.test`;
  const password = `M6-1a-smoke-${suffix}!`;
  const orgName = `M6-1A Smoke ${suffix}`;
  const personName = `M6-1A User ${suffix}`;
  const ledger = cleanLedger();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  observe(page, baseUrl, ledger);

  let result;
  let residue = null;
  try {
    await page.goto(`${baseUrl}/register`, { waitUntil: "networkidle" });
    await page.getByLabel("组织名称").fill(orgName);
    await page.getByLabel("你的姓名").fill(personName);
    await page.getByLabel("邮箱").fill(email);
    await page.getByLabel("密码").fill(password);
    await page.getByRole("button", { name: "创建组织" }).click();
    await page.waitForURL(`${baseUrl}/app`, { timeout: 20_000 });

    await page.getByRole("heading", { name: "组织大脑" }).waitFor();
    await page.getByPlaceholder("询问角色、回路、项目、张力或会议…").waitFor();
    await page.locator('[aria-busy="true"]').waitFor({ state: "detached", timeout: 30_000 });
    const desktopLinks = await primaryLinks(page, "aside nav a");
    await page.screenshot({ path: `${screenshotDir}/desktop-brain-home.png`, fullPage: true });

    await page.locator('aside nav a[href="/app/workspace"]').click();
    await page.waitForURL(`${baseUrl}/app/workspace`);
    await page.getByRole("navigation", { name: "常用工作" }).waitFor();
    const desktopWorkspaceActive = await page
      .locator('aside nav a[href="/app/workspace"]')
      .getAttribute("class");

    await page.getByRole("button", { name: "打开组织大脑" }).click();
    const brainPanel = page.getByRole("dialog");
    await brainPanel.getByRole("heading", { name: "组织大脑" }).waitFor();
    const expandLink = page.locator('a[href="/app"]', { hasText: "展开" });
    await expandLink.waitFor();
    const expandHref = await expandLink.getAttribute("href");
    await expandLink.click();
    await page.waitForURL(`${baseUrl}/app`);

    await page.goto(`${baseUrl}/app/brain`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(`${baseUrl}/app`);
    const compatibilityRedirected = page.url() === `${baseUrl}/app`;

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
    const mobileLinks = await primaryLinks(page, 'nav[aria-label="主要导航"] a');
    await page.locator('nav[aria-label="主要导航"] a[href="/app/workspace"]').click();
    await page.waitForURL(`${baseUrl}/app/workspace`);
    await page.getByRole("navigation", { name: "常用工作" }).waitFor();
    const mobileWorkspaceCurrent = await page
      .locator('nav[aria-label="主要导航"] a[href="/app/workspace"]')
      .getAttribute("aria-current");
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    await page.screenshot({ path: `${screenshotDir}/mobile-workspace.png`, fullPage: true });

    const expectedLinks = [
      { label: "工作", href: "/app/workspace" },
      { label: "目标", href: "/app/goals" },
      { label: "会议", href: "/app/meetings" },
      { label: "组织", href: "/app/circles/map" },
    ];
    const navigationMatches = JSON.stringify(desktopLinks) === JSON.stringify(expectedLinks)
      && JSON.stringify(mobileLinks) === JSON.stringify(expectedLinks);
    const ok = navigationMatches
      && desktopWorkspaceActive?.includes("bg-sidebar-accent")
      && expandHref === "/app"
      && compatibilityRedirected
      && mobileWorkspaceCurrent === "page"
      && !horizontalOverflow
      && ledger.console.length === 0
      && ledger.page.length === 0
      && ledger.http.length === 0;

    result = {
      ok,
      baseUrl,
      screenshotDir,
      navigationMatches,
      desktopLinks,
      mobileLinks,
      desktopWorkspaceActive: desktopWorkspaceActive?.includes("bg-sidebar-accent") ?? false,
      expandHref,
      compatibilityRedirected,
      mobileWorkspaceCurrent,
      horizontalOverflow,
      ledger,
    };
  } catch (error) {
    result = {
      ok: false,
      baseUrl,
      screenshotDir,
      error: error instanceof Error ? error.message : String(error),
      ledger,
    };
  } finally {
    await browser.close();
    residue = await cleanup({ databaseUrl, email, orgName });
  }

  const cleanupOk = Object.values(residue).every((count) => count === 0);
  const output = { ...result, cleanupOk, residue };
  console.log(JSON.stringify(output, null, 2));
  if (!output.ok || !cleanupOk) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
