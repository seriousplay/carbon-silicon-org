// 会议智能体阶段常量（客户端安全，不依赖 server-only 模块）

export const PHASES = {
  OPENING: "OPENING",
  TENSION_COLLECT: "TENSION_COLLECT",
  PROPOSAL: "PROPOSAL",
  CLARIFY: "CLARIFY",
  RESPONSE: "RESPONSE",
  AMEND: "AMEND",
  VOTE: "VOTE",
  JUDGE: "JUDGE",
  INTEGRATE: "INTEGRATE",
  SUMMARY: "SUMMARY",
} as const;

export const PHASE_LABELS: Record<string, string> = {
  OPENING: "开场",
  TENSION_COLLECT: "张力收集",
  PROPOSAL: "提案提交",
  CLARIFY: "澄清提问",
  RESPONSE: "自由回应",
  AMEND: "提案打磨",
  VOTE: "反对表决",
  JUDGE: "反对判定",
  INTEGRATE: "整合决策",
  SUMMARY: "总结",
};

export const PHASE_ORDER: readonly string[] = [
  "OPENING", "TENSION_COLLECT", "PROPOSAL", "CLARIFY", "RESPONSE", "AMEND", "VOTE", "JUDGE", "INTEGRATE", "SUMMARY",
];
