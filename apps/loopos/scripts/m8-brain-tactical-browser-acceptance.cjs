require("dotenv").config();
const { chromium } = require("playwright");
const { Client } = require("pg");

const baseUrl = (process.env.E2E_BASE_URL || "http://localhost:3013").replace(/\/$/, "");
const suffix = String(Date.now());
const template = process.env.M8_TEMPLATE || "functional-team";
const templateLabel = template === "professional-services" ? "专业服务 / 项目型组织" : "传统职能型组织";
const account = { email: `m8-tactical-${suffix}@example.invalid`, password: `M8-Tactical-${suffix}!Aa` };

function check(condition, message) { if (!condition) throw new Error(message); }

async function databaseEvidence(email, title) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT
        (SELECT count(*) FROM tensions t JOIN users u ON u.id = (SELECT "userId" FROM people WHERE id = t."raiserId") WHERE u.email = $1 AND t.title = $2 AND t.status = 'ASSIGNED') AS actions,
        (SELECT count(*) FROM tactical_outcome_proposals p WHERE p.title = $2 AND p.status = 'APPROVED') AS approved_proposals,
        (SELECT count(*) FROM tensions t WHERE t.title = $2 AND t.status = 'ASSIGNED') AS assigned_tensions
    `, [email, title]);
    return result.rows[0];
  } finally { await client.end(); }
}

async function cleanupOrganization(name) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try { await client.query(`DELETE FROM organizations WHERE name = $1`, [name]); }
  finally { await client.end(); }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const organizationName = `M8 战术 Brain 验收 ${suffix}`;
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("webpack-hmr")) errors.push(message.text()); });
  try {
    await page.goto(`${baseUrl}/register`, { waitUntil: "networkidle" });
    await page.getByLabel("组织名称").fill(organizationName);
    await page.getByLabel("你的姓名").fill("M8 战术验收账号");
    await page.getByLabel("邮箱").fill(account.email);
    await page.getByLabel("密码").fill(account.password);
    await Promise.all([page.waitForURL(`${baseUrl}/app`), page.getByRole("button", { name: "创建组织" }).click()]);

    await page.goto(`${baseUrl}/app/setup`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: `用「${templateLabel}」初始化` }).click();
    await page.waitForURL(`${baseUrl}/app/circles/map`, { timeout: 30_000 });

    await page.goto(`${baseUrl}/app/tensions/new`, { waitUntil: "networkidle" });
    const tensionTitle = `客户响应延迟需要行动 ${suffix}`;
    const outcomeTitle = `建立客户响应值班机制 ${suffix}`;
    await page.locator("input[name=title]").fill(tensionTitle);
    await page.locator("textarea[name=description]").fill("客户请求响应不稳定，需要明确一个可执行的改进动作。");
    await page.locator("input[name=handlingMode][value=TACTICAL]").check();
    await page.locator("input[name=type][value=PROBLEMATIC]").check();
    await page.getByRole("button", { name: "提交张力" }).click();
    await page.waitForURL(/\/app\/tensions\/[^/]+$/, { timeout: 30_000 });

    await page.goto(`${baseUrl}/app/meetings/new`, { waitUntil: "networkidle" });
    const meetingTitle = `M8 战术闭环会 ${suffix}`;
    await page.locator("input[name=title]").fill(meetingTitle);
    await page.locator('[data-slot="select-trigger"]').first().click();
    await page.getByRole("option", { name: /战术会/ }).click();
    await page.locator("textarea[name=agenda]").fill("把客户响应张力转成一个可验收的行动。");
    await page.getByRole("button", { name: "发起会议" }).click();
    await page.waitForTimeout(800);
    await page.goto(`${baseUrl}/app/meetings`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: meetingTitle }).last().click();
    await page.waitForURL(/\/app\/meetings\/[^/]+$/, { timeout: 30_000 });
    const meetingUrl = page.url();

    await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "新建组织大脑对话" }).first().click();
    const question = page.locator('textarea[placeholder*="询问角色"]').last();
    await question.fill("请准备客户响应延迟的战术行动。");
    await page.getByRole("button", { name: "发送问题" }).last().click();
    await page.waitForTimeout(2_000);
    await page.reload({ waitUntil: "networkidle" });
    const composer = page.locator('[aria-labelledby="brain-tactical-outcome-heading"]');
    await composer.waitFor({ state: "visible", timeout: 30_000 });
    await composer.getByLabel("选择战术张力").selectOption({ label: tensionTitle });
    await composer.getByLabel("选择战术会议").selectOption({ label: meetingTitle });
    await composer.getByLabel("结果类型").selectOption("ACTION");
    await composer.getByLabel("结果标题").fill(outcomeTitle);
    await composer.getByLabel("预期结果或验收标准").fill("客户请求在一个工作日内得到明确响应。");
    await composer.getByLabel("归属回路").selectOption({ index: 1 });
    await composer.getByLabel("负责人").selectOption({ index: 1 });
    await composer.getByRole("button", { name: "生成战术预览" }).click();
    try {
      await page.getByText("战术结果已生成待确认预览。").waitFor({ state: "visible", timeout: 30_000 });
    } catch (error) {
      throw new Error(`tactical preview failed: ${(await composer.innerText()).slice(-1800)} | page=${(await page.locator("body").innerText()).slice(-2200)} | ${error.message}`);
    }
    await page.getByRole("button", { name: "确认执行" }).last().click();
    try {
      await page.getByText("命令已确认执行").waitFor({ state: "visible", timeout: 30_000 });
    } catch (error) {
      throw new Error(`tactical preview confirmation failed: ${(await page.locator("body").innerText()).slice(-2600)} | ${error.message}`);
    }

    await page.goto(meetingUrl, { waitUntil: "networkidle" });
    await page.getByText(new RegExp(outcomeTitle)).waitFor({ state: "visible", timeout: 30_000 });
    await page.getByRole("button", { name: /记录会议通过并创建/ }).click();
    await page.waitForTimeout(1_500);
    const body = await page.locator("body").innerText();
    check(body.includes("会议结果已记录") && body.includes("Action 已创建"), "tactical meeting did not create Action");
    const db = await databaseEvidence(account.email, outcomeTitle);
    check(Number(db.approved_proposals) === 1 && Number(db.actions) === 1 && Number(db.assigned_tensions) === 1, `unexpected DB evidence ${JSON.stringify(db)}`);
    check(errors.length === 0, `browser errors: ${errors.join(" | ")}`);
    console.log(JSON.stringify({ ok: true, tensionToBrainPreview: true, previewConfirmed: true, tacticalMeetingApproved: true, database: db }));
  } finally {
    await browser.close();
    await cleanupOrganization(organizationName).catch(() => undefined);
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
