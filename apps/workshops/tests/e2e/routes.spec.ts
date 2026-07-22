import { expect, test } from "@playwright/test";

test("home presents the experiment and first note", async ({ page }) => {
  await page.goto("/journal");

  await expect(
    page.getByRole("heading", { name: "我正在学习，如何借助 AI 成为一个人的组织。" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "最新成长手记" })).toBeVisible();
  await expect(
    page.locator("#latest-note").getByRole("link", {
      name: "为什么我要开始记录成为超级个体的过程",
    }),
  ).toBeVisible();
});

test("article and about routes form a reading path", async ({ page }) => {
  await page.goto("/journal/articles/why-i-start");

  await expect(page.getByRole("heading", { name: "为什么我要开始记录成为超级个体的过程" })).toBeVisible();
  await expect(page.getByText("AI 协助我梳理问题")).toBeVisible();

  await page.goto("/journal/about");
  await expect(page.getByRole("heading", { name: "我不想先写一份漂亮的自我介绍。" })).toBeVisible();
});

test("empty section states are explicit", async ({ page }) => {
  await page.goto("/journal/sections/ai-practice");

  await expect(page.getByRole("heading", { name: "AI 实践" })).toBeVisible();
  await expect(page.getByText("这里不会用工具清单代替真实结果")).toBeVisible();
});

test("unknown content returns a useful 404", async ({ page }) => {
  const response = await page.goto("/journal/articles/not-real");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "这一页还没有被写出来。" })).toBeVisible();
});

test("machine-readable routes respond", async ({ request }) => {
  const [rss, sitemap, robots] = await Promise.all([
    request.get("/journal/rss.xml"),
    request.get("/journal/sitemap.xml"),
    request.get("/journal/robots.txt"),
  ]);

  expect(rss.ok()).toBe(true);
  expect(await rss.text()).toContain("<rss version=\"2.0\">");
  expect(sitemap.ok()).toBe(true);
  expect(robots.ok()).toBe(true);
});

test("mobile navigation opens and navigates", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only behavior");
  await page.goto("/journal");

  await page.getByRole("button", { name: "打开导航" }).click();
  await expect(page.getByRole("navigation", { name: "移动端主导航" })).toBeVisible();
  await page.getByRole("link", { name: /关于/ }).last().click();
  await expect(page).toHaveURL(/\/journal\/about$/);
});
