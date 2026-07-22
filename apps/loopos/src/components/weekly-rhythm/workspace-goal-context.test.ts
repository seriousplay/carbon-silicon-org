import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./workspace-goal-context.tsx", import.meta.url), "utf8");

test("compact context renders exact Goal, meeting, evidence, and work source links", () => {
  assert.match(source, /goal\.url/);
  assert.match(source, /meeting\.url/);
  assert.match(source, /effectiveEvidence\.meetingUrl/);
  assert.match(source, /effectiveEvidence\.sourceUrl/);
  assert.match(source, /work\.url/);
  assert.match(source, /projection\.allGoalsUrl/);
});

test("hasMore is explicit and does not silently truncate the Workspace context", () => {
  assert.match(source, /projection\.hasMore/);
  assert.match(source, /查看全部目标/);
  assert.match(source, /goal\.targetsHasMore/);
  assert.match(source, /还有更多指标/);
  assert.match(source, /goal\.meetingsHasMore/);
  assert.match(source, /还有更多相关战术会/);
  assert.match(source, /goal\.workLinksHasMore/);
  assert.match(source, /还有更多关联工作/);
});

test("empty, unavailable, ownership gap, stale evidence, and missing evidence are honest", () => {
  for (const text of [
    "当前没有进行中的目标周期",
    "当前没有与你相关的主目标",
    "目标上下文暂时不可用",
    "责任角色当前未激活",
    "责任角色尚未分配",
    "已超过更新节奏",
    "尚无进展证据",
  ]) {
    assert.match(source, new RegExp(text));
  }
  assert.doesNotMatch(source, />\s*(?:ACTIVE|ARCHIVED|AT_RISK|OFF_TRACK|NOT_UPDATED|PROJECT|ACTION)\s*</);
});

test("the section remains compact, mobile-safe, and keyboard reachable without authoring controls", () => {
  assert.match(source, /aria-labelledby="workspace-goal-context-title"/);
  assert.match(source, /min-w-0/);
  assert.match(source, /break-words/);
  assert.match(source, /flex-wrap/);
  assert.match(source, /<Link/);
  assert.doesNotMatch(source, /<form|<button|proposal|draft|capabilit|GoalTree/i);
  assert.doesNotMatch(source, /rounded-(?:card|xl|2xl|3xl)/);
});
