/**
 * AI 张力翻译者
 *
 * 基于 docs/06-AI能力边界与降级.md 2.2 节
 * - 模糊吐槽 → 结构化张力草稿
 * - 准确率目标 ≥85%
 * - 结果是"草稿"，需人确认才落库（docs/06 第四节：AI 不做决策者）
 * - 降级：未接入时引导表单填写
 */
import { askAI, isAIAvailable } from "./provider";

export type TensionTranslation = {
  structuredDescription: string; // 结构化描述
  suggestedType: "PROBLEMATIC" | "CONSTRUCTIVE" | "CLARIFYING";
  suggestedCircles: string[]; // 建议涉及的回路关键词
  summary: string; // 一句话总结
};

const SYSTEM_PROMPT = `你是一个组织治理助手，帮助把模糊的吐槽翻译成结构化的"张力"。

回路制中的"张力"是组织感知到差距的信号，分三种类型：
- 问题性（PROBLEMATIC）：某事卡住了，需要被解决
- 建设性（CONSTRUCTIVE）：有更好的做法，可以改进
- 澄清性（CLARIFYING）：角色边界不清，需要澄清

你的任务：把用户的模糊描述翻译成结构化的张力草稿。用户后续会确认或修改，所以你只需要给出建议。

请用中文，以 JSON 格式返回，字段：
{
  "structuredDescription": "结构化重写的描述，清晰说明当前现实和期望状态",
  "suggestedType": "PROBLEMATIC | CONSTRUCTIVE | CLARIFYING",
  "suggestedCircles": ["涉及的关键领域/回路关键词，如 数据/预训练/工程基座"],
  "summary": "一句话总结这个张力的核心"
}

只返回 JSON，不要其他文字。`;

/**
 * 翻译张力
 * 返回 null 表示 AI 不可用或翻译失败，调用方应降级到表单模式
 */
export async function translateTension(
  rawDescription: string
): Promise<TensionTranslation | null> {
  if (!isAIAvailable()) return null;

  try {
    const result = await askAI(SYSTEM_PROMPT, rawDescription, {
      temperature: 0.2,
      maxTokens: 2000,
    });

    // 解析 JSON（容错：AI 可能返回带 markdown 包裹的 JSON）
    const jsonStr = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(jsonStr) as TensionTranslation;

    // 基本校验
    if (!parsed.structuredDescription || !parsed.suggestedType) {
      return null;
    }

    return parsed;
  } catch (e) {
    console.error("张力翻译失败:", e);
    return null;
  }
}
