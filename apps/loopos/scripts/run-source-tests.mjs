import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const sourceRoot = resolve(repoRoot, "src");
const summaryFields = ["tests", "pass", "fail", "cancelled", "skipped", "todo"];

function discoverTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return discoverTests(path);
    return /\.test\.tsx?$/.test(entry.name) ? [relative(repoRoot, path)] : [];
  });
}

export function parseTapSummary(output) {
  const values = new Map();
  for (const match of output.matchAll(/^# (tests|pass|fail|cancelled|skipped|todo) (\d+)\r?$/gm)) {
    if (values.has(match[1])) throw new Error(`duplicate TAP summary field: ${match[1]}`);
    values.set(match[1], Number(match[2]));
  }
  const missing = summaryFields.filter((field) => !values.has(field));
  if (missing.length > 0) throw new Error(`invalid TAP summary; missing: ${missing.join(", ")}`);

  const summary = Object.fromEntries(summaryFields.map((field) => [field, values.get(field)]));
  const accounted = summary.pass + summary.fail + summary.cancelled + summary.skipped + summary.todo;
  if (summary.tests !== accounted) {
    throw new Error(`invalid TAP summary counts: tests=${summary.tests}, accounted=${accounted}`);
  }
  return summary;
}

export function runSourceTests() {
  const discovered = discoverTests(sourceRoot).sort();
  if (discovered.length === 0) {
    console.error("Source test discovery returned zero files.");
    return 1;
  }

  if (new Set(discovered).size !== discovered.length) {
    console.error("Source test discovery returned duplicate file identities.");
    return 1;
  }

  const executed = [];
  const failures = [];
  let totalTests = 0;

  for (const testFile of discovered) {
    executed.push(testFile);
    const result = spawnSync(
      process.execPath,
      ["--test-reporter=tap", "--import", "tsx", testFile],
      { cwd: repoRoot, encoding: "utf8", env: process.env },
    );
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    process.stdout.write(`\n## ${testFile}\n${output}`);

    let executedTests = 0;
    try {
      const summary = parseTapSummary(output);
      executedTests = summary.tests;
      if (summary.fail > 0 || summary.cancelled > 0) {
        failures.push(`${testFile} (TAP fail=${summary.fail}, cancelled=${summary.cancelled})`);
      }
    } catch (error) {
      failures.push(`${testFile} (${error instanceof Error ? error.message : "invalid TAP summary"})`);
    }
    totalTests += executedTests;

    if (result.status !== 0 || executedTests === 0) {
      failures.push(`${testFile} (status=${result.status ?? "spawn-error"}, tests=${executedTests})`);
    }
  }

  const executionIdentityMatches = executed.length === discovered.length
    && executed.every((testFile, index) => testFile === discovered[index])
    && new Set(executed).size === executed.length;

  if (!executionIdentityMatches) {
    failures.push(
      `identity/count drift (discovered=${discovered.length}, executed=${executed.length}, unique=${new Set(executed).size})`,
    );
  }
  if (totalTests === 0) failures.push("zero tests executed");

  console.log(`\nSource test files: discovered=${discovered.length}, executed=${executed.length}, tests=${totalTests}`);
  if (failures.length > 0) {
    console.error(`Source test runner failed:\n- ${failures.join("\n- ")}`);
    return 1;
  }
  return 0;
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  process.exitCode = runSourceTests();
}
