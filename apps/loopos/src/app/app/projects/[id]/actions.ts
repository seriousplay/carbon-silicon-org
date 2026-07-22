"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";

export type ProjectLifecycleState = { error?: string } | undefined;

const transitions = {
  ACTIVE: new Set(["PAUSED", "COMPLETED"]),
  PAUSED: new Set(["ACTIVE", "COMPLETED"]),
  COMPLETED: new Set<string>(),
} as const;

export async function transitionProjectAction(projectId: string, expectedStatus: string, targetStatus: string): Promise<ProjectLifecycleState> {
  const [organizationId, actor] = await Promise.all([getCurrentOrgId(), getCurrentPerson()]);
  if (!actor || actor.organizationId !== organizationId) return { error: "只有项目承担者可以更新项目" };
  if (!(expectedStatus in transitions) || !transitions[expectedStatus as keyof typeof transitions].has(targetStatus)) return { error: "项目状态转移无效" };
  const now = new Date();
  const updated = await prisma.project.updateMany({
    where: { id: projectId, organizationId, bearerId: actor.id, status: expectedStatus },
    data: targetStatus === "COMPLETED"
      ? { status: "COMPLETED", completedAt: now, completedById: actor.id }
      : { status: targetStatus, completedAt: null, completedById: null },
  });
  if (updated.count !== 1) return { error: "项目状态或承担者已变化，请刷新后重试" };
  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath("/app/projects");
  return undefined;
}
