export const CONVERSATION_STEPS = [
  {
    id: "business_goal",
    title: "业务目标锚点",
    prompt: "先定义这条回路要服务的业务目标。请写清意图、目标、输出、成功标志、周期和不可牺牲约束。",
    placeholder: "例如：意图是减少定制需求反复澄清；目标是在一个交付周期内把需求确认周期从 5 天降到 48 小时；输出是结构化需求单和承诺版本；成功标志是返工率下降、异常有人接管。",
  },
  {
    id: "workflow",
    title: "描述回路单元",
    prompt: "请按真实业务语言描述这条回路如何运行。把每一步当成一个回路单元，写清动作、执行责任、输入、输出、异常接管和需要留下的记录。",
    placeholder: "例如：客户提出定制需求；销售整理需求 brief；产品判断范围和风险；交付评估周期；销售形成承诺版本并跟进验收。",
  },
  {
    id: "diagnosis",
    title: "确认拆解",
    prompt: "请确认系统对现状、人机协作机会和治理缺口的拆解。你可以直接确认，也可以补充遗漏。",
    placeholder: "例如：确认。补充：客户异议必须由业务负责人接管，不能由 AI 自动回复。",
  },
] as const;

export type ConversationStepId = (typeof CONVERSATION_STEPS)[number]["id"];

export function getStep(index: number) {
  return CONVERSATION_STEPS[Math.min(Math.max(index, 0), CONVERSATION_STEPS.length - 1)];
}

export function getNextStepIndex(current: number) {
  return Math.min(current + 1, CONVERSATION_STEPS.length);
}

export function isCollectionComplete(stepIndex: number) {
  return stepIndex >= CONVERSATION_STEPS.length;
}
