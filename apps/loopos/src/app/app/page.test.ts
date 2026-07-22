import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const homeSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const layoutSource = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
const sidebarSource = readFileSync(
  new URL("../../components/layout/sidebar.tsx", import.meta.url),
  "utf8",
);

test("/app is the Organization Brain home with the actor-scoped home projection", () => {
  assert.match(homeSource, /<BrainClient mode="workspace"/);
  assert.match(homeSource, /getOrganizationBrainHomeReadModel/);
  assert.match(homeSource, /<BrainHomeContext projection=\{projection\}/);
  assert.match(homeSource, /组织大脑/);
  assert.doesNotMatch(homeSource, /getCurrentPerson|getCurrentOrgId|prisma|queryWorkspaceGoalContext/);
  assert.doesNotMatch(homeSource, /WeeklyRhythmQueue|WorkspaceGoalContext/);
});

test("Organization Brain home is an operational command center without changing the projection or client mode", () => {
  assert.match(homeSource, /data-brain-command-center="true"/);
  assert.match(homeSource, /组织大脑/);
  assert.match(homeSource, /协作工作区/);
  assert.match(homeSource, /权限边界已启用/);
  assert.match(homeSource, /<BrainHomeContext projection=\{projection\} \/>/);
  assert.match(homeSource, /<BrainClient mode="workspace"/);
  assert.ok(
    homeSource.indexOf("<BrainClient mode=\"workspace\"")
      < homeSource.indexOf("<BrainHomeContext projection={projection}"),
    "the Brain interaction workspace must precede the sensing projection",
  );
  assert.match(homeSource, /className="min-h-\[27rem\] md:min-h-\[30rem\]"/);
  assert.doesNotMatch(homeSource, /gradient|purple|violet|indigo|orb|particle/i);
});

test("authenticated primary navigation is exactly the four daily entries", () => {
  const primaryItems = layoutSource.slice(
    layoutSource.indexOf("const primaryItems"),
    layoutSource.indexOf("const isOrgAdmin"),
  );

  const entries = [
    ["/app/workspace", "工作"],
    ["/app/goals", "目标"],
    ["/app/meetings", "会议"],
    ["/app/organization", "组织"],
  ];
  for (const [href, label] of entries) {
    assert.match(primaryItems, new RegExp(`href: ["']${href.replaceAll("/", "\\/")}["']`));
    assert.match(primaryItems, new RegExp(`label: ["']${label}["']`));
  }
  assert.equal((primaryItems.match(/href:/g) ?? []).length, 4);
  for (const href of ["/app", "/app/brain", "/app/interfaces", "/app/setup", "/app/notifications"]) {
    assert.doesNotMatch(primaryItems, new RegExp(`href: ["']${href.replaceAll("/", "\\/")}["']`));
  }
});

test("organization identity links home to the Brain", () => {
  assert.match(sidebarSource, /<Link href="\/app" className="flex items-center gap-2\.5">/);
});

test("organization setup and interfaces remain admin-only secondary utilities", () => {
  assert.match(layoutSource, /const isOrgAdmin = membership\?\.role === "ORG_ADMIN"/);
  assert.match(layoutSource, /isOrgAdmin=\{isOrgAdmin\}/);
  assert.doesNotMatch(layoutSource, /adminItems/);
});
