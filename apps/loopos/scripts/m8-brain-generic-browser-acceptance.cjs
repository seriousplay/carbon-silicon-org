require("dotenv").config();
const { chromium } = require("playwright");

const baseUrl = process.env.E2E_BASE_URL || "http://localhost:3013";
const account = { email: `m8-brain-${Date.now()}@example.invalid`, password: "M8-Brain-123!Aa" };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("webpack-hmr")) errors.push(message.text()); });

  await page.goto(`${baseUrl}/register`);
  await page.getByLabel("组织名称").fill(`M8 Brain 验收 ${Date.now()}`);
  await page.getByLabel("你的姓名").fill("M8 Brain 验收账号");
  await page.getByLabel("邮箱").fill(account.email);
  await page.getByLabel("密码").fill(account.password);
  await Promise.all([page.waitForURL(`${baseUrl}/app`), page.getByRole("button", { name: "创建组织" }).click()]);

  await page.goto(`${baseUrl}/app/setup`);
  await page.getByRole("button", { name: "用「传统职能型组织」初始化" }).click();
  await page.waitForURL(`${baseUrl}/app/circles/map`, { timeout: 30_000 });
  await page.goto(`${baseUrl}/app`);
  const question = page.locator('textarea[placeholder*="询问角色"]');
  await question.fill("目前组织有哪些重要的角色？");
  await page.getByRole("button", { name: "发送问题" }).click();
  await page.waitForFunction(() => document.querySelectorAll("[data-brain-status]").length > 0, null, { timeout: 30_000 });
  const roleStatus = await page.locator('[data-brain-status]').last().getAttribute("data-brain-status");
  const roleAnswer = await page.locator("#brain-workspace").innerText();
  if (!["ANSWERED", "EVIDENCE_ONLY"].includes(roleStatus) || !roleAnswer.includes("角色")) throw new Error(`role query did not return evidence: ${roleStatus} ${roleAnswer.slice(-500)}`);

  const statusCountBeforeUnsupported = await page.locator('[data-brain-status]').count();
  await question.fill("请告诉我 BioCoach 中有哪些客户？");
  await page.getByRole("button", { name: "发送问题" }).click();
  await page.waitForFunction((count) => document.querySelectorAll("[data-brain-status]").length > count, statusCountBeforeUnsupported, { timeout: 30_000 });
  const unsupportedStatus = await page.locator('[data-brain-status]').last().getAttribute("data-brain-status");
  if (!["INSUFFICIENT_EVIDENCE", "UNAVAILABLE"].includes(unsupportedStatus)) throw new Error(`unsupported query was not bounded: ${unsupportedStatus}`);
  if (errors.length) throw new Error(`browser errors: ${errors.join(" | ")}`);
  console.log(JSON.stringify({ ok: true, roleQuery: roleStatus, unsupportedQuery: unsupportedStatus }));
  await browser.close();
})().catch((error) => { console.error(error); process.exitCode = 1; });
