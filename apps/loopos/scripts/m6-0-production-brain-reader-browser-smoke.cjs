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
  const email = `m5b-smoke-${suffix}@loopos.test`;
  const password = `M5b-smoke-${suffix}!`;
  const orgName = `M5B Smoke ${suffix}`;
  const name = `M5B Reader ${suffix}`;
  const question = "当前组织名称是什么？请只根据组织事实回答。";
  const browserErrors = [];
  const serverErrors = [];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      browserErrors.push({ type: message.type(), text: message.text().slice(0, 500) });
    }
  });
  page.on("pageerror", (error) => {
    browserErrors.push({ type: "pageerror", text: error.message.slice(0, 500) });
  });
  page.on("response", (response) => {
    if (response.url().startsWith(baseUrl) && response.status() >= 500) {
      serverErrors.push({ url: response.url(), status: response.status() });
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

    await page.goto(`${baseUrl}/app/brain`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "组织大脑" }).waitFor({ timeout: 10000 });
    await page.locator('[aria-busy="true"]').waitFor({ state: "detached", timeout: 30000 });

    const input = page.getByPlaceholder("询问角色、回路、项目、张力或会议…");
    const send = page.getByRole("button", { name: "发送问题" });
    const factLabel = page.getByText("确认事实", { exact: true });
    const sourceLabel = page.getByText("来源", { exact: true });
    const beforeOrgCount = await page.getByText(orgName, { exact: true }).count();
    const beforeFactCount = await factLabel.count();
    const beforeSourceCount = await sourceLabel.count();

    await input.fill(question);
    await send.click();
    await page.waitForFunction(
      ({ beforeFactCount, beforeSourceCount }) => {
        const facts = [...document.querySelectorAll("h3, h4, p, span")]
          .filter((node) => node.textContent?.trim() === "确认事实").length;
        const sources = [...document.querySelectorAll("h3, h4, p, span")]
          .filter((node) => node.textContent?.trim() === "来源").length;
        return facts > beforeFactCount && sources > beforeSourceCount;
      },
      { beforeFactCount, beforeSourceCount },
      { timeout: 45000 },
    );
    await page.waitForFunction(
      ({ orgName, beforeOrgCount }) => {
        const matches = [...document.querySelectorAll("body *")]
          .filter((node) => node.children.length === 0 && node.textContent?.trim() === orgName).length;
        return matches > beforeOrgCount;
      },
      { orgName, beforeOrgCount },
      { timeout: 10000 },
    );
    await page.waitForFunction(
      () => {
        const textarea = document.querySelector('textarea[placeholder="询问角色、回路、项目、张力或会议…"]');
        return textarea && !textarea.disabled && textarea.value === "";
      },
      undefined,
      { timeout: 10000 },
    );

    const finalFactCount = await factLabel.count();
    const finalSourceCount = await sourceLabel.count();
    const finalOrgCount = await page.getByText(orgName, { exact: true }).count();
    const ok = browserErrors.length === 0
      && serverErrors.length === 0
      && finalFactCount > beforeFactCount
      && finalSourceCount > beforeSourceCount
      && finalOrgCount > beforeOrgCount;

    console.log(JSON.stringify({
      ok,
      baseUrl,
      email,
      orgName,
      question,
      evidence: {
        factSectionAdded: finalFactCount > beforeFactCount,
        sourceSectionAdded: finalSourceCount > beforeSourceCount,
        organizationFactAdded: finalOrgCount > beforeOrgCount,
      },
      serverErrors,
      browserErrors,
    }, null, 2));
    if (!ok) process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({
      ok: false,
      baseUrl,
      email,
      orgName,
      question,
      error: error instanceof Error ? error.message : String(error),
      serverErrors,
      browserErrors,
    }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
