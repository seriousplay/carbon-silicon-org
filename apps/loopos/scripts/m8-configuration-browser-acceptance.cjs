require("dotenv").config();
const { chromium } = require("playwright");
const { Client } = require("pg");
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");

const baseUrl = process.env.E2E_BASE_URL || "http://localhost:3013";
const account = {
  email: process.env.E2E_EMAIL || (process.env.M8_REGISTER === "1" ? `m8-config-${Date.now()}@example.invalid` : "test@loopos.dev"),
  password: process.env.E2E_PASSWORD || "testpass123",
};
const expectUninitialized = process.env.M8_EXPECT_UNINITIALIZED === "1";

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function createSecondMember(firstEmail) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const email = `m8-reviewer-${Date.now()}@example.invalid`;
  const password = `M8-Reviewer-${Date.now()}!Aa`;
  const userId = `m8-reviewer-user-${crypto.randomUUID()}`;
  const personId = `m8-reviewer-person-${crypto.randomUUID()}`;
  try {
    const base = await client.query(`SELECT o.id AS organization_id, p."homeCircleId" AS home_circle_id FROM users u JOIN people p ON p."userId"=u.id JOIN organizations o ON o.id=p."organizationId" WHERE u.email=$1`, [firstEmail]);
    const row = base.rows[0];
    if (!row) throw new Error("cannot create second member without organization");
    await client.query("BEGIN");
    await client.query(`INSERT INTO users (id,email,name,"passwordHash","createdAt","updatedAt") VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, [userId, email, "M8 治理审核人", await bcrypt.hash(password, 10)]);
    await client.query(`INSERT INTO memberships (id,"userId","organizationId",role,"createdAt") VALUES ($1,$2,$3,'ORG_MEMBER',CURRENT_TIMESTAMP)`, [`m8-reviewer-membership-${crypto.randomUUID()}`, userId, row.organization_id]);
    await client.query(`INSERT INTO people (id,"organizationId","userId",name,email,"homeCircleId","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)`, [personId, row.organization_id, userId, "M8 治理审核人", email, row.home_circle_id]);
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

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  let adoptedRoleId = null;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.method() === "POST") console.log(`POST ${request.url()} body=${(request.postData() ?? "").slice(0, 500)}`);
  });
  page.on("response", async (response) => {
    if (response.request().method() === "POST") {
      let body = "";
      try { body = (await response.text()).slice(0, 500); } catch {}
      console.log(`POST_RESPONSE ${response.status()} ${response.url()} body=${body}`);
    }
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    const expectedServerActionAbort = request.method() === "POST" && (request.url().endsWith("/app") || request.url().includes("/app/tensions/new") || request.url().includes("/app/meetings/new")) && failure === "net::ERR_ABORTED";
    if (!expectedServerActionAbort) errors.push(`request failed ${request.method()} ${request.url()}: ${failure}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("/_next/webpack-hmr")) errors.push(message.text());
  });

  const authPath = process.env.M8_REGISTER === "1" ? "/register" : "/login";
  await page.goto(`${baseUrl}${authPath}`);
  if (process.env.M8_REGISTER === "1") {
    await page.getByLabel("组织名称").fill(`M8 配置验收 ${Date.now()}`);
    await page.getByLabel("你的姓名").fill("M8 验收账号");
  }
  await page.getByLabel("邮箱").fill(account.email);
  await page.getByLabel("密码").fill(account.password);
  await Promise.all([
    page.waitForURL(`${baseUrl}/app`, { timeout: 30_000 }),
    page.getByRole("button", { name: process.env.M8_REGISTER === "1" ? "创建组织" : "登录" }).click(),
  ]);

  await page.goto(`${baseUrl}/app/setup`);
  await page.getByRole("heading", { name: "组织初始化", exact: true }).waitFor();
  await page.getByLabel("组织名称").waitFor();
  await page.getByLabel("组织类型").waitFor();
  await page.getByLabel("建议会议节奏").waitFor();
  await page.getByLabel("角色分类").waitFor();
  await page.getByRole("heading", { name: "组织语言" }).waitFor();
  await page.getByRole("heading", { name: "治理规则" }).waitFor();

  const templateNames = ["精益团队", "专业服务 / 项目型组织", "传统职能型组织", "大模型团队"];
  const visibleTemplateNames = [];
  for (const name of templateNames) {
    if (await page.getByRole("heading", { name }).count()) visibleTemplateNames.push(name);
  }
  if (expectUninitialized) {
    check(visibleTemplateNames.length === templateNames.length, `missing onboarding templates: ${templateNames.filter((name) => !visibleTemplateNames.includes(name)).join(", ")}`);
  }

  let initializedTemplate = null;
  let roleLifecycle = false;
  let nominationLifecycle = false;
  let secondMember = null;
  if (process.env.M8_INIT_TEMPLATE) {
    const templateLabels = {
      "lean-team": "精益团队",
      "professional-services": "专业服务 / 项目型组织",
      "functional-team": "传统职能型组织",
      "llm-team": "大模型团队",
    };
    const templateName = templateLabels[process.env.M8_INIT_TEMPLATE];
    check(Boolean(templateName), `unsupported template: ${process.env.M8_INIT_TEMPLATE}`);
    const initButton = page.getByRole("button", { name: `用「${templateName}」初始化` });
    await initButton.waitFor({ state: "visible", timeout: 10_000 });
    console.log(`initializing template=${process.env.M8_INIT_TEMPLATE} url=${page.url()}`);
    await initButton.click();
    await page.waitForTimeout(3_000);
    if (!page.url().endsWith("/app/circles/map")) {
      console.log(`initialization did not navigate: url=${page.url()} body=${(await page.locator("body").innerText()).slice(-1200)}`);
    }
    await page.waitForURL(`${baseUrl}/app/circles/map`, { timeout: 30_000 });
    initializedTemplate = process.env.M8_INIT_TEMPLATE;
    const expectedCircleNames = {
      "professional-services": ["项目交付回路", "能力与方法回路"],
      "functional-team": ["运营回路", "持续改进回路"],
      "lean-team": ["主回路"],
      "llm-team": ["战略决策回路", "数据回路"],
    };
    for (const circleName of expectedCircleNames[initializedTemplate] ?? []) {
      check((await page.locator("body").innerText()).includes(circleName), `${initializedTemplate} circle was not initialized: ${circleName}`);
    }

    if (process.env.M8_ROLE_LIFECYCLE === "1") {
      let governanceMeetingCreated = false;
      if (process.env.M8_ROLE_GOVERNANCE === "1") {
        secondMember = await createSecondMember(account.email);
        await page.goto(`${baseUrl}/app/tensions/new`);
        await page.locator("input[name=title]").fill("角色任职治理边界需要明确");
        await page.locator("textarea[name=description]").fill("需要通过治理流程确认空缺角色的承担者。");
        await page.locator("input[name=handlingMode][value=GOVERNANCE]").check();
        await page.locator("input[name=type][value=CLARIFYING]").check();
        await page.getByRole("button", { name: "提交张力" }).click();
        await page.waitForURL(/\/app\/tensions\/[^/]+$/, { timeout: 30_000 });
        await page.goto(`${baseUrl}/app/meetings/new`);
        await page.locator("input[name=title]").fill("角色任职治理会");
        await page.locator('[data-slot="select-trigger"]').first().click();
        await page.getByRole("option", { name: /治理会/ }).click();
        await page.locator("textarea[name=agenda]").fill("审核角色任职申请并形成确认议案。");
        await page.getByRole("button", { name: "发起会议" }).click();
        await page.waitForTimeout(1_000);
        await page.goto(`${baseUrl}/app/meetings`);
        await page.getByRole("link", { name: "角色任职治理会" }).last().click();
        await page.waitForURL(/\/app\/meetings\/[^/]+$/, { timeout: 30_000 });
        await addMeetingParticipant(page.url().match(/\/app\/meetings\/([^/?]+)/)[1], secondMember.personId);
        governanceMeetingCreated = true;
      }
      await page.goto(`${baseUrl}/app/roles/market`);
      await page.getByRole("heading", { name: "发现组织中的空缺角色", exact: true }).waitFor();
      if (process.env.M8_ROLE_NOMINATION === "1") {
        check(Boolean(secondMember), "nomination evidence requires a second member");
        await page.goto(`${baseUrl}/app/roles/applications`);
        const nominationRoleSelect = page.locator('select[name="roleId"]').last();
        const nominationForm = nominationRoleSelect.locator("xpath=ancestor::form");
        console.log(`nomination-form-count=${await nominationForm.count()} role-selects=${await page.locator('select[name="roleId"]').count()} body=${(await page.locator("body").innerText()).slice(-700)}`);
        await nominationForm.locator('select[name="roleId"]').selectOption({ index: 1 });
        const nominationRoleId = await nominationForm.locator('select[name="roleId"]').inputValue();
        await nominationForm.locator('select[name="nomineeId"]').selectOption(secondMember.personId);
        await nominationForm.getByRole("button", { name: "提交提名" }).click();
        await page.waitForTimeout(1_000);
        const nomineePage = await browser.newPage();
        await nomineePage.goto(`${baseUrl}/login`);
        await nomineePage.getByLabel("邮箱").fill(secondMember.email);
        await nomineePage.getByLabel("密码").fill(secondMember.password);
        await Promise.all([nomineePage.waitForURL(`${baseUrl}/app`), nomineePage.getByRole("button", { name: "登录" }).click()]);
        await nomineePage.goto(`${baseUrl}/app/roles/applications`);
        const nominationCard = nomineePage.locator("article").filter({ hasText: "待本人接受提名" }).first();
        await nominationCard.getByRole("button", { name: "接受提名并补充申请" }).click();
        await nomineePage.waitForTimeout(1_000);
        const nominationClient = new Client({ connectionString: process.env.DATABASE_URL });
        await nominationClient.connect();
        const nominationEvidence = await nominationClient.query(`SELECT a.status, (SELECT count(*) FROM "_PersonRoles" rp WHERE rp."B" = a."roleId") AS assignees FROM role_assignment_applications a WHERE a."organizationId" = (SELECT p."organizationId" FROM people p WHERE p.email = $1) AND a."roleId" = $2 AND a."applicantId" = $3 ORDER BY a."createdAt" DESC LIMIT 1`, [account.email, nominationRoleId, secondMember.personId]);
        await nominationClient.end();
        check(nominationEvidence.rows[0]?.status === "PENDING", "accepted nomination did not become PENDING");
        check(Number(nominationEvidence.rows[0]?.assignees ?? 0) === 0, "nomination changed role assignment before governance");
        nominationLifecycle = true;
        await nomineePage.close();
        await page.goto(`${baseUrl}/app/roles/market`);
      }
      const roleCard = process.env.M8_ROLE_NOMINATION === "1"
        ? page.locator("article").filter({ hasText: "申请承担这个角色" }).first()
        : page.locator("article").first();
      if (await roleCard.count() === 0) {
        const marketText = await page.locator("body").innerText();
        check(/暂无|没有|空缺/.test(marketText), "role market has no card but no honest empty state");
        roleLifecycle = true;
      } else {
      const roleName = await roleCard.locator("h2").innerText();
      adoptedRoleId = await roleCard.locator('input[name="roleId"]').inputValue();
      await roleCard.getByText("申请承担这个角色").click();
      await roleCard.getByLabel("申请动机").fill("希望承担该角色并改善项目交付结果");
      await roleCard.getByLabel("相关能力").fill("具备专业服务交付和持续改进能力");
      await roleCard.getByLabel("投入承诺").fill("每周参加战术会并公开进展");
      await roleCard.getByRole("button", { name: "提交申请" }).click();
      await page.waitForTimeout(1_000);
      if (process.env.M8_ROLE_GOVERNANCE === "1") {
        await page.goto(`${baseUrl}/app/roles/applications`);
        const application = page.locator("article").filter({ has: page.getByRole("heading", { name: roleName, exact: true }) }).last();
        await application.getByText("待治理确认").waitFor();
        await application.locator("select[name=meetingId]").selectOption({ index: 1 });
        await application.locator("select[name=tensionId]").selectOption({ index: 1 });
        await application.getByRole("button", { name: "提交治理审核" }).click();
        await page.waitForURL(/\/app\/meetings\/[^?]+\?proposal=/, { timeout: 30_000 });
        const initialize = page.getByRole("button", { name: "初始化治理提案" });
        await initialize.waitFor({ state: "visible", timeout: 30_000 });
        await initialize.click();
        await page.getByText("READY", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
        console.log(`governance-ready adopt-buttons=${await page.getByRole("button", { name: "采纳：确认任职" }).count()} body=${(await page.locator("body").innerText()).slice(-900)}`);
        const reviewerPage = await browser.newPage();
        await reviewerPage.goto(`${baseUrl}/login`);
        await reviewerPage.getByLabel("邮箱").fill(secondMember.email);
        await reviewerPage.getByLabel("密码").fill(secondMember.password);
        await Promise.all([reviewerPage.waitForURL(`${baseUrl}/app`), reviewerPage.getByRole("button", { name: "登录" }).click()]);
        await reviewerPage.goto(page.url());
        await reviewerPage.getByText("READY", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
        const adoptButton = reviewerPage.getByRole("button", { name: "采纳：确认任职" });
        const adoptForm = adoptButton.locator("xpath=ancestor::form");
        await adoptForm.locator('textarea[name="note"]').fill("治理会议审核申请证据后确认由申请人承担该角色。");
        console.log(`adopt-form disabled=${await adoptButton.isDisabled()} valid=${await adoptForm.evaluate((form) => form.checkValidity())}`);
        await adoptButton.click();
        await reviewerPage.waitForTimeout(5_000);
        console.log(`governance-after-adopt url=${reviewerPage.url()} body=${(await reviewerPage.locator("body").innerText()).slice(-1100)}`);
        await reviewerPage.getByText("ADOPTED", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
        if (process.env.M8_ROLE_EXIT === "1") {
          const roleHref = `/app/roles/${adoptedRoleId}`;
          console.log(`exit-start url=${reviewerPage.url()} role-href=${roleHref}`);
          check(Boolean(roleHref), "adopted role link missing");
          await page.goto(`${baseUrl}/app/tensions/new`);
          await page.locator("input[name=title]").fill("改进负责人退出后需要重新安排承担者");
          await page.locator("textarea[name=description]").fill("当前承担者需要退出角色，组织需要通过治理流程确认退出。");
          await page.locator("input[name=handlingMode][value=GOVERNANCE]").check();
          await page.locator("input[name=type][value=CLARIFYING]").check();
          await Promise.all([
            page.waitForURL(/\/app\/tensions\/[^/]+$/, { timeout: 30_000 }),
            page.getByRole("button", { name: "提交张力" }).click(),
          ]);
          const exitTensionUrl = page.url();
          const exitTensionId = page.url().match(/\/app\/tensions\/([^/?]+)/)[1];
          await page.goto(`${baseUrl}${roleHref}`);
          await page.getByRole("heading", { name: "退出任职", exact: true }).waitFor();
          await page.locator("select[name=meetingId]").selectOption({ index: 1 });
          await page.locator("select[name=tensionId]").selectOption({ label: "改进负责人退出后需要重新安排承担者" });
          await page.getByRole("button", { name: "提交退出审核" }).click();
          await page.waitForURL(/\/app\/meetings\/[^?]+\?proposal=/, { timeout: 30_000 });
          await page.getByRole("button", { name: "初始化治理提案" }).click();
          await page.getByText("READY", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
          await reviewerPage.goto(page.url());
          await reviewerPage.getByText("READY", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
          const exitAdoptButton = reviewerPage.getByRole("button", { name: "采纳：确认退出" });
          const exitForm = exitAdoptButton.locator("xpath=ancestor::form");
          await exitForm.locator('textarea[name="note"]').fill("治理会议确认退出并记录角色承接风险。");
          console.log(`exit-adopt count=${await exitAdoptButton.count()} disabled=${await exitAdoptButton.isDisabled()} valid=${await exitForm.evaluate((form) => form.checkValidity())} body=${(await reviewerPage.locator("body").innerText()).slice(-1000)}`);
          await Promise.all([
            reviewerPage.waitForRequest((request) => request.method() === "POST" && request.url().includes("/app/meetings/"), { timeout: 30_000 }),
            exitAdoptButton.click(),
          ]);
          await reviewerPage.getByText("ADOPTED", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
          const evidenceClient = new Client({ connectionString: process.env.DATABASE_URL });
          await evidenceClient.connect();
          let released;
          for (let attempt = 0; attempt < 10; attempt += 1) {
            released = await evidenceClient.query(`SELECT 1 FROM role_assignment_history h JOIN people p ON p.id = h."personId" WHERE h."roleId" = $1 AND h."eventType" = 'RELEASED' AND p.email = $2 LIMIT 1`, [adoptedRoleId, account.email]);
            if (released.rowCount === 1) break;
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
          await evidenceClient.end();
          check(released.rowCount === 1, "role exit did not persist RELEASED assignment history");
          roleLifecycle = Boolean(exitTensionId && exitTensionUrl);
        }
        roleLifecycle = process.env.M8_ROLE_EXIT === "1" ? roleLifecycle : governanceMeetingCreated;
      } else {
        await page.goto(`${baseUrl}/app/roles/market?fresh=${Date.now()}`);
        const submittedCard = page.locator("article").filter({ has: page.getByRole("heading", { name: roleName, exact: true }) });
        await submittedCard.getByText("已提交申请，等待处理").waitFor();
        await submittedCard.getByRole("button", { name: "撤回申请" }).click();
        roleLifecycle = true;
      }
      }
    }
  }

  check(errors.length === 0, `browser errors: ${errors.join(" | ")}`);
  console.log(JSON.stringify({
    ok: true,
    setupProfile: true,
    terminology: true,
    governanceRules: true,
    initialized: visibleTemplateNames.length === 0,
    templateNames: visibleTemplateNames,
    initializedTemplate,
    roleLifecycle,
    nominationLifecycle,
  }));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
