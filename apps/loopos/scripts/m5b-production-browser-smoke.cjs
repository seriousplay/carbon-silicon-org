#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright");

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value) throw new Error(`${name} requires a value`);
  return value;
}

async function main() {
  const baseUrl = option("--base-url", "https://csi-org.com/loopos").replace(/\/+$/, "");
  const suffix = option("--suffix", String(Date.now()));
  const screenshotPath = option("--screenshot-path", "");
  const email = `m5b-smoke-${suffix}@loopos.test`;
  const password = `M5b-smoke-${suffix}!`;
  const orgName = `M5B Smoke ${suffix}`;
  const name = `M5B Smoke User ${suffix}`;
  const errors = [];
  const responses = [];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      errors.push({ type: "console", level: message.type(), text: message.text().slice(0, 500) });
    }
  });
  page.on("pageerror", (error) => {
    errors.push({ type: "pageerror", text: error.message.slice(0, 500) });
  });
  page.on("response", (response) => {
    const url = response.url();
    if (url.startsWith(baseUrl) && response.status() >= 500) {
      responses.push({ url, status: response.status() });
    }
  });

  try {
    await page.goto(`${baseUrl}/register`, { waitUntil: "networkidle" });
    await page.getByLabel("组织名称").fill(orgName);
    await page.getByLabel("你的姓名").fill(name);
    await page.getByLabel("邮箱").fill(email);
    await page.getByLabel("密码").fill(password);
    await page.getByRole("button", { name: "创建组织" }).click();
    await page.waitForURL(/\/loopos\/app(?:$|[/?#])/, { timeout: 20000 });

    await page.goto(`${baseUrl}/app`, { waitUntil: "domcontentloaded" });
    await page.locator("body").waitFor({ state: "visible", timeout: 10000 });
    const appTitle = (await page.locator("body").innerText()).slice(0, 500);

    await page.goto(`${baseUrl}/app/brain`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "组织大脑" }).waitFor({ timeout: 10000 });
    await page.locator('[aria-busy="true"]').waitFor({ state: "detached", timeout: 30000 });
    await page.getByText("向组织大脑提问", { exact: true }).first().waitFor({ timeout: 10000 });
    const brainTitle = (await page.locator("body").innerText()).slice(0, 500);
    if (screenshotPath) {
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }

    const session = await page.goto(`${baseUrl}/api/auth/session`, { waitUntil: "domcontentloaded" });
    const sessionStatus = session?.status() ?? null;

    await browser.close();
    const ok = responses.length === 0 && errors.length === 0 && sessionStatus === 200;
    console.log(JSON.stringify({
      ok,
      baseUrl,
      email,
      orgName,
      sessionStatus,
      appTextSample: appTitle,
      brainTextSample: brainTitle,
      screenshotPath: screenshotPath || null,
      serverErrors: responses,
      browserErrors: errors,
    }, null, 2));
    if (!ok) process.exit(1);
  } catch (error) {
    await browser.close();
    console.log(JSON.stringify({
      ok: false,
      baseUrl,
      email,
      orgName,
      error: error instanceof Error ? error.message : String(error),
      serverErrors: responses,
      browserErrors: errors,
    }, null, 2));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
