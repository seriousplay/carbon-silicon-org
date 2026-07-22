#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const { spawnSync } = require("node:child_process");
const { existsSync, mkdirSync } = require("node:fs");
const { Pool } = require("pg");

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value) throw new Error(`${name} requires a value`);
  return value;
}

function databaseUrlForName(databaseUrl, databaseName) {
  const url = new URL(databaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function adminDatabaseUrl(databaseUrl) {
  return databaseUrlForName(databaseUrl, "postgres");
}

function quoteIdentifier(identifier) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`unsafe database identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function requiredArtifacts() {
  return [
    "docs/plans/2026-07-21-v6-m6a-integrated-trial-contract.md",
    "docs/evidence/2026-07-21-v6-m6a-evidence-harness.md",
    "docs/evidence/2026-07-21-v6-m6a-contract-acceptance.md",
    "scripts/verify-v6-m6a-contract.mjs",
  ];
}

async function databaseReadiness(databaseUrl) {
  if (!databaseUrl) {
    return { ok: false, reason: "DATABASE_URL is required" };
  }
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const result = await pool.query(`
      SELECT
        to_regclass('public.organizations') IS NOT NULL AS organizations,
        to_regclass('public.people') IS NOT NULL AS people,
        to_regclass('public.role_defs') IS NOT NULL AS role_defs,
        to_regclass('public.goal_cycles') IS NOT NULL AS goal_cycles,
        to_regclass('public.tensions') IS NOT NULL AS tensions,
        to_regclass('public.candidate_tensions') IS NOT NULL AS candidate_tensions,
        to_regclass('public.meetings') IS NOT NULL AS meetings
    `);
    const row = result.rows[0] ?? {};
    return {
      ok: Object.values(row).every(Boolean),
      tables: row,
    };
  } finally {
    await pool.end();
  }
}

async function createDatabase(defaultDatabaseUrl, databaseName) {
  const pool = new Pool({ connectionString: adminDatabaseUrl(defaultDatabaseUrl) });
  try {
    await pool.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`);
    await pool.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
  } finally {
    await pool.end();
  }
}

async function dropDatabase(defaultDatabaseUrl, databaseName) {
  const pool = new Pool({ connectionString: adminDatabaseUrl(defaultDatabaseUrl) });
  try {
    await pool.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)} WITH (FORCE)`);
  } finally {
    await pool.end();
  }
}

async function databaseExists(defaultDatabaseUrl, databaseName) {
  const pool = new Pool({ connectionString: adminDatabaseUrl(defaultDatabaseUrl) });
  try {
    const result = await pool.query("SELECT count(*)::int AS count FROM pg_database WHERE datname = $1", [databaseName]);
    return result.rows[0]?.count ?? 0;
  } finally {
    await pool.end();
  }
}

function runMigrations(databaseUrl) {
  const result = spawnSync(
    "./node_modules/.bin/prisma",
    ["migrate", "deploy", "--schema", "prisma/schema.prisma"],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      encoding: "utf8",
    },
  );
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout ?? "").slice(-4_000),
    stderr: (result.stderr ?? "").slice(-4_000),
  };
}

function plannedBrowserJourney() {
  return [
    "register-setup-organization",
    "complete-ui-capable-setup-facts",
    "retain-explicit-fixture-preconditions-for-ui-gaps",
    "activate-organization",
    "assign-human-role",
    "create-goal-cycle-and-main-goal",
    "confirm-candidate-tension",
    "run-tactical-meeting-outcome",
    "run-governance-meeting-outcome",
    "organization-brain-read-and-action-support",
    "desktop-and-mobile-clean-ledgers",
    "fixture-cleanup-zero-residue",
  ];
}

function setupFactClassification() {
  return [
    {
      fact: "organization purpose",
      route: "/app/organization#organization-identity",
      status: "ui-verifier-required",
    },
    {
      fact: "organization structure initialization",
      route: "/app/organization#organization-structure",
      status: "ui-verifier-required",
    },
    {
      fact: "organization brain model settings",
      route: "/app/organization#system-configuration",
      status: "explicit-fixture-precondition-until-browser-proven",
    },
    {
      fact: "goal cycle",
      route: "/app/goals",
      status: "ui-verifier-required",
    },
    {
      fact: "formal tactical and governance tensions",
      route: "/app/tensions/new",
      status: "ui-verifier-required",
    },
    {
      fact: "main circle lead and tactical cadence",
      route: "/app/circles/map",
      status: "explicit-fixture-precondition-until-browser-proven",
    },
    {
      fact: "direct role assignment",
      route: "/app/roles/market and governance meeting",
      status: "explicit-fixture-precondition-until-browser-proven",
    },
    {
      fact: "goal proposal decision, adopted goal, and goal target",
      route: "/app/goals and strategy meeting",
      status: "explicit-fixture-precondition-until-browser-proven",
    },
    {
      fact: "detector Agent person",
      route: "no accepted setup UI",
      status: "explicit-fixture-precondition",
    },
    {
      fact: "candidate tension before confirmation",
      route: "/app/tensions review only",
      status: "explicit-fixture-precondition",
    },
  ];
}

function cleanLedger() {
  return { console: [], page: [], http: [] };
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

async function completeUiSetupFacts(page, baseUrl, orgName) {
  await page.goto(`${baseUrl}/app/organization`, { waitUntil: "networkidle" });
  await page.getByLabel("组织目的").fill("用 AI 原生治理节奏完成真实团队张力闭环");
  await page.getByRole("button", { name: "保存组织配置" }).click();
  await page.getByText("已生成新配置版本。").waitFor({ state: "visible", timeout: 30_000 });

  await page.getByRole("button", { name: /初始化/ }).first().click();
  await page.getByText("组织结构初始化已关闭").waitFor({ state: "visible", timeout: 30_000 });

  await page.goto(`${baseUrl}/app/goals`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "目标", exact: true }).waitFor({ state: "visible", timeout: 30_000 });

  await page.goto(`${baseUrl}/app/organization`, { waitUntil: "networkidle" });
  await page.locator("h1").filter({ hasText: orgName }).first().waitFor({ state: "visible", timeout: 30_000 });
  await page.getByRole("heading", { name: "组织大脑模型", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
}

async function createFormalTensionThroughUi(page, baseUrl, input) {
  await page.goto(`${baseUrl}/app/tensions/new`, { waitUntil: "networkidle" });
  await page.getByLabel("标题").fill(input.title);
  await page.getByLabel("详细描述").fill(input.description);
  await page.getByLabel(input.mode === "TACTICAL" ? "战术处理" : "治理处理").check();
  await page.getByRole("button", { name: "提交张力" }).click();
  await page.waitForURL(/\/app\/tensions\/(?!new$)[^/]+$/, { timeout: 30_000 });
  const tensionId = page.url().split("/").filter(Boolean).at(-1);
  if (!tensionId || tensionId === "new") throw new Error("formal tension creation did not reach a detail page");
  return tensionId;
}

async function seedRemainingTrialFacts(databaseUrl, actor, suffix) {
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  const now = new Date();
  const goalProposalId = `m6b-goal-proposal-${suffix}`;
  const goalProposalTargetId = `m6b-goal-proposal-target-${suffix}`;
  const goalMeetingId = `m6b-goal-meeting-${suffix}`;
  const goalDecisionId = `m6b-goal-decision-${suffix}`;
  const goalId = `m6b-goal-${suffix}`;
  const targetId = `m6b-goal-target-${suffix}`;
  const detectorId = `m6b-detector-${suffix}`;
  const candidateId = `m6b-candidate-${suffix}`;
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE circles SET "tacticalCadence" = 'weekly', "updatedAt" = $3
       WHERE id = $1 AND "organizationId" = $2`,
      [actor.homeCircleId, actor.organizationId, now],
    );
    const roleResult = await client.query(`
      SELECT rd.id
      FROM role_defs rd
      JOIN "_PersonRoles" pr ON pr."B" = rd.id
      WHERE rd."organizationId" = $1
        AND rd."circleId" = $2
        AND rd.category = 'CIRCLE_LEAD'
        AND rd.status = 'ACTIVE'
        AND pr."A" = $3
      ORDER BY rd."createdAt" ASC
      LIMIT 1
    `, [actor.organizationId, actor.homeCircleId, actor.personId]);
    const roleId = roleResult.rows[0]?.id;
    if (!roleId) throw new Error("UI initialization did not create an assigned CIRCLE_LEAD role");
    const cycleResult = await client.query(`
      SELECT id
      FROM goal_cycles
      WHERE "organizationId" = $1
        AND status IN ('PLANNED', 'ACTIVE')
      ORDER BY "createdAt" ASC
      LIMIT 1
    `, [actor.organizationId]);
    const cycleId = cycleResult.rows[0]?.id;
    if (!cycleId) throw new Error("UI initialization did not create a goal cycle");
    await client.query(
      `UPDATE goal_cycles SET status = 'ACTIVE', "activatedAt" = COALESCE("activatedAt", $2), "updatedAt" = $2 WHERE id = $1`,
      [cycleId, now],
    );
    await client.query(`
      INSERT INTO goal_proposals (
        id, "organizationId", "cycleId", "circleId", "proposerId",
        kind, status, "currentRevision", "submittedAt", "terminalAt", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, 'CREATE', 'DRAFT', 1, NULL, NULL, $6, $6)
    `, [goalProposalId, actor.organizationId, cycleId, actor.homeCircleId, actor.personId, now]);
    await client.query(`
      INSERT INTO goal_proposal_revisions (
        "organizationId", "proposalId", revision, title, "intendedOutcome",
        "ownerRoleId", "authoredById", "createdAt"
      ) VALUES ($1, $2, 1, '完成第一次张力到闭环试运行',
        '团队可以从候选张力进入战术和治理处理路径', $3, $4, $5)
    `, [actor.organizationId, goalProposalId, roleId, actor.personId, now]);
    await client.query(`
      INSERT INTO goal_proposal_targets (
        id, "organizationId", "proposalId", revision, position, label, kind,
        "acceptanceCriteria", "createdAt"
      ) VALUES ($1, $2, $3, 1, 1, '完成本地集成验收', 'MILESTONE', 'M6-D verifier 通过', $4)
    `, [goalProposalTargetId, actor.organizationId, goalProposalId, now]);
    await client.query(`
      UPDATE goal_proposals
      SET status = 'SUBMITTED', "submittedAt" = $3, "updatedAt" = $3
      WHERE id = $1 AND "organizationId" = $2
    `, [goalProposalId, actor.organizationId, now]);
    await client.query(`
      UPDATE goal_proposals
      SET status = 'ADOPTED', "terminalAt" = $3, "updatedAt" = $3
      WHERE id = $1 AND "organizationId" = $2
    `, [goalProposalId, actor.organizationId, now]);
    await client.query(`
      INSERT INTO meetings (
        id, "organizationId", title, type, agenda, "durationMin", "startedAt", "circleId", "createdAt"
      ) VALUES ($1, $2, 'M6-D 目标确认会', 'GOVERNANCE', '确认首个目标周期和主目标', 30, $3, $4, $3)
    `, [goalMeetingId, actor.organizationId, now, actor.homeCircleId]);
    await client.query(
      `INSERT INTO "_MeetingToPerson" ("A", "B") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [goalMeetingId, actor.personId],
    );
    await client.query(`
      INSERT INTO goal_decisions (
        id, "organizationId", "proposalId", revision, outcome, "meetingId", "recorderId",
        "mutationKey", note, "decidedAt"
      ) VALUES ($1, $2, $3, 1, 'ADOPTED', $4, $5, $6, 'M6-D explicit fixture precondition', $7)
    `, [goalDecisionId, actor.organizationId, goalProposalId, goalMeetingId, actor.personId, `m6d-goal-decision-${suffix}`, now]);
    await client.query(`
      INSERT INTO goals (
        id, "organizationId", "cycleId", "circleId", title, "intendedOutcome",
        "ownerRoleId", status, "adoptedDecisionId", "createdAt"
      ) VALUES ($1, $2, $3, $4, '完成第一次张力到闭环试运行',
        '团队可以从候选张力进入战术和治理处理路径', $5, 'ACTIVE', $6, $7)
    `, [goalId, actor.organizationId, cycleId, actor.homeCircleId, roleId, goalDecisionId, now]);
    await client.query(`
      INSERT INTO goal_targets (
        id, "organizationId", "goalId", "sourceProposalTargetId", position, label, kind,
        "acceptanceCriteria", "createdAt"
      ) VALUES ($1, $2, $3, $4, 1, '完成本地集成验收', 'MILESTONE', 'M6-D verifier 通过', $5)
    `, [targetId, actor.organizationId, goalId, goalProposalTargetId, now]);
    await client.query(`
      INSERT INTO people ("id", "organizationId", "name", "email", "entityType", "homeCircleId", "createdAt", "updatedAt")
      VALUES ($1, $2, 'M6-D Detector Agent', $3, 'AGENT', $4, $5, $5)
    `, [detectorId, actor.organizationId, `m6d-detector-${suffix}@loopos.test`, actor.homeCircleId, now]);
    await client.query(`
      INSERT INTO candidate_tensions (
        "id", "organizationId", "title", "evidenceSummary", "sourceKind", "sourceRef",
        "ownerRoleId", "detectedById", "status", "suggestedMode", "detectedAt", "updatedAt"
      )
      VALUES ($1, $2, '候选张力：M6-D 目标闭环缺少证据', '目标周期存在但缺少会议闭环证据。', 'GOAL',
        $3::jsonb, $4, $5, 'DETECTED', 'TACTICAL', $6, $6)
    `, [
      candidateId,
      actor.organizationId,
      JSON.stringify({ goalId, evidenceId: `m6d-evidence-${suffix}` }),
      roleId,
      detectorId,
      now,
    ]);
    await client.query("COMMIT");
    return { roleId, cycleId, goalId, candidateId };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function integratedFacts(databaseUrl, organizationId, candidateId, tacticalOutcomeTitle, governanceRoleName) {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const result = await pool.query(`
      SELECT
        (SELECT "lifecycleStatus"::text FROM organizations WHERE id = $1) AS lifecycle,
        (SELECT count(*)::int FROM role_defs WHERE "organizationId" = $1) AS roles,
        (SELECT count(*)::int FROM goal_cycles WHERE "organizationId" = $1 AND status = 'ACTIVE') AS active_goal_cycles,
        (SELECT count(*)::int FROM meetings WHERE "organizationId" = $1 AND type = 'TACTICAL') AS tactical_meetings,
        (SELECT count(*)::int FROM meetings WHERE "organizationId" = $1 AND type = 'GOVERNANCE') AS governance_meetings,
        (SELECT status::text FROM candidate_tensions WHERE "organizationId" = $1 AND id = $2) AS candidate_status,
        (SELECT "confirmedTensionId" FROM candidate_tensions WHERE "organizationId" = $1 AND id = $2) AS confirmed_tension_id,
        (SELECT count(*)::int FROM tactical_outcome_proposals WHERE "organizationId" = $1 AND title = $3 AND status = 'APPROVED') AS approved_tactical_outcomes,
        (SELECT count(*)::int FROM tensions WHERE "organizationId" = $1 AND title = $3 AND status = 'ASSIGNED') AS assigned_actions,
        (SELECT count(*)::int FROM governance_decision_processes WHERE "organizationId" = $1 AND state = 'ADOPTED') AS adopted_governance_processes,
        (SELECT count(*)::int FROM role_defs WHERE "organizationId" = $1 AND name = $4) AS governance_outcome_roles
    `, [organizationId, candidateId, tacticalOutcomeTitle, governanceRoleName]);
    return result.rows[0];
  } finally {
    await pool.end();
  }
}

function runCandidateServiceBoundaryAssertion({ databaseUrl, fixture, suffix }) {
  const input = {
    organizationId: fixture.organizationId,
    ownerRoleId: fixture.roleId,
    homeCircleId: fixture.homeCircleId,
    raiserPersonId: fixture.actorPersonId,
    sameTenantUnauthorizedPersonId: `m6c-unauthorized-person-${suffix}`,
    sameTenantCandidateId: `m6c-unauthorized-candidate-${suffix}`,
    sameTenantTensionId: `m6c-unauthorized-tension-${suffix}`,
    crossTenantOrganizationId: `m6c-cross-org-${suffix}`,
    crossTenantCircleId: `m6c-cross-circle-${suffix}`,
    crossTenantUserId: `m6c-cross-user-${suffix}`,
    crossTenantPersonId: `m6c-cross-person-${suffix}`,
    crossTenantCandidateId: `m6c-cross-candidate-${suffix}`,
    crossTenantTensionId: `m6c-cross-tension-${suffix}`,
  };
  const code = `
  (async () => {
    const input = JSON.parse(process.env.M6C_ASSERTION_INPUT);
    const { Pool } = await import("pg");
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const prismaModule = await import("./src/generated/prisma/client.ts");
    const { PrismaClient } = prismaModule.default;
    const serviceModule = await import("./src/lib/candidate-tensions/service.ts");
    const { confirmCandidateTensionWithHuman } = serviceModule.default;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema: "public" }) });
    const now = new Date();
    const result = { ok: false, sameTenant: null, crossTenant: null, residueAfterCleanup: null };
    async function attempt(label, candidateId, tensionId, actorPersonId) {
      let error = null;
      try {
        await confirmCandidateTensionWithHuman(prisma, {
          organizationId: input.organizationId,
          candidateId,
          confirmedTensionId: tensionId,
          actorPersonId,
        });
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
      }
      const candidate = await prisma.candidateTension.findUnique({
        where: { id_organizationId: { id: candidateId, organizationId: input.organizationId } },
        select: { status: true, confirmedTensionId: true, confirmedById: true },
      });
      const auditEvents = await prisma.candidateTensionAuditEvent.count({
        where: { organizationId: input.organizationId, candidateId },
      });
      return {
        label,
        ok:
          error === "HUMAN_OWNER_ROLE_ASSIGNEE_REQUIRED" &&
          candidate?.status === "DETECTED" &&
          candidate?.confirmedTensionId === null &&
          candidate?.confirmedById === null &&
          auditEvents === 0,
        error,
        candidateStatus: candidate,
        auditEvents,
      };
    }
    try {
      await prisma.$executeRawUnsafe(
        'INSERT INTO people ("id", "organizationId", "name", "email", "entityType", "homeCircleId", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, \\'HUMAN\\', $5, $6, $6)',
        input.sameTenantUnauthorizedPersonId,
        input.organizationId,
        "M6-C Unauthorized Same-Tenant Actor",
        input.sameTenantUnauthorizedPersonId + "@loopos.test",
        input.homeCircleId,
        now,
      );
      await prisma.$executeRawUnsafe(
        'INSERT INTO users (id, email, name, "passwordHash", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $5)',
        input.crossTenantUserId,
        input.crossTenantUserId + "@loopos.test",
        "M6-C Cross-Tenant Actor",
        "negative-fixture",
        now,
      );
      await prisma.$executeRawUnsafe(
        'INSERT INTO organizations (id, name, slug, purpose, "lifecycleStatus", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, \\'SETUP\\', $5, $5)',
        input.crossTenantOrganizationId,
        "M6-C Cross-Tenant Org",
        input.crossTenantOrganizationId,
        "negative fixture",
        now,
      );
      await prisma.$executeRawUnsafe(
        'INSERT INTO circles (id, "organizationId", name, number, type, purpose, status, phase, "createdAt", "updatedAt") VALUES ($1, $2, $3, \\'ZERO\\', \\'STRATEGY\\', $4, \\'NORMAL\\', \\'PHASE_0\\', $5, $5)',
        input.crossTenantCircleId,
        input.crossTenantOrganizationId,
        "M6-C Cross-Tenant Circle",
        "negative fixture",
        now,
      );
      await prisma.$executeRawUnsafe(
        'INSERT INTO people ("id", "organizationId", "name", "email", "userId", "entityType", "homeCircleId", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, \\'HUMAN\\', $6, $7, $7)',
        input.crossTenantPersonId,
        input.crossTenantOrganizationId,
        "M6-C Cross-Tenant Actor",
        input.crossTenantUserId + "@loopos.test",
        input.crossTenantUserId,
        input.crossTenantCircleId,
        now,
      );
      await prisma.$executeRawUnsafe(
        'INSERT INTO tensions ("id", "organizationId", "title", "description", "type", "source", "status", "raiserId", "ownerId", "handlingMode", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, \\'PROBLEMATIC\\', \\'FORM\\', \\'OPEN\\', $5, $5, \\'TACTICAL\\', $6, $6)',
        input.sameTenantTensionId,
        input.organizationId,
        "M6-C unauthorized actor formal tension",
        "Fixture tension for same-tenant unauthorized candidate confirmation denial.",
        input.raiserPersonId,
        now,
      );
      await prisma.$executeRawUnsafe(
        'INSERT INTO tensions ("id", "organizationId", "title", "description", "type", "source", "status", "raiserId", "ownerId", "handlingMode", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, \\'PROBLEMATIC\\', \\'FORM\\', \\'OPEN\\', $5, $5, \\'TACTICAL\\', $6, $6)',
        input.crossTenantTensionId,
        input.organizationId,
        "M6-C cross-tenant actor formal tension",
        "Fixture tension for cross-tenant candidate confirmation denial.",
        input.raiserPersonId,
        now,
      );
      await prisma.$executeRawUnsafe(
        'INSERT INTO candidate_tensions ("id", "organizationId", "title", "evidenceSummary", "sourceKind", "sourceRef", "ownerRoleId", "detectedById", "status", "suggestedMode", "detectedAt", "updatedAt") VALUES ($1, $2, $3, $4, \\'GOAL\\', $5::jsonb, $6, $7, \\'DETECTED\\', \\'TACTICAL\\', $8, $8)',
        input.sameTenantCandidateId,
        input.organizationId,
        "M6-C unauthorized actor candidate",
        "Fixture candidate for same-tenant unauthorized actor denial.",
        JSON.stringify({ verifier: "m6c-authority-negative" }),
        input.ownerRoleId,
        input.raiserPersonId,
        now,
      );
      await prisma.$executeRawUnsafe(
        'INSERT INTO candidate_tensions ("id", "organizationId", "title", "evidenceSummary", "sourceKind", "sourceRef", "ownerRoleId", "detectedById", "status", "suggestedMode", "detectedAt", "updatedAt") VALUES ($1, $2, $3, $4, \\'GOAL\\', $5::jsonb, $6, $7, \\'DETECTED\\', \\'TACTICAL\\', $8, $8)',
        input.crossTenantCandidateId,
        input.organizationId,
        "M6-C cross-tenant actor candidate",
        "Fixture candidate for cross-tenant actor denial.",
        JSON.stringify({ verifier: "m6c-cross-tenant-negative" }),
        input.ownerRoleId,
        input.raiserPersonId,
        now,
      );
      result.sameTenant = await attempt(
        "same-tenant unauthorized actor",
        input.sameTenantCandidateId,
        input.sameTenantTensionId,
        input.sameTenantUnauthorizedPersonId,
      );
      result.crossTenant = await attempt(
        "cross-tenant actor",
        input.crossTenantCandidateId,
        input.crossTenantTensionId,
        input.crossTenantPersonId,
      );
    } finally {
      await prisma.candidateTensionAuditEvent.deleteMany({ where: { organizationId: input.organizationId, candidateId: { in: [input.sameTenantCandidateId, input.crossTenantCandidateId] } } });
      await prisma.candidateTension.deleteMany({ where: { organizationId: input.organizationId, id: { in: [input.sameTenantCandidateId, input.crossTenantCandidateId] } } });
      await prisma.tension.deleteMany({ where: { organizationId: input.organizationId, id: { in: [input.sameTenantTensionId, input.crossTenantTensionId] } } });
      await prisma.person.deleteMany({ where: { id: input.sameTenantUnauthorizedPersonId, organizationId: input.organizationId } });
      await prisma.person.deleteMany({ where: { id: input.crossTenantPersonId, organizationId: input.crossTenantOrganizationId } });
      await prisma.circle.deleteMany({ where: { id: input.crossTenantCircleId, organizationId: input.crossTenantOrganizationId } });
      await prisma.organization.deleteMany({ where: { id: input.crossTenantOrganizationId } });
      await prisma.user.deleteMany({ where: { id: input.crossTenantUserId } });
      result.residueAfterCleanup = {
        sameTenantPeople: await prisma.person.count({ where: { id: input.sameTenantUnauthorizedPersonId, organizationId: input.organizationId } }),
        crossTenantPeople: await prisma.person.count({ where: { id: input.crossTenantPersonId, organizationId: input.crossTenantOrganizationId } }),
        crossTenantCircles: await prisma.circle.count({ where: { id: input.crossTenantCircleId, organizationId: input.crossTenantOrganizationId } }),
        crossTenantOrganizations: await prisma.organization.count({ where: { id: input.crossTenantOrganizationId } }),
        crossTenantUsers: await prisma.user.count({ where: { id: input.crossTenantUserId } }),
        tensions: await prisma.tension.count({ where: { organizationId: input.organizationId, id: { in: [input.sameTenantTensionId, input.crossTenantTensionId] } } }),
        candidates: await prisma.candidateTension.count({ where: { organizationId: input.organizationId, id: { in: [input.sameTenantCandidateId, input.crossTenantCandidateId] } } }),
        auditEvents: await prisma.candidateTensionAuditEvent.count({ where: { organizationId: input.organizationId, candidateId: { in: [input.sameTenantCandidateId, input.crossTenantCandidateId] } } }),
      };
      result.ok =
        result.sameTenant?.ok === true &&
        result.crossTenant?.ok === true &&
        Object.values(result.residueAfterCleanup).every((value) => value === 0);
      console.log(JSON.stringify(result));
      await prisma.$disconnect();
      await pool.end();
    }
  })().catch((error) => {
    console.error(error);
    process.exit(1);
  });
  `;
  const result = spawnSync("./node_modules/.bin/tsx", ["-e", code], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      M6C_ASSERTION_INPUT: JSON.stringify(input),
    },
    encoding: "utf8",
  });
  const stdout = (result.stdout ?? "").trim();
  const lastLine = stdout.split(/\r?\n/).filter(Boolean).at(-1);
  let parsed = null;
  try {
    parsed = lastLine ? JSON.parse(lastLine) : null;
  } catch (error) {
    parsed = { ok: false, parseError: error.message, stdout: stdout.slice(-1_000) };
  }
  return {
    ok: result.status === 0 && parsed?.ok === true,
    status: result.status,
    stdout: stdout.slice(-1_000),
    stderr: (result.stderr ?? "").slice(-1_000),
    result: parsed,
  };
}

async function runNegativeAssertions({ databaseUrl, baseUrl, page, fixture, suffix }) {
  const pool = new Pool({ connectionString: databaseUrl });
  const foreignOrgId = `m6b-negative-org-${suffix}`;
  const foreignCircleId = `m6b-negative-circle-${suffix}`;
  const foreignUserId = `m6b-negative-user-${suffix}`;
  const foreignPersonId = `m6b-negative-person-${suffix}`;
  const now = new Date();
  const assertions = [];
  const gaps = [];

  function pass(name, evidence) {
    assertions.push({ name, status: "pass", evidence });
  }

  function fail(name, evidence) {
    assertions.push({ name, status: "fail", evidence });
  }

  function gap(name, evidence) {
    assertions.push({ name, status: "gap", evidence });
    gaps.push(name);
  }

  try {
    await pool.query("BEGIN");
    await pool.query(`
      INSERT INTO users (id, email, name, "passwordHash", "createdAt", "updatedAt")
      VALUES ($1, $2, 'M6-B Foreign Actor', 'negative-fixture', $3, $3)
    `, [foreignUserId, `m6b-foreign-${suffix}@loopos.test`, now]);
    await pool.query(`
      INSERT INTO organizations (id, name, slug, purpose, "lifecycleStatus", "createdAt", "updatedAt")
      VALUES ($1, 'M6-B Foreign Org', $2, 'negative fixture', 'SETUP', $3, $3)
    `, [foreignOrgId, `m6b-negative-${suffix}`, now]);
    await pool.query(`
      INSERT INTO circles (id, "organizationId", name, number, type, purpose, status, phase, "createdAt", "updatedAt")
      VALUES ($1, $2, 'Foreign Main Circle', 'ZERO', 'STRATEGY', 'negative fixture', 'NORMAL', 'PHASE_0', $3, $3)
    `, [foreignCircleId, foreignOrgId, now]);
    await pool.query(`
      INSERT INTO people (id, "organizationId", name, email, "userId", "entityType", "homeCircleId", "createdAt", "updatedAt")
      VALUES ($1, $2, 'M6-B Foreign Actor', $3, $4, 'HUMAN', $5, $6, $6)
    `, [foreignPersonId, foreignOrgId, `m6b-foreign-${suffix}@loopos.test`, foreignUserId, foreignCircleId, now]);

    const serviceBoundary = runCandidateServiceBoundaryAssertion({ databaseUrl, fixture, suffix });
    if (serviceBoundary.ok && serviceBoundary.result?.crossTenant?.ok === true) {
      pass("cross-tenant denial", {
        boundary: "confirmCandidateTensionWithHuman",
        expectedError: serviceBoundary.result.crossTenant.error,
        candidateStatus: serviceBoundary.result.crossTenant.candidateStatus,
        auditEvents: serviceBoundary.result.crossTenant.auditEvents,
      });
    } else {
      fail("cross-tenant denial", {
        boundary: "confirmCandidateTensionWithHuman",
        serviceBoundary,
      });
    }

    if (serviceBoundary.ok && serviceBoundary.result?.sameTenant?.ok === true) {
      pass("unauthorized actor denial", {
        boundary: "confirmCandidateTensionWithHuman",
        expectedError: serviceBoundary.result.sameTenant.error,
        candidateStatus: serviceBoundary.result.sameTenant.candidateStatus,
        auditEvents: serviceBoundary.result.sameTenant.auditEvents,
      });
    } else {
      fail("unauthorized actor denial", {
        boundary: "confirmCandidateTensionWithHuman",
        serviceBoundary,
      });
    }

    const residueBeforeRollback = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM users WHERE id = $1) AS users,
        (SELECT count(*)::int FROM people WHERE id = $2) AS people,
        (SELECT count(*)::int FROM circles WHERE id = $3) AS circles,
        (SELECT count(*)::int FROM organizations WHERE id = $4) AS organizations,
        (SELECT count(*)::int FROM candidate_tension_audit_events WHERE id = $5) AS denied_audit_events
    `, [foreignUserId, foreignPersonId, foreignCircleId, foreignOrgId, `m6b-negative-audit-${suffix}`]);
    await pool.query("ROLLBACK");
    const residueAfterRollback = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM users WHERE id = $1) AS users,
        (SELECT count(*)::int FROM people WHERE id = $2) AS people,
        (SELECT count(*)::int FROM circles WHERE id = $3) AS circles,
        (SELECT count(*)::int FROM organizations WHERE id = $4) AS organizations,
        (SELECT count(*)::int FROM candidate_tension_audit_events WHERE id = $5) AS denied_audit_events
    `, [foreignUserId, foreignPersonId, foreignCircleId, foreignOrgId, `m6b-negative-audit-${suffix}`]);
    const zeroResidue = Object.values(residueAfterRollback.rows[0] ?? {}).every((value) => Number(value) === 0);
    const serviceBoundaryZeroResidue = serviceBoundary.result?.residueAfterCleanup
      ? Object.values(serviceBoundary.result.residueAfterCleanup).every((value) => Number(value) === 0)
      : false;
    if (zeroResidue && serviceBoundaryZeroResidue) {
      pass("zero residue", {
        rollbackOnly: true,
        transactionFixtureRowsBeforeRollback: residueBeforeRollback.rows[0],
        rowsAfterRollback: residueAfterRollback.rows[0],
        serviceBoundaryRowsAfterCleanup: serviceBoundary.result.residueAfterCleanup,
      });
    } else {
      fail("zero residue", {
        rollbackOnly: true,
        transactionFixtureRowsBeforeRollback: residueBeforeRollback.rows[0],
        rowsAfterRollback: residueAfterRollback.rows[0],
        serviceBoundaryRowsAfterCleanup: serviceBoundary.result?.residueAfterCleanup ?? null,
      });
    }
  } catch (error) {
    await pool.query("ROLLBACK").catch(() => {});
    fail("negative assertion harness", { message: error.message, code: error.code });
  }

  if (page) {
    try {
      await pool.query(`
        UPDATE organizations
        SET "lifecycleStatus" = 'SETUP', "updatedAt" = $2
        WHERE id = $1
      `, [fixture.organizationId, now]);
      await page.goto(`${baseUrl}/app/meetings/new`, { waitUntil: "networkidle" });
      const bodyText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
      const startButton = page.getByRole("button", { name: "发起会议" });
      const disabled = await startButton.first().isDisabled().catch(() => false);
      await pool.query(`
        UPDATE organizations
        SET "lifecycleStatus" = 'ACTIVE', "updatedAt" = $2
        WHERE id = $1
      `, [fixture.organizationId, now]);
      if (disabled || /启用组织|设置模式|完成初始设置/.test(bodyText)) {
        pass("invalid lifecycle denial", {
          lifecycleForcedTo: "SETUP",
          meetingStartButtonDisabled: disabled,
          pageContainedSetupGate: /启用组织|设置模式|完成初始设置/.test(bodyText),
        });
      } else {
        fail("invalid lifecycle denial", {
          lifecycleForcedTo: "SETUP",
          meetingStartButtonDisabled: disabled,
          pageSample: bodyText.slice(0, 500),
        });
      }
    } catch (error) {
      await pool.query(`
        UPDATE organizations
        SET "lifecycleStatus" = 'ACTIVE', "updatedAt" = $2
        WHERE id = $1
      `, [fixture.organizationId, now]).catch(() => {});
      if (error.code === "55000") {
        pass("invalid lifecycle denial", {
          boundary: "organization lifecycle trigger",
          attemptedTransition: "ACTIVE_TO_SETUP",
          sqlstate: error.code,
          message: error.message,
        });
      } else {
        fail("invalid lifecycle denial", { message: error.message, code: error.code });
      }
    }
  } else {
    gap("invalid lifecycle denial", {
      reason: "requires authenticated browser or service execution; readiness mode does not exercise lifecycle-gated UI/service paths",
    });
  }

  await pool.end();

  return {
    ok: assertions.every((assertion) => assertion.status === "pass"),
    assertions,
    gaps,
  };
}

async function createBrainConversation(page, baseUrl) {
  await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
  const workspaceButton = page.locator('[data-brain-mode="workspace"] button[aria-label="新建组织大脑对话"]');
  if (await workspaceButton.count()) {
    await workspaceButton.first().click();
  } else {
    await page.getByRole("button", { name: "新建组织大脑对话" }).first().click();
  }
  await page.waitForTimeout(2_000);
  const questionInputs = page.locator('textarea[placeholder*="询问角色"]');
  const question = questionInputs.nth(Math.max(0, await questionInputs.count() - 1));
  await question.fill("请准备 M6-B 本地集成验收所需的会议结果。");
  await page.getByRole("button", { name: "发送问题" }).last().click();
  await page.waitForTimeout(3_000);
  await page.reload({ waitUntil: "networkidle" });
}

async function openTacticalTensionStage(page) {
  await page.waitForLoadState("domcontentloaded");
  const stageButton = page.getByRole("button", { name: /张力清单与处理/ });
  if (await stageButton.count()) {
    await stageButton.first().click();
    return;
  }
  const footerLink = page.getByText(/进入张力清单/);
  if (await footerLink.count()) {
    await footerLink.first().click();
    return;
  }
  const bodyText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
  throw new Error(`tactical tension stage entry not found at ${page.url()}\n${bodyText.slice(0, 2_000)}`);
}

async function runBrowserJourney({ baseUrl, databaseUrl, screenshotDir }) {
  const { chromium } = require("playwright");
  const suffix = String(Date.now());
  const email = `m6b-admin-${suffix}@loopos.test`;
  const password = `M6b-admin-${suffix}!`;
  const orgName = `M6-B Admin ${suffix}`;
  const ledger = cleanLedger();
  const browser = await chromium.launch({ headless: true });
  try {
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    observe(desktop, baseUrl, ledger);
    await desktop.goto(`${baseUrl}/register`, { waitUntil: "networkidle" });
    await desktop.getByLabel("组织名称").fill(orgName);
    await desktop.getByLabel("你的姓名").fill("M6-B Admin");
    await desktop.getByLabel("邮箱").fill(email);
    await desktop.getByLabel("密码").fill(password);
    await desktop.getByRole("button", { name: "创建组织" }).click();
    await desktop.waitForURL(`${baseUrl}/app`, { timeout: 30_000 });

    const actor = await currentActor(databaseUrl, email);
    await completeUiSetupFacts(desktop, baseUrl, orgName);
    const seeded = await seedRemainingTrialFacts(databaseUrl, actor, suffix);

    await desktop.goto(`${baseUrl}/app/organization`, { waitUntil: "networkidle" });
    await desktop.getByRole("button", { name: "确认启用组织" }).click();
    await desktop.getByText("组织已启用").waitFor({ timeout: 30_000 });

    const formalTensionId = await createFormalTensionThroughUi(desktop, baseUrl, {
      title: "正式张力：M6-B 运营卡点",
      description: "用于确认候选张力的正式张力。",
      mode: "TACTICAL",
    });
    const governanceTensionId = await createFormalTensionThroughUi(desktop, baseUrl, {
      title: "治理张力：M6-B 权责边界",
      description: "用于验证治理会议形成结构调整。",
      mode: "GOVERNANCE",
    });

    await desktop.goto(`${baseUrl}/app/tensions`, { waitUntil: "networkidle" });
    const candidateCard = desktop
      .getByRole("heading", { name: "候选张力：M6-D 目标闭环缺少证据" })
      .locator("xpath=ancestor::article[1]");
    await candidateCard.getByText("确认为正式张力").waitFor();
    await candidateCard.locator('select[name="confirmedTensionId"]').selectOption(formalTensionId);
    await candidateCard.getByRole("button", { name: "确认" }).click();
    await desktop.locator("span").filter({ hasText: /^已确认$/ }).waitFor();

    const tacticalMeetingTitle = `M6-B 战术会 ${suffix}`;
    const tacticalOutcomeTitle = `M6-B 建立张力闭环行动 ${suffix}`;
    const governanceMeetingTitle = `M6-B 治理会 ${suffix}`;
    const governanceRoleName = `M6-B 治理验证角色 ${suffix}`;

    await desktop.goto(`${baseUrl}/app/meetings/new`, { waitUntil: "networkidle" });
    await desktop.getByLabel("会议主题").fill(tacticalMeetingTitle);
    await desktop.getByRole("button", { name: "发起会议" }).click();
    await desktop.waitForURL(/\/app\/meetings\/(?!new$)[^/]+$/, { timeout: 30_000 });
    const tacticalMeetingUrl = desktop.url();

    await desktop.goto(`${baseUrl}/app/meetings/new`, { waitUntil: "networkidle" });
    await desktop.getByLabel("会议主题").fill(governanceMeetingTitle);
    await desktop.locator('[data-slot="select-trigger"]').first().click();
    await desktop.getByRole("option", { name: /治理会/ }).click();
    await desktop.getByRole("button", { name: "发起会议" }).click();
    await desktop.waitForURL(/\/app\/meetings\/(?!new$)[^/]+$/, { timeout: 30_000 });
    const governanceMeetingUrl = desktop.url();

    await desktop.goto(`${baseUrl}/app/brain`, { waitUntil: "networkidle" });
    await desktop.locator("body").getByText(/组织大脑|Brain/).first().waitFor({ timeout: 30_000 });
    await desktop.screenshot({ path: `${screenshotDir}/desktop-brain.png`, fullPage: true });

    await createBrainConversation(desktop, baseUrl);
    const tacticalComposer = desktop.locator('[aria-labelledby="brain-tactical-outcome-heading"]');
    await tacticalComposer.waitFor({ state: "visible", timeout: 30_000 });
    await tacticalComposer.getByLabel("选择战术张力").selectOption({ label: "正式张力：M6-B 运营卡点" });
    await tacticalComposer.getByLabel("选择战术会议").selectOption({ label: tacticalMeetingTitle });
    await tacticalComposer.getByLabel("结果类型").selectOption("ACTION");
    await tacticalComposer.getByLabel("结果标题").fill(tacticalOutcomeTitle);
    await tacticalComposer.getByLabel("预期结果或验收标准").fill("每个候选张力都能被授权角色确认并进入会议处理。");
    await tacticalComposer.getByLabel("归属回路").selectOption({ index: 1 });
    await tacticalComposer.getByLabel("负责人").selectOption({ index: 1 });
    await tacticalComposer.getByRole("button", { name: "生成战术预览" }).click();
    await desktop.getByText("战术结果已生成待确认预览。").waitFor({ state: "visible", timeout: 30_000 });
    await desktop.getByRole("button", { name: "确认执行" }).last().click();
    await desktop.getByText("命令已确认执行").waitFor({ state: "visible", timeout: 30_000 });

    await desktop.goto(tacticalMeetingUrl, { waitUntil: "networkidle" });
    await openTacticalTensionStage(desktop);
    await desktop.getByText(new RegExp(tacticalOutcomeTitle)).waitFor({ state: "visible", timeout: 30_000 });
    await desktop.getByRole("button", { name: /记录会议通过并创建/ }).click();
    await desktop.getByText(/会议结果已记录|Action 已创建|Project 已创建/).waitFor({ state: "visible", timeout: 30_000 });

    await desktop.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
    const governanceComposer = desktop.locator('[aria-labelledby="brain-governance-composer-heading"]');
    await governanceComposer.waitFor({ state: "visible", timeout: 30_000 });
    await governanceComposer.getByLabel("选择张力").selectOption({ label: "治理张力：M6-B 权责边界" });
    await governanceComposer.getByLabel("选择治理会议").selectOption({ label: governanceMeetingTitle });
    await governanceComposer.getByLabel("当前结构").fill("当前结构没有专门承接 M6-B 治理验证的回路。");
    await governanceComposer.getByLabel("提议结构").fill(`新增 ${governanceRoleName}，承接治理验证责任。`);
    await governanceComposer.getByLabel("提案理由").fill("治理张力提出者需要通过会议确认结构边界。");
    await governanceComposer.getByLabel("预期影响").fill("形成可审计的结构调整结果，失败可通过新张力回归。");
    await governanceComposer.getByLabel("拟创建角色名称").fill(governanceRoleName);
    await governanceComposer.getByLabel("角色目的").fill("承接 M6-B 治理验证责任");
    await governanceComposer.getByLabel("角色职责").fill("维护治理验证证据\n推动会议裁决后的结构落地");
    await governanceComposer.getByRole("button", { name: "生成治理预览" }).click();
    await desktop.getByText("治理提案已生成待确认预览。").waitFor({ state: "visible", timeout: 30_000 });
    await desktop.getByRole("button", { name: "确认执行" }).last().click();
    await desktop.getByText("命令已确认执行").waitFor({ state: "visible", timeout: 30_000 });
    await desktop.goto(governanceMeetingUrl, { waitUntil: "networkidle" });
    await desktop.getByRole("button", { name: "初始化治理提案" }).click();
    await desktop.getByText("READY").waitFor({ state: "visible", timeout: 30_000 });
    await desktop.reload({ waitUntil: "networkidle" });
    await desktop.locator('textarea[name="note"]').last().fill("治理会议确认该结构调整可安全试行并正式采纳。");
    await desktop.getByRole("button", { name: /^采纳：/ }).last().click();
    await desktop.getByText("ADOPTED").waitFor({ state: "visible", timeout: 30_000 });

    const mobile = await browser.newPage({ viewport: { width: 390, height: 900 } });
    observe(mobile, baseUrl, ledger);
    await mobile.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    await mobile.getByLabel("邮箱").fill(email);
    await mobile.getByLabel("密码").fill(password);
    await mobile.getByRole("button", { name: "登录" }).click();
    await mobile.waitForURL(/\/app/, { timeout: 30_000 });
    await mobile.goto(`${baseUrl}/app/organization`, { waitUntil: "networkidle" });
    const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    await mobile.screenshot({ path: `${screenshotDir}/mobile-organization.png`, fullPage: true });

    const facts = await integratedFacts(
      databaseUrl,
      actor.organizationId,
      seeded.candidateId,
      tacticalOutcomeTitle,
      governanceRoleName,
    );
    const negativeAssertions = await runNegativeAssertions({
      databaseUrl,
      baseUrl,
      page: desktop,
      fixture: {
        organizationId: actor.organizationId,
        actorPersonId: actor.personId,
        homeCircleId: actor.homeCircleId,
        roleId: seeded.roleId,
        candidateId: seeded.candidateId,
      },
      suffix,
    });
    const ok = facts.lifecycle === "ACTIVE"
      && Number(facts.roles) >= 1
      && Number(facts.active_goal_cycles) >= 1
      && Number(facts.tactical_meetings) >= 1
      && Number(facts.governance_meetings) >= 1
      && facts.candidate_status === "CONFIRMED"
      && facts.confirmed_tension_id === formalTensionId
      && Number(facts.approved_tactical_outcomes) >= 1
      && Number(facts.assigned_actions) >= 1
      && Number(facts.adopted_governance_processes) >= 1
      && Number(facts.governance_outcome_roles) >= 1
      && !overflow
      && ledger.console.length === 0
      && ledger.page.length === 0
      && ledger.http.length === 0
      && negativeAssertions.ok;

    return {
      ok,
      readinessOnly: false,
      accepted: false,
      fixture: { organizationId: actor.organizationId },
      uiFirstSetupFacts: {
        organizationPurpose: true,
        structureInitialized: true,
        goalCycleCreated: true,
        formalTensionsCreated: true,
        organizationBrainModelSettingsVisibleOnly: true,
        tacticalTensionId: formalTensionId,
        governanceTensionId,
      },
      explicitFixturePreconditions: {
        tacticalCadence: true,
        organizationBrainModelProfile: true,
        goalProposalDecisionAdoptedGoalAndTarget: true,
        detectorAgent: true,
        candidateTension: true,
      },
      browser: {
        registered: true,
        activated: facts.lifecycle === "ACTIVE",
        candidateConfirmed: facts.candidate_status === "CONFIRMED",
        tacticalMeetingCreated: Number(facts.tactical_meetings) >= 1,
        governanceMeetingCreated: Number(facts.governance_meetings) >= 1,
        tacticalOutcomeApproved: Number(facts.approved_tactical_outcomes) >= 1,
        actionAssigned: Number(facts.assigned_actions) >= 1,
        governanceProcessAdopted: Number(facts.adopted_governance_processes) >= 1,
        governanceRoleCreated: Number(facts.governance_outcome_roles) >= 1,
        brainVisited: true,
        mobileOverflow: overflow,
      },
      facts,
      negativeAssertions,
      ledger,
      screenshots: [`${screenshotDir}/desktop-brain.png`, `${screenshotDir}/mobile-organization.png`],
      nonClaims: [
        "This browser mode proves a local integrated browser path before independent review.",
        "No production deployment refresh is claimed.",
        "No real-team longitudinal completion is claimed.",
      ],
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  const mode = option("--mode", "readiness");
  const runsBrowserJourney = mode === "browser" || mode === "full";
  const baseUrl = option("--base-url", "http://127.0.0.1:3001").replace(/\/+$/, "");
  const screenshotDir = option("--screenshot-dir", `/tmp/loopos-m6b-${Date.now()}`);
  const tempDatabaseName = option("--temp-db-name", `loopos_m6b_${Date.now()}`);
  const defaultDatabaseUrl = option("--default-database-url", process.env.DEFAULT_DATABASE_URL ?? process.env.DATABASE_URL);
  const prepareDisposable = option("--prepare-disposable-db", "false") === "true";
  const dropDisposable = option("--drop-disposable-db-after-check", "false") === "true";
  mkdirSync(screenshotDir, { recursive: true });

  const artifacts = requiredArtifacts().map((path) => ({ path, exists: existsSync(path) }));
  const disposable = {
    requested: prepareDisposable,
    databaseName: prepareDisposable ? tempDatabaseName : null,
    created: false,
    migrated: null,
    dropped: false,
    existsAfterDrop: null,
  };
  let databaseUrl = process.env.DATABASE_URL;
  if (prepareDisposable) {
    if (!defaultDatabaseUrl) throw new Error("--prepare-disposable-db requires --default-database-url or DATABASE_URL");
    databaseUrl = databaseUrlForName(defaultDatabaseUrl, tempDatabaseName);
    await createDatabase(defaultDatabaseUrl, tempDatabaseName);
    disposable.created = true;
    disposable.migrated = runMigrations(databaseUrl);
  }

  const db = await databaseReadiness(databaseUrl).catch((error) => ({
    ok: false,
    reason: error.message,
  }));

  const browserResult = runsBrowserJourney
    ? await runBrowserJourney({ baseUrl, databaseUrl, screenshotDir })
    : null;

  if (dropDisposable && prepareDisposable && defaultDatabaseUrl) {
    await dropDatabase(defaultDatabaseUrl, tempDatabaseName);
    disposable.dropped = true;
    disposable.existsAfterDrop = await databaseExists(defaultDatabaseUrl, tempDatabaseName);
  }

  const output = {
    ok:
      (mode === "readiness" || mode === "browser" || mode === "full")
      && artifacts.every((artifact) => artifact.exists)
      && (!prepareDisposable || disposable.migrated?.ok)
      && db.ok
      && (!dropDisposable || (disposable.dropped && disposable.existsAfterDrop === 0))
      && (!runsBrowserJourney || browserResult?.ok),
    mode: "m6b-local-integrated-trial",
    accepted: false,
    readinessOnly: !runsBrowserJourney,
    screenshotDir,
    artifacts,
    disposable,
    database: db,
    browserResult,
    plannedBrowserJourney: plannedBrowserJourney(),
    setupFactClassification: setupFactClassification(),
    nonClaims: runsBrowserJourney ? [
      "M6-D browser/full mode is local evidence only; independent review is still required before acceptance.",
      "No production deployment refresh is claimed.",
      "No real-team longitudinal completion is claimed.",
      "No automatic sensing, unsupervised AI execution, or BioCoach integration is claimed.",
    ] : [
      "M6-D browser journey is not executed by readiness mode.",
      "V6-M6 is not accepted.",
      "No production deployment refresh is claimed.",
      "No real-team longitudinal completion is claimed.",
      "No automatic sensing, unsupervised AI execution, or BioCoach integration is claimed.",
    ],
    nextImplementationRequired: runsBrowserJourney ? [
      "Send M6-D for independent implementation review and roadmap/evidence audit.",
      "Keep only explicit-fixture-precondition facts SQL seeded and visible in evidence.",
      "Keep production deployment, BioCoach isolation, and real-team longitudinal evidence as separate unclaimed gates.",
    ] : [
      "Run browser/full mode against a disposable migrated database and local production server.",
      "Complete browser/full proof for UI-capable setup facts before accepting M6-D.",
      "Assert PostgreSQL authority/isolation outcomes and zero residue.",
      "Capture desktop and mobile clean ledgers.",
    ],
  };

  console.log(JSON.stringify(output, null, 2));
  if (!output.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
