import toolProductsData from "./tool-products.json";

export type OnlineSupport = "assessment" | "template" | "manual" | "planned";

export type ToolType =
  | "assessment"
  | "diagnosis"
  | "governance"
  | "practice"
  | "strategy"
  | "template"
  | "workflow"
  | "workshop";

export type ToolStep = {
  title: string;
  instruction: string;
  output: string;
};

export type ToolTemplateSection = {
  title: string;
  prompts: (string | ToolTemplatePrompt)[];
};

export type ToolTemplatePrompt = {
  label: string;
  standard?: string;
  example?: string;
  avoid?: string;
};

export type ToolDevelopmentSpec = {
  formFields: string[];
  reportBlocks: string[];
  acceptanceCriteria: string[];
};

export type ToolProduct = {
  id: string;
  chapter: number;
  name: string;
  subtitle: string;
  purpose: string;
  output: string;
  tags: string[];
  toolType: ToolType;
  scenarioTags: string[];
  targetUsers: string[];
  duration: string;
  participants: string;
  onlineSupport: OnlineSupport;
  problem: string;
  whenToUse: string[];
  notFor: string[];
  inputs: string[];
  steps: ToolStep[];
  scoring: string[];
  facilitatorTips: string[];
  pitfalls: string[];
  followUpActions: string[];
  formGuidance?: Record<string, ToolTemplatePrompt>;
  templateSections: ToolTemplateSection[];
  developmentSpec: ToolDevelopmentSpec;
  relatedTools: string[];
  content: string;
};

export type ToolItem = ToolProduct;

export const toolLibrary = toolProductsData as ToolProduct[];

export const onlineSupportMeta: Record<OnlineSupport, { label: string; shortLabel: string; description: string }> = {
  assessment: {
    label: "在线测评",
    shortLabel: "在线测评",
    description: "进入测评并生成报告。",
  },
  template: {
    label: "在线记录",
    shortLabel: "在线记录",
    description: "提交工具记录并沉淀团队数据。",
  },
  manual: {
    label: "引导交付",
    shortLabel: "引导交付",
    description: "适合由引导师带领完成。",
  },
  planned: {
    label: "基础记录",
    shortLabel: "基础记录",
    description: "可先记录关键输入与输出。",
  },
};

export const toolTypeMeta: Record<ToolType, { label: string; description: string }> = {
  assessment: { label: "测评诊断", description: "适合打分、定位阶段或识别短板。" },
  diagnosis: { label: "组织诊断", description: "适合定位组织卡点和行动起点。" },
  governance: { label: "治理工具", description: "适合定义边界、责任和复核机制。" },
  practice: { label: "练习任务", description: "适合连续实践和行为训练。" },
  strategy: { label: "策略判断", description: "适合路径选择和战略研讨。" },
  template: { label: "交付模板", description: "适合输出卡片、契约或画布。" },
  workflow: { label: "流程设计", description: "适合重写真实业务链路。" },
  workshop: { label: "工作坊", description: "适合多人共创和深度对齐。" },
};

export function getTool(id: string) {
  return toolLibrary.find((tool) => tool.id === id);
}

export function getRelatedTools(tool: ToolProduct, limit = 3) {
  const explicit = tool.relatedTools
    .map((id) => getTool(id))
    .filter((item): item is ToolProduct => Boolean(item));

  const inferred = toolLibrary.filter(
    (item) =>
      item.id !== tool.id &&
      !explicit.some((related) => related.id === item.id) &&
      item.tags.some((tag) => tool.tags.includes(tag)),
  );

  return [...explicit, ...inferred].slice(0, limit);
}

export function chapterLabel(chapter: number) {
  return `第 ${chapter} 章`;
}
