import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BrainAnswer,
  BrainUserMessage,
  PrivateBriefPanel,
  createBrainActionInvoker,
  createBrainRequestMemory,
  formatUntitledConversationLabel,
  markBrainRequestTemporaryFailure,
  memoryCandidateDraftFromSignal,
  restoreQuestionFocus,
} from "./brain-client";

const source = readFileSync(new URL("./brain-client.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../../app/app/layout.tsx", import.meta.url), "utf8");
const temporaryFailure = {
  ok: false,
  code: "TEMPORARY_FAILURE",
  message: "组织大脑暂时不可用，请稍后重试。",
} as const;

test("Brain client explicitly renders every accepted stored status and answer section", () => {
  for (const status of [
    "ANSWERED",
    "EVIDENCE_ONLY",
    "INSUFFICIENT_EVIDENCE",
    "DENIED",
    "REJECTED",
    "UNAVAILABLE",
    "FAILED",
  ]) {
    assert.match(source, new RegExp(status));
  }
  for (const section of ["已确认组织记忆", "确认事实", "推断", "建议", "缺失证据", "来源"]) {
    assert.match(source, new RegExp(section));
  }
});

test("Brain answer renders confirmed memory as read-only evidence with correction entry", () => {
  const markup = renderToStaticMarkup(createElement(BrainAnswer, {
    result: {
      schemaVersion: 1,
      status: "ANSWERED",
      code: "ANSWERED",
      message: "已基于授权证据生成回答。",
      confirmedMemory: [{
        label: "已确认组织记忆",
        candidateId: "mc-memory-secret",
        claim: "本周期主目标是完成治理闭环",
        rationale: "已经通过授权流程确认。",
        authorityRoute: {
          kind: "GOVERNANCE",
          label: "治理会议确认",
          applicationUrl: "/app/governance/decisions/decision-1",
        },
        sourceRefs: [{
          type: "decision",
          id: "decision-1",
          label: "治理决议",
          applicationUrl: "/app/governance/decisions/decision-1",
          observedAt: "2026-07-14T08:00:00.000Z",
        }],
        confirmedBy: {
          type: "person",
          id: "person-a",
          label: "主回路成员",
        },
        validFrom: "2026-07-14T08:00:00.000Z",
        validUntil: null,
        applicationUrl: "/app/brain/memory-candidates/mc-memory-secret",
        correctionUrl: "/app/tensions/new?memoryCandidateId=mc-memory-secret",
      }],
      facts: [],
      inferences: [],
      recommendations: [],
      missingEvidence: [],
      sources: [],
    },
  }));

  assert.match(markup, /已确认组织记忆/);
  assert.match(markup, /本周期主目标是完成治理闭环/);
  assert.match(markup, /治理确认/);
  assert.match(markup, /治理决议/);
  assert.match(markup, /提出纠偏张力/);
  assert.doesNotMatch(markup, />mc-memory-secret</);
});

test("all rejected action promises become the fixed temporary failure", async () => {
  const secret = "raw database or transport error";
  const reject = async () => {
    throw new Error(secret);
  };
  const actions = createBrainActionInvoker({
    create: reject,
    list: reject,
    load: reject,
    submit: reject,
    listPreviews: reject,
    confirmPreview: reject,
    loadBrief: reject,
    submitMemoryCandidate: reject,
    listReviewableMemoryCandidates: reject,
    confirmMemoryCandidate: reject,
    rejectMemoryCandidate: reject,
    loadGovernanceProposalContext: reject,
    createGovernanceProposalPreview: reject,
    loadRoleApplicationContext: reject,
    createRoleApplicationPreview: reject,
    loadTensionRaiseContext: reject,
    createTensionRaisePreview: reject,
    loadTacticalOutcomeContext: reject,
    createTacticalOutcomePreview: reject,
  });

  const results = await Promise.all([
    actions.create({ clientConversationId: "client-conversation-1" }),
    actions.list({ limit: 20 }),
    actions.load({ conversationId: "conversation-1", messageLimit: 30 }),
    actions.submit({
      conversationId: "conversation-1",
      clientTurnId: "client-turn-1",
      question: "当前目标是什么？",
    }),
    actions.listPreviews({ conversationId: "conversation-1", limit: 12 }),
    actions.confirmPreview({ previewId: "preview-1", mutationKey: "mutation-1" }),
    actions.loadBrief({ windowDays: 7, maxSignals: 6 }),
    actions.submitMemoryCandidate({
      claim: "候选事实",
      rationale: "提交理由",
      sourceRefs: [{
        type: "goal",
        id: "goal-1",
        label: "目标",
        applicationUrl: "/app/goals",
        observedAt: "2026-07-15T12:00:00.000Z",
      }],
    }),
    actions.listReviewableMemoryCandidates({ limit: 12 }),
    actions.confirmMemoryCandidate({ candidateId: "candidate-1", reason: "Confirmed." }),
    actions.rejectMemoryCandidate({ candidateId: "candidate-1", reason: "Rejected." }),
    actions.loadGovernanceProposalContext(),
    actions.createGovernanceProposalPreview({ conversationId: "conversation-1", userMessageId: "message-1", tensionId: "tension-1", meetingId: "meeting-1", currentStructure: "current", proposedStructure: "proposed", rationale: "reason", expectedImpact: "impact", structuralChange: {} }),
  ]);

  for (const result of results) {
    assert.deepEqual(result, temporaryFailure);
    assert.doesNotMatch(JSON.stringify(result), new RegExp(secret));
  }
});

test("Brain client renders command previews without raw command internals or direct domain writes", () => {
  for (const label of ["组织大脑命令预览", "确认执行", "确认前不会修改组织数据"]) {
    assert.match(source, new RegExp(label));
  }
  for (const forbidden of [
    "serverPayload",
    "sourceBindings",
    "createGoalProposal",
    "appendGoalCheckIns",
    "raiseTension",
    "submitTacticalOutcomeProposal",
    "updateMeetingNotes",
  ]) {
    assert.doesNotMatch(source, new RegExp(forbidden));
  }
});

test("Brain client exposes candidate submission only through explicit action boundary", () => {
  assert.match(source, /submitBrainMemoryCandidate/);
  assert.match(source, /提交候选记忆/);
  assert.match(source, /提交后才会进入来源权威审核，不会直接成为已确认事实。/);
  assert.doesNotMatch(source, /supersedeMemoryCandidate/);
});

test("Brain client exposes source-authority review without central admin approval wording or raw identifiers", () => {
  assert.match(source, /listBrainReviewableMemoryCandidates/);
  assert.match(source, /confirmBrainMemoryCandidate/);
  assert.match(source, /rejectBrainMemoryCandidate/);
  for (const label of [
    "候选记忆审核",
    "仅显示你基于来源流程有权审核的候选",
    "确认",
    "拒绝",
    "打开来源流程",
  ]) {
    assert.match(source, new RegExp(label));
  }
  for (const forbidden of ["中心管理员", "Brain confirmed", "组织大脑确认人"]) {
    assert.doesNotMatch(source, new RegExp(forbidden));
  }
});

test("Private brief panel renders source-linked signals and explicit memory-candidate submit affordance without raw identifiers", () => {
  const markup = renderToStaticMarkup(createElement(PrivateBriefPanel, {
    pending: false,
    failure: null,
    onStartMemoryCandidate: () => undefined,
    brief: {
      schemaVersion: 1,
      generatedAt: "2026-07-15T12:00:00.000Z",
      windowDays: 7,
      truncated: false,
      signals: [{
        kind: "STALE_GOAL_CHECK_IN",
        dedupeKey: "goal:goal-secret-123",
        title: "目标需要更新进展",
        reason: "最近 7 天没有新的 check-in。",
        severity: "risk",
        evidenceAgeDays: 8,
        action: {
          kind: "OPEN_GOAL_TREE",
          label: "打开目标树",
          applicationUrl: "/app/goals",
        },
        sources: [{
          type: "goal",
          id: "goal-secret-123",
          label: "主目标",
          applicationUrl: "/app/goals",
          observedAt: "2026-07-07T12:00:00.000Z",
        }, {
          type: "tension",
          id: "tension-secret-456",
          label: "外部来源",
          applicationUrl: "https://example.invalid/tensions/tension-secret-456",
          observedAt: "2026-07-07T12:00:00.000Z",
        }],
      }],
    },
  }));

  assert.match(markup, /私人简报/);
  assert.match(markup, /仅你可见/);
  assert.match(markup, /作为候选记忆提交/);
  assert.match(markup, /目标需要更新进展/);
  assert.match(markup, /最近 7 天没有新的 check-in/);
  assert.match(markup, /href="\/app\/goals"/);
  assert.doesNotMatch(markup, /goal-secret-123|tension-secret-456|dedupeKey|schemaVersion/);
  assert.doesNotMatch(markup, /https:\/\/example\.invalid/);
});

test("memory candidate draft derives only selected safe private-brief sources", () => {
  const draft = memoryCandidateDraftFromSignal({
    kind: "STALE_GOAL_CHECK_IN",
    dedupeKey: "goal:goal-secret-123",
    title: "目标需要更新进展",
    reason: "最近 7 天没有新的 check-in。",
    severity: "risk",
    evidenceAgeDays: 8,
    action: {
      kind: "OPEN_GOAL_TREE",
      label: "打开目标树",
      applicationUrl: "/app/goals",
    },
    sources: [{
      type: "goal",
      id: "goal-secret-123",
      label: "主目标",
      applicationUrl: "/app/goals",
      observedAt: "2026-07-07T12:00:00.000Z",
    }, {
      type: "meeting",
      id: "meeting-secret-456",
      label: "外部来源",
      applicationUrl: "https://example.invalid/meeting",
      observedAt: "2026-07-07T12:00:00.000Z",
    }],
  });

  assert.deepEqual(draft, {
    claim: "目标需要更新进展",
    rationale: "最近 7 天没有新的 check-in。",
    sourceRefs: [{
      type: "goal",
      id: "goal-secret-123",
      label: "主目标",
      applicationUrl: "/app/goals",
      observedAt: "2026-07-07T12:00:00.000Z",
    }],
  });
});

test("Private brief panel renders honest empty and degraded states", () => {
  const emptyMarkup = renderToStaticMarkup(createElement(PrivateBriefPanel, {
    pending: false,
    failure: null,
    brief: {
      schemaVersion: 1,
      generatedAt: "2026-07-15T12:00:00.000Z",
      windowDays: 7,
      truncated: false,
      signals: [],
    },
  }));
  assert.match(emptyMarkup, /暂无需要处理的私人信号/);

  const degradedMarkup = renderToStaticMarkup(createElement(PrivateBriefPanel, {
    brief: null,
    pending: false,
    failure: temporaryFailure,
    onRetry: () => undefined,
  }));
  assert.match(degradedMarkup, /组织大脑暂时不可用，请稍后重试/);
  assert.match(degradedMarkup, /重试/);
});

test("temporary failures retain create and submit retry identities", () => {
  const memory = createBrainRequestMemory();
  memory.update((current) => ({
    ...current,
    pendingConversationId: "client-conversation-1",
    pendingTurn: {
      conversationId: "conversation-1",
      clientTurnId: "client-turn-1",
      question: "当前目标是什么？",
    },
    operation: "submit",
  }));

  memory.update((current) => markBrainRequestTemporaryFailure(current, "submit"));
  assert.deepEqual(memory.getSnapshot(), {
    pendingConversationId: "client-conversation-1",
    pendingTurn: {
      conversationId: "conversation-1",
      clientTurnId: "client-turn-1",
      question: "当前目标是什么？",
    },
    operation: null,
    retry: "submit",
    failure: temporaryFailure,
  });

  memory.update((current) => ({
    ...current,
    pendingConversationId: "client-conversation-2",
    pendingTurn: null,
    operation: "create",
  }));
  memory.update((current) => markBrainRequestTemporaryFailure(current, "create"));
  assert.equal(memory.getSnapshot().pendingConversationId, "client-conversation-2");
  assert.equal(memory.getSnapshot().retry, "create");
});

test("shared request memory hands unresolved work across panel remount and workspace", () => {
  const providerMemory = createBrainRequestMemory();
  let notifications = 0;
  const unsubscribe = providerMemory.subscribe(() => {
    notifications += 1;
  });

  const panelInstance = providerMemory;
  panelInstance.update((current) => ({
    ...current,
    pendingConversationId: "client-conversation-panel",
    pendingTurn: {
      conversationId: null,
      clientTurnId: "client-turn-panel",
      question: "  本周有哪些治理张力？  ".trim(),
    },
  }));

  const remountedPanelInstance = providerMemory;
  const workspaceInstance = providerMemory;
  assert.deepEqual(remountedPanelInstance.getSnapshot(), workspaceInstance.getSnapshot());
  assert.equal(workspaceInstance.getSnapshot().pendingTurn?.clientTurnId, "client-turn-panel");
  assert.equal(workspaceInstance.getSnapshot().pendingTurn?.question, "本周有哪些治理张力？");
  assert.equal(notifications, 1);
  unsubscribe();

  assert.match(layout, /<OrganizationBrainProvider>/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie|URLSearchParams/);
});

test("untitled conversations created on the same day include distinguishing time", () => {
  const morning = formatUntitledConversationLabel("2026-07-15T01:05:00.000Z");
  const afternoon = formatUntitledConversationLabel("2026-07-15T09:35:00.000Z");
  assert.notEqual(morning, afternoon);
});

test("Brain client uses returned source URLs unchanged", () => {
  assert.match(source, /href=\{source\.applicationUrl\}/);
  assert.doesNotMatch(source, /withBasePath\(source\.applicationUrl/);
});

test("Brain client includes keyboard submission and live status", () => {
  assert.match(source, /event\.(metaKey \|\| event\.ctrlKey)/);
  assert.match(source, /event\.key === "Enter"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /disabled=\{pending/);
});

test("question focus waits for the transition and textarea to become enabled", () => {
  let focusCalls = 0;
  const control = {
    disabled: true,
    focus() {
      focusCalls += 1;
    },
  };

  let restoredRequestId = restoreQuestionFocus({
    pending: true,
    requestId: 1,
    restoredRequestId: 0,
    control,
  });
  assert.equal(restoredRequestId, 0);
  assert.equal(focusCalls, 0);

  restoredRequestId = restoreQuestionFocus({
    pending: false,
    requestId: 1,
    restoredRequestId,
    control,
  });
  assert.equal(restoredRequestId, 0);
  assert.equal(focusCalls, 0);

  control.disabled = false;
  restoredRequestId = restoreQuestionFocus({
    pending: false,
    requestId: 1,
    restoredRequestId,
    control,
  });
  assert.equal(restoredRequestId, 1);
  assert.equal(focusCalls, 1);

  restoredRequestId = restoreQuestionFocus({
    pending: false,
    requestId: 1,
    restoredRequestId,
    control,
  });
  assert.equal(restoredRequestId, 1);
  assert.equal(focusCalls, 1);
});

test("legal long user text renders with mobile-safe wrapping", () => {
  const content = `https://example.invalid/${"continuousIdentifier".repeat(100)}`;
  assert.ok(Buffer.byteLength(content, "utf8") <= 2048);

  const markup = renderToStaticMarkup(createElement(BrainUserMessage, { content }));
  assert.match(markup, /\[overflow-wrap:anywhere\]/);
  assert.match(markup, /https:\/\/example\.invalid\//);
  assert.ok(markup.includes("continuousIdentifier".repeat(100)));
});

test("workspace and panel retain distinct command-center shapes", () => {
  assert.match(source, /data-brain-mode="workspace"/);
  assert.match(source, /md:grid-cols-\[15rem_minmax\(0,1fr\)\]/);
  assert.match(source, /aria-label="近期私人对话"/);
  assert.match(source, /近期工作/);
  assert.match(source, /当前协作/);
  assert.match(source, /aria-pressed=\{selected\}/);
  assert.match(source, /data-brain-mode="panel"/);
  assert.match(source, /mode === "panel"/);
});

test("command center explicitly exposes loading, empty, continuation, process, provider-off, denial, and retry states", () => {
  for (const label of [
    "正在加载对话",
    "暂无近期对话",
    "对话已加载",
    "新对话已建立",
    "处理中",
    "可交互",
    "模型不可用",
    "无法提供",
    "重试",
  ]) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /aria-busy=\{pending\}/);
});

test("provider unavailable and denied answers remain explicit without leaking internal identifiers", () => {
  const base = {
    schemaVersion: 1,
    message: "当前无法生成模型回答。",
    confirmedMemory: [],
    facts: [],
    inferences: [],
    recommendations: [],
    missingEvidence: [],
    sources: [],
  } as const;
  const unavailable = renderToStaticMarkup(createElement(BrainAnswer, {
    result: { ...base, status: "UNAVAILABLE", code: "MODEL_UNAVAILABLE" },
  }));
  const denied = renderToStaticMarkup(createElement(BrainAnswer, {
    result: { ...base, status: "DENIED", code: "DENIED" },
  }));

  assert.match(unavailable, /模型不可用/);
  assert.match(unavailable, /data-brain-status="UNAVAILABLE"/);
  assert.match(unavailable, /当前无法生成模型回答/);
  assert.match(denied, /无法提供/);
  assert.doesNotMatch(`${unavailable}${denied}`, /conversationId|clientTurnId|previewId/);
  assert.doesNotMatch(source, /\{source\.recordId\}/);
});

test("visual shell is unframed and avoids nested cards or forbidden decoration", () => {
  assert.doesNotMatch(source, /grid overflow-hidden rounded-card border/);
  assert.equal((source.match(/rounded-card/g) ?? []).length, 1, "only the user message bubble may remain rounded-card");
  assert.doesNotMatch(source, /gradient|purple|violet|indigo|\borb\b|particle/i);
  assert.doesNotMatch(source, /shadow-(?:sm|md|lg|xl|2xl)/);
});

test("all Brain action flows and intent input remain wired after the visual restructure", () => {
  for (const action of [
    "createBrainConversation",
    "listBrainConversations",
    "loadBrainConversation",
    "submitBrainTurn",
    "listBrainCommandPreviewCards",
    "confirmBrainCommandPreviewCard",
    "loadBrainPrivateBrief",
    "submitBrainMemoryCandidate",
    "listBrainReviewableMemoryCandidates",
    "confirmBrainMemoryCandidate",
    "rejectBrainMemoryCandidate",
    "loadRoleApplicationContext",
    "createRoleApplicationPreview",
  ]) {
    assert.match(source, new RegExp(action));
  }
  assert.match(source, /<form/);
  assert.match(source, /onSubmit=\{\(event\) =>/);
  assert.match(source, /placeholder="询问角色、任职申请、回路、目标、张力、项目或会议…"/);
  assert.match(source, /onClick=\{runCreate\}/);
  assert.match(source, /onConfirm=\{runConfirmPreview\}/);
  assert.match(source, /href="\/app\/tensions\/new"/);
  assert.match(source, /href="\/app\/meetings\/new"/);
  assert.match(source, /href="\/app\/roles\/market"/);
});

test("workspace actions use stable touch targets and long text wrapping", () => {
  assert.match(source, /className="size-10"/);
  assert.match(source, /min-h-10 w-full break-words/);
  assert.match(source, /\[overflow-wrap:anywhere\]/);
  assert.match(source, /min-w-0 overflow-hidden/);
});
