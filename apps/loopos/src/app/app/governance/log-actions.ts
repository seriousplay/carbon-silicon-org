"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrgId } from "@/lib/session";
import { prisma } from "@/lib/db";
import { draftGovernanceLog } from "@/lib/ai/pattern-builder";
import { isAIAvailable } from "@/lib/ai/provider";

export type LogState = { error?: string; ok?: boolean } | undefined;

// AI 起草治理日志
export async function draftLogAction(period: string): Promise<LogState> {
  const orgId = await getCurrentOrgId();

  if (!isAIAvailable()) {
    return { error: "AI 未配置，无法起草。请在 .env 设置 OPENAI_API_KEY 或 ANTHROPIC_API_KEY" };
  }

  // 检查是否已有该月日志
  const existing = await prisma.governanceLog.findUnique({
    where: { organizationId_period: { organizationId: orgId, period } },
  });
  if (existing && existing.status === "published") {
    return { error: `${period} 日志已发布，无法重新起草` };
  }

  const draft = await draftGovernanceLog(orgId, period);
  if (!draft) {
    return { error: "起草失败，可能数据不足或 AI 调用异常" };
  }

  // upsert：已有草稿则更新，否则新建
  await prisma.governanceLog.upsert({
    where: { organizationId_period: { organizationId: orgId, period } },
    create: {
      organizationId: orgId,
      period,
      title: draft.title,
      content: draft.content,
      patterns: JSON.stringify(draft.patterns, null, 2),
      risks: draft.risks,
      credibilityScore: draft.credibilityScore,
      status: "draft",
    },
    update: {
      title: draft.title,
      content: draft.content,
      patterns: JSON.stringify(draft.patterns, null, 2),
      risks: draft.risks,
      credibilityScore: draft.credibilityScore,
    },
  });

  revalidatePath("/app/governance");
  return { ok: true };
}

// 发布治理日志
export async function publishLogAction(logId: string): Promise<LogState> {
  const orgId = await getCurrentOrgId();

  await prisma.governanceLog.updateMany({
    where: { id: logId, organizationId: orgId },
    data: { status: "published", publishedAt: new Date() },
  });

  revalidatePath("/app/governance");
  return { ok: true };
}
