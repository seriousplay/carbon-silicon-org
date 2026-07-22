import type { LoopCellInput } from "./design-brief";

export type BreakpointType =
  | "information_collapse"
  | "waiting_black_hole"
  | "validation_vacuum";

export type BreakpointSeverity = "low" | "medium" | "high";
export type BreakpointConfidence = "low" | "medium" | "high";

export type LegacyWorkflowNode = {
  id: string;
  order: number;
  action: string;
  owner: string;
  input: string;
  output: string;
  handoffTo?: string;
  waitFor?: string;
  decision?: string;
  approval?: string;
  system?: string;
  acceptance?: string;
  verification?: string;
  painNote?: string;
};

export type WorkflowBreakpoint = {
  id: string;
  nodeId: string;
  type: BreakpointType;
  severity: BreakpointSeverity;
  diagnosis: string;
  evidence: string;
  suggestedIntervention: string;
  confidence: BreakpointConfidence;
  userConfirmed?: boolean;
};

export type TransformationMoveType =
  | "remove"
  | "merge"
  | "agent_takeover"
  | "human_boundary"
  | "add_validation"
  | "add_memory"
  | "add_interface_protocol";

export type LoopTransformationMove = {
  id: string;
  type: TransformationMoveType;
  sourceNodeIds: string[];
  targetCellId?: string;
  title: string;
  rationale: string;
  expectedEffect: string;
  humanChange?: string;
};

export type BeforeAfterMetrics = {
  nodeCountBefore: number;
  nodeCountAfter: number;
  humanExecutionNodesBefore: number;
  humanExecutionNodesAfter: number;
  waitingPointsBefore: number;
  waitingPointsAfter: number;
  approvalRoundsBefore: number;
  approvalRoundsAfter: number;
  aiTakeoverNodesAfter: number;
  validationSignalsBefore: number;
  validationSignalsAfter: number;
  memoryAssetsBefore: number;
  memoryAssetsAfter: number;
  estimatedCycleBefore?: string;
  estimatedCycleAfter?: string;
  confidence: BreakpointConfidence;
};

export type ProcessTransformation = {
  generatedAt: string;
  legacyNodes: LegacyWorkflowNode[];
  breakpoints: WorkflowBreakpoint[];
  moves: LoopTransformationMove[];
  beforeAfter: BeforeAfterMetrics;
  conceptBridge: Array<{
    oldTerm: string;
    newTerm: string;
    explanation: string;
  }>;
};

const INFORMATION_COLLAPSE_TERMS = ["汇总", "整理", "摘要", "转述", "上报", "同步", "会议纪要", "口头确认", "搬运"];
const WAITING_BLACK_HOLE_TERMS = ["审批", "排期", "等", "等待", "确认", "协调", "供应商", "IT", "信息中心", "跨部门"];
const EMPTY_VERIFICATION_TERMS = ["完成", "交付", "发送", "提交", "处理完", "已同步"];
const SLA_TERMS = ["SLA", "时限", "超时", "升级", "替代路径", "自动推进", "多少分钟", "多少小时", "天内"];

export function legacyNodesFromLoopCells(cells: LoopCellInput[]): LegacyWorkflowNode[] {
  return cells
    .filter((cell) => hasText(cell.action) || hasText(cell.input) || hasText(cell.output))
    .map((cell, index) => ({
      id: cell.id || `legacy-node-${index + 1}`,
      order: index + 1,
      action: cell.action.trim(),
      owner: cell.owner.trim(),
      input: cell.input.trim(),
      output: cell.output.trim(),
      decision: cell.decision.trim() || undefined,
      system: cell.system.trim() || undefined,
      acceptance: cell.acceptance.trim() || undefined,
      verification: verificationFromCell(cell),
      painNote: cell.friction.trim() || undefined,
      waitFor: inferWaitFor(cell),
      approval: inferApproval(cell),
    }));
}

export function scanWorkflowBreakpoints(nodes: LegacyWorkflowNode[], successSignal?: string): WorkflowBreakpoint[] {
  return nodes.flatMap((node) => {
    const breakpoints: WorkflowBreakpoint[] = [];
    const text = nodeText(node);
    if (hasAny(text, INFORMATION_COLLAPSE_TERMS) || likelyMultiSourceCollapse(node)) {
      breakpoints.push({
        id: breakpointId(node, "information_collapse"),
        nodeId: node.id,
        type: "information_collapse",
        severity: likelyMultiSourceCollapse(node) ? "high" : "medium",
        diagnosis: "这一步可能把原始上下文压缩成下游难以复用的摘要或转述。",
        evidence: evidenceLine(node, ["action", "input", "output", "painNote"]),
        suggestedIntervention: "改成结构化输入协议，保留原始上下文、关键字段和判断依据。",
        confidence: "medium",
      });
    }
    if (hasAny(text, WAITING_BLACK_HOLE_TERMS) && !hasOperationalSla(text)) {
      breakpoints.push({
        id: breakpointId(node, "waiting_black_hole"),
        nodeId: node.id,
        type: "waiting_black_hole",
        severity: hasText(node.approval) || hasText(node.waitFor) ? "high" : "medium",
        diagnosis: "这一步的主要成本可能不是处理，而是等待确认、审批、排期或跨部门响应。",
        evidence: evidenceLine(node, ["waitFor", "approval", "decision", "painNote", "owner"]),
        suggestedIntervention: "把逐条确认改成前置规则、SLA、超时升级和异常裁决路径。",
        confidence: "medium",
      });
    }
    if (isValidationVacuum(node, successSignal)) {
      breakpoints.push({
        id: breakpointId(node, "validation_vacuum"),
        nodeId: node.id,
        type: "validation_vacuum",
        severity: "high",
        diagnosis: "这一步交付后缺少真实结果回验，流程在这里结束，回路没有形成。",
        evidence: evidenceLine(node, ["acceptance", "verification", "output"]),
        suggestedIntervention: "增加验证节点，把结果信号、异常原因和下一轮输入接回回路。",
        confidence: "high",
      });
    }
    return breakpoints;
  });
}

export function buildTransformationMoves(breakpoints: WorkflowBreakpoint[], nodes: LegacyWorkflowNode[]): LoopTransformationMove[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  return breakpoints
    .filter((breakpoint) => breakpoint.userConfirmed !== false)
    .map((breakpoint, index) => {
      const node = nodeById.get(breakpoint.nodeId);
      const titlePrefix = node ? `${node.order}. ${node.action || node.output || "旧流程节点"}` : "旧流程节点";
      if (breakpoint.type === "information_collapse") {
        return {
          id: `move-${index + 1}-interface`,
          type: "add_interface_protocol",
          sourceNodeIds: [breakpoint.nodeId],
          title: `${titlePrefix}：补结构化接口`,
          rationale: breakpoint.diagnosis,
          expectedEffect: "减少下游重新追问和重复整理，让 AI 与下游角色能直接消费完整上下文。",
          humanChange: "人从转述者变成字段定义者和异常解释者。",
        };
      }
      if (breakpoint.type === "waiting_black_hole") {
        return {
          id: `move-${index + 1}-boundary`,
          type: "human_boundary",
          sourceNodeIds: [breakpoint.nodeId],
          title: `${titlePrefix}：把等待改成边界裁决`,
          rationale: breakpoint.diagnosis,
          expectedEffect: "减少排队和逐条审批，把人工注意力集中到例外、风险和承诺边界。",
          humanChange: "人不再逐条卡流程，只处理越界、高风险和超时事项。",
        };
      }
      return {
        id: `move-${index + 1}-validation`,
        type: "add_validation",
        sourceNodeIds: [breakpoint.nodeId],
        title: `${titlePrefix}：增加验证回灌`,
        rationale: breakpoint.diagnosis,
        expectedEffect: "让交付结果进入下一轮输入，形成可学习、可复盘的真实回路。",
        humanChange: "人负责定义验收信号和复盘口径，而不是只确认任务完成。",
      };
    });
}

export function calculateBeforeAfterMetrics(
  nodes: LegacyWorkflowNode[],
  breakpoints: WorkflowBreakpoint[],
  moves: LoopTransformationMove[],
): BeforeAfterMetrics {
  const activeBreakpoints = breakpoints.filter((breakpoint) => breakpoint.userConfirmed !== false);
  const activeMoves = moves.filter((move) => move.sourceNodeIds.length);
  const waitingBefore = activeBreakpoints.filter((breakpoint) => breakpoint.type === "waiting_black_hole").length;
  const validationBefore = nodes.filter((node) => hasText(node.verification)).length;
  const memoryBefore = nodes.filter((node) => /记录|沉淀|复盘|留痕|日志|知识库/.test(nodeText(node))).length;
  const removedOrMerged = activeMoves.filter((move) => move.type === "remove" || move.type === "merge").length;
  const aiTakeover = activeMoves.filter((move) => move.type === "agent_takeover").length
    || activeBreakpoints.filter((breakpoint) => breakpoint.type === "information_collapse").length;
  const validationAdded = activeMoves.filter((move) => move.type === "add_validation").length
    || activeBreakpoints.filter((breakpoint) => breakpoint.type === "validation_vacuum").length;
  const memoryAdded = activeMoves.filter((move) => move.type === "add_memory").length + validationAdded;
  return {
    nodeCountBefore: nodes.length,
    nodeCountAfter: Math.max(1, nodes.length - removedOrMerged + validationAdded),
    humanExecutionNodesBefore: nodes.length,
    humanExecutionNodesAfter: Math.max(1, nodes.length - aiTakeover),
    waitingPointsBefore: waitingBefore,
    waitingPointsAfter: Math.max(0, waitingBefore - activeMoves.filter((move) => move.type === "human_boundary").length),
    approvalRoundsBefore: nodes.filter((node) => hasText(node.approval) || /审批|批准|复核/.test(nodeText(node))).length,
    approvalRoundsAfter: Math.max(0, nodes.filter((node) => hasText(node.approval) || /审批|批准|复核/.test(nodeText(node))).length - activeMoves.filter((move) => move.type === "human_boundary").length),
    aiTakeoverNodesAfter: aiTakeover,
    validationSignalsBefore: validationBefore,
    validationSignalsAfter: validationBefore + validationAdded,
    memoryAssetsBefore: memoryBefore,
    memoryAssetsAfter: memoryBefore + memoryAdded + activeMoves.filter((move) => move.type === "add_interface_protocol").length,
    estimatedCycleBefore: nodes.length ? "按旧流程逐节点流转，等待和返工需要试运行记录校准" : undefined,
    estimatedCycleAfter: nodes.length ? "先小范围试运行，基于每轮运行记录校准周期" : undefined,
    confidence: "low",
  };
}

export function buildProcessTransformation(input: {
  legacyNodes: LegacyWorkflowNode[];
  successSignal?: string;
  now?: string;
  confirmedBreakpoints?: WorkflowBreakpoint[];
}): ProcessTransformation {
  const breakpoints = input.confirmedBreakpoints ?? scanWorkflowBreakpoints(input.legacyNodes, input.successSignal);
  const moves = buildTransformationMoves(breakpoints, input.legacyNodes);
  return {
    generatedAt: input.now ?? new Date().toISOString(),
    legacyNodes: input.legacyNodes,
    breakpoints,
    moves,
    beforeAfter: calculateBeforeAfterMetrics(input.legacyNodes, breakpoints, moves),
    conceptBridge: [
      { oldTerm: "流程", newTerm: "回路", explanation: "不只是流转，还要有验证信号回到下一轮输入。" },
      { oldTerm: "审批", newTerm: "护栏", explanation: "不逐条卡住，而是定义边界、授权规则和异常裁决。" },
      { oldTerm: "复盘", newTerm: "记忆", explanation: "不只开会总结，而是沉淀成下轮可复用的脚本、规则和异常样本。" },
    ],
  };
}

function breakpointId(node: LegacyWorkflowNode, type: BreakpointType) {
  return `${node.id}-${type}`;
}

function nodeText(node: LegacyWorkflowNode) {
  return [
    node.action,
    node.owner,
    node.input,
    node.output,
    node.handoffTo,
    node.waitFor,
    node.decision,
    node.approval,
    node.system,
    node.acceptance,
    node.verification,
    node.painNote,
  ].filter(Boolean).join(" ");
}

function hasAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function hasOperationalSla(value: string) {
  if (!hasAny(value, SLA_TERMS)) return false;
  if (/(没有|无|缺少|未定义|未设置|没有明确).{0,8}(SLA|时限|超时|升级|替代路径|自动推进)/.test(value)) return false;
  return true;
}

function hasText(value: string | undefined) {
  return Boolean(value?.trim());
}

function likelyMultiSourceCollapse(node: LegacyWorkflowNode) {
  const input = node.input || "";
  return /、|,|，|\/|和/.test(input) && node.output.trim().length > 0 && node.output.trim().length < input.trim().length;
}

function isValidationVacuum(node: LegacyWorkflowNode, successSignal?: string) {
  const verification = node.verification || "";
  if (verification.trim().length >= 4) return false;
  const acceptance = node.acceptance || "";
  const output = node.output || "";
  if (successSignal && output.includes(successSignal)) return false;
  return !acceptance || hasAny(acceptance, EMPTY_VERIFICATION_TERMS) || /验收|反馈|复盘|指标|回访|转化|返工|复现/.test(output) === false;
}

function evidenceLine(node: LegacyWorkflowNode, fields: Array<keyof LegacyWorkflowNode>) {
  const parts = fields
    .map((field) => [field, node[field]] as const)
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([field, value]) => `${field}: ${String(value).trim()}`);
  return parts.length ? parts.join("；") : "该节点缺少足够的输入、输出、验收或验证描述。";
}

function verificationFromCell(cell: LoopCellInput) {
  const text = `${cell.acceptance} ${cell.memory} ${cell.friction}`;
  if (/验收|反馈|复盘|回访|指标|转化|返工|复现|回灌/.test(text)) return text.trim();
  return "";
}

function inferWaitFor(cell: LoopCellInput) {
  const text = `${cell.action} ${cell.owner} ${cell.decision} ${cell.friction}`;
  return hasAny(text, WAITING_BLACK_HOLE_TERMS) ? text.trim() : undefined;
}

function inferApproval(cell: LoopCellInput) {
  const text = `${cell.action} ${cell.decision} ${cell.acceptance}`;
  return /审批|批准|复核|确认/.test(text) ? text.trim() : undefined;
}
