import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProcessTransformation,
  buildTransformationMoves,
  calculateBeforeAfterMetrics,
  scanWorkflowBreakpoints,
  type LegacyWorkflowNode,
  type WorkflowBreakpoint,
} from "./process-transformation-core";

const nodes: LegacyWorkflowNode[] = [
  {
    id: "node-1",
    order: 1,
    action: "销售把客户原始需求整理成摘要再同步给产品",
    owner: "销售",
    input: "客户群聊、截图、历史订单、口头补充",
    output: "需求摘要",
    painNote: "下游经常需要重新追问原始语境",
  },
  {
    id: "node-2",
    order: 2,
    action: "等待产品负责人确认能不能做",
    owner: "产品",
    input: "需求摘要",
    output: "可做判断",
    approval: "产品负责人审批",
    painNote: "经常排期等待，没有超时升级",
  },
  {
    id: "node-3",
    order: 3,
    action: "销售把承诺版本发送给客户",
    owner: "销售",
    input: "可做判断",
    output: "客户承诺版本",
    acceptance: "发送完成",
  },
];

test("scanWorkflowBreakpoints detects information collapse", () => {
  const breakpoints = scanWorkflowBreakpoints(nodes);
  const collapse = breakpoints.find((item) => item.type === "information_collapse");
  assert.ok(collapse);
  assert.equal(collapse.nodeId, "node-1");
  assert.match(collapse.suggestedIntervention, /结构化输入协议/);
});

test("scanWorkflowBreakpoints detects waiting black hole", () => {
  const breakpoints = scanWorkflowBreakpoints(nodes);
  const waiting = breakpoints.find((item) => item.type === "waiting_black_hole");
  assert.ok(waiting);
  assert.equal(waiting.nodeId, "node-2");
  assert.equal(waiting.severity, "high");
});

test("scanWorkflowBreakpoints detects validation vacuum", () => {
  const breakpoints = scanWorkflowBreakpoints(nodes);
  const vacuum = breakpoints.find((item) => item.type === "validation_vacuum" && item.nodeId === "node-3");
  assert.ok(vacuum);
  assert.match(vacuum.diagnosis, /缺少真实结果回验/);
});

test("ignored breakpoint does not enter transformation moves or after metrics", () => {
  const breakpoints: WorkflowBreakpoint[] = scanWorkflowBreakpoints(nodes).map((item) =>
    item.type === "waiting_black_hole" ? { ...item, userConfirmed: false } : item,
  );
  const moves = buildTransformationMoves(breakpoints, nodes);
  assert.equal(moves.some((move) => move.type === "human_boundary"), false);
  const metrics = calculateBeforeAfterMetrics(nodes, breakpoints, moves);
  assert.equal(metrics.waitingPointsAfter, metrics.waitingPointsBefore);
});

test("buildProcessTransformation returns before/after metrics and concept bridge", () => {
  const transformation = buildProcessTransformation({
    legacyNodes: nodes,
    now: "2026-07-01T00:00:00.000Z",
  });
  assert.equal(transformation.generatedAt, "2026-07-01T00:00:00.000Z");
  assert.ok(transformation.beforeAfter.validationSignalsAfter > transformation.beforeAfter.validationSignalsBefore);
  assert.ok(transformation.conceptBridge.some((item) => item.oldTerm === "流程" && item.newTerm === "回路"));
});
