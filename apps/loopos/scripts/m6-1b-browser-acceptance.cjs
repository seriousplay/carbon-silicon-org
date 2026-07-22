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

async function seedFocusFacts({ databaseUrl, email, suffix }) {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const target = await pool.query(
      `
        select p.id as "personId", p."organizationId"
        from people p
        where p.email = $1
      `,
      [email],
    );
    if (target.rowCount !== 1) throw new Error("smoke actor not found");
    const { personId, organizationId } = target.rows[0];
    const ids = ["a", "b", "c", "d"].map((key) => `m6-1b-${suffix}-${key}`);
    for (const [index, id] of ids.entries()) {
      await pool.query(
        `
          insert into tensions (
            id, "organizationId", title, description, type, source,
            "raiserId", status, "createdAt", "updatedAt"
          ) values ($1, $2, $3, $4, 'CONSTRUCTIVE', 'FORM', $5, 'OPEN', now(), now())
        `,
        [id, organizationId, `浏览器焦点 ${index + 1}`, "M6-1B bounded browser evidence", personId],
      );
    }
    return { ids, organizationId, personId };
  } finally {
    await pool.end();
  }
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

async function inspectHome(page) {
  await page.getByRole("heading", { name: "组织大脑" }).waitFor();
  await page.getByRole("heading", { name: "当前焦点" }).waitFor();
  await page.getByPlaceholder("询问角色、回路、项目、张力或会议…").waitFor();
  await page.locator('[aria-busy="true"]').waitFor({ state: "detached", timeout: 30_000 });
  const focusItems = page.locator('section[aria-labelledby="brain-focus-heading"] ol > li');
  const focusCount = await focusItems.count();
  const focusTitles = await focusItems.locator("p:first-child").allTextContents();
  const evidenceHrefs = await focusItems.locator('a:has-text("证据：")').evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")),
  );
  const actionHrefs = await focusItems.locator("a:last-child").evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")),
  );
  const healthyLabels = await page
    .getByLabel("当前运行状态")
    .locator("a > span:last-child > span:first-child")
    .allTextContents();
  const freshnessLimited = await page.getByText("新鲜度受限", { exact: true }).count();
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  return {
    focusCount,
    focusTitles,
    evidenceHrefs,
    actionHrefs,
    healthyLabels,
    freshnessLimited,
    horizontalOverflow,
  };
}

async function verifyNavigation(page, baseUrl, selector, expectedHref) {
  if (typeof expectedHref !== "string") return false;
  await page.locator(selector).click();
  await page.waitForURL(`${baseUrl}${expectedHref}`);
  return page.url() === `${baseUrl}${expectedHref}`;
}

async function main() {
  const baseUrl = option("--base-url", "http://127.0.0.1:3231").replace(/\/+$/, "");
  const screenshotDir = option("--screenshot-dir", `/tmp/loopos-m6-1b-${Date.now()}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  mkdirSync(screenshotDir, { recursive: true });
  const suffix = String(Date.now());
  const email = `m6-1b-smoke-${suffix}@loopos.test`;
  const password = `M6-1b-smoke-${suffix}!`;
  const orgName = `M6-1B Smoke ${suffix}`;
  const personName = `M6-1B User ${suffix}`;
  const ledger = { console: [], page: [], http: [] };
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

    const seeded = await seedFocusFacts({ databaseUrl, email, suffix });
    await page.reload({ waitUntil: "networkidle" });
    const desktop = await inspectHome(page);
    const evidenceNavigation = await verifyNavigation(
      page,
      baseUrl,
      'section[aria-labelledby="brain-focus-heading"] ol > li:first-child a:has-text("证据：")',
      desktop.evidenceHrefs[0],
    );
    await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
    const actionNavigation = await verifyNavigation(
      page,
      baseUrl,
      'section[aria-labelledby="brain-focus-heading"] ol > li:first-child a:last-child',
      desktop.actionHrefs[0],
    );
    await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
    await page.screenshot({ path: `${screenshotDir}/desktop-brain-focus.png`, fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "networkidle" });
    const mobile = await inspectHome(page);
    await page.screenshot({ path: `${screenshotDir}/mobile-brain-focus.png`, fullPage: true });

    const expectedTitles = ["浏览器焦点 1", "浏览器焦点 2", "浏览器焦点 3"];
    const linkCountsMatch = desktop.evidenceHrefs.length === 3
      && desktop.actionHrefs.length === 3
      && mobile.evidenceHrefs.length === 3
      && mobile.actionHrefs.length === 3;
    const internalLinks = linkCountsMatch && [...desktop.evidenceHrefs, ...desktop.actionHrefs].every(
      (href) => typeof href === "string" && /^\/app(?:[/?#]|$)/.test(href),
    );
    const healthyStateVisible = JSON.stringify(desktop.healthyLabels) === JSON.stringify([
      "本周期目标",
      "下一场会议",
      "我的进行中项目",
    ]);
    const ok = seeded.ids.length === 4
      && desktop.focusCount === 3
      && mobile.focusCount === 3
      && JSON.stringify(desktop.focusTitles) === JSON.stringify(expectedTitles)
      && JSON.stringify(mobile.focusTitles) === JSON.stringify(expectedTitles)
      && internalLinks
      && evidenceNavigation
      && actionNavigation
      && healthyStateVisible
      && desktop.freshnessLimited === 0
      && mobile.freshnessLimited === 0
      && !desktop.horizontalOverflow
      && !mobile.horizontalOverflow
      && ledger.console.length === 0
      && ledger.page.length === 0
      && ledger.http.length === 0;
    result = {
      ok,
      baseUrl,
      screenshotDir,
      desktop,
      mobile,
      linkCountsMatch,
      internalLinks,
      evidenceNavigation,
      actionNavigation,
      healthyStateVisible,
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
