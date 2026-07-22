"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrgId } from "@/lib/session";
import { prisma } from "@/lib/db";

export type MetricFormState = { error?: string } | undefined;

export async function createMetricAction(
  circleId: string,
  _prev: MetricFormState,
  formData: FormData
): Promise<MetricFormState> {
  const orgId = await getCurrentOrgId();

  // 验证回路属于该组织
  const circle = await prisma.circle.findFirst({ where: { id: circleId, organizationId: orgId } });
  if (!circle) return { error: "回路不存在" };

  const name = (formData.get("name") as string)?.trim();
  const type = formData.get("type") as string;
  const phase = formData.get("phase") as string;
  const targetValue = (formData.get("targetValue") as string)?.trim();
  const actualValue = (formData.get("actualValue") as string)?.trim() || null;
  const milestone = (formData.get("milestone") as string)?.trim() || null;

  if (!name || !type || !phase || !targetValue) {
    return { error: "请填写所有必填字段" };
  }

  try {
    await prisma.metric.create({
      data: {
        organizationId: orgId,
        circleId,
        name,
        type: type as never,
        phase: phase as never,
        targetValue,
        actualValue,
        milestone,
      },
    });
    revalidatePath(`/app/circles/${circleId}`);
    return undefined;
  } catch (e) {
    console.error("创建指标失败:", e);
    return { error: "创建失败" };
  }
}
