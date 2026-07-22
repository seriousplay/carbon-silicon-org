require("dotenv").config();
const { chromium } = require("playwright");
const { Client } = require("pg");

const baseUrl = (process.env.E2E_BASE_URL || "http://localhost:3013").replace(/\/$/, "");
const suffix = String(Date.now());
const template = process.env.M8_TEMPLATE || "functional-team";
const templateLabel = template === "professional-services" ? "专业服务 / 项目型组织" : "传统职能型组织";
const organizationName = `M8 Brain 角色验收 ${suffix}`;
const email = `m8-brain-role-${suffix}@example.invalid`;

function check(condition, message) { if (!condition) throw new Error(message); }

async function cleanup() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try { await client.query(`DELETE FROM organizations WHERE name = $1`, [organizationName]); }
  finally { await client.end(); }
}

async function evidence(roleName) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(`SELECT a.status, (SELECT count(*) FROM "_PersonRoles" pr WHERE pr."B" = a."roleId") AS assignees FROM role_assignment_applications a JOIN role_defs r ON r.id = a."roleId" WHERE a."organizationId" = (SELECT id FROM organizations WHERE name = $1) AND r.name = $2 ORDER BY a."createdAt" DESC LIMIT 1`, [organizationName, roleName]);
    return result.rows[0] ?? null;
  } finally { await client.end(); }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("webpack-hmr")) errors.push(message.text()); });
  try {
    await page.goto(`${baseUrl}/register`, { waitUntil: "networkidle" });
    await page.getByLabel("组织名称").fill(organizationName);
    await page.getByLabel("你的姓名").fill("M8 Brain 角色验收账号");
    await page.getByLabel("邮箱").fill(email);
    await page.getByLabel("密码").fill("M8-Brain-Role-123!Aa");
    await Promise.all([page.waitForURL(`${baseUrl}/app`), page.getByRole("button", { name: "创建组织" }).click()]);
    await page.goto(`${baseUrl}/app/setup`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: `用「${templateLabel}」初始化` }).click();
    await page.waitForURL(`${baseUrl}/app/circles/map`, { timeout: 30_000 });
    await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "新建组织大脑对话" }).first().click();
    const question = page.locator('textarea[placeholder*="询问角色"]').last();
    await question.fill("我想申请一个当前空缺的角色，请告诉我下一步。");
    await page.getByRole("button", { name: "发送问题" }).last().click();
    await page.waitForTimeout(2_000);
    await page.reload({ waitUntil: "networkidle" });
    const composer = page.locator('[aria-labelledby="brain-role-application-heading"]');
    await composer.waitFor({ state: "visible", timeout: 30_000 });
    const roleSelect = composer.getByLabel("选择空缺角色");
    const roleLabel = await roleSelect.locator("option").nth(1).innerText();
    const roleName = roleLabel.split(" · ")[0];
    await roleSelect.selectOption({ index: 1 });
    await composer.getByLabel("申请动机").fill("希望承担该角色并改善组织交付。");
    await composer.getByLabel("相关能力").fill("具备相关经验，能够持续投入并公开进展。");
    await composer.getByLabel("投入承诺").fill("每周在战术会报告事实和阻塞。");
    await composer.getByRole("button", { name: "生成申请预览" }).click();
    try {
      await page.getByText("角色申请已生成待确认预览。").waitFor({ state: "visible", timeout: 30_000 });
    } catch (error) {
      throw new Error(`role preview failed: ${(await composer.innerText()).slice(-1800)} | ${error.message}`);
    }
    await page.getByRole("button", { name: "确认执行" }).last().click();
    await page.getByText("命令已确认执行").waitFor({ state: "visible", timeout: 30_000 });
    const row = await evidence(roleName);
    check(row?.status === "PENDING" && Number(row.assignees) === 0, `role application evidence invalid: ${JSON.stringify(row)}`);
    check(errors.length === 0, `browser errors: ${errors.join(" | ")}`);
    console.log(JSON.stringify({ ok: true, brainRoleApplicationPreview: true, previewConfirmed: true, governanceStillRequired: true, role: roleName, database: row }));
  } finally {
    await browser.close();
    await cleanup().catch(() => undefined);
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
