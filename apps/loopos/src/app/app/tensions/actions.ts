"use server";

/**
 * 张力相关的 Server Actions
 *
 * 基于 docs/01 数据模型 表4【张力】
 * 基于 docs/06-AI能力边界与降级.md：张力翻译是草稿，需人确认
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";
import { raiseTension } from "@/lib/domain-operations";
import {
  closeCandidateTensionWithHuman,
  confirmCandidateTensionWithHuman,
  mergeCandidateTensionWithHuman,
} from "@/lib/candidate-tensions/service";

export type TensionFormState = { error?: string; tensionId?: string } | undefined;

// ─── 创建张力 ──────────────────────────────────────────────
export async function createTensionAction(
  _prev: TensionFormState,
  formData: FormData
): Promise<TensionFormState> {
  const orgId = await getCurrentOrgId();
  const person = await getCurrentPerson();

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const type = readTensionType(formData);
  const aiTranslation = (formData.get("aiTranslation") as string)?.trim() || null;
  const translationAccepted = formData.get("translationAccepted") === "true";
  const handlingMode = formData.get("handlingMode") as string;
  const aiHandlingSuggestion = (formData.get("aiHandlingSuggestion") as string | null) || null;
  const meetingId = (formData.get("meetingId") as string | null)?.trim() || null;

  // 关联回路（可选，多选）
  const circleIds = formData.getAll("circleIds") as string[];

  if (!title || !description || !["TACTICAL", "GOVERNANCE"].includes(handlingMode)) {
    return { error: "请填写标题、描述并确认处理方式" };
  }

  if (!person) {
    return { error: "无法获取当前用户" };
  }

  let tensionId: string | null = null;

  try {
    const tension = await raiseTension(prisma, {
      organizationId: orgId,
      title,
      description,
      type,
      source: "FORM",
      raiserId: person.id,
      aiTranslation,
      translationAccepted,
      circleIds,
      handlingMode: handlingMode as "TACTICAL" | "GOVERNANCE",
      aiHandlingSuggestion: aiHandlingSuggestion === "TACTICAL" || aiHandlingSuggestion === "GOVERNANCE" ? aiHandlingSuggestion : null,
    });
    tensionId = tension.id;
  } catch (e) {
    console.error("创建张力失败:", e);
    return { error: "创建失败，请重试" };
  }

  // ★ redirect 必须在 try-catch 外调用
  revalidatePath("/app/tensions");
  if (meetingId) revalidatePath(`/app/meetings/${meetingId}`);
  redirect(meetingId ? `/app/meetings/${meetingId}` : `/app/tensions/${tensionId}`);
}

// ─── AI 翻译张力（接入 LLM）────────────────────────────────
// 基于 docs/06 2.2: 准确率目标≥85%，结果作为草稿需人确认
import { translateTension } from "@/lib/ai/tension-translator";
import { isAIAvailable } from "@/lib/ai/provider";

export async function translateTensionAction(rawDescription: string): Promise<{
  translation: string | null;
  suggestedType: string | null;
  summary: string | null;
  warning: string | null;
  suggestedHandlingMode: "TACTICAL" | "GOVERNANCE" | null;
}> {
  if (!rawDescription.trim()) {
    return { translation: null, suggestedType: null, summary: null, warning: "请先填写描述", suggestedHandlingMode: null };
  }

  // 降级：AI 不可用时引导表单填写（docs/06 第六节）
  if (!isAIAvailable()) {
    return {
      translation: null,
      suggestedType: null,
      summary: null,
      warning: "AI 未配置。请手动结构化：涉及哪个回路？什么类型的问题？当前现实 vs 期望状态？",
      suggestedHandlingMode: null,
    };
  }

  const result = await translateTension(rawDescription);
  if (!result) {
    return {
      translation: null,
      suggestedType: null,
      summary: null,
      warning: "AI 翻译失败，请手动填写或稍后重试。",
      suggestedHandlingMode: null,
    };
  }

  return {
    translation: result.structuredDescription,
    suggestedType: result.suggestedType,
    summary: result.summary,
    warning: null,
    suggestedHandlingMode: result.suggestedType === "CLARIFYING" ? "GOVERNANCE" : "TACTICAL",
  };
}

export async function routeUnroutedTensionAction(tensionId: string, formData: FormData): Promise<void> {
  const [organizationId, actor] = await Promise.all([getCurrentOrgId(), getCurrentPerson()]);
  const handlingMode = formData.get("handlingMode");
  if (!actor || actor.organizationId !== organizationId || (handlingMode !== "TACTICAL" && handlingMode !== "GOVERNANCE")) return;
  await prisma.tension.updateMany({
    where: { id: tensionId, organizationId, raiserId: actor.id, handlingMode: "UNROUTED", status: "OPEN" },
    data: { handlingMode },
  });
  revalidatePath(`/app/tensions/${tensionId}`);
  revalidatePath("/app/meetings");
}

export async function confirmCandidateTensionAction(candidateId: string, formData: FormData): Promise<void> {
  const [organizationId, actor] = await Promise.all([getCurrentOrgId(), getCurrentPerson()]);
  const confirmedTensionId = readRequiredFormValue(formData, "confirmedTensionId");
  if (!actor || actor.organizationId !== organizationId) return;
  await confirmCandidateTensionWithHuman(prisma, {
    organizationId,
    candidateId,
    confirmedTensionId,
    actorPersonId: actor.id,
  });
  revalidatePath("/app/tensions");
}

export async function closeCandidateTensionAction(candidateId: string, formData: FormData): Promise<void> {
  const [organizationId, actor] = await Promise.all([getCurrentOrgId(), getCurrentPerson()]);
  const reason = readRequiredFormValue(formData, "reason");
  if (!actor || actor.organizationId !== organizationId) return;
  await closeCandidateTensionWithHuman(prisma, {
    organizationId,
    candidateId,
    actorPersonId: actor.id,
    reason,
    falsePositive: formData.get("falsePositive") === "true",
  });
  revalidatePath("/app/tensions");
}

export async function mergeCandidateTensionAction(candidateId: string, formData: FormData): Promise<void> {
  const [organizationId, actor] = await Promise.all([getCurrentOrgId(), getCurrentPerson()]);
  const mergedIntoId = readRequiredFormValue(formData, "mergedIntoId");
  const reason = readRequiredFormValue(formData, "reason");
  if (!actor || actor.organizationId !== organizationId) return;
  await mergeCandidateTensionWithHuman(prisma, {
    organizationId,
    candidateId,
    actorPersonId: actor.id,
    mergedIntoId,
    reason,
  });
  revalidatePath("/app/tensions");
}

function readRequiredFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) throw new Error(`${key.toUpperCase()}_REQUIRED`);
  return value.trim();
}

function readTensionType(formData: FormData): "PROBLEMATIC" | "CONSTRUCTIVE" | "CLARIFYING" {
  const value = formData.get("type");
  if (value === "PROBLEMATIC" || value === "CONSTRUCTIVE" || value === "CLARIFYING") return value;
  return "PROBLEMATIC";
}
