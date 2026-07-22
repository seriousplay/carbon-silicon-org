const { chromium } = require("playwright");
const baseUrl = process.env.E2E_BASE_URL || "http://localhost:3013";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel("邮箱").fill("test@loopos.dev");
  await page.getByLabel("密码").fill("testpass123");
  await Promise.all([page.waitForURL(`${baseUrl}/app`), page.getByRole("button", { name: "登录" }).click()]);

  await page.goto(`${baseUrl}/app/roles/market`);
  const roleCard = page.locator("article").first();
  const roleName = await roleCard.locator("h2").innerText();
  await roleCard.getByText("申请承担这个角色").click();
  await roleCard.getByLabel("申请动机").fill("希望通过治理流程承担该角色");
  await roleCard.getByLabel("相关能力").fill("具备相关能力并愿意公开进展");
  await roleCard.getByLabel("投入承诺").fill("每周投入并参加治理和战术会议");
  await roleCard.getByRole("button", { name: "提交申请" }).click();
  await page.waitForTimeout(1500);
  await page.goto(`${baseUrl}/app/roles/applications`);
  const application = page.locator("article").filter({ has: page.getByRole("heading", { name: roleName }) });
  await application.getByText("待治理确认").waitFor();
  await application.locator("select[name=meetingId]").selectOption({ index: 1 });
  await application.locator("select[name=tensionId]").selectOption({ index: 1 });
  await application.getByRole("button", { name: "提交治理审核" }).click();
  await page.waitForURL(/\/app\/meetings\/[^?]+\?proposal=/, { timeout: 30_000 });
  if (errors.length) throw new Error(errors.join(" | "));
  console.log(JSON.stringify({ ok: true, roleName, proposalCreated: true, url: page.url() }));
  await browser.close();
})().catch((error) => { console.error(error); process.exitCode = 1; });
