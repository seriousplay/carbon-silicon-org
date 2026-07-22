"use server";

/**
 * 阻塞点状态转移
 *
 * 基于 lib/statemachine.ts 的转移表。
 * 仅已通过行动提案的当前负责人可以执行状态转移。
 * 基于 review/v1 产品 P0-2：状态转移后 router.refresh()
 */
import { revalidatePath } from "next/cache";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";
import { canTransition } from "@/lib/statemachine";
import { authorizeTrackerTensionMutation } from "@/lib/domain-operations";
import { currentTrackerActionDependencies } from "./action-dependencies";

export type TransitionState = { error?: string } | undefined;

const productionDependencies = {
  prisma,
  getCurrentOrgId,
  getCurrentPerson,
  authorizeTrackerTensionMutation,
  revalidatePath,
  beforeTrackerWrite: async (): Promise<void> => {},
};

export async function transitionTensionAction(
  tensionId: string,
  toStatus: string,
  _prev: TransitionState
): Promise<TransitionState> {
  void _prev;
  const dependencies = currentTrackerActionDependencies(productionDependencies);
  const orgId = await dependencies.getCurrentOrgId();
  const actor = await dependencies.getCurrentPerson();
  if (!actor || actor.organizationId !== orgId) return { error: "无权操作此行动" };

  try {
    await dependencies.authorizeTrackerTensionMutation(dependencies.prisma, {
      organizationId: orgId,
      tensionId,
      actorId: actor.id,
    });
  } catch {
    return { error: "只有已通过行动提案的当前负责人可以更新此行动" };
  }
  await dependencies.beforeTrackerWrite();

  const blocker = await dependencies.prisma.tension.findFirst({
    where: { id: tensionId, organizationId: orgId, ownerId: actor.id },
  });
  if (!blocker) return { error: "行动不存在或负责人已变更" };

  if (!canTransition(blocker.status, toStatus as never)) {
    return { error: `非法状态转移: ${blocker.status} → ${toStatus}` };
  }

  const data: Record<string, unknown> = {
    status: toStatus,
    resolvedAt: toStatus === "RESOLVED" ? new Date() : null,
  };
  if (toStatus.startsWith("ESCALATED")) {
    data.consecutiveMissed = { increment: 1 };
  }

  const updated = await dependencies.prisma.tension.updateMany({
    where: { id: tensionId, organizationId: orgId, ownerId: actor.id },
    data,
  });
  if (updated.count !== 1) return { error: "行动负责人已变更，请刷新后重试" };

  // ★ review P0-2: 状态转移后页面自动刷新
  dependencies.revalidatePath("/app/tracker");
  dependencies.revalidatePath(`/app/tracker/${tensionId}`);
  dependencies.revalidatePath("/app");
  return undefined;
}

/**
 * 扫描所有阻塞点，检测升级信号并创建通知。
 * 基于独立 worker 调用（见 worker/ 目录）。
 */
export async function scanEscalationsForOrg(orgId: string): Promise<void> {
  const blockers = await prisma.tension.findMany({
    where: {
      organizationId: orgId,
      status: { notIn: ["RESOLVED", "REJECTED"] },
    },
    include: { owner: { select: { id: true } } },
  });

  for (const tension of blockers) {
    if (!tension.ownerId) continue;
    const hoursSinceUpdate = (Date.now() - tension.updatedAt.getTime()) / 3600000;
    if (hoursSinceUpdate > 48) {
      const { createNotification } = await import("@/lib/notifications");
      await createNotification({
        organizationId: orgId,
        recipientId: tension.ownerId,
        type: "blocker_overdue",
        eventKey: `tension:${tension.id}:inactive-48h`,
        title: `张力超时：${tension.title.slice(0, 40)}`,
        body: `已超过 48h 无更新（当前 ${Math.floor(hoursSinceUpdate)}h）。请更新状态或标记阻塞。`,
        targetUrl: `/app/tracker/${tension.id}`,
      });
    }
  }
}
