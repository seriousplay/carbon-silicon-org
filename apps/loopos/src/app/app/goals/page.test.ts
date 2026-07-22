import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const errorSource = readFileSync(new URL("./error.tsx", import.meta.url), "utf8");
const workspaceSource = readFileSync(new URL("./goal-tree-workspace.tsx", import.meta.url), "utf8");
const draftFormSource = readFileSync(new URL("./goal-draft-form.tsx", import.meta.url), "utf8");

test("Goals page resolves the actor and delegates its tenant-scoped read", () => {
  assert.match(pageSource, /async function GoalsPage/);
  assert.match(pageSource, /searchParams:\s*GoalsSearchParams/);
  assert.match(pageSource, /const params = await searchParams/);
  assert.match(pageSource, /typeof value === "string" \? value : undefined/);
  assert.match(pageSource, /await resolveActorContext\(\)/);
  assert.match(pageSource, /queryGoalTree\(/);
  assert.match(pageSource, /organizationId: actor\.organizationId/);
  assert.match(pageSource, /viewerPersonId: actor\.personId/);
  assert.match(pageSource, /\{ prisma, now: new Date\(\) \}/);
});

test("Goals page renders honest READY, EMPTY, TRUNCATED, and NOT_AVAILABLE states", () => {
  assert.match(pageSource, /projection\.status === "READY"/);
  assert.match(pageSource, /import \{ GoalTreeWorkspace \} from "\.\/goal-tree-workspace"/);
  assert.match(pageSource, /<GoalTreeWorkspace projection=\{projection\}/);
  assert.match(pageSource, /projection\.status === "EMPTY"/);
  assert.match(pageSource, /尚未建立目标循环/);
  assert.match(pageSource, /projection\.status === "TRUNCATED"/);
  assert.match(pageSource, /目标树数据超出安全展示范围/);
  assert.match(pageSource, /这个目标视图当前不可用/);
  assert.match(pageSource, /href="\/app\/goals"/);
  assert.match(errorSource, /^"use client";/);
  assert.match(errorSource, /unstable_retry/);
  assert.match(errorSource, /href="\/app\/goals"/);
});

test("Goals server page has no write or unrelated capability boundary", () => {
  assert.doesNotMatch(
    pageSource,
    /createGoalProposal|appendGoalProposalRevision|submitGoalProposal|withdrawGoalProposal|\.(?:create|update|upsert|delete|createMany|updateMany|deleteMany)\s*\(/,
  );
  assert.doesNotMatch(
    pageSource,
    /strategic|tactical|governance|organization-brain|Brain|Meeting|Tension/,
  );
});

test("Goals selects provide human-readable trigger labels without duplicate target kinds", () => {
  assert.match(
    workspaceSource,
    /items=\{cycleOptions\.map\(\(cycle\) => \(\{\s*value: cycle\.id,\s*label: cycle\.name,\s*\}\)\)\}/,
  );
  assert.match(
    draftFormSource,
    /items=\{ownerRoleOptions\.map\(\(role\) => \(\{\s*value: role\.id,\s*label: role\.name,\s*\}\)\)\}/,
  );
  assert.match(draftFormSource, /items=\{\{ NUMERIC: "数值", MILESTONE: "里程碑" \}\}/);
  assert.equal(draftFormSource.match(/<SelectItem value="MILESTONE">/g)?.length, 1);
  assert.match(draftFormSource, /<Label htmlFor=\{`\$\{baseId\}-metric`\}>关联指标（可选）<\/Label>/);
  assert.match(draftFormSource, /\.\.\.metricOptions\.map\(\(metric\) => \(\{ value: metric\.id, label: metric\.name \}\)\)/);
  assert.match(draftFormSource, /<SelectItem value="__NONE__">不关联指标<\/SelectItem>/);
  assert.match(draftFormSource, /value=\{target\.metricId \|\| "__NONE__"\}/);
  assert.match(draftFormSource, /\.\.\.\(target\.metricId\.trim\(\) \? \{ metricId: target\.metricId \} : \{\}\)/);
  assert.doesNotMatch(draftFormSource, /指标 ID|<Input[^>]+metricId/);
});

test("Goals renders every actionable proposal for the selected Circle before the new draft form", () => {
  assert.match(
    workspaceSource,
    /const actionableProposals = selectedNode\s*\? projection\.actionableProposals\.filter\(\s*\(proposal\) => proposal\.circleId === selectedNode\.circle\.id,?\s*\)/,
  );
  assert.doesNotMatch(workspaceSource, /projection\.proposals\.find\(/);
  assert.doesNotMatch(workspaceSource, /projection\.proposals\.filter\([\s\S]{0,200}canAppendRevision/);
  assert.match(workspaceSource, /actionableProposals\.map\(\(proposal\) => \(/);
  assert.match(workspaceSource, /key=\{proposal\.id\}[\s\S]*proposal=\{proposal\}/);
  assert.match(
    workspaceSource,
    /\)\)\s*: \(\s*<GoalDraftForm\s*cycleId=\{projection\.cycle\.id\}\s*node=\{selectedNode\}\s*suggestedParentGoal=\{suggestedParentGoal\}\s*\/>/,
  );
});

test("Goal actionable lifecycle shows a human-readable revision title without an internal ID fallback", () => {
  assert.match(
    draftFormSource,
    /const actionableRevisionTitle = proposal\?\.revision\?\.title\?\.trim\(\)\s*\|\| proposal\?\.revision\?\.conclusion\?\.trim\(\)\s*\|\| "修订标题不可用"/,
  );
  assert.match(
    draftFormSource,
    /proposal\.status === "DRAFT" \|\| proposal\.status === "SUBMITTED"[\s\S]*if \(actionableLifecycle && proposal\)[\s\S]*\{actionableRevisionTitle\}/,
  );
  assert.doesNotMatch(draftFormSource, /const actionableRevisionTitle =[^;]*proposal\.id/);
});

test("Goal revision owner options pin exact named Roles and never render a raw Role ID fallback", () => {
  assert.match(
    draftFormSource,
    /const ownerRoleOptions = pinnedOwnerRoleOptions\(\s*revision\?\.ownerRole,\s*node\.goal\?\.ownerRole,\s*node\.draftOwnerRoles,\s*\)/,
  );
  assert.match(
    draftFormSource,
    /useState\(revision\?\.ownerRole\?\.id \?\? node\.goal\?\.ownerRole\?\.id \?\? ownerRoleOptions\[0\]\?\.id \?\? ""\)/,
  );
  assert.match(draftFormSource, /ownerRoleOptions\.map\(\(role\) => \([\s\S]*\{role\.name\}/);
  assert.doesNotMatch(draftFormSource, /useState\(revision\?\.ownerRoleId/);
  assert.doesNotMatch(draftFormSource, /<SelectValue[^>]*>\s*\{ownerRoleId\}/);
});

test("new Goal drafts remount the revision editor across cycles and nodes", () => {
  assert.match(
    draftFormSource,
    /<GoalRevisionEditor\s*key=\{`\$\{cycleId\}-\$\{node\.id\}-\$\{kind\}`\}\s*cycleId=\{cycleId\}\s*node=\{node\}/,
  );
  assert.doesNotMatch(
    draftFormSource,
    /<GoalRevisionEditor\s*key=\{kind\}\s*cycleId=\{cycleId\}\s*node=\{node\}/,
  );
});

test("Goals draft headings use render-unique IDs for desktop and mobile details", () => {
  assert.match(workspaceSource, /const draftHeadingId = useId\(\)/);
  assert.match(workspaceSource, /aria-labelledby=\{draftHeadingId\}/);
  assert.match(workspaceSource, /id=\{draftHeadingId\}/);
  assert.doesNotMatch(workspaceSource, /goal-draft-heading/);
});

test("Goal Target fieldset has a direct legend while preserving its visible toolbar", () => {
  assert.match(
    draftFormSource,
    /<fieldset className="space-y-3" disabled=\{pending\}>\s*<legend[^>]*>目标判据<\/legend>\s*<div className="flex items-center justify-between gap-3">\s*<span[^>]*>目标判据<\/span>/,
  );
});

test("Goals date formatting is locked to the zh-CN product timezone", () => {
  assert.equal(workspaceSource.match(/timeZone: "Asia\/Shanghai"/g)?.length, 2);
});

test("Goal browser renders names and localized statuses without visible internal IDs or enum fallbacks", () => {
  for (const token of [
    "goal.parentGoal.title",
    "evidence.recorder.name",
    "source.recorder.name",
    "target.metric.name",
    "修正记录",
    "workStatusLabel(work)",
  ]) {
    assert.equal(workspaceSource.includes(token), true, `missing ${token}`);
  }
  assert.doesNotMatch(workspaceSource, /Goal ID|记录人 ID|来源议案 Target|sourceProposalTargetId|supersedesCheckInId\}<\/span>|Metric：\$\{target\.metricId\}|当前状态 \{work\.objectStatus\}/);
  assert.doesNotMatch(workspaceSource, /\?\? item\.targetId|proposalId\}/);
  for (const mapping of [
    'ACTIVE: "进行中"',
    'COMPLETED: "已完成"',
    'OPEN: "待指派"',
    'BLOCKED: "受阻"',
    'RESOLVED: "已闭环"',
  ]) assert.equal(workspaceSource.includes(mapping), true, `missing ${mapping}`);
  assert.match(workspaceSource, /labels\[work\.objectStatus\] \?\? "状态未知"/);
});

test("Goal browser exposes bounded preview and proposal pagination metadata", () => {
  for (const token of [
    "projection.cyclesHasMore",
    "node.draftOwnerRolesHasMore",
    "node.draftMetricsHasMore",
    "goal.workLinksHasMore",
    "role.assigneeCount",
    "pagination.hasPrevious",
    "pagination.hasNext",
  ]) {
    assert.equal(`${workspaceSource}\n${draftFormSource}`.includes(token), true, `missing ${token}`);
  }
  assert.match(pageSource, /proposalPage: parsePage\(params\.proposalPage\)/);
});
