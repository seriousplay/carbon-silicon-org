import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

test("Brain transport exposes only accepted explicit Server Actions and injects schema version", () => {
  assert.match(source, /^"use server";/);
  for (const name of [
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
  ]) {
    assert.match(source, new RegExp(`export async function ${name}\\(`));
  }
  assert.equal((source.match(/schemaVersion: 1/g) ?? []).length, 12);
  assert.match(source, /value \? \(value\.limit as number \| undefined\) : 0/);
  assert.doesNotMatch(source, /revalidate|unstable_cache|route handler|NextResponse/);
});

test("Brain transport maps E1 errors to the fixed public allowlist without raw details", () => {
  for (const [code, message] of [
    ["INVALID_INPUT", "请求内容不符合要求。"],
    ["NOT_AVAILABLE", "无法访问该组织大脑会话。"],
    ["RETRY_CONFLICT", "该请求标识已用于不同内容，请重新提交。"],
    ["TEMPORARY_FAILURE", "组织大脑暂时不可用，请稍后重试。"],
  ]) {
    assert.match(source, new RegExp(code));
    assert.match(source, new RegExp(message));
  }
  assert.doesNotMatch(source, /error\.message|error\.stack|ActorContext|@\/lib\/(db|session|authorization)/);
});

test("Brain transport imports only accepted Brain production boundaries", () => {
  const imports = source.match(/^import[\s\S]*?;$/gm) ?? [];
  assert.ok(imports.length > 0);
  for (const statement of imports) {
    assert.match(statement, /@\/lib\/organization-brain\/(turn-service|conversation-store|command-preview-service|private-brief-service|private-brief-types|memory-candidate-service|memory-candidate-types)/);
  }
  for (const forbidden of ["planner", "query-broker", "reasoner", "prisma", "database"] ) {
    assert.doesNotMatch(source, new RegExp(forbidden, "i"));
  }
});

test("Brain preview transport does not expose domain action calls", () => {
  assert.match(source, /listBrainCommandPreviews/);
  assert.match(source, /confirmBrainCommandPreview/);
  assert.match(source, /getPrivateBrief/);
  assert.match(source, /createMemoryCandidateDraft/);
  assert.match(source, /submitMemoryCandidate/);
  assert.match(source, /listReviewableMemoryCandidates/);
  assert.match(source, /confirmMemoryCandidate/);
  assert.match(source, /rejectMemoryCandidate/);
  for (const forbidden of [
    "createGoalProposal",
    "appendGoalCheckIns",
    "raiseTension",
    "submitTacticalOutcomeProposal",
    "updateMeetingNotes",
  ]) {
    assert.doesNotMatch(source, new RegExp(forbidden));
  }
});
