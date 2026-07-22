import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const actionsSource = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

describe("V6-M5-D candidate tension review UI", () => {
  test("renders human review actions for detected candidate tensions", () => {
    assert.match(pageSource, /candidate\.status === "DETECTED"/);
    assert.match(pageSource, /confirmCandidateTensionAction\.bind\(null, candidateId\)/);
    assert.match(pageSource, /closeCandidateTensionAction\.bind\(null, candidateId\)/);
    assert.match(pageSource, /mergeCandidateTensionAction\.bind\(null, candidateId\)/);
    assert.match(pageSource, /确认为正式张力/);
    assert.match(pageSource, /驳回或标记误报/);
    assert.match(pageSource, /合并到候选/);
  });

  test("keeps candidate review actions behind the accepted service boundary", () => {
    assert.match(actionsSource, /confirmCandidateTensionWithHuman\(prisma/);
    assert.match(actionsSource, /closeCandidateTensionWithHuman\(prisma/);
    assert.match(actionsSource, /mergeCandidateTensionWithHuman\(prisma/);
    assert.doesNotMatch(actionsSource, /candidateTension\.update\(/);
    assert.doesNotMatch(actionsSource, /candidateTensionAuditEvent\.create\(/);
  });

  test("preserves formal tension type compatibility without reintroducing a type picker", () => {
    assert.match(actionsSource, /const type = readTensionType\(formData\)/);
    assert.match(actionsSource, /type,/);
    assert.match(actionsSource, /function readTensionType/);
    assert.doesNotMatch(pageSource, /name="type"/);
  });
});
