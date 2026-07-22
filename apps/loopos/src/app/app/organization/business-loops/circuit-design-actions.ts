"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";
import { isAIAvailable, askAI } from "@/lib/ai/provider";

// ─── 类型 ────────────────────────────────────────────────────

export interface CircuitDesignStep {
  step: number;
  title: string;
  question: string;
}

export interface CircuitDesignSuggestion {
  name: string;
  purpose: string;
  coreMetrics: { name: string; target: string; unit: string }[];
  nodes: {
    name: string;
    nodeType: "HUMAN_ROLE" | "AI_AGENT";
    responsibility: string;
    agentAbilities?: string;
  }[];
  inputs: { label: string; source: string }[];
  outputs: { label: string; consumer: string }[];
  edges: { from: string; to: string; label: string; edgeType: string }[];
  acceptanceCriteria: { condition: string; measure: string }[];
  cadence: string;
  cadenceDetail: string;
  leadSuggestion: string;
}

export type DesignState = {
  error?: string;
  suggestion?: CircuitDesignSuggestion;
  step?: number;
  totalSteps?: number;
};

// ─── AI 脚手架对话 ───────────────────────────────────────────

const DESIGN_STEPS: CircuitDesignStep[] = [
  { step: 1, title: "价值定位", question: "这个回路为谁创造什么核心价值？一句话说清楚。" },
  { step: 2, title: "核心指标", question: "如何知道这个回路在健康运转？需要哪 2-3 个核心指标？" },
  { step: 3, title: "角色节点", question: "回路需要哪些角色来运转？可以是人类角色，也可以是 AI 智能体。" },
  { step: 4, title: "节点协作", question: "回路节点之间如何协作？数据/价值/信号如何流动？" },
  { step: 5, title: "输入输出", question: "回路从哪接收输入？向谁交付输出？" },
  { step: 6, title: "节奏负责人", question: "回路按什么节奏运转？谁来负责？" },
];

export async function scaffoldCircuitDesignAction(
  _prev: DesignState,
  formData: FormData,
): Promise<DesignState> {
  if (!isAIAvailable()) {
    return { error: "AI 未配置，请先在组织设置中配置模型。" };
  }

  const userInput = String(formData.get("userInput") ?? "").trim();
  const currentStep = Number(formData.get("step") ?? "1");
  const accumulatedContext = String(formData.get("context") ?? "");

  if (!userInput) {
    return { error: "请输入回答。" };
  }

  const stepDef = DESIGN_STEPS.find((s) => s.step === currentStep);
  if (!stepDef) return { error: "无效的步骤。" };

  try {
    const systemPrompt = `你是 LoopOS 的业务回路设计专家。你正在通过脚手架式对话帮助用户设计一条业务价值回路。

当前进度：第 ${currentStep}/${DESIGN_STEPS.length} 步 —「${stepDef.title}」
已收集的上下文：${accumulatedContext || "（第一步，尚无上下文）"}

你的任务是：
1. 理解用户的回答
2. 基于回答和已收集的上下文，给出本条回路的更新设计建议
3. 如果当前步骤不是最后一步，推动进入下一步
4. 如果用户回答模糊，追问具体细节

返回一个 JSON 对象（只返回 JSON，不要 markdown 包裹）：
{
  "acknowledgment": "对用户回答的简短确认（1-2句）",
  "nextQuestion": "下一步的具体问题（如果已是最后一步则为空字符串）",
  "suggestion": {
    "name": "回路名称",
    "purpose": "锚定价值（一句话）",
    "coreMetrics": [{"name":"指标名","target":"目标值","unit":"单位"}],
    "nodes": [{"name":"节点名","nodeType":"HUMAN_ROLE或AI_AGENT","responsibility":"职责描述","agentAbilities":"如果是AI智能体，能力边界是什么"}],
    "inputs": [{"label":"输入描述","source":"来源"}],
    "outputs": [{"label":"输出描述","consumer":"消费方"}],
    "edges": [{"from":"源节点名","to":"目标节点名","label":"连接标签","edgeType":"VALUE或DATA或SIGNAL"}],
    "acceptanceCriteria": [{"condition":"验收条件","measure":"如何衡量"}],
    "cadence": "WEEKLY或BIWEEKLY或MONTHLY或CONTINUOUS",
    "cadenceDetail": "具体的运转节奏描述",
    "leadSuggestion": "建议的回路负责人角色名称"
  }
}

设计原则：
- 回路名称简洁有力（2-5字）
- 每个回路 2-5 个角色节点
- 智能体节点只在明确适合 AI 自动化时建议（如监控巡检、数据处理）
- 指标是可衡量的（带数字目标值）
- 验收标准具体可验证
- 当前步骤未涉及的内容，用已有上下文或合理推断填充
- 已收集的上下文信息优先保留，只基于新回答做增量更新`;

    const result = await askAI(systemPrompt, `用户回答（第${currentStep}步「${stepDef.title}」）：${userInput}`, {
      temperature: 0.4,
      maxTokens: 2000,
    });

    // 解析 AI 响应
    const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      suggestion: parsed.suggestion as CircuitDesignSuggestion,
      step: currentStep < DESIGN_STEPS.length ? currentStep + 1 : DESIGN_STEPS.length + 1,
      totalSteps: DESIGN_STEPS.length,
    };
  } catch (e) {
    console.error("回路设计 AI 调用失败:", e);
    return { error: "AI 响应异常，请重试。" };
  }
}

export async function getNextScaffoldQuestionAction(step: number): Promise<{ question: string; title: string } | { error: string }> {
  const stepDef = DESIGN_STEPS.find((s) => s.step === step);
  if (!stepDef) return { error: "无效步骤" };
  return { question: stepDef.question, title: stepDef.title };
}

// ─── 创建回路 ────────────────────────────────────────────────

export async function createCircuitFromDesignAction(
  design: CircuitDesignSuggestion,
): Promise<{ error?: string; ok?: boolean; loopId?: string; tensionsCreated?: number }> {
  const orgId = await getCurrentOrgId();
  const person = await getCurrentPerson();
  if (!person) return { error: "无法获取当前用户" };

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 创建回路
      const loop = await tx.businessLoop.create({
        data: {
          organizationId: orgId,
          name: design.name,
          purpose: design.purpose,
          status: "ACTIVE",
          coreMetrics: design.coreMetrics,
          cadence: design.cadence,
          cadenceDetail: design.cadenceDetail,
          inputs: design.inputs,
          outputs: design.outputs,
          acceptanceCriteria: design.acceptanceCriteria,
          leadPersonId: person.id,
          leadRoleLabel: design.leadSuggestion,
        },
      });

      // 创建节点 + 角色匹配 + 生成治理张力
      const nodeMap = new Map<string, string>();
      const unmatchedNodes: string[] = [];

      // 预查询现有角色和人员，用于匹配
      const existingRoles = await tx.roleDef.findMany({
        where: { organizationId: orgId, status: "ACTIVE" },
        select: { id: true, name: true, circleId: true },
      });
      const existingPeople = await tx.person.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true, entityType: true },
      });
      const rootCircle = await tx.circle.findFirst({
        where: { organizationId: orgId, parentId: null },
        select: { id: true },
      });

      for (let i = 0; i < design.nodes.length; i++) {
        const node = design.nodes[i];
        let matchedRoleId: string | undefined;
        let agentPersonId: string | undefined;

        if (node.nodeType === "AI_AGENT") {
          // AI 智能体：尝试复用已有 Agent，否则新建
          const existingAgent = existingPeople.find(
            (p) => p.entityType === "AGENT" && p.name === node.name
          );
          if (existingAgent) {
            agentPersonId = existingAgent.id;
          } else {
            const agent = await tx.person.create({
              data: {
                organizationId: orgId,
                name: node.name,
                entityType: "AGENT",
                agentAbilities: node.agentAbilities ?? "",
                homeCircleId: rootCircle?.id ?? "",
              },
            });
            agentPersonId = agent.id;
          }
        } else {
          // 人类角色：尝试匹配现有角色（模糊匹配）
          const matchedRole = existingRoles.find(
            (r) => r.name.includes(node.name) || node.name.includes(r.name)
          );
          if (matchedRole) {
            matchedRoleId = matchedRole.id;
          } else {
            unmatchedNodes.push(node.name);
          }

          // 尝试匹配现有人员
          const matchedPerson = existingPeople.find(
            (p) => p.entityType === "HUMAN" && (p.name.includes(node.name) || node.name.includes(p.name))
          );
          if (matchedPerson) {
            agentPersonId = matchedPerson.id;
          }
        }

        const created = await tx.businessLoopNode.create({
          data: {
            organizationId: orgId,
            loopId: loop.id,
            name: node.name,
            nodeType: node.nodeType,
            responsibility: node.responsibility,
            agentCapabilities: node.agentAbilities,
            roleId: matchedRoleId,
            personId: agentPersonId,
            position: i,
          },
        });
        nodeMap.set(node.name, created.id);
      }

      // 为未匹配角色自动提交治理张力
      for (const nodeName of unmatchedNodes) {
        await tx.tension.create({
          data: {
            organizationId: orgId,
            title: `[业务回路] 需要创建角色「${nodeName}」`,
            description: `业务回路「${design.name}」中定义了角色「${nodeName}」，但在组织结构中未找到匹配的现有角色。\n\n建议通过治理会议创建此角色，或将此张力转交对应回路负责人处理。\n\n来源：业务回路 ${design.name}`,
            type: "CONSTRUCTIVE",
            status: "OPEN",
            source: "FORM",
            circleId: rootCircle?.id ?? "",
            raiserId: person.id,
          },
        });
      }

      // 创建连接边
      for (let i = 0; i < design.edges.length; i++) {
        const edge = design.edges[i];
        const fromId = nodeMap.get(edge.from);
        const toId = nodeMap.get(edge.to);
        if (fromId && toId) {
          await tx.businessLoopEdge.create({
            data: {
              organizationId: orgId,
              businessLoopId: loop.id,
              fromNodeId: fromId,
              toNodeId: toId,
              edgeType: (edge.edgeType as "VALUE" | "DATA" | "SIGNAL" | "DECISION_SIGNAL" | "EVIDENCE") || "VALUE",
              label: edge.label,
              position: i,
            },
          });
        }
      }

      return { loop, tensionsCreated: unmatchedNodes.length };
    });

    revalidatePath("/app/organization/business-loops");
    revalidatePath("/app/tracker");
    return {
      ok: true,
      loopId: result.loop.id,
      tensionsCreated: result.tensionsCreated,
    };
  } catch (e) {
    console.error("创建回路失败:", e);
    return { error: "创建回路失败，请重试。" };
  }
}
