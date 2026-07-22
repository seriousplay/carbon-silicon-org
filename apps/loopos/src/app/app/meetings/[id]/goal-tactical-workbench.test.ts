import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const workbenchSource = readFileSync(new URL("./goal-tactical-workbench.tsx", import.meta.url), "utf8");

test("TACTICAL mounts a dedicated Goal workbench beside the unchanged tension processor", () => {
  assert.match(pageSource, /queryTacticalGoalMeeting\(/);
  assert.match(pageSource, /organizationId: orgId/);
  assert.match(pageSource, /viewerPersonId: currentPerson\.id/);
  assert.match(pageSource, /meeting\.type === "TACTICAL"[\s\S]*<MeetingTensionProcessor[\s\S]*<GoalTacticalWorkbench/);
  assert.match(pageSource, /meeting\.type === "STRATEGY"[\s\S]*<GoalStrategyWorkbench/);
  assert.match(pageSource, /meeting\.type === "GOVERNANCE"[\s\S]*<GovernanceWorkbench/);
});

test("unavailable, no-Circle, no-Goal, ended, and nonparticipant states are explicit", () => {
  for (const text of [
    "目标跟进数据当前不可用",
    "本次战术会尚未关联回路",
    "本回路在当前周期没有进行中的主目标",
    "会议已结束，仅可查看",
    "你不是本次会议参与人，仅可查看",
  ]) assert.match(workbenchSource, new RegExp(text));
});

test("Goal context shows health, evidence age, full correction history, provenance, and source links", () => {
  for (const token of [
    "goal.health",
    "effectiveEvidence",
    "evidenceIsStale",
    "target.evidence",
    "isSuperseded",
    "supersedesCheckInId",
    "recorder.name",
    "meetingUrl",
    "sourceUrl",
    "createdBy.name",
    "removedBy",
    "removalReason",
    "ageLabel",
  ]) assert.match(workbenchSource, new RegExp(token.replace(".", "\\.")));
});

test("evidence and work-link capabilities remain separate", () => {
  assert.match(workbenchSource, /meeting\.canAppendEvidence/);
  assert.match(workbenchSource, /meeting\.canManageWorkLinks/);
  assert.doesNotMatch(workbenchSource, /canOperate/);
});

test("owner assignee preview discloses exact total and further assignees", () => {
  assert.match(workbenchSource, /ownerRole\.assigneeCount/);
  assert.match(workbenchSource, /ownerRole\.assigneesHasMore/);
  assert.match(workbenchSource, /共 \{goal\.ownerRole\.assigneeCount\} 位/);
  assert.match(workbenchSource, /还有更多/);
  assert.doesNotMatch(workbenchSource, /meeting\.participants/);
});

test("bounded history and candidate probes are disclosed without client clock drift", () => {
  for (const token of ["evidenceHasMore", "workLinksHasMore", "approvedOutcomesHasMore", "blockingTensionsHasMore"]) {
    assert.match(workbenchSource, new RegExp(token));
  }
  assert.match(workbenchSource, /仅显示最近 50 条/);
  assert.match(workbenchSource, /仍有更多候选/);
  assert.doesNotMatch(workbenchSource, /Date\.now\(|formatEvidenceAge/);
});

test("NUMERIC and MILESTONE forms support ACHIEVED requirements and append-only correction", () => {
  assert.match(workbenchSource, /target\.kind === "NUMERIC"/);
  assert.match(workbenchSource, /name="currentValue"/);
  assert.match(workbenchSource, /name="milestoneCompleted"/);
  assert.match(workbenchSource, /name="acceptanceEvidence"/);
  assert.match(workbenchSource, /value="ACHIEVED"/);
  assert.match(workbenchSource, /name="supersedesCheckInId"/);
  assert.match(workbenchSource, /纠正此条证据/);
  assert.doesNotMatch(workbenchSource, /updateGoalCheckIn|editGoalCheckIn|deleteGoalCheckIn/);
});

test("three work-link kinds use trusted candidates and active links require a removal reason", () => {
  for (const token of ["candidates.projects", "candidates.actions", "candidates.blockingTensions"]) {
    assert.match(workbenchSource, new RegExp(token.replace(".", "\\.")));
  }
  assert.match(workbenchSource, /name="kind"/);
  assert.match(workbenchSource, /name="workObjectId"/);
  assert.match(workbenchSource, /name="linkId"/);
  assert.match(workbenchSource, /name="reason"/);
  assert.match(workbenchSource, /移除关联/);
});

test("forms suppress pending duplicate clicks, never auto-retry, and map only public errors", () => {
  assert.match(workbenchSource, /useActionState/);
  assert.match(workbenchSource, /disabled=\{pending/);
  assert.match(workbenchSource, /冲突，请刷新后确认最新状态/);
  assert.doesNotMatch(workbenchSource, /setTimeout|retry\(|自动重试|mutationKey|exactly.once|幂等/i);
  for (const code of ["INVALID_INPUT", "NOT_AVAILABLE", "CONFLICT", "TEMPORARY_FAILURE"]) {
    assert.match(workbenchSource, new RegExp(code));
  }
});

test("the responsive workbench stays unframed and does not render raw identifiers or enum labels", () => {
  assert.match(workbenchSource, /grid-cols-1[\s\S]*lg:grid-cols-2/);
  assert.doesNotMatch(workbenchSource, /rounded-card|shadow-soft/);
  assert.doesNotMatch(workbenchSource, /目标编号|证据编号|关联编号|内部代码|>\s*(?:PROJECT|ACTION|BLOCKING_TENSION)\s*</);
  assert.match(workbenchSource, /在目标树查看/);
});
