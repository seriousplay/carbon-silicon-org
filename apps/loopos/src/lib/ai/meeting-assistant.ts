/**
 * 会议议程生成 + 会后守护者报告
 *
 * 基于 docs/06-AI能力边界与降级.md
 * - 议程生成：基于追踪表未闭环项，生成治理会议程草案
 * - 守护者报告：分析纪要中的禁用词/四要素缺失/超时
 * - 降级：AI 不可用时返回 null，调用方降级处理
 */
import { askAI, isAIAvailable } from "./provider";
import { prisma } from "@/lib/db";

// ─── 议程生成 ──────────────────────────────────────────────
export async function generateMeetingAgenda(
  orgId: string,
  meetingType: "TACTICAL" | "GOVERNANCE" | "STRATEGY",
  circleId?: string
): Promise<string | null> {
  if (!isAIAvailable()) return null;

  // 收集上下文：未闭环阻塞点
  const blockers = await prisma.tension.findMany({
    where: {
      organizationId: orgId,
      status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "BLOCKED"] },
      ...(circleId ? { circleId } : {}),
    },
    include: {
      owner: { select: { name: true } },
      circle: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  const blockersContext = blockers
    .map(
      (b) =>
        `- [${b.circle?.name ?? "未分配"}] ${b.description}（${b.status}，负责人 ${b.owner?.name ?? "未指派"}，DDL ${b.deadline?.toLocaleDateString("zh-CN")}）`
    )
    .join("\n");

  const typeLabel =
    meetingType === "TACTICAL"
      ? "战术会（≤30min，追踪阻塞点）"
      : meetingType === "GOVERNANCE"
      ? "治理会（≤90min，裁决张力，议程模板：追踪核对15min→未闭环解释15min→回路间张力30min→本周冲刺20min→追踪更新10min）"
      : "战略回路（决定做什么样的模型）";

  const prompt = `请为以下${typeLabel}生成一份议程草案。

当前未闭环阻塞点：
${blockersContext || "（暂无）"}

请生成结构化议程，包含时间分配。用中文。`;

  try {
    return await askAI(
      "你是回路制的会议引导者。根据当前阻塞点状态，生成高效、聚焦的会议议程。议程应该聚焦在阻塞点的闭环和张力裁决上，避免泛泛讨论。",
      prompt,
      { temperature: 0.4, maxTokens: 3000 }
    );
  } catch (e) {
    console.error("议程生成失败:", e);
    return null;
  }
}

// ─── 会后守护者报告 ────────────────────────────────────────
export async function generateGuardReport(notes: string): Promise<string | null> {
  if (!isAIAvailable()) return null;
  if (!notes.trim()) return null;

  const prompt = `请分析以下会议纪要，生成"会议守护者报告"。

会议纪要：
${notes}

请检查并报告：
1. 是否出现模糊词（"可能/大概/争取/尽量/尽快"）——如有，指出具体位置
2. 阻塞点是否四要素齐全（负责人/DDL/验收标准/依赖）
3. 是否有超时未闭环的事项被提及但未跟进
4. 总体评价（1-2句）

用中文，简洁。`;

  try {
    return await askAI(
      "你是回路制的会议守护者。你的职责是确保会议产出可执行的结果，检测模糊承诺和遗漏。不评判对错，只指出可改进点。",
      prompt,
      { temperature: 0.3, maxTokens: 3000 }
    );
  } catch (e) {
    console.error("守护者报告生成失败:", e);
    return null;
  }
}
