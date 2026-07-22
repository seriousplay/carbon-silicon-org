#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const { chromium } = require("playwright");
const fs = require("node:fs");
const { Client } = require("pg");
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");

const baseUrl = (process.env.M63_BASE_URL ?? "https://csi-org.com/loopos").replace(/\/$/, "");

async function createSecondMember(firstEmail) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const email = `m63-reviewer-${Date.now()}@example.invalid`;
  const password = `M63-Reviewer-${Date.now()}!Aa`;
  try {
    const base = await client.query(`SELECT o.id AS organization_id, p."homeCircleId" AS home_circle_id FROM users u JOIN people p ON p."userId"=u.id JOIN organizations o ON o.id=p."organizationId" WHERE u.email=$1`, [firstEmail]);
    if (!base.rows[0]) throw new Error("cannot create reviewer without organization");
    const userId = crypto.randomUUID();
    const personId = crypto.randomUUID();
    await client.query("BEGIN");
    await client.query(`INSERT INTO users (id,email,name,"passwordHash","createdAt","updatedAt") VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, [userId, email, "M6-3 治理审核人", await bcrypt.hash(password, 10)]);
    await client.query(`INSERT INTO memberships (id,"userId","organizationId",role,"createdAt") VALUES ($1,$2,$3,'ORG_MEMBER',CURRENT_TIMESTAMP)`, [crypto.randomUUID(), userId, base.rows[0].organization_id]);
    await client.query(`INSERT INTO people (id,"organizationId","userId",name,email,"homeCircleId","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)`, [personId, base.rows[0].organization_id, userId, "M6-3 治理审核人", email, base.rows[0].home_circle_id]);
    await client.query("COMMIT");
    return { email, password, personId };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { await client.end(); }
}

async function addMeetingParticipant(meetingId, personId) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try { await client.query(`INSERT INTO "_MeetingToPerson" ("A","B") VALUES ($1,$2) ON CONFLICT DO NOTHING`, [meetingId, personId]); }
  finally { await client.end(); }
}

async function main() {
  const suffix = String(Date.now());
  const email = `m63-${suffix}@example.invalid`;
  const password = `M6-3-${suffix}!Aa`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const evidence = { suffix, email, steps: [] };
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/app")) console.log(`request=${request.method()} ${request.url()}`);
  });
  page.on("response", async (response) => {
    if (response.request().method() === "POST" && response.url().includes("/app")) console.log(`response=${response.status()} ${response.url()}`);
  });
  page.on("pageerror", (error) => console.log(`pageerror=${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") console.log(`console-error=${message.text()}`); });
  try {
    await page.goto(`${baseUrl}/register`, { waitUntil: "networkidle" });
    await page.getByLabel("组织名称").fill(`M6-3 Browser ${suffix}`);
    await page.getByLabel("你的姓名").fill("M6-3 Tester");
    await page.getByLabel("邮箱").fill(email);
    await page.getByLabel("密码").fill(password);
    await page.getByRole("button", { name: "创建组织" }).click();
    await page.waitForURL(`${baseUrl}/app`, { timeout: 30_000 });
    evidence.steps.push({ name: "registration-base-path", url: page.url(), ok: page.url().replace(/\/$/, "") === `${baseUrl}/app` });

    await page.goto(`${baseUrl}/app/tensions/new`, { waitUntil: "networkidle" });
    await page.locator("input[name=title]").fill("治理责任边界需要明确");
    await page.locator("textarea[name=description]").fill("当前治理责任边界不清，治理会无法确认谁有权提出结构调整。");
    await page.locator("input[name=handlingMode][value=GOVERNANCE]").check();
    await page.locator("input[name=type][value=CLARIFYING]").check();
    await page.getByRole("button", { name: "提交张力" }).click();
    await page.waitForURL(`${baseUrl}/app/tensions/*`, { timeout: 30_000 });
    evidence.steps.push({ name: "governance-tension", url: page.url(), ok: page.url().includes("/app/tensions/") });

    await page.goto(`${baseUrl}/app/meetings/new`, { waitUntil: "networkidle" });
    console.log(`meeting-page=${page.url()}\n${(await page.locator("body").innerText()).slice(0, 1200)}`);
    await page.locator("input[name=title]").fill("M6-3 治理验证会");
    await page.locator('[data-slot="select-trigger"]').first().click();
    await page.getByRole("option", { name: /治理会/ }).click();
    await page.locator("textarea[name=agenda]").fill("审核治理张力并确认分布式结构提案");
    await page.getByRole("button", { name: "发起会议" }).click();
    await page.waitForTimeout(1_000);
    await page.goto(`${baseUrl}/app/meetings`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "M6-3 治理验证会" }).last().click();
    await page.waitForURL(/\/app\/meetings\/[^/]+$/, { timeout: 30_000 });
    const meetingUrl = page.url();
    const meetingId = meetingUrl.match(/\/app\/meetings\/([^/?]+)/)[1];
    const reviewer = await createSecondMember(email);
    await addMeetingParticipant(meetingId, reviewer.personId);
    evidence.steps.push({ name: "governance-meeting", url: meetingUrl, ok: meetingUrl.includes("/app/meetings/") });

    await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
    const newBrainButtons = page.locator('[data-brain-mode="workspace"] button[aria-label="新建组织大脑对话"]');
    console.log(`new-brain-buttons=${await newBrainButtons.count()} states=${JSON.stringify(await newBrainButtons.evaluateAll((buttons) => buttons.map((button) => ({ disabled: button.hasAttribute("disabled"), visible: !!(button.offsetWidth || button.offsetHeight), html: button.outerHTML.slice(0, 300) }))))}`);
    await newBrainButtons.first().click();
    await page.waitForTimeout(10_000);
    const questionInputs = page.locator('textarea[placeholder*="询问角色"]');
    const question = questionInputs.nth(Math.max(0, await questionInputs.count() - 1));
    await question.fill("请准备治理责任边界的结构调整提案。");
    console.log(`brain-inputs=${await page.getByPlaceholder("询问角色、回路、项目、张力或会议…").count()} value=${await question.inputValue()} buttons=${await page.getByRole("button", { name: "发送问题" }).count()}`);
    await page.getByRole("button", { name: "发送问题" }).last().click();
    await page.waitForTimeout(15_000);
    evidence.steps.push({ name: "brain-question-submitted", activity: await page.locator("body").innerText().then((text) => text.includes("组织大脑正在处理") || text.includes("回答已保存") || text.includes("回答暂时不可用") || text.includes("起草治理提案")) });
    await page.reload({ waitUntil: "networkidle" });
    const composer = page.locator('[aria-labelledby="brain-governance-composer-heading"]');
    await composer.waitFor({ state: "visible", timeout: 30_000 });
    evidence.steps.push({ name: "brain-governance-composer", ok: true });
    await composer.getByLabel("选择张力").selectOption({ index: 1 });
    await composer.getByLabel("选择治理会议").selectOption({ index: 1 });
    await composer.getByLabel("当前结构").fill("当前治理结构未明确组织级责任边界。");
    await composer.getByLabel("提议结构").fill("新增一个承接治理责任边界的生产回路。");
    await composer.getByLabel("提案理由").fill("治理张力提出者基于真实阻塞提出结构调整。");
    await composer.getByLabel("预期影响").fill("可在治理会议审核后执行，失败可通过新张力回归。");
    await composer.getByLabel("结构变更 JSON").fill(JSON.stringify({ schemaVersion: 1, operation: "CIRCLE_CREATED", domain: null, name: `治理验证回路 ${suffix}`, number: "CUSTOM", purpose: "承接治理责任边界", parentId: null, type: "PRODUCTION" }));
    await composer.getByRole("button", { name: "生成治理预览" }).click();
    await page.waitForTimeout(5_000);
    console.log(`composer-after-preview=${(await composer.innerText()).slice(0, 1600)}`);
    await page.getByText("治理提案已生成待确认预览。").waitFor({ state: "visible", timeout: 30_000 });
    evidence.steps.push({ name: "brain-governance-preview", ok: true });
    const confirm = page.getByRole("button", { name: "确认执行" }).last();
    await confirm.click();
    await page.getByText("命令已确认执行").waitFor({ state: "visible", timeout: 30_000 });
    evidence.steps.push({ name: "brain-governance-confirmation", ok: true });
    await page.goto(meetingUrl, { waitUntil: "networkidle" });
    const initialize = page.getByRole("button", { name: "初始化治理提案" });
    console.log(`meeting-after-confirm=${(await page.locator("body").innerText()).slice(-3500)}`);
    await initialize.waitFor({ state: "visible", timeout: 30_000 });
    await initialize.click();
    await page.waitForTimeout(2_000);
    evidence.steps.push({ name: "governance-process-initialized", ok: (await page.locator("body").innerText()).includes("READY") });
    await page.reload({ waitUntil: "networkidle" });
    console.log(`meeting-after-initialize=${(await page.locator("body").innerText()).slice(-2200)}`);
    const reviewerPage = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await reviewerPage.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    await reviewerPage.getByLabel("邮箱").fill(reviewer.email);
    await reviewerPage.getByLabel("密码").fill(reviewer.password);
    await Promise.all([reviewerPage.waitForURL(`${baseUrl}/app`), reviewerPage.getByRole("button", { name: "登录" }).click()]);
    await reviewerPage.goto(meetingUrl, { waitUntil: "networkidle" });
    const adopt = reviewerPage.getByRole("button", { name: /^采纳：/ });
    await adopt.waitFor({ state: "visible", timeout: 30_000 });
    await reviewerPage.locator('textarea[name="note"]').last().fill("治理会议确认该结构调整可安全试行并正式采纳。");
    await adopt.click();
    await reviewerPage.waitForTimeout(2_000);
    evidence.steps.push({ name: "governance-structure-adopted", ok: (await reviewerPage.locator("body").innerText()).includes("ADOPTED") });
    await reviewerPage.close();
    await page.screenshot({ path: `/tmp/m6-3-browser-${suffix}.png`, fullPage: false });
    const result = { ok: evidence.steps.every((step) => step.ok ?? step.activity), evidence };
    if (process.env.M63_EVIDENCE_FILE) fs.writeFileSync(process.env.M63_EVIDENCE_FILE, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
