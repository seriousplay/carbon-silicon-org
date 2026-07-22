"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { draftWeeklyReview, weeklyReviewPeriod, type WeeklyReviewDraft } from "@/lib/ai/weekly-review";
import { isAIAvailable } from "@/lib/ai/provider";

export type WeeklyReviewState = { error?: string; ok?: boolean; draft?: WeeklyReviewDraft } | undefined;

export async function generateWeeklyReviewAction(): Promise<WeeklyReviewState> {
  const [orgId, person] = await Promise.all([getCurrentOrgId(), getCurrentPerson()]);
  if (!person || person.organizationId !== orgId) return { error: "当前账号没有组织成员档案" };
  if (!isAIAvailable()) return { error: "AI 未配置，当前仍可查看本周事实" };

  const draft = await draftWeeklyReview(orgId);
  return draft ? { draft } : { error: "AI 起草失败，请稍后重试" };
}

export async function confirmWeeklyReviewAction(
  _previous: WeeklyReviewState,
  formData: FormData,
): Promise<WeeklyReviewState> {
  const [orgId, person] = await Promise.all([getCurrentOrgId(), getCurrentPerson()]);
  if (!person || person.organizationId !== orgId) return { error: "当前账号没有组织成员档案" };

  const period = weeklyReviewPeriod();
  if (formData.get("period") !== period.key) return { error: "周回顾周期已变化，请重新生成" };
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const risks = String(formData.get("risks") ?? "").trim();
  const nextWeekFocus = String(formData.get("nextWeekFocus") ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
  const credibilityScore = Number(formData.get("credibilityScore"));

  if (!title || !content) return { error: "标题和事实回顾不能为空" };
  if (title.length > 120 || content.length > 12000 || risks.length > 4000) return { error: "周回顾内容过长" };

  try {
    await prisma.governanceLog.create({
      data: {
        organizationId: orgId,
        period: period.key,
        title,
        content,
        patterns: JSON.stringify(nextWeekFocus),
        risks,
        credibilityScore: Number.isFinite(credibilityScore) ? Math.min(1, Math.max(0, credibilityScore)) : 0.3,
        status: "published",
        publishedAt: new Date(),
        confirmedById: person.id,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "本周期回顾已被确认，请重新加载" };
    }
    throw error;
  }

  revalidatePath("/app/review");
  revalidatePath("/app/governance");
  return { ok: true };
}
