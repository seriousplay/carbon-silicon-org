"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";
import { authorizeTrackerTensionMutation } from "@/lib/domain-operations";
import { currentTrackerActionDependencies } from "../action-dependencies";

export type EditTensionState = { error?: string } | undefined;

const productionDependencies = {
  prisma,
  getCurrentOrgId,
  getCurrentPerson,
  authorizeTrackerTensionMutation,
  revalidatePath,
  redirect,
  beforeTrackerWrite: async (): Promise<void> => {},
};

export async function editTensionAction(
  tensionId: string,
  _prev: EditTensionState,
  formData: FormData
): Promise<EditTensionState> {
  const dependencies = currentTrackerActionDependencies(productionDependencies);
  const orgId = await dependencies.getCurrentOrgId();
  const actor = await dependencies.getCurrentPerson();
  if (!actor || actor.organizationId !== orgId) return { error: "无权编辑此行动" };

  try {
    await dependencies.authorizeTrackerTensionMutation(dependencies.prisma, {
      organizationId: orgId,
      tensionId,
      actorId: actor.id,
    });
  } catch {
    return { error: "只有已通过行动提案的当前负责人可以编辑此行动" };
  }
  await dependencies.beforeTrackerWrite();

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const acceptanceCriteria = (formData.get("acceptanceCriteria") as string)?.trim() || null;
  const deadlineStr = formData.get("deadline") as string;
  const rootCause = (formData.get("rootCause") as string)?.trim() || null;

  if (!title || !description) {
    return { error: "请填写标题和描述" };
  }

  // 禁用词检测
  const fuzzy = ["可能", "大概", "争取", "尽量", "尽快"];
  if (acceptanceCriteria && fuzzy.some((w) => acceptanceCriteria.includes(w))) {
    return { error: "验收标准包含禁用词，请明确化" };
  }

  try {
    const updated = await dependencies.prisma.tension.updateMany({
      where: { id: tensionId, organizationId: orgId, ownerId: actor.id },
      data: {
        title,
        description,
        acceptanceCriteria: acceptanceCriteria || null,
        deadline: deadlineStr ? new Date(deadlineStr) : null,
        rootCause,
      },
    });
    if (updated.count !== 1) return { error: "行动负责人已变更，请刷新后重试" };
  } catch (e) {
    console.error("编辑张力失败:", e);
    return { error: "编辑失败" };
  }

  // ★ redirect 必须在 try-catch 外调用
  dependencies.revalidatePath("/app/tracker");
  dependencies.revalidatePath(`/app/tracker/${tensionId}`);
  dependencies.redirect(`/app/tracker/${tensionId}`);
}
