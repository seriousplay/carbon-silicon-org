import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:3011/loop-designer";
const eventCode = process.env.LOOP_EVENT_ACCESS_CODE || "624624";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error("E2E requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stages = ["感知", "理解", "决策", "执行", "反馈"];
const plan = {
  title: "E2E 企业 × 客户交付回路",
  executiveSummary: "把跨部门等待改造成可观察、可诊断、可迭代的人机闭环。",
  loopType: "客户交付回路",
  valueFlow: { start: "客户提出需求", end: "验收完成", targetCycleTime: "48 小时" },
  stages: stages.map((name, index) => ({
    name,
    currentState: "人工处理，信息在多个表格和群聊之间流转。",
    aiDesign: index <= 2 ? "AI 提供结构化建议和风险提示。" : "AI 记录执行证据并汇总反馈。",
    humanRole: "回路主理人审核关键承诺并处理异常。",
    aiParticipation: index <= 2 ? 62 : 46,
    hitlTrigger: "高风险承诺、字段缺失或客户异议。",
    successSignal: index === 4 ? "形成复盘记录并进入下一轮规则更新。" : "阶段输出可被下一环节验收。",
  })),
  hitlNodes: [{ node: "最终承诺", owner: "回路主理人", authority: "批准或驳回", trigger: "高风险", tool: "决策看板" }],
  organizationMap: {
    conflicts: ["信息重复传递", "异常责任不清"],
    roleChanges: ["设置回路主理人", "引入需求理解智能体"],
    reportingChanges: [],
    sharedDataLayer: "统一需求对象",
  },
  governance: {
    kpis: [
      { name: "闭环周期", current: "5 天", target: "48 小时", cadence: "每周" },
      { name: "返工率", current: "未知", target: "<10%", cadence: "每周" },
    ],
    arbitrationRules: ["重大承诺由回路主理人裁决"],
    interlocks: ["案例回灌知识库"],
    lifecycleRule: "连续两周不达标则回退人工模式并复盘规则。",
  },
  roadmap: [1, 2, 3, 4].map((week) => ({
    week,
    theme: `第${week}周`,
    actions: ["完成试运行", "记录异常和证据"],
    milestone: "形成运行记录",
    checkpoint: week === 4 ? "周复盘" : "周检查",
  })),
  assumptions: ["数据可接入"],
  risks: ["数据质量不足"],
  validationQuestions: ["谁对异常负责？"],
};
const previousPlan = {
  ...plan,
  title: "E2E 企业 × 客户交付回路 v0",
  governance: {
    ...plan.governance,
    interlocks: [],
    lifecycleRule: "试点期间人工兜底，复盘机制待补充。",
  },
  roadmap: plan.roadmap.map((week) => ({ ...week, checkpoint: "周检查" })),
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  const unique = Date.now().toString().slice(-8);
  const phone = `139${unique}`;

  await page.goto(`${baseUrl}/auth/login?next=${encodeURIComponent("/loop-designer")}`, { waitUntil: "networkidle" });
  await page.locator('input[name="accessCode"]').fill(eventCode);
  await page.locator('input[name="phone"]').fill(phone);
  await page.locator('input[name="displayName"]').fill("E2E 成熟度用户");
  await page.locator('input[name="companyName"]').fill("E2E 成熟度企业");
  await page.getByRole("button", { name: "进入设计工作室" }).click();
  await page.waitForURL(/\/loop-designer\/?$/, { timeout: 15000 });

  const createResult = await page.evaluate(async (url) => {
    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workflow: "loop_design" }),
    });
    return { ok: response.ok, status: response.status, text: await response.text() };
  }, `${baseUrl}/api/sessions`);
  assert.equal(createResult.ok, true, createResult.text);
  const { id: sessionId } = JSON.parse(createResult.text);
  assert.ok(sessionId);

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("loop_designer_sessions")
    .update({
      status: "submitted",
      context: { currentStep: 5, workflowStage: "loop_design", model: "e2e-fixture" },
      responses: {
        loop: "客户提出需求到验收完成",
        stages: "五阶段均已拆解",
        pain: "跨部门等待和异常无人接管",
        organization: "存在人类角色、智能体和系统接口",
        target: "60 天内缩短到 48 小时",
      },
      outputs: {
        messages: [],
        currentPlan: plan,
        versions: [
          { id: randomUUID(), createdAt: now, focus: "e2e-previous", plan: previousPlan },
          { id: randomUUID(), createdAt: now, focus: "e2e-current", plan },
        ],
        refinementCount: 1,
      },
      submitted_at: now,
    })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);

  await page.goto(`${baseUrl}/sessions/${sessionId}`, { waitUntil: "networkidle" });
  await expectText(page, "对齐与成熟度诊断");
  await expectText(page, "算法评估");
  await expectText(page, "推荐优先行动");
  await expectText(page, "三重对齐");
  await expectText(page, "30 天后重新评估成熟度");
  await expectText(page, "本次成熟度变化");

  await page.getByRole("button", { name: /五维成熟度、亮点与升级建议/ }).click();
  await expectText(page, "五维成熟度");
  await page.getByRole("button", { name: /证据链与推导来源/ }).click();
  await expectText(page, "来源：");
  await expectText(page, "置信度：");

  await page.getByRole("button", { name: /应用到定向优化/ }).click();
  await expectText(page, "生成后请重新评估成熟度");

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(`${baseUrl}/auth/login?next=${encodeURIComponent(`/loop-designer/sessions/${sessionId}`)}`, { waitUntil: "networkidle" });
  await mobile.locator('input[name="accessCode"]').fill(eventCode);
  await mobile.locator('input[name="phone"]').fill(phone);
  await mobile.getByRole("button", { name: "进入设计工作室" }).click();
  await mobile.waitForURL(new RegExp(`/loop-designer/sessions/${sessionId}`), { timeout: 15000 });
  await expectText(mobile, "对齐与成熟度诊断");
  const noHorizontalOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  assert.equal(noHorizontalOverflow, true, "mobile viewport has horizontal overflow");

  await page.screenshot({ path: "/tmp/loop-designer-maturity-e2e-desktop.png", fullPage: true });
  await mobile.screenshot({ path: "/tmp/loop-designer-maturity-e2e-mobile.png", fullPage: true });

  await browser.close();
  console.log(JSON.stringify({ ok: true, sessionId, desktopScreenshot: "/tmp/loop-designer-maturity-e2e-desktop.png", mobileScreenshot: "/tmp/loop-designer-maturity-e2e-mobile.png" }));
}

async function expectText(page, text) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout: 15000 });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
