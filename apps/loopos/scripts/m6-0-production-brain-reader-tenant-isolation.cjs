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

async function registerTenant(browser, baseUrl, suffix, label) {
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  const page = await context.newPage();
  const tenant = {
    label,
    email: `m5b-smoke-${suffix}-${label}@loopos.test`,
    password: `M5b-smoke-${suffix}-${label}!`,
    orgName: `M5B Smoke ${suffix}-${label}`,
    personName: `M5B Reader ${suffix}-${label}`,
    browserErrors: [],
    httpErrors: [],
    serverErrors: [],
    context,
    page,
  };

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())
      && !message.text().startsWith("Failed to load resource:")) {
      tenant.browserErrors.push({ type: message.type(), text: message.text().slice(0, 500) });
    }
  });
  page.on("pageerror", (error) => {
    tenant.browserErrors.push({ type: "pageerror", text: error.message.slice(0, 500) });
  });
  page.on("response", (response) => {
    if (response.url().startsWith(baseUrl) && response.status() >= 400) {
      tenant.httpErrors.push({ url: response.url(), status: response.status() });
    }
    if (response.url().startsWith(baseUrl) && response.status() >= 500) {
      tenant.serverErrors.push({ url: response.url(), status: response.status() });
    }
  });

  await page.goto(`${baseUrl}/register`, { waitUntil: "networkidle" });
  await page.getByLabel("组织名称").fill(tenant.orgName);
  await page.getByLabel("你的姓名").fill(tenant.personName);
  await page.getByLabel("邮箱").fill(tenant.email);
  await page.getByLabel("密码").fill(tenant.password);
  await page.getByRole("button", { name: "创建组织" }).click();
  await page.waitForURL(/\/loopos\/app(?:$|[/?#])/, { timeout: 20000 });
  return tenant;
}

async function askOrganization(tenant, otherOrgName, baseUrl) {
  const { page, orgName } = tenant;
  await page.goto(`${baseUrl}/app/brain`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "组织大脑" }).waitFor({ timeout: 10000 });
  await page.locator('[aria-busy="true"]').waitFor({ state: "detached", timeout: 30000 });

  const input = page.getByPlaceholder("询问角色、回路、项目、张力或会议…");
  const send = page.getByRole("button", { name: "发送问题" });
  const factLabel = page.getByText("确认事实", { exact: true });
  const beforeFactCount = await factLabel.count();
  const beforeOwnCount = await page.getByText(orgName, { exact: true }).count();
  const beforeOtherCount = await page.getByText(otherOrgName, { exact: true }).count();

  await input.fill("当前组织名称是什么？请只根据组织事实回答。");
  await send.click();
  await page.waitForFunction(
    ({ beforeFactCount }) => [...document.querySelectorAll("h3, h4, p, span")]
      .filter((node) => node.textContent?.trim() === "确认事实").length > beforeFactCount,
    { beforeFactCount },
    { timeout: 45000 },
  );
  await page.waitForFunction(
    ({ orgName, beforeOwnCount }) => [...document.querySelectorAll("body *")]
      .filter((node) => node.children.length === 0 && node.textContent?.trim() === orgName).length
      > beforeOwnCount,
    { orgName, beforeOwnCount },
    { timeout: 10000 },
  );

  const finalOwnCount = await page.getByText(orgName, { exact: true }).count();
  const finalOtherCount = await page.getByText(otherOrgName, { exact: true }).count();
  return {
    ownOrganizationReturned: finalOwnCount > beforeOwnCount,
    otherOrganizationAbsent: beforeOtherCount === 0 && finalOtherCount === 0,
  };
}

async function main() {
  const baseUrl = option("--base-url", "https://csi-org.com/loopos").replace(/\/+$/, "");
  const suffix = option("--suffix", String(Date.now()));
  const browser = await chromium.launch({ headless: true });
  const tenants = [];

  try {
    tenants.push(await registerTenant(browser, baseUrl, suffix, "a"));
    tenants.push(await registerTenant(browser, baseUrl, suffix, "b"));

    const results = [];
    for (let index = 0; index < tenants.length; index += 1) {
      const tenant = tenants[index];
      const other = tenants[1 - index];
      const evidence = await askOrganization(tenant, other.orgName, baseUrl);
      results.push({
        label: tenant.label,
        email: tenant.email,
        orgName: tenant.orgName,
        evidence,
        httpErrors: tenant.httpErrors,
        serverErrors: tenant.serverErrors,
        browserErrors: tenant.browserErrors,
      });
    }

    const ok = results.every((result) =>
      result.evidence.ownOrganizationReturned
      && result.evidence.otherOrganizationAbsent
      && result.httpErrors.length === 0
      && result.serverErrors.length === 0
      && result.browserErrors.length === 0);
    console.log(JSON.stringify({ ok, baseUrl, suffix, tenants: results }, null, 2));
    if (!ok) process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({
      ok: false,
      baseUrl,
      suffix,
      tenants: tenants.map(({ label, email, orgName, httpErrors, serverErrors, browserErrors }) => ({
        label,
        email,
        orgName,
        httpErrors,
        serverErrors,
        browserErrors,
      })),
      error: error instanceof Error ? error.message : String(error),
    }, null, 2));
    process.exitCode = 1;
  } finally {
    await Promise.all(tenants.map((tenant) => tenant.context.close().catch(() => undefined)));
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
