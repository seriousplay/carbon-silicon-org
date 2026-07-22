#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";

const FILES = {
  validation: "docs/evidence/2026-07-16-v5-m5b-production-validation.md",
  brainBoundary: "docs/evidence/2026-07-16-v5-m5b-brain-reader-production-boundary.md",
  brainReadiness: "docs/evidence/2026-07-17-v5-m6-0-brain-reader-readiness.md",
  securityReview: "docs/evidence/2026-07-17-v5-m6-0-security-review.md",
  roadmapAudit: "docs/evidence/2026-07-17-v5-m5b-final-roadmap-audit.md",
  recovery: "docs/evidence/2026-07-16-v5-m5b-production-recovery-proof.md",
  goals: "GOALS.md",
  dashboard: "progress-dashboard.html",
  httpVerifier: "scripts/verify-production-http.mjs",
  authHttpVerifier: "scripts/m5b-production-auth-http-smoke.mjs",
  browserSmoke: "scripts/m5b-production-browser-smoke.cjs",
  brainBoundaryVerifier: "scripts/verify-production-brain-reader-boundary.mjs",
  brainReadinessVerifier: "scripts/verify-production-brain-reader-readiness.mjs",
  brainIsolationVerifier: "scripts/verify-production-brain-reader-isolation.mjs",
  brainMutationVerifier: "scripts/verify-production-brain-reader-mutation-denial.mjs",
  brainReaderBrowserSmoke: "scripts/m6-0-production-brain-reader-browser-smoke.cjs",
  tenantIsolationBrowserSmoke: "scripts/m6-0-production-brain-reader-tenant-isolation.cjs",
  longitudinalVerifier: "scripts/verify-m5b-longitudinal-real-team.mjs",
};

function parseArgs(argv) {
  const options = { json: false };
  for (const arg of argv) {
    if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/verify-m5b-acceptance-state.mjs [--json]

Summarizes the current M5-B evidence ledger. It is intentionally conservative:
any explicit unproven production gate keeps accepted=false.
`);
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function containsAll(text, snippets) {
  return snippets.every((snippet) => text.includes(snippet));
}

function containsNone(text, snippets) {
  return snippets.every((snippet) => !text.includes(snippet));
}

function gate(name, status, detail, evidence = []) {
  return { name, status, detail, evidence };
}

async function readRequired(path) {
  return readFile(path, "utf8");
}

async function readOptional(path) {
  return await fileExists(path) ? readFile(path, "utf8") : "";
}

async function buildState() {
  const [
    validation,
    brainBoundary,
    brainReadiness,
    securityReview,
    roadmapAudit,
    recovery,
    goals,
    dashboard,
  ] = await Promise.all([
    readRequired(FILES.validation),
    readRequired(FILES.brainBoundary),
    readRequired(FILES.brainReadiness),
    readOptional(FILES.securityReview),
    readOptional(FILES.roadmapAudit),
    readRequired(FILES.recovery),
    readRequired(FILES.goals),
    readRequired(FILES.dashboard),
  ]);

  const scriptEntries = await Promise.all(
    Object.entries(FILES)
      .filter(([, path]) => path.startsWith("scripts/"))
      .map(async ([key, path]) => [key, path, await fileExists(path)]),
  );

  const scriptGates = scriptEntries.map(([key, path, exists]) =>
    gate(
      `script:${key}`,
      exists ? "pass" : "missing",
      `${path} ${exists ? "exists" : "is missing"}`,
      [path],
    ),
  );

  const finalRoadmapAuditPassed = containsAll(roadmapAudit, [
    "Conclusion: ACCEPT M5-B AND ACTIVATE M6-1",
    "No P0/P1/P2 findings.",
    "BioCoach remains isolated",
  ]);

  const roadmapDashboardSynced = finalRoadmapAuditPassed
      ? containsAll(goals, [
        "M5-B is accepted",
        "## Active Milestone\n\n### V5-M6",
        "BioCoach remains a separate application and database boundary",
      ]) && containsNone(goals, [
        "M5-B is not accepted yet",
        "M6 remains pending",
        "only final roadmap reclosure pending",
      ]) && containsAll(dashboard, [
        "V5-M6 Active",
        "BioCoach remains isolated",
        "M5-B is accepted",
      ]) && containsNone(dashboard, [
        "V5-M5-B production validation is active",
        "final roadmap audit remains",
        "The final roadmap audit is the only remaining M5-B gate.",
      ])
    : containsAll(goals, [
        "M5-B is not accepted yet",
        "production technical Brain Reader gate has passed",
        "BioCoach remains a separate application and database boundary",
      ]) && containsNone(goals, [
        "## Active Goal\n\n### V5-M4",
        "future readiness verifier exists and currently fails",
        "Brain readiness is now the only active M5-B closure gate",
      ]) && containsAll(dashboard, [
        "V5-M5-B production validation is active",
        "BioCoach remains isolated",
        '<span class="muted">Pending milestones</span><strong>1</strong>',
        '<span class="muted">Evidence blockers</span><strong>1</strong>',
      ]) && containsNone(dashboard, [
        '<span class="muted">Pending milestones</span><strong>0</strong>',
        '<span class="muted">Evidence blockers</span><strong>2</strong>',
        "Production BRAIN_DATABASE_URL is not configured",
        "future readiness verification exists and fails until BRAIN_DATABASE_URL is configured",
      ]);

  const gates = [
    gate(
      "production-release",
      containsAll(validation, [
        "Release id: `20260716-135813-m5b-trial`",
        "Remote current release: `/var/www/loopos/releases/20260716-135813-m5b-trial`",
        "found 26 migrations and no pending migrations",
        "`loopos-web`: online",
        "`loopos-worker`: online",
      ]) ? "pass" : "missing",
      "release identity, migration count, and PM2 online readback are recorded",
      [FILES.validation],
    ),
    gate(
      "public-http",
      containsAll(validation, [
        "`https://csi-org.com/loopos`: `200`",
        "`https://csi-org.com/loopos/`: `308`, `location: /loopos`",
        "`https://csi-org.com/loopos/login`: `200`",
        "`https://csi-org.com/loopos/api/auth/session`: `200`",
      ]) ? "pass" : "missing",
      "public HTTP evidence is recorded",
      [FILES.validation, FILES.httpVerifier],
    ),
    gate(
      "authenticated-http",
      containsAll(validation, [
        "Authenticated `https://csi-org.com/loopos/app`: `200`",
        "Authenticated `https://csi-org.com/loopos/app/brain`: `200`",
        "Residue check returned `users=0`, `organizations=0`, `sessions=0`",
      ]) ? "pass" : "missing",
      "authenticated HTTP smoke and cleanup are recorded",
      [FILES.validation, FILES.authHttpVerifier],
    ),
    gate(
      "authenticated-browser-interaction",
      containsAll(validation, [
        "Final browser metadata URL:",
        "`https://csi-org.com/loopos/app/brain`",
        "four primary entries `工作台 / 目标 / 会议 / 组织`",
        "This proves authenticated browser form login and read-only navigation",
      ]) ? "pass" : "missing",
      "browser form login and Organization Brain navigation are recorded",
      [FILES.validation],
    ),
    gate(
      "brain-boundary-safe-blocked",
      containsAll(brainBoundary, [
        "\"ok\": true",
        "\"ready\": false",
        "\"brainDatabaseUrlConfigured\": false",
        "\"login-role-absent\"",
        "Production Organization Brain dynamic database reads are not claimed ready",
      ]) ? "pass" : "missing",
      "safe blocked Brain reader boundary is recorded",
      [FILES.brainBoundary, FILES.brainBoundaryVerifier],
    ),
    gate(
      "brain-readiness",
      containsAll(brainReadiness, [
        "`ok=true`",
        "`ready=true`",
        "Application and Brain credentials: different.",
        "exactly `20/20` approved security-barrier views are readable",
        "a nonexistent forged actor context returns no actor or organization row",
      ]) ? "pass" : "missing",
      "dedicated production Brain reader readiness is recorded",
      [FILES.brainReadiness, FILES.brainReadinessVerifier],
    ),
    gate(
      "biocoach-cross-database-isolation",
      containsAll(brainReadiness, [
        "`biocoach` | `biocoach` | no | no | connection denied `42501`",
        "BioCoach data was not migrated, queried, or modified.",
        "No BioCoach schema, table, row, credential,",
        "`brain-biocoach-connection-denied`: pass, SQLSTATE `42501`",
        "`application-biocoach-connection-denied`: pass, SQLSTATE `42501`",
        "`https://daodecision.com/biocoach`: `200`",
      ]) ? "pass" : "missing",
      "BioCoach remains a separate application and database security domain",
      [FILES.brainReadiness, FILES.brainIsolationVerifier],
    ),
    gate(
      "brain-mutation-denial",
      containsAll(brainReadiness, [
        "no direct canonical organization-table read",
        "no insert, update, or delete privilege",
        "denial SQLSTATE `42501`",
      ]) ? "pass" : "missing",
      "Brain reader canonical-table access and mutation are denied",
      [FILES.brainReadiness, FILES.brainMutationVerifier],
    ),
    gate(
      "authenticated-brain-read",
      containsAll(brainReadiness, [
        "the exact organization name appeared as a returned fact",
        "server responses with status `>=500`: `0`",
        "browser console/page errors: `0`",
        "`accounts=0`",
      ]) ? "pass" : "missing",
      "authenticated Brain read and smoke cleanup are recorded",
      [FILES.brainReadiness, FILES.brainReaderBrowserSmoke],
    ),
    gate(
      "cross-tenant-brain-read",
      containsAll(brainReadiness, [
        "Each actor asked the same organization-name question.",
        "zero occurrences of the other",
        "HTTP `4xx`: `0`",
        "HTTP `5xx`: `0`",
        "Both final temporary organizations were removed.",
      ]) ? "pass" : "missing",
      "two production browser tenants read only their own organization facts and leave zero residue",
      [FILES.brainReadiness, FILES.tenantIsolationBrowserSmoke],
    ),
    gate(
      "independent-security-review",
      containsAll(securityReview, [
        "Conclusion: PASS",
        "No P0/P1/P2 findings.",
        "BioCoach data isolation",
      ]) ? "pass" : "blocked",
      containsAll(securityReview, [
        "Conclusion: PASS",
        "No P0/P1/P2 findings.",
        "BioCoach data isolation",
      ])
        ? "independent security review passed"
        : securityReview
          ? "independent security review evidence is incomplete"
          : "independent security review is pending",
      [FILES.securityReview],
    ),
    gate(
      "final-roadmap-audit",
      finalRoadmapAuditPassed ? "pass" : "blocked",
      finalRoadmapAuditPassed
        ? "final roadmap acceptance audit passed"
        : roadmapAudit
          ? "final roadmap audit evidence is incomplete"
          : "final roadmap acceptance audit is pending",
      [FILES.roadmapAudit],
    ),
    gate(
      "bounded-recovery-proof",
      containsAll(recovery, [
        "current=/var/www/loopos/releases/20260716-115933-m5b",
        "previous_exists=yes",
        "next_node_modules=present",
        "This is a bounded recovery proof, not a rollback switch drill.",
      ]) ? "pass" : "missing",
      "bounded recovery proof is recorded",
      [FILES.recovery],
    ),
    gate(
      "rollback-switch-proof",
      containsAll(recovery, [
        "The bounded recovery proof is sufficient for M5-B production recovery",
        "Do not execute an extra rollback symlink switch drill for M5-B solely",
        "No rollback symlink switch was executed after the recovery.",
      ])
        ? "pass"
        : "missing",
      "product-owner decision accepts bounded recovery proof without extra rollback switch drill",
      [FILES.recovery],
    ),
    gate(
      "screenshot-browser-evidence",
      containsAll(validation, [
        "docs/evidence/assets/2026-07-16-v5-m5b-organization-brain-production.png",
        "c7b3eb8405e26b39c186269f1a03e19f5367290ba871797c8e4267f53542f8fb",
        "left `aria-busy=true`",
        "Residue check returned `users=0`, `people=0`, `organizations=0`,",
      ])
        ? "pass"
        : "missing",
      "screenshot-based authenticated browser evidence and cleanup are recorded",
      [FILES.validation],
    ),
    gate(
      "longitudinal-real-team",
      containsAll(validation, ["No real-team longitudinal operation evidence is claimed."])
        && containsAll(goals, ["Real-team longitudinal evidence is deferred to M6-6"])
        ? "deferred"
        : "missing",
      "real-team longitudinal evidence is explicitly unproven and deferred to M6-6",
      [FILES.validation],
    ),
    gate(
      "roadmap-dashboard-synced",
      roadmapDashboardSynced ? "pass" : "missing",
      finalRoadmapAuditPassed
        ? "GOALS.md and progress-dashboard.html reflect accepted M5-B and active M6-1"
        : "GOALS.md and progress-dashboard.html reflect current M5-B state",
      [FILES.goals, FILES.dashboard],
    ),
    ...scriptGates,
  ];

  const summary = {
    pass: gates.filter((item) => item.status === "pass").length,
    blocked: gates.filter((item) => item.status === "blocked").length,
    missing: gates.filter((item) => item.status === "missing").length,
    deferred: gates.filter((item) => item.status === "deferred").length,
  };

  return {
    accepted: summary.blocked === 0 && summary.missing === 0,
    activeMilestone: finalRoadmapAuditPassed ? "V5-M6-1" : "V5-M5-B",
    summary,
    gates,
  };
}

function printHuman(state) {
  console.log(`accepted=${state.accepted ? "true" : "false"}`);
  console.log(`summary pass=${state.summary.pass} blocked=${state.summary.blocked} missing=${state.summary.missing} deferred=${state.summary.deferred}`);
  for (const item of state.gates) {
    console.log(`${item.status.toUpperCase()} ${item.name}: ${item.detail}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const state = await buildState();
  if (options.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    printHuman(state);
  }
  if (!state.accepted) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
