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
      `select p.id as "personId", p."organizationId" from people p where p.email = $1`,
      [email],
    );
    if (target.rowCount !== 1) throw new Error("smoke actor not found");
    const { personId, organizationId } = target.rows[0];
    const ids = ["a", "b", "c", "d"].map((key) => `m6-1c-${suffix}-${key}`);
    for (const [index, id] of ids.entries()) {
      await pool.query(
        `
          insert into tensions (
            id, "organizationId", title, description, type, source,
            "raiserId", status, "createdAt", "updatedAt"
          ) values ($1, $2, $3, $4, 'CONSTRUCTIVE', 'FORM', $5, 'OPEN', now(), now())
        `,
        [id, organizationId, `浏览器焦点 ${index + 1}`, "M6-1C browser evidence", personId],
      );
    }
    return ids;
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
        select u.id as "userId", coalesce(p."organizationId", m."organizationId", o.id) as "organizationId"
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

async function renderedContrast(locator) {
  return locator.evaluate((element) => {
    const parse = (value) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d", { colorSpace: "srgb" });
      if (!context) throw new Error("2D canvas unavailable");
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
      return [red, green, blue, alpha / 255];
    };
    const composite = (foreground, background) => {
      const alpha = foreground[3] + background[3] * (1 - foreground[3]);
      if (alpha === 0) return [0, 0, 0, 0];
      return [0, 1, 2].map((index) => (
        (foreground[index] * foreground[3]
          + background[index] * background[3] * (1 - foreground[3])) / alpha
      )).concat(alpha);
    };
    const layers = [];
    for (let node = element; node; node = node.parentElement) {
      layers.push(parse(getComputedStyle(node).backgroundColor));
    }
    let background = [0, 0, 0, 0];
    for (const layer of layers.reverse()) background = composite(layer, background);
    if (background[3] < 1) background = composite(background, [255, 255, 255, 1]);

    const foreground = composite(parse(getComputedStyle(element).color), background);
    const luminance = (color) => {
      const channels = color.slice(0, 3).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const foregroundLuminance = luminance(foreground);
    const backgroundLuminance = luminance(background);
    const ratio = (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
      / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
    return {
      foreground: getComputedStyle(element).color,
      background: background.slice(0, 3).map((value) => Math.round(value)),
      ratio: Number(ratio.toFixed(2)),
    };
  });
}

async function inspectHome(page) {
  await page.locator('[data-brain-command-center="true"]').waitFor();
  await page.locator('[data-brain-mode="workspace"]').waitFor();
  await page.getByRole("heading", { name: "组织感知" }).waitFor();
  await page.getByRole("heading", { name: "当前焦点" }).waitFor();
  await page.getByPlaceholder("询问角色、回路、项目、张力或会议…").waitFor();
  await page.locator('[aria-busy="true"]').waitFor({ state: "detached", timeout: 30_000 });

  const focusItems = page.locator('section[aria-labelledby="brain-focus-heading"] ol > li');
  const textarea = page.getByPlaceholder("询问角色、回路、项目、张力或会议…");
  const initialLayout = await textarea.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      inputInitiallyVisible: rect.top >= 0 && rect.bottom <= window.innerHeight,
      inputInitialTop: Math.round(rect.top),
      inputInitialBottom: Math.round(rect.bottom),
    };
  });
  await textarea.scrollIntoViewIfNeeded();
  await textarea.click();
  const inputFocused = await textarea.evaluate((element) => document.activeElement === element);
  const layout = await page.evaluate(() => {
    const input = document.querySelector('textarea[id^="brain-question-"]');
    const nav = [...document.querySelectorAll("nav")].find((element) => {
      const style = getComputedStyle(element);
      return style.position === "fixed" && style.display !== "none";
    });
    const intersects = (a, b) => Boolean(a && b
      && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
    const parseColor = (value) => {
      if (/^#[0-9a-f]{6}$/i.test(value)) {
        return [1, 3, 5].map((start) => Number.parseInt(value.slice(start, start + 2), 16));
      }
      return (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    };
    const luminance = (value) => {
      const channels = parseColor(value).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const contrast = (left, right) => {
      const high = Math.max(luminance(left), luminance(right));
      const low = Math.min(luminance(left), luminance(right));
      return (high + 0.05) / (low + 0.05);
    };
    const root = getComputedStyle(document.documentElement);
    const body = getComputedStyle(document.body);
    const background = body.backgroundColor;
    const semanticColors = ["--brain-success", "--brain-info", "--brain-warning", "--brain-danger"]
      .map((name) => ({ name, value: root.getPropertyValue(name).trim() }));
    return {
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      inputNavOverlap: intersects(input?.getBoundingClientRect(), nav?.getBoundingClientRect()),
      bodyBackground: background,
      bodyColor: body.color,
      semanticContrast: semanticColors.map((color) => ({
        name: color.name,
        value: color.value,
        ratio: Number(contrast(color.value, background).toFixed(2)),
      })),
    };
  });

  return {
    focusCount: await focusItems.count(),
    focusTitles: await focusItems.locator("p:first-child").allTextContents(),
    evidenceHrefs: await focusItems.locator('a:has-text("证据：")').evaluateAll((links) =>
      links.map((link) => link.getAttribute("href"))),
    actionHrefs: await focusItems.locator("a:last-child").evaluateAll((links) =>
      links.map((link) => link.getAttribute("href"))),
    healthyLabels: await page.getByLabel("当前运行状态")
      .locator("a > span:last-child > span:first-child").allTextContents(),
    inputFocused,
    ...initialLayout,
    ...layout,
  };
}

async function capture(page, { colorScheme, viewport, path }) {
  await page.emulateMedia({ colorScheme, reducedMotion: "no-preference" });
  await page.setViewportSize(viewport);
  await page.reload({ waitUntil: "networkidle" });
  const inspection = await inspectHome(page);
  await page.screenshot({ path, fullPage: false });
  return inspection;
}

async function main() {
  const baseUrl = option("--base-url", "http://127.0.0.1:3232").replace(/\/+$/, "");
  const screenshotDir = option("--screenshot-dir", `/tmp/loopos-m6-1c-${Date.now()}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  mkdirSync(screenshotDir, { recursive: true });
  const suffix = String(Date.now());
  const email = `m6-1c-smoke-${suffix}@loopos.test`;
  const password = `M6-1c-smoke-${suffix}!`;
  const orgName = `M6-1C Smoke ${suffix}`;
  const ledger = { console: [], page: [], http: [] };
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  observe(page, baseUrl, ledger);

  let result;
  let residue = null;
  try {
    await page.goto(`${baseUrl}/register`, { waitUntil: "networkidle" });
    await page.getByLabel("组织名称").fill(orgName);
    await page.getByLabel("你的姓名").fill(`M6-1C User ${suffix}`);
    await page.getByLabel("邮箱").fill(email);
    await page.getByLabel("密码").fill(password);
    await page.getByRole("button", { name: "创建组织" }).click();
    await page.waitForURL(`${baseUrl}/app`, { timeout: 20_000 });

    const seededIds = await seedFocusFacts({ databaseUrl, email, suffix });
    const desktopLight = await capture(page, {
      colorScheme: "light",
      viewport: { width: 1440, height: 960 },
      path: `${screenshotDir}/desktop-light.png`,
    });
    const desktopDark = await capture(page, {
      colorScheme: "dark",
      viewport: { width: 1440, height: 960 },
      path: `${screenshotDir}/desktop-dark.png`,
    });
    const mobileLight = await capture(page, {
      colorScheme: "light",
      viewport: { width: 390, height: 844 },
      path: `${screenshotDir}/mobile-light.png`,
    });
    const mobileDark = await capture(page, {
      colorScheme: "dark",
      viewport: { width: 390, height: 844 },
      path: `${screenshotDir}/mobile-dark.png`,
    });

    await page.emulateMedia({ colorScheme: "light" });
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.reload({ waitUntil: "networkidle" });
    const firstEvidence = page.locator('section[aria-labelledby="brain-focus-heading"] ol > li:first-child a:has-text("证据：")');
    const evidenceHref = await firstEvidence.getAttribute("href");
    await firstEvidence.click();
    await page.waitForURL(`${baseUrl}${evidenceHref}`);
    const evidenceNavigation = page.url() === `${baseUrl}${evidenceHref}`;
    await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
    const firstAction = page.locator('section[aria-labelledby="brain-focus-heading"] ol > li:first-child a:last-child');
    const actionHref = await firstAction.getAttribute("href");
    await firstAction.click();
    await page.waitForURL(`${baseUrl}${actionHref}`);
    const actionNavigation = page.url() === `${baseUrl}${actionHref}`;
    await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "新建组织大脑对话" }).click();
    await page.locator('[aria-busy="true"]').waitFor({ state: "detached", timeout: 30_000 });
    const conversationCreated = await page.locator('aside[aria-label="近期私人对话"] button[aria-pressed="true"]').count() === 1;
    const question = page.getByPlaceholder("询问角色、回路、项目、张力或会议…");
    await question.fill("当前组织需要我优先关注什么？");
    await question.press(process.platform === "darwin" ? "Meta+Enter" : "Control+Enter");
    await page.getByText("模型不可用", { exact: true }).waitFor({ timeout: 30_000 });
    const modelUnavailableVisible = await page.getByText("模型不可用", { exact: true }).count() === 1;
    const unavailableBadge = page.locator('[data-brain-status="UNAVAILABLE"]').last();
    const unavailableLightContrast = await renderedContrast(unavailableBadge);
    await page.screenshot({ path: `${screenshotDir}/provider-unavailable-light.png`, fullPage: false });
    await page.emulateMedia({ colorScheme: "dark" });
    const unavailableDarkContrast = await renderedContrast(unavailableBadge);
    await page.screenshot({ path: `${screenshotDir}/provider-unavailable-dark.png`, fullPage: false });

    const expectedTitles = ["浏览器焦点 1", "浏览器焦点 2", "浏览器焦点 3"];
    const inspections = [desktopLight, desktopDark, mobileLight, mobileDark];
    const stableFocus = inspections.every((item) => item.focusCount === 3
      && JSON.stringify(item.focusTitles) === JSON.stringify(expectedTitles));
    const linksValid = inspections.every((item) => item.evidenceHrefs.length === 3
      && item.actionHrefs.length === 3
      && [...item.evidenceHrefs, ...item.actionHrefs].every(
        (href) => typeof href === "string" && /^\/app(?:[/?#]|$)/.test(href),
      ));
    const healthyStateVisible = inspections.every((item) => JSON.stringify(item.healthyLabels) === JSON.stringify([
      "本周期目标", "下一场会议", "我的进行中项目",
    ]));
    const themeChanges = desktopLight.bodyBackground !== desktopDark.bodyBackground
      && desktopLight.bodyColor !== desktopDark.bodyColor
      && mobileLight.bodyBackground !== mobileDark.bodyBackground
      && mobileLight.bodyColor !== mobileDark.bodyColor;
    const contrastPass = inspections.every((item) => item.semanticContrast.every((color) => color.ratio >= 4.5))
      && unavailableLightContrast.ratio >= 4.5
      && unavailableDarkContrast.ratio >= 4.5;
    const layoutsPass = inspections.every((item) => item.inputInitiallyVisible && item.inputFocused
      && !item.horizontalOverflow && !item.inputNavOverlap);
    const ok = seededIds.length === 4 && stableFocus && linksValid && healthyStateVisible
      && themeChanges && contrastPass && layoutsPass && evidenceNavigation && actionNavigation
      && conversationCreated && modelUnavailableVisible
      && ledger.console.length === 0 && ledger.page.length === 0 && ledger.http.length === 0;
    result = {
      ok, baseUrl, screenshotDir, stableFocus, linksValid, healthyStateVisible,
      themeChanges, contrastPass, layoutsPass, evidenceNavigation, actionNavigation,
      conversationCreated, modelUnavailableVisible, unavailableLightContrast,
      unavailableDarkContrast, desktopLight, desktopDark,
      mobileLight, mobileDark, ledger,
    };
  } catch (error) {
    result = {
      ok: false, baseUrl, screenshotDir,
      error: error instanceof Error ? error.message : String(error), ledger,
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
