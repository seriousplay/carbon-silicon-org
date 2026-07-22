const { chromium } = require("playwright");

const baseUrl = process.env.E2E_BASE_URL || "http://localhost:3013";
const account = { email: "test@loopos.dev", password: "testpass123" };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

  await page.goto(`${baseUrl}/login`);
  console.log("role-market: login page");
  await page.getByLabel("邮箱").fill(account.email);
  await page.getByLabel("密码").fill(account.password);
  await Promise.all([
    page.waitForURL(`${baseUrl}/app`, { timeout: 30_000 }),
    page.getByRole("button", { name: "登录" }).click(),
  ]);

  await page.goto(`${baseUrl}/app/roles/market`);
  console.log("role-market: market page");
  await page.getByRole("heading", { name: "发现组织中的空缺角色" }).waitFor();
  const roleCard = page.locator("article").first();
  const roleName = await roleCard.locator("h2").innerText();
  await roleCard.getByText("申请承担这个角色").click();
  await roleCard.getByLabel("申请动机").fill("希望承担该角色并改善当前交付结果");
  await roleCard.getByLabel("相关能力").fill("具备相关领域经验和稳定投入能力");
  await roleCard.getByLabel("投入承诺").fill("每周投入并在战术会上公开进展");
  await roleCard.getByRole("button", { name: "提交申请" }).click();
  console.log(`role-market: submitted ${roleName}`);
  await page.waitForTimeout(2_000);
  await page.goto(`${baseUrl}/app/roles/market?fresh=${Date.now()}`);
  const submittedCard = page.locator("article").filter({ has: page.getByRole("heading", { name: roleName }) });
  await submittedCard.getByText("已提交申请，等待处理").waitFor();
  await submittedCard.getByRole("button", { name: "撤回申请" }).click();
  console.log("role-market: withdrawn");
  await page.waitForTimeout(500);

  if (errors.length) throw new Error(`browser errors: ${errors.join(" | ")}`);
  console.log(JSON.stringify({ ok: true, url: page.url(), roleMarket: true, applicationSubmitted: true, applicationWithdrawn: true }));
  await browser.close();
})().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
