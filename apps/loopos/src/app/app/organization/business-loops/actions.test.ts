import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const panel = readFileSync(new URL("./business-loop-authoring-panel.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("M3-D authoring requires ORG_ADMIN and only writes Business Loop draft tables", () => {
  assert.match(source, /membership\?\.role !== "ORG_ADMIN"/);
  assert.match(source, /businessLoop\.create/);
  assert.match(source, /businessLoop\.updateMany/);
  assert.match(source, /existingDraft/);
  assert.match(source, /existingActivity/);
  assert.match(source, /existingEdge/);
  assert.match(source, /existingEvidence/);
  assert.match(source, /businessLoopVersion\.create/);
  assert.match(source, /businessLoopActivity\.create/);
  assert.match(source, /businessLoopEdge\.create/);
  assert.match(source, /businessLoopEvidenceRef\.create/);
  assert.match(source, /publishBusinessLoopDraftAction/);

  for (const forbidden of [
    "circle.create",
    "circle.update",
    "roleDef.create",
    "roleDef.update",
    "circleInterface.create",
    "circleInterface.update",
    "governanceProposal",
    "tension.create",
    "candidate",
    "biocoach",
  ]) {
    assert.doesNotMatch(source, new RegExp(forbidden, "i"));
  }
});

test("M3-D authoring validates references instead of mutating governance structure", () => {
  assert.match(source, /ensureCircle/);
  assert.match(source, /ensureRole/);
  assert.match(source, /ensureInterface/);
  assert.match(source, /status: "DRAFT"/);
  assert.match(source, /circle\.findFirst/);
  assert.match(source, /roleDef\.findFirst/);
  assert.match(source, /circleInterface\.findFirst/);
  assert.match(panel, /角色、职责、任命、决策权和组织结构变更仍然需要通过治理流程/);
});

test("M3-D authoring is visible only for admins and keeps the read projection on the same page", () => {
  assert.match(page, /membership\?\.role === "ORG_ADMIN"/);
  assert.match(page, /BusinessLoopAuthoringPanel/);
  assert.match(page, /getBusinessLoopReadModel/);
  assert.match(panel, /新建草稿/);
  assert.match(panel, /添加活动/);
  assert.match(panel, /添加流动/);
  assert.match(panel, /添加证据标签/);
});

test("M3-E publish confirms a draft version without governance structure writes", () => {
  assert.match(source, /status: "PUBLISHED"/);
  assert.match(source, /status: "SUPERSEDED"/);
  assert.match(source, /status: "ACTIVE"/);
  assert.match(source, /publishedLoop\?\.versions\[0\]/);
  assert.match(source, /业务回路已经是正式版本/);
  assert.match(source, /发布前至少需要一个活动和一个价值或数据流/);
  assert.match(panel, /发布正式版本/);
  assert.match(page, /已发布/);
  assert.match(page, /草稿/);
});
