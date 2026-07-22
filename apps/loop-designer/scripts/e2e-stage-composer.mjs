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
  await page.locator('input[name="phone"]').fill(`138${unique}`);
  await page.locator('input[name="displayName"]').fill("E2E 阶段输入用户");
  await page.locator('input[name="companyName"]').fill("E2E 阶段输入企业");
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

  await page.goto(`${baseUrl}/sessions/${sessionId}`, { waitUntil: "networkidle" });
  await page.locator("textarea").fill("从客户提出定制需求，到方案确认、交付验收并完成回款；现在需求澄清反复、承诺分散、异常无人接管。");
  await page.getByRole("button", { name: "保存回答" }).click();
  await expectText(page, "拆解价值流");
  await expectText(page, "按五阶段分别输入");
  await expectText(page, "人做什么");
  await expectText(page, "智能体做什么");
  await expectText(page, "系统记录什么");

  await page.getByRole("button", { name: "填入示例" }).click();
  await expectText(page, "完成 5/5");
  const save = page.getByRole("button", { name: "保存五阶段拆解" });
  assert.equal(await save.isEnabled(), true);
  await save.click();
  await expectText(page, "哪个环节最痛");

  await page.screenshot({ path: "/tmp/loop-designer-stage-composer.png", fullPage: true });
  await browser.close();
  console.log(JSON.stringify({ ok: true, sessionId, screenshot: "/tmp/loop-designer-stage-composer.png" }));
}

async function expectText(page, text) {
  await page.locator(`text=${text}`).first().waitFor({ state: "visible", timeout: 15000 });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
