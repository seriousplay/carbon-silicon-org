const { chromium } = require("playwright");
const baseUrl = process.env.E2E_BASE_URL || "http://localhost:3013";
const meetingId = "cmrcuvpep0000j3s6csnx2q17";
const proposalId = "cmrqdq5r50009q7ial7uhg2px";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel("邮箱").fill("test@loopos.dev");
  await page.getByLabel("密码").fill("testpass123");
  await Promise.all([page.waitForURL(`${baseUrl}/app`), page.getByRole("button", { name: "登录" }).click()]);
  await page.goto(`${baseUrl}/app/meetings/${meetingId}?proposal=${proposalId}`);
  const bodyBefore = await page.locator("body").innerText();
  if (bodyBefore.includes("初始化治理提案")) {
    await page.getByRole("button", { name: "初始化治理提案" }).click();
    await page.waitForTimeout(1200);
  }
  await page.reload();
  const body = await page.locator("body").innerText();
  if (body.includes("采纳：确认任职")) {
    const adoptionForm = page.locator("form").filter({ has: page.getByRole("button", { name: "采纳：确认任职" }) });
    await adoptionForm.getByLabel("会议记录").fill("会议流程审核通过，确认申请人承担该角色。");
    await page.getByRole("button", { name: "采纳：确认任职" }).click();
    await page.waitForTimeout(1500);
  }
  console.log(JSON.stringify({ url: page.url(), adoptedVisible: (await page.locator("body").innerText()).includes("采纳：确认任职"), excerpt: (await page.locator("body").innerText()).slice(-1200) }));
  await browser.close();
})().catch((error) => { console.error(error); process.exitCode = 1; });
