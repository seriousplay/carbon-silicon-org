import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:3012/loop-designer";
const eventCode = process.env.LOOP_EVENT_ACCESS_CODE || "624624";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1360, height: 960 } });
  const unique = Date.now().toString().slice(-8);

  await page.goto(`${baseUrl}/auth/login?next=${encodeURIComponent("/loop-designer")}`, { waitUntil: "networkidle" });
  await page.locator('input[name="accessCode"]').fill(eventCode);
  await page.locator('input[name="phone"]').fill(`137${unique}`);
  await page.locator('input[name="displayName"]').fill("E2E 无模型用户");
  await page.locator('input[name="companyName"]').fill("E2E 无模型企业");
  await page.getByRole("button", { name: "进入设计工作室" }).click();
  await page.waitForURL(/\/loop-designer\/?$/, { timeout: 15000 });

  const createResult = await page.evaluate(async (url) => {
    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workflow: "loop_design" }),
    });
    return { ok: response.ok, text: await response.text() };
  }, `${baseUrl}/api/sessions`);
  assert.equal(createResult.ok, true, createResult.text);
  const { id: sessionId } = JSON.parse(createResult.text);

  const answers = [
    "从客户提出定制需求，到方案确认、交付验收并完成回款。",
    "按五阶段拆解价值流：感知客户需求；理解业务约束；决策承诺；执行交付；反馈复盘。",
    "决策环节最痛，销售、产品和交付之间等待时间长，异常无人统一接管。",
    "人负责承诺和异常，智能体负责需求理解和风险提示，系统负责事实记录。",
    "60 天内让常规需求自动分级，高风险承诺人工审批，闭环从 5 天缩短到 48 小时。",
  ];
  for (const answer of answers) {
    const answerResult = await page.evaluate(async ({ url, value }) => {
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answer: value }),
      });
      return { ok: response.ok, status: response.status, text: await response.text() };
    }, { url: `${baseUrl}/api/sessions/${sessionId}/answer`, value: answer });
    assert.equal(answerResult.ok, true, answerResult.text);
  }

  await page.goto(`${baseUrl}/sessions/${sessionId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "生成完整回路方案" }).click();
  await page.getByText("本地演示模式", { exact: false }).waitFor({ state: "visible", timeout: 15000 });
  await page.getByText("对齐与成熟度诊断", { exact: false }).waitFor({ state: "visible", timeout: 15000 });
  await page.screenshot({ path: "/tmp/loop-designer-no-model-fallback.png", fullPage: true });
  await browser.close();
  console.log(JSON.stringify({ ok: true, sessionId, screenshot: "/tmp/loop-designer-no-model-fallback.png" }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
