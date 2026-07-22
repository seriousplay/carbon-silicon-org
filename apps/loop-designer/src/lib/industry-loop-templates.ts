import templates from "./industry-loop-template-data.json";
import type { IndustryLoopTemplate, IndustryLoopTemplateSummary } from "./industry-loop-template-types";
import { buildProcessTransformation, type LegacyWorkflowNode } from "./process-transformation-core";

const industryLoopTemplates = (templates as IndustryLoopTemplate[]).map(enrichBeforeAfterTemplate);

export function listIndustryLoopTemplates(): IndustryLoopTemplate[] {
  return [...industryLoopTemplates].sort((left, right) => left.order - right.order);
}

export function listIndustryLoopTemplateSummaries(): IndustryLoopTemplateSummary[] {
  return listIndustryLoopTemplates().map((template) => ({
    id: template.id,
    order: template.order,
    title: template.title,
    industry: template.industry,
    pathType: template.pathType,
    marginalEffectRating: template.marginalEffectRating,
    definition: template.definition,
    applicableScenarios: template.applicableScenarios,
    tradeoffs: template.tradeoffs,
  }));
}

export function getIndustryLoopTemplate(templateId: string | undefined | null) {
  if (!templateId) return null;
  return industryLoopTemplates.find((template) => template.id === templateId) ?? null;
}

export function formatIndustryLoopTemplateForPrompt(template: IndustryLoopTemplate) {
  return `行业回路参考模板：
标题：${template.title}
行业：${template.industry}
路径类型：${template.pathType || "未标注"}
边际效应：${template.marginalEffectRating || "未标注"}
一句话定义：${template.definition || "未提供"}
适用场景：${template.applicableScenarios || "未提供"}
不适用场景：${template.unsuitableScenarios || "未提供"}
工具建议：${template.tools || "未提供"}
取舍偏好：${template.tradeoffs || "未提供"}
参考案例：${template.cases || "未提供"}
${formatBeforeAfterTemplateForPrompt(template)}

使用要求：
1. 上述内容只能作为行业参考锚点，不能替代客户真实输入。
2. 如果客户输入与模板冲突，以客户输入为准，并在 assumptions 或 validationQuestions 中说明需要确认。
3. 不要照抄模板文本，要把模板转化为适合当前客户价值流的组织角色、接口、HITL 和治理设计。`;
}

function enrichBeforeAfterTemplate(template: IndustryLoopTemplate): IndustryLoopTemplate {
  if (template.beforeAfterTemplate) return template;
  const legacyFlow = legacyFlowForTemplate(template);
  if (!legacyFlow.length) return template;
  const transformation = buildProcessTransformation({ legacyNodes: legacyFlow, now: template.date });
  return {
    ...template,
    beforeAfterTemplate: {
      legacyFlow,
      expectedBreakpoints: transformation.breakpoints,
      transformationMoves: transformation.moves,
      beforeAfter: transformation.beforeAfter,
      facilitatorNotes: facilitatorNotesForTemplate(template),
      ownerTransition: [
        { day: "Day 0", focus: "锁定旧流程和第一批断点", ownerShift: "负责人先定义目标、边界和验收信号，不急着让 AI 自动跑。", evidence: "旧流程节点、三类断点和试运行样例清单" },
        { day: "Day 7", focus: "发布试运行版", ownerShift: "人从逐条执行退到异常接管和验收脚本维护。", evidence: "第一轮运行记录、人工修改点和异常日志" },
        { day: "Day 30", focus: "校准接口和护栏", ownerShift: "负责人开始治理上下游接口协议和版本变更。", evidence: "接口协议、验证信号趋势和复盘记忆" },
        { day: "Day 90", focus: "发布正式运行版或决定回退", ownerShift: "负责人从项目推动者转为回路资产 owner。", evidence: "正式版发布记录、稳定指标和下一轮演化路线" },
      ],
    },
  };
}

function legacyFlowForTemplate(template: IndustryLoopTemplate): LegacyWorkflowNode[] {
  const source = `${template.title} ${template.definition} ${template.applicableScenarios}`.toLowerCase();
  if (/跨境|选品|电商|商品/.test(source)) return legacyNodes("cross-border", ["运营收集平台热卖和竞品信息", "人工整理表格发给采购和老板确认", "等待供应商报价和样品反馈", "上架后只看销量日报"]);
  if (/客服|投诉|客诉|售后/.test(source)) return legacyNodes("support", ["客服记录客户投诉并转述给对应部门", "等待产品或交付确认责任归属", "人工回复客户处理进度", "结案后缺少同类投诉复现率回验"]);
  if (/销售|线索|商机|获客/.test(source)) return legacyNodes("sales", ["市场把线索名单汇总给销售", "销售逐条判断是否值得跟进", "等待负责人确认重点客户优先级", "成交或流失后没有回灌线索质量"]);
  if (/教研|讲评|教育|课程/.test(source)) return legacyNodes("education", ["老师收集作业和课堂表现", "人工整理共性问题给教研组", "等待教研排期讨论讲评方案", "讲评后没有追踪下一次作业改善"]);
  if (/合同|法务|审核|合规/.test(source)) return legacyNodes("contract", ["业务提交合同草稿和口头背景", "法务人工审查并汇总风险点", "等待业务负责人确认商务取舍", "签署后没有回验争议条款是否复现"]);
  return [];
}

function legacyNodes(prefix: string, actions: string[]): LegacyWorkflowNode[] {
  return actions.map((action, index) => ({
    id: `${prefix}-${index + 1}`,
    order: index + 1,
    action,
    owner: index === 0 ? "一线角色" : index === actions.length - 1 ? "业务负责人" : "协作角色",
    input: index === 0 ? "原始业务信息、聊天记录、表格、历史案例" : "上一步整理后的摘要和判断",
    output: index === actions.length - 1 ? "处理结果或日报" : "转述后的摘要",
    approval: /确认|审核|负责人/.test(action) ? "负责人确认" : undefined,
    waitFor: /等待|排期/.test(action) ? action : undefined,
    acceptance: index === actions.length - 1 ? "完成" : "已同步",
    painNote: /整理|汇总|转述/.test(action) ? "原始上下文被压缩，下游需要反复追问。" : /等待/.test(action) ? "没有明确 SLA 和替代路径。" : "结果没有进入下一轮学习。",
  }));
}

function facilitatorNotesForTemplate(template: IndustryLoopTemplate) {
  return [
    `${template.title} 样板只用于冷启动，现场应让客户替换为自己的旧流程节点。`,
    "讲解时先指出断点，再讲回路；不要先解释抽象定义。",
    "如果客户只想删步骤，提醒他们同时补验证信号和记忆沉淀。",
  ];
}

function formatBeforeAfterTemplateForPrompt(template: IndustryLoopTemplate) {
  if (!template.beforeAfterTemplate) return "";
  return `行业 Before/After 样板：
旧流程节点：${template.beforeAfterTemplate.legacyFlow.map((node) => `${node.order}.${node.action}`).join("；")}
预期断点：${template.beforeAfterTemplate.expectedBreakpoints.map((breakpoint) => breakpoint.type).join("、")}
负责人过渡：${template.beforeAfterTemplate.ownerTransition.map((item) => `${item.day} ${item.focus}`).join("；")}`;
}
