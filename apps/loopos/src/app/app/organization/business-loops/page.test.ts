import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const subnavSource = readFileSync(new URL("../organization-subnav.tsx", import.meta.url), "utf8");
const structureMapSource = readFileSync(new URL("../../circles/map/page.tsx", import.meta.url), "utf8");

test("business loop page lives under Organization and stays read-only", () => {
  assert.match(pageSource, /getBusinessLoopReadModel/);
  assert.match(pageSource, /OrganizationSubnav active="business-loops"/);
  assert.match(pageSource, /业务回路/);
  assert.match(pageSource, /价值与数据流/);
  assert.match(pageSource, /model\.source === "persisted"/);
  assert.match(pageSource, /正式业务回路数据/);
  assert.match(pageSource, /只读观察视图/);
  assert.match(pageSource, /model\.persistedLoops\.map/);
  assert.match(pageSource, /\/app\/circles\/\$\{activity\.circleId\}/);
  assert.match(pageSource, /\/app\/roles\/\$\{activity\.ownerRoleId\}/);
  assert.match(pageSource, /href="\/app\/interfaces"/);
  assert.doesNotMatch(pageSource, /<form|action=|创建业务回路|提交治理|候选张力/);
});

test("organization structure and business loops are parallel views", () => {
  assert.match(subnavSource, /概览/);
  assert.match(subnavSource, /组织结构/);
  assert.match(subnavSource, /业务回路/);
  assert.match(subnavSource, /我的角色/);
  assert.match(subnavSource, /角色市场/);
  assert.match(subnavSource, /治理记录/);
  assert.match(subnavSource, /\/app\/circles\/map/);
  assert.match(subnavSource, /\/app\/organization\/business-loops/);
  assert.match(structureMapSource, /OrganizationSubnav active="structure"/);
});
