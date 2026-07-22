/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright");
const { Pool } = require("pg");
const { writeFileSync, mkdirSync } = require("node:fs");

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3210";
const database = process.env.E2E_DATABASE ?? "loopos_rtw1_s4_main_1783950102";
const evidenceDir = process.env.E2E_EVIDENCE_DIR ?? "/tmp/loopos-rtw1-s4-evidence";
const password = "Slice4-pass-123";
const suffix = Date.now();
const accounts = {
  admin: { email: `s4-admin-${suffix}@loopos.test`, name: "S4 管理员" },
  proposer: { email: `s4-proposer-${suffix}@loopos.test`, name: "S4 提出者" },
  owner: { email: `s4-owner-${suffix}@loopos.test`, name: "S4 承担者" },
};
const ledger = { failedRequests: [], badResponses: [], consoleErrors: [], pageErrors: [] };

mkdirSync(evidenceDir, { recursive: true });

function observe(page, name) {
  page.on("requestfailed", (request) => {
    const error = request.failure()?.errorText;
    if (error !== "net::ERR_ABORTED") ledger.failedRequests.push({ page: name, url: request.url(), error });
  });
  page.on("response", (response) => {
    if (response.status() >= 400) ledger.badResponses.push({ page: name, status: response.status(), url: response.url() });
  });
  page.on("console", (message) => {
    if (message.type() === "error") ledger.consoleErrors.push({ page: name, text: message.text() });
  });
  page.on("pageerror", (error) => ledger.pageErrors.push({ page: name, text: error.message }));
}

async function invite(adminPage, invitee) {
  await adminPage.goto(`${baseUrl}/app/people`);
  await adminPage.getByLabel("邀请邮箱").fill(invitee.email);
  await adminPage.getByRole("button", { name: "生成邀请" }).click();
  const linkText = await adminPage.getByText(/邀请链接：/).textContent();
  const match = linkText?.match(/\/invite\/[A-Za-z0-9_-]+/);
  if (!match) throw new Error(`Invitation link missing for ${invitee.email}: ${linkText}`);
  return match[0];
}

async function acceptInvite(page, path, invitee) {
  await page.goto(`${baseUrl}${path}`);
  await page.getByLabel("姓名").fill(invitee.name);
  await page.getByLabel("设置密码").fill(password);
  await Promise.all([
    page.waitForURL(`${baseUrl}/app`, { timeout: 30000 }),
    page.getByRole("button", { name: "接受邀请" }).click(),
  ]);
}

async function createTension(page, { title, description, handlingMode }) {
  await page.goto(`${baseUrl}/app/tensions/new`);
  await page.getByLabel("标题").fill(title);
  await page.getByLabel("详细描述").fill(description);
  await page.locator(`input[name="handlingMode"][value="${handlingMode}"]`).check();
  await page.locator('input[name="type"][value="PROBLEMATIC"]').check();
  await Promise.all([
    page.waitForURL((url) => /^\/app\/tensions\/[^/]+$/.test(url.pathname) && url.pathname !== "/app/tensions/new", { timeout: 30000 }),
    page.getByRole("button", { name: "提交张力" }).click(),
  ]);
  return page.url().split("/").pop();
}

async function createMeeting(adminPage, { title, type, participantNames }) {
  await adminPage.goto(`${baseUrl}/app/meetings/new`);
  await adminPage.getByLabel("会议主题").fill(title);
  if (type === "GOVERNANCE") {
    await adminPage.getByRole("combobox").first().click();
    await adminPage.getByRole("option", { name: /治理会/ }).click();
  }
  for (const name of participantNames) {
    await adminPage.locator("label", { hasText: name }).locator('input[type="checkbox"]').check();
  }
  await Promise.all([
    adminPage.waitForURL((url) => /^\/app\/meetings\/[^/]+$/.test(url.pathname) && url.pathname !== "/app/meetings/new", { timeout: 30000 }),
    adminPage.getByRole("button", { name: "发起会议" }).click(),
  ]);
  return { id: adminPage.url().split("/").pop(), url: adminPage.url() };
}

async function pgRows(text, params = []) {
  const pool = new Pool({ host: "/tmp", database, user: process.env.USER });
  try {
    return (await pool.query(text, params)).rows;
  } finally {
    await pool.end();
  }
}

async function requireOne(locator, description) {
  const count = await locator.count();
  if (count !== 1) throw new Error(`${description} must exist exactly once, got ${count}`);
  return locator;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const proposerContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const ownerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const admin = await adminContext.newPage();
  const proposer = await proposerContext.newPage();
  const owner = await ownerContext.newPage();
  observe(admin, "admin"); observe(proposer, "proposer"); observe(owner, "owner-mobile");

  try {
    await admin.goto(`${baseUrl}/register`);
    await admin.getByLabel("组织名称").fill(`S4 真实团队 ${suffix}`);
    await admin.getByLabel("你的姓名").fill(accounts.admin.name);
    await admin.getByLabel("邮箱").fill(accounts.admin.email);
    await admin.getByLabel("密码").fill(password);
    await Promise.all([
      admin.waitForURL(`${baseUrl}/app`, { timeout: 30000 }),
      admin.getByRole("button", { name: "创建组织" }).click(),
    ]);
    await admin.getByText("本周下一步").waitFor();
    await admin.screenshot({ path: `${evidenceDir}/01-admin-dashboard.png`, fullPage: true });

    const proposerInvite = await invite(admin, accounts.proposer);
    await acceptInvite(proposer, proposerInvite, accounts.proposer);
    const ownerInvite = await invite(admin, accounts.owner);
    await acceptInvite(owner, ownerInvite, accounts.owner);

    const tacticalTitle = `S4 Action 张力 ${suffix}`;
    const tacticalTensionId = await createTension(proposer, {
      title: tacticalTitle,
      description: "当前模型评测缺少本周复核结果，需要一个可验收的单次行动。",
      handlingMode: "TACTICAL",
    });

    const tacticalMeeting = await createMeeting(admin, {
      title: `S4 战术会 ${suffix}`,
      type: "TACTICAL",
      participantNames: [accounts.proposer.name, accounts.owner.name],
    });

    await proposer.goto(tacticalMeeting.url);
    await proposer.locator('[aria-label="提案类型"] button').filter({ hasText: "Action" }).click();
    await proposer.getByLabel("行动标题").fill(`完成 S4 模型复核 ${suffix}`);
    await proposer.getByLabel("验收标准").fill("复核记录已提交并可由团队查看");
    await proposer.getByLabel("归属回路").selectOption({ label: "主回路" });
    await proposer.getByLabel("负责人").selectOption({ label: accounts.owner.name });
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await proposer.getByLabel("截止日期（可选）").fill(tomorrow);
    await proposer.getByRole("button", { name: "提交会议提案" }).click();
    await proposer.getByText(/Action 提案/).waitFor({ timeout: 15000 });

    await admin.goto(tacticalMeeting.url);
    await admin.getByRole("button", { name: "记录会议通过并创建" }).click();
    await admin.getByText("Action 已创建").waitFor({ timeout: 15000 });

    await owner.goto(`${baseUrl}/app/notifications`);
    await owner.getByText(`已指派行动：完成 S4 模型复核 ${suffix}`).waitFor();
    await owner.screenshot({ path: `${evidenceDir}/02-owner-notifications-mobile.png`, fullPage: true });
    await owner.getByRole("button", { name: new RegExp(`已指派行动：完成 S4 模型复核 ${suffix}`) }).click();
    await owner.waitForURL(/\/app\/tracker\/[^/]+$/);
    const actionId = owner.url().split("/").pop();
    await owner.goto(`${baseUrl}/app`);
    await owner.getByText(`完成 S4 模型复核 ${suffix}`).waitFor();
    const geometry = await owner.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    if (geometry.scrollWidth > geometry.clientWidth) throw new Error(`390px overflow: ${JSON.stringify(geometry)}`);
    await owner.getByRole("button", { name: "☰" }).click();
    const mobileMenu = owner.locator('[data-slot="sheet-content"]');
    await mobileMenu.getByRole("link", { name: /本周回顾/ }).waitFor();
    if (await mobileMenu.getByRole("link", { name: /接口运行/ }).count()) throw new Error("Normal member mobile nav exposes interface runtime");
    if (await mobileMenu.getByRole("link", { name: /初始化/ }).count()) throw new Error("Normal member mobile nav exposes setup");
    await owner.screenshot({ path: `${evidenceDir}/03-owner-dashboard-mobile.png`, fullPage: true });
    await owner.keyboard.press("Escape");

    await owner.goto(`${baseUrl}/app/tracker/${actionId}`);
    const inProgress = owner.getByRole("button", { name: /生长中/ });
    await (await requireOne(inProgress, "Action in-progress status control")).click();
    await owner.getByText("生长中", { exact: true }).waitFor();
    const resolved = owner.getByRole("button", { name: /已成熟/ });
    await (await requireOne(resolved, "Action completed status control")).click();
    await owner.getByText("已成熟", { exact: true }).waitFor();

    const projectTitle = `S4 Project ${suffix}`;
    await createTension(proposer, {
      title: `S4 Project 张力 ${suffix}`,
      description: "需要持续推进模型发布准备，并由明确承担者完成可验收结果。",
      handlingMode: "TACTICAL",
    });
    const projectMeeting = await createMeeting(admin, {
      title: `S4 Project 战术会 ${suffix}`,
      type: "TACTICAL",
      participantNames: [accounts.proposer.name, accounts.owner.name],
    });
    await proposer.goto(projectMeeting.url);
    await proposer.locator('[aria-label="提案类型"] button').filter({ hasText: "Project" }).click();
    await proposer.getByLabel("项目名称").fill(projectTitle);
    await proposer.getByLabel("预期结果").fill("模型发布准备项全部完成并可由团队验收");
    await proposer.getByLabel("归属回路").selectOption({ label: "主回路" });
    await proposer.getByLabel("Project owner").selectOption({ label: accounts.owner.name });
    await proposer.getByRole("button", { name: "提交会议提案" }).click();
    await proposer.getByText(/Project 提案/).waitFor({ timeout: 15000 });

    await admin.goto(projectMeeting.url);
    await admin.getByRole("button", { name: "记录会议通过并创建" }).click();
    await admin.getByText("Project 已创建").waitFor({ timeout: 15000 });

    await owner.goto(`${baseUrl}/app/notifications`);
    const projectNotification = owner.getByRole("button", { name: new RegExp(`已指派项目：${projectTitle}`) });
    await (await requireOne(projectNotification, "Project owner assignment notification")).click();
    await owner.waitForURL(/\/app\/projects\/[^/]+$/);
    const projectId = owner.url().split("/").pop();
    const pause = owner.getByRole("button", { name: "暂停", exact: true });
    await (await requireOne(pause, "Project pause status control")).click();
    await owner.getByText("已暂停", { exact: true }).waitFor();
    const resume = owner.getByRole("button", { name: "恢复", exact: true });
    await resume.waitFor();
    await (await requireOne(resume, "Project resume status control")).click();
    await owner.getByText("进行中", { exact: true }).waitFor();
    const complete = owner.getByRole("button", { name: "完成", exact: true });
    await complete.waitFor();
    await (await requireOne(complete, "Project complete status control")).click();
    await owner.getByText("已完成", { exact: true }).waitFor();

    const governanceTitle = `S4 治理张力 ${suffix}`;
    const governanceTensionId = await createTension(proposer, {
      title: governanceTitle,
      description: "当前缺少一个持续维护模型风险台账的角色，需要通过治理流程修改组织结构。",
      handlingMode: "GOVERNANCE",
    });
    const governanceMeeting = await createMeeting(admin, {
      title: `S4 治理会 ${suffix}`,
      type: "GOVERNANCE",
      participantNames: [accounts.proposer.name, accounts.owner.name],
    });

    await proposer.goto(governanceMeeting.url);
    const revisionForm = proposer.locator("form", { hasText: "初始化治理提案" });
    await revisionForm.locator('[name="currentStructure"]').fill("主回路尚无模型风险守护角色");
    await revisionForm.locator('[name="proposedStructure"]').fill("在主回路创建模型风险守护角色");
    await revisionForm.locator('[name="rationale"]').fill("让风险台账有持续明确的角色责任");
    await revisionForm.locator('[name="expectedImpact"]').fill("模型风险能够每周被更新和追溯");
    await revisionForm.locator('[name="roleName"]').fill(`模型风险守护 ${suffix}`);
    await revisionForm.locator('[name="purpose"]').fill("持续保持模型风险透明");
    await revisionForm.locator('[name="accountabilities"]').fill("每周维护风险台账并暴露新的治理张力");
    await revisionForm.getByRole("button", { name: "初始化治理提案" }).click();
    await proposer.getByText("READY", { exact: true }).waitFor({ timeout: 15000 });

    const adoptForm = proposer.locator("form", { hasText: "采纳并创建角色" });
    await adoptForm.locator('textarea[name="note"]').fill("治理会流程完成，采纳该角色提案");
    await adoptForm.getByRole("button", { name: "采纳并创建角色" }).click();
    await proposer.getByText("ADOPTED", { exact: true }).waitFor({ timeout: 15000 });
    await proposer.screenshot({ path: `${evidenceDir}/04-governance-adopted.png`, fullPage: true });

    await admin.goto(tacticalMeeting.url);
    await admin.locator('textarea[name="notes"]').fill("本周战术会完成 Action 分配，并确认负责人和验收标准。下一步由承担者闭环。");
    await admin.getByRole("button", { name: "保存纪要" }).click();
    await admin.waitForTimeout(500);
    await admin.getByRole("button", { name: "生成报告草稿" }).click();
    await admin.getByRole("button", { name: "确认保存报告" }).waitFor({ timeout: 90000 });
    await admin.screenshot({ path: `${evidenceDir}/05-meeting-ai-draft.png`, fullPage: true });
    const meetingDraftWrites = await pgRows('select count(*)::int as count from meetings where id=$1 and "aiGuardReport" is not null', [tacticalMeeting.id]);
    if (meetingDraftWrites[0].count !== 0) throw new Error(`Meeting AI draft persisted before confirmation: ${JSON.stringify(meetingDraftWrites)}`);
    await admin.getByRole("button", { name: "确认保存报告" }).click();
    await admin.getByText("会议守护者报告（AI 会后分析）").waitFor({ timeout: 15000 });

    await admin.goto(`${baseUrl}/app/review`);
    await admin.getByRole("button", { name: "生成本周回顾草稿" }).click();
    await admin.getByRole("button", { name: "确认并保存" }).waitFor({ timeout: 90000 });
    await admin.screenshot({ path: `${evidenceDir}/06-weekly-review-draft.png`, fullPage: true });
    const weeklyDraftWrites = await pgRows('select count(*)::int as count from governance_logs gl join people p on p."organizationId"=gl."organizationId" where p.email=$1 and gl.period like \'%-W%\'', [accounts.admin.email]);
    if (weeklyDraftWrites[0].count !== 0) throw new Error(`Weekly review draft persisted before confirmation: ${JSON.stringify(weeklyDraftWrites)}`);
    await admin.getByRole("button", { name: "确认并保存" }).click();
    await admin.getByText(/已由 .+ 确认/).waitFor({ timeout: 15000 });
    await admin.screenshot({ path: `${evidenceDir}/07-weekly-review-confirmed.png`, fullPage: true });

    const pool = new Pool({ host: "/tmp", database, user: process.env.USER });
    const db = {};
    db.people = (await pool.query('select email, id from people where email = any($1) order by email', [[accounts.admin.email, accounts.proposer.email, accounts.owner.email]])).rows;
    db.notifications = (await pool.query('select type, "recipientId", "targetUrl", count(*)::int as count from notifications where "organizationId" = (select "organizationId" from people where email=$1) group by type, "recipientId", "targetUrl" order by type, "recipientId"', [accounts.admin.email])).rows;
    db.action = (await pool.query('select t.id, t.status, t."ownerId", t."resolvedAt", p.status as proposal_status, p.kind, p."recordedById" as resolution_actor_id from tensions t join tactical_outcome_proposals p on p."outcomeActionId"=t.id where t.id=$1', [actionId])).rows;
    db.project = (await pool.query('select pr.id, pr.status, pr."bearerId", pr."completedById", p.status as proposal_status, p.kind, p."recordedById" from projects pr join tactical_outcome_proposals p on p."outcomeProjectId"=pr.id where pr.id=$1', [projectId])).rows;
    db.governance = (await pool.query('select gdp.state, gdp."proposerId", gdp."recordedById", gdp."outcomeRoleId", t.id as tension_id, t.status as tension_status from governance_decision_processes gdp join tensions t on t.id=gdp."sourceTensionId" where t.id=$1', [governanceTensionId])).rows;
    db.meetingReport = (await pool.query('select id, "aiGuardReport" is not null as persisted from meetings where id=$1', [tacticalMeeting.id])).rows;
    db.weeklyReview = (await pool.query('select gl.period, gl.status, gl."publishedAt" is not null as published, gl."confirmedById" from governance_logs gl join people p on p."organizationId"=gl."organizationId" where p.email=$1 and gl.period like \'%-W%\' order by gl."createdAt" desc limit 1', [accounts.admin.email])).rows;
    db.invitationPlaintextMatches = (await pool.query("select count(*)::int as count from organization_invitations where \"tokenHash\" like '%/%' or length(\"tokenHash\") <> 64")).rows;
    await pool.end();

    if (db.people.length !== 3) throw new Error(`Expected 3 people, got ${db.people.length}`);
    const peopleByEmail = Object.fromEntries(db.people.map((person) => [person.email, person.id]));
    const adminId = peopleByEmail[accounts.admin.email];
    const proposerId = peopleByEmail[accounts.proposer.email];
    const ownerId = peopleByEmail[accounts.owner.email];
    if (db.action.length !== 1 || db.action[0].ownerId !== ownerId || db.action[0].status !== "RESOLVED" || !db.action[0].resolvedAt || db.action[0].proposal_status !== "APPROVED" || db.action[0].resolution_actor_id !== adminId) throw new Error(`Action trace invalid: ${JSON.stringify(db.action)}`);
    if (db.project.length !== 1 || db.project[0].bearerId !== ownerId || db.project[0].status !== "COMPLETED" || db.project[0].completedById !== ownerId || db.project[0].proposal_status !== "APPROVED" || db.project[0].recordedById !== adminId) throw new Error(`Project trace invalid: ${JSON.stringify(db.project)}`);
    if (db.governance.length !== 1 || db.governance[0].state !== "ADOPTED" || db.governance[0].proposerId !== db.governance[0].recordedById) throw new Error(`Governance self-adoption trace invalid: ${JSON.stringify(db.governance)}`);
    if (db.meetingReport.length !== 1 || !db.meetingReport[0].persisted) throw new Error(`Meeting report invalid: ${JSON.stringify(db.meetingReport)}`);
    if (db.weeklyReview.length !== 1 || db.weeklyReview[0].status !== "published" || !db.weeklyReview[0].published || db.weeklyReview[0].confirmedById !== adminId) throw new Error(`Weekly review invalid: ${JSON.stringify(db.weeklyReview)}`);
    const actualNotifications = db.notifications
      .filter((row) => row.type === "meeting_participation" || row.type === "outcome_assigned")
      .map((row) => `${row.type}|${row.recipientId}|${row.targetUrl}|${row.count}`)
      .sort();
    const expectedNotifications = [
      `meeting_participation|${proposerId}|/app/meetings/${tacticalMeeting.id}|1`,
      `meeting_participation|${ownerId}|/app/meetings/${tacticalMeeting.id}|1`,
      `meeting_participation|${proposerId}|/app/meetings/${projectMeeting.id}|1`,
      `meeting_participation|${ownerId}|/app/meetings/${projectMeeting.id}|1`,
      `meeting_participation|${proposerId}|/app/meetings/${governanceMeeting.id}|1`,
      `meeting_participation|${ownerId}|/app/meetings/${governanceMeeting.id}|1`,
      `outcome_assigned|${ownerId}|/app/tracker/${actionId}|1`,
      `outcome_assigned|${ownerId}|/app/projects/${projectId}|1`,
    ].sort();
    if (JSON.stringify(actualNotifications) !== JSON.stringify(expectedNotifications)) throw new Error(`Notification trace invalid: ${JSON.stringify({ actualNotifications, expectedNotifications })}`);
    if (db.invitationPlaintextMatches[0].count !== 0) throw new Error("Invitation plaintext persistence check failed");
    if (Object.values(ledger).some((items) => items.length > 0)) throw new Error(`Browser ledger is not clean: ${JSON.stringify(ledger)}`);

    const evidence = { baseUrl, database, accounts, ids: { tacticalTensionId, actionId, projectId, governanceTensionId, tacticalMeetingId: tacticalMeeting.id, projectMeetingId: projectMeeting.id, governanceMeetingId: governanceMeeting.id }, geometry, ledger, db };
    writeFileSync(`${evidenceDir}/evidence.json`, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
  } catch (error) {
    for (const [name, page] of [["admin", admin], ["proposer", proposer], ["owner", owner]]) {
      try {
        await page.screenshot({ path: `${evidenceDir}/failure-${name}.png`, fullPage: true });
        writeFileSync(`${evidenceDir}/failure-${name}.txt`, `${page.url()}\n\n${await page.locator("body").innerText()}`);
      } catch {}
    }
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
