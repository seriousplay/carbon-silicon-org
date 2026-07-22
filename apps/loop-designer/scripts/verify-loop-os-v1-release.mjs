#!/usr/bin/env node

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const statusUrl = readArg("--status-url") || process.env.LOOP_OS_STATUS_URL;
const localOnly = args.has("--local-only");
const skipBuild = args.has("--skip-build");
const skipMatrix = args.has("--skip-matrix");

const localGates = [
  ["npx", ["eslint", "src/lib/loop-os-v1-acceptance.test.ts", "src/lib/loop-assets-core.test.ts", "src/lib/memory-context-core.test.ts", "src/lib/org-profile-core.test.ts", "src/lib/matrix-study-payload.test.ts"]],
  ["npx", ["tsc", "--noEmit", "--pretty", "false"]],
  ["npm", ["test"]],
];

if (!skipBuild) localGates.push(["npm", ["run", "build"]]);

const fullReleaseGates = [
  ["node", ["scripts/verify-loop-os-v1.mjs"]],
  ["node", ["scripts/verify-loop-os-v1.mjs", "--write-probe"]],
];

if (statusUrl) {
  fullReleaseGates.push(["node", ["-e", "const url = process.argv[1]; const response = await fetch(url); const body = await response.text(); if (!response.ok) throw new Error(`${response.status} ${body}`); console.log(body);", statusUrl]]);
} else if (!localOnly) {
  console.log("SKIP remote status endpoint check: set LOOP_OS_STATUS_URL or pass --status-url.");
}

if (!skipMatrix && existsSync(resolve(root, "../matrix-origin/package.json"))) {
  fullReleaseGates.push(["npm", ["run", "verify:matrix-loop"], { cwd: resolve(root, "../matrix-origin") }]);
} else if (!localOnly && skipMatrix) {
  console.log("SKIP Matrix Origin verification: --skip-matrix was provided.");
}

console.log(`Loop OS v1 release gate: ${localOnly ? "local-only" : "full"}`);

for (const gate of localGates) run(gate);

if (!localOnly) {
  for (const gate of fullReleaseGates) run(gate);
}

console.log("PASS Loop OS v1 release gate");

function run([command, commandArgs, options = {}]) {
  const cwd = options.cwd || root;
  console.log(`\n$ ${command} ${commandArgs.join(" ")}`);
  const result = spawnSync(command, commandArgs, {
    cwd,
    env: process.env,
    shell: false,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function readArg(name) {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  if (index !== -1) return process.argv[index + 1];
  return undefined;
}
