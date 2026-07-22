#!/usr/bin/env node
import { readFileSync } from "node:fs";

const files = {
  goals: "GOALS.md",
  plan: "docs/plans/2026-07-20-v6-ai-native-organization-bootstrap-implementation-plan.md",
  contract: "docs/plans/2026-07-21-v6-m6a-integrated-trial-contract.md",
  harness: "docs/evidence/2026-07-21-v6-m6a-evidence-harness.md",
  dashboard: "progress-dashboard.html",
};

function read(path) {
  return readFileSync(path, "utf8");
}

function includesAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}

const goals = read(files.goals);
const plan = read(files.plan);
const contract = read(files.contract);
const harness = read(files.harness);
const dashboard = read(files.dashboard);

const checks = [
  {
    id: "single-active-goal",
    ok:
      goals.includes("### V6-M6 - Integrated Acceptance and Real-Team Trial")
      && goals.includes("Status: active. This is the only active Goal.")
      && !goals.includes("### V6-M5 - Candidate Tension Sensing\n\nStatus: active"),
    note: "GOALS represents V6-M6, not V6-M5, as the single active Goal.",
  },
  {
    id: "m6a-current-slice",
    ok:
      goals.includes("Current bounded slice: V6-M6-A Integrated Trial Contract and Evidence Harness.")
      && plan.includes("Current bounded slice: M6-A integrated trial contract and evidence harness."),
    note: "M6-A is the current bounded slice in roadmap and plan.",
  },
  {
    id: "contract-required-journey",
    ok: includesAll(contract, [
      "Register or create an organization in `SETUP`.",
      "Activate the organization through the accepted readiness and authority gate.",
      "Create the first goal cycle and a main goal for the root structure.",
      "Run a tactical meeting that reviews operating health",
      "Run a governance meeting when structure, role, domain, accountability, or",
      "Use the Organization Brain to read organization facts",
    ]),
    note: "Contract covers the integrated setup-to-closure user journey.",
  },
  {
    id: "evidence-class-separation",
    ok: includesAll(contract, [
      "| Source/static |",
      "| Local browser |",
      "| PostgreSQL |",
      "| Production |",
      "| Isolation |",
      "| UX review |",
      "| Longitudinal real-team |",
    ]),
    note: "Contract keeps evidence classes separated.",
  },
  {
    id: "non-claims-preserved",
    ok: includesAll(contract, [
      "A real team has completed the trial.",
      "Production deployment has been refreshed for this milestone.",
      "Automatic sensing policies are active.",
      "AI can create formal `Tension` records without human confirmation.",
      "BioCoach data is integrated or readable by LoopOS.",
    ]),
    note: "Contract states M6-A non-claims.",
  },
  {
    id: "harness-inventory",
    ok: includesAll(harness, [
      "| Trial contract |",
      "| Local integrated browser |",
      "| PostgreSQL authority/isolation |",
      "| Production evidence |",
      "| BioCoach isolation |",
      "| UX review |",
      "| Longitudinal real-team |",
      "M6-A is not accepted yet.",
      "V6-M6 is not accepted yet.",
    ]),
    note: "Harness inventory names all required gates and current non-accepted state.",
  },
  {
    id: "dashboard-current-state",
    ok:
      dashboard.includes("V6-M6 Active")
      && dashboard.includes("Current slice is M6-A integrated trial contract and evidence harness")
      && dashboard.includes("V6-M6 is not accepted until local, production, isolation, review, and real-team evidence all pass"),
    note: "Dashboard reports M6-A as active without claiming V6-M6 acceptance.",
  },
];

const ok = checks.every((check) => check.ok);

console.log(JSON.stringify({ ok, mode: "v6-m6a-contract", checks }, null, 2));

if (!ok) {
  process.exit(1);
}
