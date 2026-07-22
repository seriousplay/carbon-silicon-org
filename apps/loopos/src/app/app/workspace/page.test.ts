import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workspaceSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const loadingSource = readFileSync(new URL("./loading.tsx", import.meta.url), "utf8");
const errorSource = readFileSync(new URL("./error.tsx", import.meta.url), "utf8");

test("workspace only exposes the dedicated setup path for pristine organizations", () => {
  assert.doesNotMatch(workspaceSource, /href=["']\/app\/circles\/new["']/);
  assert.doesNotMatch(workspaceSource, /手动建立回路/);
  assert.match(workspaceSource, /href=["']\/app\/setup["']/);
});

test("workspace setup link opts out of native button semantics", () => {
  assert.match(
    workspaceSource,
    /<Button nativeButton=\{false\} render=\{<Link href=["']\/app\/setup["'] \/>\}>/,
  );
});

test("workspace renders the current person's weekly executable queue", () => {
  assert.match(workspaceSource, /getWeeklyRhythm\(orgId, person!\.id\)/);
  assert.match(workspaceSource, /<WeeklyRhythmQueue items=\{weeklyRhythm\} \/>/);
});

test("workspace loads the tenant-bounded compact Goal context in parallel", () => {
  assert.match(workspaceSource, /queryWorkspaceGoalContext\(/);
  assert.match(workspaceSource, /organizationId: orgId/);
  assert.match(workspaceSource, /viewerPersonId: person!\.id/);
  assert.match(workspaceSource, /<WorkspaceGoalContext projection=\{workspaceGoals\} \/>/);
  assert.doesNotMatch(workspaceSource, /queryGoalTree/);
});

test("compact Goal context sits after weekly rhythm and before frequent work navigation", () => {
  const weeklyQueue = workspaceSource.indexOf("<WeeklyRhythmQueue");
  const goalContext = workspaceSource.indexOf("<WorkspaceGoalContext");
  const frequentWork = workspaceSource.indexOf('<nav aria-label="常用工作"');

  assert.ok(weeklyQueue >= 0);
  assert.ok(goalContext > weeklyQueue);
  assert.ok(frequentWork > goalContext);
});

test("workspace preserves one-click access to frequent execution surfaces", () => {
  for (const href of ["/app/projects", "/app/tracker", "/app/tensions", "/app/review"]) {
    assert.match(workspaceSource, new RegExp(`href: ["']${href.replaceAll("/", "\\/")}["']`));
  }
});

test("workspace keeps session and organization resolution on the server page", () => {
  assert.doesNotMatch(workspaceSource, /^["']use client["']/m);
  assert.match(workspaceSource, /await getCurrentPerson\(\)/);
  assert.match(workspaceSource, /await getCurrentOrgId\(\)/);
});

test("workspace has route-level loading and retryable error states", () => {
  assert.match(loadingSource, /aria-label="正在加载工作台"/);
  assert.match(errorSource, /^["']use client["'];/);
  assert.match(errorSource, /unstable_retry: \(\) => void/);
  assert.match(errorSource, /onClick=\{\(\) => unstable_retry\(\)\}/);
});
