import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const workbenchSource = readFileSync(
  new URL("./goal-strategy-workbench.tsx", import.meta.url),
  "utf8",
);

test("STRATEGY uses the dedicated tenant-scoped Goal workbench", () => {
  assert.match(pageSource, /queryStrategicGoalMeeting\(/);
  assert.match(pageSource, /organizationId: orgId/);
  assert.match(pageSource, /viewerPersonId: currentPerson\.id/);
  assert.match(pageSource, /meeting\.type === "STRATEGY"[\s\S]*<GoalStrategyWorkbench/);
  assert.match(pageSource, /目标决策工作台/);
  assert.match(pageSource, /href="\/app\/goals"/);
  assert.match(pageSource, /meeting\.type === "TACTICAL"[\s\S]*<MeetingTensionProcessor/);
  assert.match(pageSource, /searchParams: Promise<Record<string, string \| string\[\] \| undefined>>/);
  assert.match(pageSource, /proposalPage: parsePage\(query\.proposalPage\)/);
  assert.match(pageSource, /decisionPage: parsePage\(query\.decisionPage\)/);
  assert.match(pageSource, /typeof value !== "string" \|\| !\/\^\[1-9\]\\d\*\$\//);
});

test("STRATEGY uses accurate meeting language", () => {
  assert.match(pageSource, /STRATEGY: "战略会"/);
  assert.match(pageSource, /STRATEGY: "审阅本回路目标提案，通过会议形成分布式决策。"/);
  assert.doesNotMatch(pageSource, /战略回路|决定做什么样的模型/);
});

test("every submitted proposal is rendered with one stable decision form", () => {
  assert.match(workbenchSource, /projection\.proposals\.map\(\(proposal\) =>/);
  assert.match(workbenchSource, /useState\(\(\) => crypto\.randomUUID\(\)\)/);
  assert.match(workbenchSource, /recordGoalDecisionAction\.bind\(null, proposal\.id, meetingId\)/);
  assert.match(workbenchSource, /name="expectedRevision" value=\{proposal\.currentRevision\.revision\}/);
  assert.match(workbenchSource, /name="mutationKey" value=\{mutationKey\}/);
});

test("the shared note form offers three explicit outcomes without a default", () => {
  assert.equal(workbenchSource.match(/name="outcome"/g)?.length, 3);
  for (const outcome of ["ADOPTED", "RETURNED", "DECLINED"]) {
    assert.match(workbenchSource, new RegExp(`value="${outcome}"`));
  }
  assert.doesNotMatch(workbenchSource, /type="hidden" name="outcome"|defaultValue="ADOPTED"|checked/);
  assert.match(workbenchSource, /<Textarea[\s\S]*name="note"/);
});

test("adoption follows cycle capability while return and decline remain available", () => {
  assert.match(
    workbenchSource,
    /disabled=\{pending \|\| !proposal\.canAdopt \|\| noteTooLong\}[\s\S]*value="ADOPTED"/,
  );
  assert.equal(
    workbenchSource.match(/disabled=\{pending \|\| noteTooLong\}[\s\S]*?value="(?:RETURNED|DECLINED)"/g)?.length,
    2,
  );
  assert.match(workbenchSource, /周期未激活，当前不能通过，可退回或不采纳/);
});

test("Target positions are rendered as one-based labels", () => {
  assert.match(workbenchSource, /\{target\.position \+ 1\}\. \{target\.label\}/);
  assert.doesNotMatch(workbenchSource, /\{target\.position\}\. \{target\.label\}/);
});

test("success messages do not expose internal decision IDs", () => {
  assert.match(workbenchSource, /决策已记录：\{outcomeLabel\(success\.outcome\)\}，修订 \{success\.revision\}/);
  assert.doesNotMatch(workbenchSource, /success\.decisionId|决策编号/);
});

test("notes preserve the server UTF-8 byte boundary", () => {
  assert.match(workbenchSource, /new TextEncoder\(\)\.encode\(note\.trim\(\)\)\.byteLength/);
  assert.match(workbenchSource, /noteBytes > 2_000/);
  assert.match(workbenchSource, /value=\{note\}/);
  assert.match(workbenchSource, /onChange=\{\(event\) => setNote\(event\.target\.value\)\}/);
  assert.match(workbenchSource, /超过 2000 UTF-8 字节/);
  assert.equal(workbenchSource.match(/noteTooLong\}/g)?.length, 3);
});

test("proposal context and durable decision provenance remain visible", () => {
  for (const token of [
    "currentRevision.targets",
    "replacedGoal",
    "ownerRole",
    "parentGoal",
    "projection.decisions",
    "decision.revision",
    "decision.recorder.name",
    "decision.note",
    "decision.decidedAt",
    "decision.adoptedGoal",
    "decision.terminalGoal",
  ]) {
    assert.match(workbenchSource, new RegExp(token.replace(".", "\\.")));
  }
});

test("strategic workbench uses exact participant metadata and named Metric projections", () => {
  assert.match(workbenchSource, /projection\.meeting\.participantCount/);
  assert.doesNotMatch(workbenchSource, /meeting\.participants/);
  assert.match(workbenchSource, /target\.metric\.name/);
  assert.doesNotMatch(workbenchSource, /target\.metricId|指标 ID/);
});

test("denied, ended, empty, unavailable, success, and fixed error states are honest", () => {
  for (const text of [
    "目标决策数据当前不可用",
    "本回路没有待决策的目标提案",
    "会议已结束",
    "你不是本次会议参与人",
    "提案人不在本次会议参与人中",
    "决策已记录",
    "STALE_REVISION",
    "RETRY_CONFLICT",
    "TEMPORARY_FAILURE",
  ]) {
    assert.match(workbenchSource, new RegExp(text));
  }
  assert.match(workbenchSource, /aria-live="polite"/);
  assert.match(workbenchSource, /disabled=\{pending \|\|/);
  assert.match(workbenchSource, /projection\.status === "TRUNCATED"/);
  assert.match(workbenchSource, /目标提案判据超出安全展示范围/);
});

test("the client workbench has no unrelated meeting or Brain capability imports", () => {
  assert.doesNotMatch(
    workbenchSource,
    /from ["'][^"']*(?:tension-processor|governance-workbench|organization-brain|brain-client)[^"']*["']/i,
  );
});

test("proposal and decision pagination are independent and preserve each other", () => {
  assert.equal(workbenchSource.match(/<PaginationLinks/g)?.length, 2);
  assert.match(workbenchSource, /pagination=\{projection\.proposalPagination\}/);
  assert.match(workbenchSource, /pagination=\{projection\.decisionPagination\}/);
  assert.match(workbenchSource, /pageKind="proposal"/);
  assert.match(workbenchSource, /pageKind="decision"/);
  assert.match(workbenchSource, /params\.set\("proposalPage", String\(nextProposalPage\)\)/);
  assert.match(workbenchSource, /params\.set\("decisionPage", String\(nextDecisionPage\)\)/);
  assert.match(workbenchSource, /href=\{pageHref\(pagination\.page - 1\)\}/);
  assert.match(workbenchSource, /href=\{pageHref\(pagination\.page \+ 1\)\}/);
  assert.match(workbenchSource, /ChevronLeft/);
  assert.match(workbenchSource, /ChevronRight/);
});
