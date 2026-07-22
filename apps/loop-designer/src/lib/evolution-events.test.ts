import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRunSummary,
  nextRunSequence,
  validateReleasePayload,
  validateRunRoundPayload,
  type LoopEvolutionEvent,
  type RunRoundPayload,
} from "./evolution-events-core";

const runPayload: RunRoundPayload = {
  runSequence: 1,
  runMode: "trial",
  loopVersionId: "version-1",
  goal: "验证需求确认是否能闭环",
  metricSnapshot: [{ name: "确认周期", before: "5 天", current: "3 天", target: "48 小时" }],
  incidents: ["一次字段缺失"],
  validatedLearning: "结构化 brief 能减少重复追问，但验收脚本还不稳定。",
  nextChange: "补充验收字段和缺失字段回传规则。",
  workflowChanged: true,
  acceptanceScriptChanged: true,
  guardrailChanged: false,
  interfaceChanged: true,
  trueLoopSignal: "partial",
  releaseRecommendation: "continue_trial",
};

test("validateRunRoundPayload accepts continuous run sequence", () => {
  assert.equal(validateRunRoundPayload({ ...runPayload, runSequence: 12 }).runSequence, 12);
});

test("validateRunRoundPayload rejects invalid sequence", () => {
  assert.throws(() => validateRunRoundPayload({ ...runPayload, runSequence: 0 }), /大于 0/);
});

test("validateReleasePayload accepts trial and production release", () => {
  const base = {
    loopVersionId: "version-1",
    releaseReason: "完成小范围验证",
    readinessEvidence: ["连续两轮有验证信号"],
    ownerRole: "回路负责人",
    releaseAt: "2026-07-01T00:00:00.000Z",
  };
  assert.equal(validateReleasePayload({ ...base, releaseStage: "trial" }).releaseStage, "trial");
  assert.equal(validateReleasePayload({ ...base, releaseStage: "production" }).releaseStage, "production");
});

test("buildRunSummary keeps latest run and release signal", () => {
  const events: LoopEvolutionEvent[] = [
    event("event-1", runPayload),
    event("event-2", { ...runPayload, runSequence: 2, runMode: "production", trueLoopSignal: "strong", releaseRecommendation: "keep_production" }),
    {
      id: "event-3",
      enterpriseId: "enterprise-1",
      assetId: "asset-1",
      versionId: "version-1",
      eventType: "version_released",
      payload: {
        loopVersionId: "version-1",
        releaseStage: "production",
        releaseReason: "真回路信号稳定",
        readinessEvidence: ["指标改善", "异常边界清楚"],
        ownerRole: "回路负责人",
        releaseAt: "2026-07-03T00:00:00.000Z",
      },
      createdBy: "user-1",
      createdAt: "2026-07-03T00:00:00.000Z",
    },
  ];
  const summary = buildRunSummary(events);
  assert.equal(summary.completedRuns, 2);
  assert.equal(summary.latestRunMode, "production");
  assert.equal(summary.trueLoopSignal, "strong");
  assert.equal(summary.releaseStage, "production");
  assert.equal(nextRunSequence(events), 3);
});

function event(id: string, payload: RunRoundPayload): LoopEvolutionEvent {
  return {
    id,
    enterpriseId: "enterprise-1",
    assetId: "asset-1",
    versionId: payload.loopVersionId,
    eventType: "run_round",
    runSequence: payload.runSequence,
    runMode: payload.runMode,
    payload,
    createdBy: "user-1",
    createdAt: `2026-07-0${payload.runSequence}T00:00:00.000Z`,
  };
}
