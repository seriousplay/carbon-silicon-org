#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const { mkdirSync } = require("node:fs");
const { chromium } = require("playwright");
const { Pool } = require("pg");

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value) throw new Error(`${name} requires a value`);
  return value;
}

function observe(page, baseUrl, ledger) {
  page.on("console", (message) => {
    if (!["error", "warning"].includes(message.type())) return;
    if (message.text().includes("/_next/webpack-hmr")) return;
    ledger.console.push({ type: message.type(), text: message.text().slice(0, 500) });
  });
  page.on("pageerror", (error) => ledger.page.push(error.message.slice(0, 500)));
  page.on("response", (response) => {
    if (response.url().startsWith(baseUrl) && response.status() >= 400) {
      ledger.http.push({ status: response.status(), url: response.url() });
    }
  });
}

async function cleanup(databaseUrl, email, orgName) {
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL session_replication_role = replica");
    const target = await client.query(`
      SELECT u.id AS "userId", coalesce(p."organizationId", m."organizationId", o.id) AS "organizationId"
      FROM users u
      LEFT JOIN people p ON p."userId" = u.id
      LEFT JOIN memberships m ON m."userId" = u.id
      LEFT JOIN organizations o ON o.name = $2
      WHERE u.email = $1
    `, [email, orgName]);
    const userIds = [...new Set(target.rows.map((row) => row.userId).filter(Boolean))];
    const organizationIds = [...new Set(target.rows.map((row) => row.organizationId).filter(Boolean))];
    if (organizationIds.length > 0) {
      for (const table of [
        "business_loop_evidence_refs",
        "business_loop_edges",
        "business_loop_activities",
        "business_loop_versions",
        "business_loops",
        "circle_interfaces",
        "role_defs",
        "circles",
        "memberships",
        "people",
      ]) {
        await client.query(`DELETE FROM ${table} WHERE "organizationId" = any($1::text[])`, [organizationIds]);
      }
      await client.query("DELETE FROM organizations WHERE id = any($1::text[])", [organizationIds]);
    }
    if (userIds.length > 0) {
      await client.query("DELETE FROM users WHERE id = any($1::text[])", [userIds]);
    }
    const residue = await client.query(`
      SELECT
        (SELECT count(*)::int FROM users WHERE email = $1) AS users,
        (SELECT count(*)::int FROM people WHERE email = $1) AS people,
        (SELECT count(*)::int FROM organizations WHERE name = $2) AS organizations,
        (SELECT count(*)::int FROM business_loops WHERE "organizationId" = any($3::text[])) AS business_loops
    `, [email, orgName, organizationIds]);
    await client.query("COMMIT");
    return residue.rows[0];
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function seedReferenceData(databaseUrl, email, suffix) {
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    const actor = await client.query(`
      SELECT p."organizationId", p.id AS "personId"
      FROM people p
      WHERE p.email = $1
      LIMIT 1
    `, [email]);
    const row = actor.rows[0];
    if (!row) throw new Error("M3-E fixture person not found after registration");
    const organizationId = row.organizationId;
    const sourceCircleId = `m3e-source-${suffix}`;
    const targetCircleId = `m3e-target-${suffix}`;
    const roleId = `m3e-role-${suffix}`;
    const interfaceId = `m3e-interface-${suffix}`;
    await client.query(`
      INSERT INTO circles ("id", "organizationId", "name", "number", "type", "purpose", "status", "phase", "createdAt", "updatedAt")
      VALUES
        ($2, $1, '洞察团队', 'ONE', 'PRODUCTION', '识别客户需求', 'NORMAL', 'PHASE_0', now(), now()),
        ($3, $1, '模型团队', 'TWO', 'PRODUCTION', '交付模型能力', 'NORMAL', 'PHASE_0', now(), now())
    `, [organizationId, sourceCircleId, targetCircleId]);
    await client.query(`
      INSERT INTO role_defs ("id", "organizationId", "name", "purpose", "accountabilities", "ownershipType", "category", "status", "circleId", "createdAt", "updatedAt")
      VALUES ($1, $2, '业务回路维护者', '维护运营流动事实', '维护业务回路草稿', 'HOME', 'EXPERT', 'ACTIVE', $3, now(), now())
    `, [roleId, organizationId, sourceCircleId]);
    await client.query(`
      INSERT INTO circle_interfaces (
        "id", "organizationId", "name", "contractContent", "sla", "acceptanceCriteria",
        "status", "fromCircleId", "toCircleId", "ownerId", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, '洞察到模型接口', '洞察团队提供训练需求。', '每周同步', '模型团队确认可训练', 'READY', $3, $4, $5, now(), now())
    `, [interfaceId, organizationId, sourceCircleId, targetCircleId, row.personId]);
    return { organizationId, sourceCircleId, targetCircleId, roleId, interfaceId };
  } finally {
    client.release();
    await pool.end();
  }
}

async function fetchCounts(databaseUrl, organizationId) {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const result = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM business_loops WHERE "organizationId" = $1 AND status = 'ACTIVE') AS active_loops,
        (SELECT count(*)::int FROM business_loop_versions WHERE "organizationId" = $1 AND status = 'PUBLISHED') AS published_versions,
        (SELECT count(*)::int FROM business_loop_versions WHERE "organizationId" = $1 AND status = 'DRAFT') AS draft_versions,
        (SELECT count(*)::int FROM business_loop_activities WHERE "organizationId" = $1) AS activities,
        (SELECT count(*)::int FROM business_loop_edges WHERE "organizationId" = $1) AS edges,
        (SELECT count(*)::int FROM business_loop_evidence_refs WHERE "organizationId" = $1) AS evidence,
        (SELECT count(*)::int FROM role_defs WHERE "organizationId" = $1) AS roles,
        (SELECT count(*)::int FROM circles WHERE "organizationId" = $1) AS circles
    `, [organizationId]);
    return result.rows[0];
  } finally {
    await pool.end();
  }
}

async function main() {
  const baseUrl = option("--base-url", "http://127.0.0.1:3001").replace(/\/+$/, "");
  const screenshotDir = option("--screenshot-dir", `/tmp/loopos-m3e-${Date.now()}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  mkdirSync(screenshotDir, { recursive: true });

  const suffix = String(Date.now());
  const email = `m3e-admin-${suffix}@loopos.test`;
  const password = `M3e-admin-${suffix}!`;
  const orgName = `M3-E Admin ${suffix}`;
  const ledger = { console: [], page: [], http: [] };
  const browser = await chromium.launch({ headless: true });
  let output;
  let residue = null;
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    observe(page, baseUrl, ledger);
    await page.goto(`${baseUrl}/register`, { waitUntil: "networkidle" });
    await page.getByLabel("组织名称").fill(orgName);
    await page.getByLabel("你的姓名").fill("M3-E Admin");
    await page.getByLabel("邮箱").fill(email);
    await page.getByLabel("密码").fill(password);
    await page.getByRole("button", { name: "创建组织" }).click();
    await page.waitForURL(`${baseUrl}/app`, { timeout: 30_000 });
    const references = await seedReferenceData(databaseUrl, email, suffix);

    await page.goto(`${baseUrl}/app/organization/business-loops`, { waitUntil: "networkidle" });
    await page.locator('input[name="name"]').fill("客户需求到模型能力正式版");
    await page.locator('input[name="purpose"]').fill("把客户需求、数据流动和模型交付串成一个正式运营闭环。");
    await page.getByRole("button", { name: "新建草稿" }).click();
    await page.getByText("业务回路草稿已创建").waitFor();
    await page.reload({ waitUntil: "networkidle" });

    await page.locator('input[name="activityName"]').fill("确认高价值需求");
    await page.locator('select[name="circleId"]').selectOption(references.sourceCircleId);
    await page.locator('select[name="ownerRoleId"]').selectOption(references.roleId);
    await page.getByRole("button", { name: "加入活动" }).click();
    await page.getByText("业务活动已加入草稿").waitFor();

    await page.locator('input[name="edgeLabel"]').fill("需求证据进入模型训练");
    await page.locator('select[name="edgeType"]').selectOption("DATA");
    await page.locator('select[name="fromCircleId"]').selectOption(references.sourceCircleId);
    await page.locator('select[name="toCircleId"]').selectOption(references.targetCircleId);
    await page.locator('select[name="interfaceId"]').selectOption(references.interfaceId);
    await page.getByRole("button", { name: "加入流动" }).click();
    await page.getByText("价值或数据流已加入草稿").waitFor();

    await page.locator('input[name="evidenceLabel"]').fill("客户访谈证据");
    await page.getByRole("button", { name: "加入证据" }).click();
    await page.getByText("证据标签已加入草稿").waitFor();
    const publishButton = page.getByRole("button", { name: "发布正式版本" });
    const duplicatePublishAttempt = await Promise.allSettled([
      publishButton.click(),
      publishButton.click({ timeout: 2_000 }),
    ]);
    await page.getByText("已发布").waitFor();
    await page.reload({ waitUntil: "networkidle" });

    await page.getByText("正式业务回路数据").waitFor();
    await page.getByText("客户需求到模型能力正式版").waitFor();
    await page.getByText("已发布").waitFor();
    await page.getByText("确认高价值需求").waitFor();
    await page.getByRole("link", { name: "业务回路维护者" }).waitFor();
    await page.getByText("需求证据进入模型训练").waitFor();
    await page.getByRole("link", { name: "洞察到模型接口" }).waitFor();
    const stats = await page.locator("section").first().locator(".text-2xl").evaluateAll(
      (items) => items.map((item) => item.textContent?.trim() ?? ""),
    );
    if (stats.join(",") !== "3,1,1,1") {
      throw new Error(`unexpected publishing stats: ${stats.join(",")}`);
    }
    const counts = await fetchCounts(databaseUrl, references.organizationId);
    if (counts.active_loops !== 1 || counts.published_versions !== 1 || counts.draft_versions !== 0) {
      throw new Error(`unexpected publish counts: ${JSON.stringify(counts)}`);
    }
    if (counts.activities !== 1 || counts.edges !== 1 || counts.evidence !== 1) {
      throw new Error(`unexpected persisted child counts: ${JSON.stringify(counts)}`);
    }
    if (counts.roles !== 1 || counts.circles !== 3) {
      throw new Error(`governance structure count changed unexpectedly: ${JSON.stringify(counts)}`);
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    await page.screenshot({ path: `${screenshotDir}/desktop-published.png`, fullPage: true });
    await page.close();

    output = {
      ok: !overflow && ledger.console.length === 0 && ledger.page.length === 0 && ledger.http.length === 0,
      baseUrl,
      screenshotDir,
      stats,
      counts,
      duplicatePublishAttempt: duplicatePublishAttempt.map((result) => result.status),
      overflow,
      ledger,
    };
  } catch (error) {
    output = {
      ok: false,
      baseUrl,
      screenshotDir,
      error: error instanceof Error ? error.message : String(error),
      ledger,
    };
  } finally {
    await browser.close();
    residue = await cleanup(databaseUrl, email, orgName);
  }
  const cleanupOk = Object.values(residue).every((count) => count === 0);
  const finalOutput = { ...output, cleanupOk, residue };
  console.log(JSON.stringify(finalOutput, null, 2));
  if (!finalOutput.ok || !cleanupOk) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
