import { readFile } from "node:fs/promises";

const operations = [
  "ROLE_CREATED",
  "ROLE_MODIFIED",
  "ROLE_ARCHIVED",
  "CIRCLE_CREATED",
  "CIRCLE_MODIFIED",
  "HOME_CHANGE",
  "AGENT_CREATED",
  "CHARTER_CREATED",
  "CHARTER_AMENDED",
];

const files = {
  parser: "src/lib/governance-change.ts",
  executor: "src/lib/governance-decision.ts",
  workbench: "src/app/app/meetings/[id]/governance-workbench.tsx",
};

const sources = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([name, file]) => [name, await readFile(file, "utf8")] )));
const brainSource = await readFile("src/lib/organization-brain/command-preview-service.ts", "utf8");
const missing = [];
for (const operation of operations) {
  for (const [name, source] of Object.entries(sources)) {
    if (!source.includes(operation)) missing.push(`${name}:${operation}`);
  }
}
if (!brainSource.includes("governance_proposal.create")) missing.push("brain:governance_proposal.create");
if (missing.length > 0) {
  console.error(JSON.stringify({ ok: false, missing }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, operations, files }, null, 2));
