#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const { mkdirSync } = require("node:fs");
const { chromium } = require("playwright");
const { Pool } = require("pg");
const crypto = require("node:crypto");

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value) throw new Error(`${name} requires a value`);
  return value;
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function testCiphertext(index) {
  return `v1.${Buffer.alloc(12, index + 1).toString("base64url")}.${Buffer.from(`m1d-cipher-${index}`).toString("base64url")}.${Buffer.alloc(16, index + 21).toString("base64url")}`;
}

function cleanLedger() {
  return { console: [], page: [], http: [] };
}

function observe(page, baseUrl, ledger) {
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      if (message.text().includes("/_next/webpack-hmr")) return;
      ledger.console.push({ type: message.type(), text: message.text().slice(0, 500) });
    }
  });
  page.on("pageerror", (error) => ledger.page.push(error.message.slice(0, 500)));
  page.on("response", (response) => {
    if (response.url().startsWith(baseUrl) && response.status() >= 400) {
      ledger.http.push({ status: response.status(), url: response.url() });
    }
  });
}

async function currentActor(databaseUrl, email) {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const result = await pool.query(`
      SELECT
        u.id AS "userId",
        p.id AS "personId",
        p."organizationId",
        p."homeCircleId"
      FROM users u
      JOIN people p ON p."userId" = u.id
      WHERE u.email = $1
    `, [email]);
    if (result.rowCount !== 1) throw new Error("registered actor not found");
    return result.rows[0];
  } finally {
    await pool.end();
  }
}

async function seedReadyFacts(databaseUrl, actor, suffix) {
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  const now = new Date();
  const endAt = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1_000);
  const roleId = `m1d-${suffix}-lead-role`;
  const cycleId = `m1d-${suffix}-cycle`;
  const meetingId = `m1d-${suffix}-goal-meeting`;
  const proposalId = `m1d-${suffix}-goal-proposal`;
  const proposalTargetId = `m1d-${suffix}-proposal-target`;
  const decisionId = `m1d-${suffix}-goal-decision`;
  const goalId = `m1d-${suffix}-goal`;
  const goalTargetId = `m1d-${suffix}-goal-target`;
  const invitationId = `m1d-${suffix}-held-invitation`;
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE organizations SET purpose = $2, "updatedAt" = $3 WHERE id = $1`,
      [actor.organizationId, "让真实团队以张力驱动组织自我进化", now],
    );
    await client.query(
      `UPDATE circles SET "leadPersonId" = $3, "tacticalCadence" = 'weekly', "updatedAt" = $4
       WHERE id = $1 AND "organizationId" = $2`,
      [actor.homeCircleId, actor.organizationId, actor.personId, now],
    );
    await client.query(`
      INSERT INTO role_defs (
        id, "organizationId", name, purpose, accountabilities,
        "ownershipType", category, status, "circleId", "createdAt", "updatedAt"
      ) VALUES ($1, $2, '圈子负责人', '维护主回路目的', '维护组织运行节奏', 'HOME', 'CIRCLE_LEAD', 'ACTIVE', $3, $4, $4)
    `, [roleId, actor.organizationId, actor.homeCircleId, now]);
    await client.query(
      `INSERT INTO "_PersonRoles" ("A", "B") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [actor.personId, roleId],
    );
    await client.query(`
      INSERT INTO organization_brain_profiles (
        id, "organizationId", name, "modelProvider", "createdAt", "updatedAt"
      ) VALUES ($1, $2, 'M1-D 组织大脑', 'system', $3, $3)
    `, [`m1d-${suffix}-brain`, actor.organizationId, now]);
    await client.query(`
      INSERT INTO goal_cycles (
        id, "organizationId", name, status, "startAt", "endAt",
        "checkInCadenceDays", "activatedAt", "createdAt", "updatedAt"
      ) VALUES ($1, $2, 'M1-D 浏览器验收周期', 'PLANNED', $3, $4, 7, NULL, $3, $3)
    `, [cycleId, actor.organizationId, now, endAt]);
    await client.query(
      `UPDATE goal_cycles SET status = 'ACTIVE', "activatedAt" = $2, "updatedAt" = $2 WHERE id = $1`,
      [cycleId, now],
    );
    await client.query(`
      INSERT INTO meetings (
        id, "organizationId", title, type, agenda, "durationMin", "startedAt", "circleId", "createdAt"
      ) VALUES ($1, $2, 'M1-D 目标决策会', 'GOVERNANCE', '确认首个组织目标', 30, $3, $4, $3)
    `, [meetingId, actor.organizationId, now, actor.homeCircleId]);
    await client.query(
      `INSERT INTO "_MeetingToPerson" ("A", "B") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [meetingId, actor.personId],
    );
    await client.query(`
      INSERT INTO goal_proposals (
        id, "organizationId", "cycleId", "circleId", "proposerId",
        kind, status, "currentRevision", "submittedAt", "terminalAt", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, 'CREATE', 'DRAFT', 1, NULL, NULL, $6, $6)
    `, [proposalId, actor.organizationId, cycleId, actor.homeCircleId, actor.personId, now]);
    await client.query(`
      INSERT INTO goal_proposal_revisions (
        "organizationId", "proposalId", revision, title, "intendedOutcome",
        "ownerRoleId", "authoredById", "createdAt"
      ) VALUES ($1, $2, 1, '让组织完成首次治理闭环', '真实团队能从张力进入会议并形成行动闭环', $3, $4, $5)
    `, [actor.organizationId, proposalId, roleId, actor.personId, now]);
    await client.query(`
      INSERT INTO goal_proposal_targets (
        id, "organizationId", "proposalId", revision, position, label, kind,
        "acceptanceCriteria", "createdAt"
      ) VALUES ($1, $2, $3, 1, 1, '完成首次张力闭环', 'MILESTONE', '浏览器验收通过', $4)
    `, [proposalTargetId, actor.organizationId, proposalId, now]);
    await client.query(`
      UPDATE goal_proposals
      SET status = 'SUBMITTED', "submittedAt" = $3, "updatedAt" = $3
      WHERE id = $1 AND "organizationId" = $2
    `, [proposalId, actor.organizationId, now]);
    await client.query(`
      UPDATE goal_proposals
      SET status = 'ADOPTED', "terminalAt" = $3, "updatedAt" = $3
      WHERE id = $1 AND "organizationId" = $2
    `, [proposalId, actor.organizationId, now]);
    await client.query(`
      INSERT INTO goal_decisions (
        id, "organizationId", "proposalId", revision, outcome, "meetingId",
        "recorderId", "mutationKey", note, "decidedAt"
      ) VALUES ($1, $2, $3, 1, 'ADOPTED', $4, $5, $6, 'M1-D fixture', $7)
    `, [decisionId, actor.organizationId, proposalId, meetingId, actor.personId, `m1d-${suffix}-decision`, now]);
    await client.query(`
      INSERT INTO goals (
        id, "organizationId", "cycleId", "circleId", title, "intendedOutcome",
        "ownerRoleId", status, "adoptedDecisionId", "createdAt"
      ) VALUES ($1, $2, $3, $4, '让组织完成首次治理闭环',
        '真实团队能从张力进入会议并形成行动闭环', $5, 'ACTIVE', $6, $7)
    `, [goalId, actor.organizationId, cycleId, actor.homeCircleId, roleId, decisionId, now]);
    await client.query(`
      INSERT INTO goal_targets (
        id, "organizationId", "goalId", "sourceProposalTargetId", position,
        label, kind, "acceptanceCriteria", "createdAt"
      ) VALUES ($1, $2, $3, $4, 1, '完成首次张力闭环', 'MILESTONE', '浏览器验收通过', $5)
    `, [goalTargetId, actor.organizationId, goalId, proposalTargetId, now]);
    await client.query(`
      INSERT INTO organization_invitations (
        id, "organizationId", email, "tokenHash", "deliveryTokenCiphertext",
        "createdById", "expiresAt", "deliveryMode", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'HELD', $8, $8)
    `, [
      invitationId,
      actor.organizationId,
      `m1d-invite-${suffix}@example.invalid`,
      hash(`m1d-token-${suffix}`),
      testCiphertext(7),
      actor.personId,
      endAt,
      now,
    ]);
    await client.query("COMMIT");
    return { roleId, cycleId, goalId, invitationId };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function activationFacts(databaseUrl, actor, invitationId) {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const result = await pool.query(`
      SELECT
        o."lifecycleStatus"::text AS "lifecycleStatus",
        o."activatedAt" IS NOT NULL AS activated,
        i."deliveryMode"::text AS "deliveryMode",
        i."releasedAt" IS NOT NULL AS released,
        i."deliveryCompletedAt" IS NOT NULL AS completed,
        count(j.id)::int AS "jobCount",
        coalesce(jsonb_agg(to_jsonb(j))::text, '[]') AS "jobsJson"
      FROM organizations o
      JOIN organization_invitations i ON i."organizationId" = o.id AND i.id = $2
      LEFT JOIN organization_invitation_delivery_jobs j
        ON j."organizationId" = i."organizationId" AND j."invitationId" = i.id
      WHERE o.id = $1
      GROUP BY o."lifecycleStatus", o."activatedAt", i."deliveryMode", i."releasedAt", i."deliveryCompletedAt"
    `, [actor.organizationId, invitationId]);
    return result.rows[0];
  } finally {
    await pool.end();
  }
}

async function cleanup(databaseUrl, email, orgName) {
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const target = await client.query(`
      SELECT
        u.id AS "userId",
        coalesce(p."organizationId", m."organizationId", o.id) AS "organizationId"
      FROM users u
      LEFT JOIN people p ON p."userId" = u.id
      LEFT JOIN memberships m ON m."userId" = u.id
      LEFT JOIN organizations o ON o.name = $2
      WHERE u.email = $1
    `, [email, orgName]);
    const userIds = [...new Set(target.rows.map((row) => row.userId).filter(Boolean))];
    const organizationIds = [...new Set(target.rows.map((row) => row.organizationId).filter(Boolean))];
    if (organizationIds.length > 0) {
      await client.query("SET LOCAL session_replication_role = replica");
      await client.query('ALTER TABLE "organizations" DISABLE TRIGGER "organizations_lifecycle_update_guard"');
      await client.query('ALTER TABLE "organization_setup_events" DISABLE TRIGGER "organization_setup_events_append_only"');
      await client.query('ALTER TABLE "organization_activation_snapshots" DISABLE TRIGGER "organization_activation_snapshots_append_only"');
      await client.query('DELETE FROM goal_check_ins WHERE "organizationId" = any($1::text[])', [organizationIds]);
      await client.query('DELETE FROM goal_targets WHERE "organizationId" = any($1::text[])', [organizationIds]);
      await client.query('DELETE FROM goals WHERE "organizationId" = any($1::text[])', [organizationIds]);
      await client.query('DELETE FROM goal_decisions WHERE "organizationId" = any($1::text[])', [organizationIds]);
      await client.query('DELETE FROM goal_proposal_targets WHERE "organizationId" = any($1::text[])', [organizationIds]);
      await client.query('DELETE FROM goal_proposal_revisions WHERE "organizationId" = any($1::text[])', [organizationIds]);
      await client.query('DELETE FROM goal_proposals WHERE "organizationId" = any($1::text[])', [organizationIds]);
      await client.query('DELETE FROM goal_cycles WHERE "organizationId" = any($1::text[])', [organizationIds]);
      await client.query('DELETE FROM meetings WHERE "organizationId" = any($1::text[])', [organizationIds]);
      await client.query('DELETE FROM organization_invitation_delivery_jobs WHERE "organizationId" = any($1::text[])', [organizationIds]);
      await client.query('DELETE FROM organization_invitations WHERE "organizationId" = any($1::text[])', [organizationIds]);
      await client.query('DELETE FROM organization_brain_profiles WHERE "organizationId" = any($1::text[])', [organizationIds]);
      await client.query('DELETE FROM organizations WHERE id = any($1::text[])', [organizationIds]);
      await client.query('ALTER TABLE "organization_activation_snapshots" ENABLE TRIGGER "organization_activation_snapshots_append_only"');
      await client.query('ALTER TABLE "organization_setup_events" ENABLE TRIGGER "organization_setup_events_append_only"');
      await client.query('ALTER TABLE "organizations" ENABLE TRIGGER "organizations_lifecycle_update_guard"');
    }
    if (userIds.length > 0) {
      await client.query("DELETE FROM people WHERE id = any($1::text[]) OR email = $2", [userIds, email]);
      await client.query("DELETE FROM users WHERE id = any($1::text[])", [userIds]);
    }
    const residue = await client.query(`
      SELECT
        (SELECT count(*)::int FROM users WHERE email = $1) AS users,
        (SELECT count(*)::int FROM people WHERE email = $1) AS people,
        (SELECT count(*)::int FROM organizations WHERE name = $2) AS organizations,
        (SELECT count(*)::int FROM sessions s JOIN users u ON u.id = s."userId" WHERE u.email = $1) AS sessions
    `, [email, orgName]);
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

async function visibleText(page) {
  return page.locator("body").innerText();
}

async function readinessDebug(page) {
  const text = await visibleText(page);
  return {
    organizationPurpose: text.includes("组织目的\n已就绪"),
    rootStructure: text.includes("主结构\n已就绪"),
    keyRole: text.includes("关键角色\n已就绪"),
    goalPull: text.includes("目标牵引\n已就绪"),
    organizationBrain: text.includes("组织大脑\n已就绪"),
    pendingLabels: Array.from(text.matchAll(/(.+)\n待补齐/g)).map((match) => match[1]?.trim()).filter(Boolean),
  };
}

async function main() {
  const baseUrl = option("--base-url", "http://127.0.0.1:3231").replace(/\/+$/, "");
  const screenshotDir = option("--screenshot-dir", `/tmp/loopos-m1d-${Date.now()}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  mkdirSync(screenshotDir, { recursive: true });

  const suffix = String(Date.now());
  const email = `m1d-smoke-${suffix}@loopos.test`;
  const password = `M1d-smoke-${suffix}!`;
  const orgName = `M1-D Smoke ${suffix}`;
  const personName = `M1-D User ${suffix}`;
  const ledger = cleanLedger();
  const browser = await chromium.launch({ headless: true });
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  observe(desktop, baseUrl, ledger);

  let output;
  let residue = null;
  try {
    await desktop.goto(`${baseUrl}/register`, { waitUntil: "networkidle" });
    await desktop.getByLabel("组织名称").fill(orgName);
    await desktop.getByLabel("你的姓名").fill(personName);
    await desktop.getByLabel("邮箱").fill(email);
    await desktop.getByLabel("密码").fill(password);
    await desktop.getByRole("button", { name: "创建组织" }).click();
    await desktop.waitForURL(`${baseUrl}/app`, { timeout: 30_000 });

    await desktop.goto(`${baseUrl}/app/organization`, { waitUntil: "networkidle" });
    await desktop.getByRole("heading", { name: orgName }).waitFor();
    await desktop.getByText("设置模式").first().waitFor();
    await desktop.getByRole("heading", { name: "最低准备度" }).waitFor();
    const initialActivationDisabled = await desktop.getByRole("button", { name: "确认启用组织" }).isDisabled();
    await desktop.screenshot({ path: `${screenshotDir}/desktop-setup-locked.png`, fullPage: true });

    await desktop.goto(`${baseUrl}/app/meetings/new`, { waitUntil: "networkidle" });
    await desktop.getByText("组织尚未启用，暂不能发起会议").waitFor();
    const setupMeetingText = await visibleText(desktop);

    const actor = await currentActor(databaseUrl, email);
    const seeded = await seedReadyFacts(databaseUrl, actor, suffix);
    await desktop.goto(`${baseUrl}/app/organization`, { waitUntil: "networkidle" });
    const readyActivationDisabled = await desktop.getByRole("button", { name: "确认启用组织" }).isDisabled();
    const seededReadiness = await readinessDebug(desktop);
    if (readyActivationDisabled) {
      throw new Error(`activation button stayed disabled after seeding: ${JSON.stringify(seededReadiness)}`);
    }
    await desktop.getByRole("button", { name: "确认启用组织" }).click();
    try {
      await desktop.getByText("组织已启用，可以进入结构、目标、角色和会议节奏。").waitFor({ timeout: 30_000 });
      await desktop.getByText("已启用").first().waitFor();
    } catch (error) {
      const activationText = await visibleText(desktop);
      throw new Error(`${error instanceof Error ? error.message : String(error)}\nactivation page text:\n${activationText}`);
    }
    await desktop.screenshot({ path: `${screenshotDir}/desktop-active.png`, fullPage: true });

    await desktop.goto(`${baseUrl}/app/meetings/new`, { waitUntil: "networkidle" });
    await desktop.getByLabel("会议主题").waitFor();
    await desktop.getByText("战术会处理运营卡点").waitFor();
    const activeMeetingText = await visibleText(desktop);

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    observe(mobile, baseUrl, ledger);
    await mobile.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    await mobile.getByLabel("邮箱").fill(email);
    await mobile.getByLabel("密码").fill(password);
    await mobile.getByRole("button", { name: "登录" }).click();
    await mobile.waitForURL(`${baseUrl}/app`, { timeout: 30_000 });
    await mobile.goto(`${baseUrl}/app/organization`, { waitUntil: "networkidle" });
    await mobile.getByText("已启用").first().waitFor();
    const horizontalOverflow = await mobile.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    await mobile.screenshot({ path: `${screenshotDir}/mobile-organization-active.png`, fullPage: true });
    await mobile.close();

    const facts = await activationFacts(databaseUrl, actor, seeded.invitationId);
    output = {
      ok: initialActivationDisabled
        && !readyActivationDisabled
        && setupMeetingText.includes("组织尚未启用，暂不能发起会议")
        && activeMeetingText.includes("会议主题")
        && activeMeetingText.includes("参与人")
        && facts.lifecycleStatus === "ACTIVE"
        && facts.activated === true
        && facts.deliveryMode === "IMMEDIATE"
        && facts.released === true
        && facts.completed === false
        && facts.jobCount === 1
        && !/m1d-token|example\.invalid/i.test(facts.jobsJson)
        && !horizontalOverflow
        && ledger.console.length === 0
        && ledger.page.length === 0
        && ledger.http.length === 0,
      baseUrl,
      screenshotDir,
      initialActivationDisabled,
      readyActivationDisabled,
      meetingLocked: setupMeetingText.includes("组织尚未启用，暂不能发起会议"),
      meetingAvailable: activeMeetingText.includes("会议主题") && activeMeetingText.includes("参与人"),
      facts,
      horizontalOverflow,
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
