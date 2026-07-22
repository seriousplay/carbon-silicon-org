"use server";

/**
 * 会议相关的 Server Actions
 *
 * 基于 docs/01 数据模型 子表 S2【会议纪要】
 * 基于 review/v1 工程 P0-2：事务安全
 *
 * 注意：redirect() 必须在 try-catch 外调用（它通过抛异常实现跳转）
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";
import { notifyMeetingParticipants, type NotificationClient } from "@/lib/notifications";
import { Prisma } from "@/generated/prisma/client";
import { evaluateMeetingLifecycle } from "@/lib/organization-setup/meeting-lifecycle-policy";
import { currentMeetingActionDependencies } from "./action-dependencies";

export type MeetingFormState = { error?: string } | undefined;

const MEETING_LIFECYCLE_DENIAL = "组织尚未启用，不能发起会议";

const productionDependencies = {
  prisma,
  getCurrentOrgId,
  getCurrentPerson,
  notifyMeetingParticipants,
  revalidatePath,
  redirect,
};

export async function createMeetingAction(
  _prev: MeetingFormState,
  formData: FormData
): Promise<MeetingFormState> {
  const dependencies = currentMeetingActionDependencies(productionDependencies);
  const orgId = await dependencies.getCurrentOrgId();
  const person = await dependencies.getCurrentPerson();

  const title = (formData.get("title") as string)?.trim();
  const type = formData.get("type") as string;
  const durationMin = parseInt(formData.get("durationMin") as string, 10);
  const startedAtStr = formData.get("startedAt") as string;
  const circleId = (formData.get("circleId") as string) || null;
  const agenda = (formData.get("agenda") as string)?.trim() || "";
  const participantIds = [...new Set(formData.getAll("participantIds").map(String).filter(Boolean))];

  if (!title || !type || !durationMin || !startedAtStr) {
    return { error: "请填写所有必填字段" };
  }

  if (type !== "TACTICAL" && type !== "GOVERNANCE") {
    return { error: "只能发起战术会或治理会" };
  }

  // 会议守护者规则（docs/06）：战术会≤30，治理会≤90
  const limits: Record<string, number> = { TACTICAL: 30, GOVERNANCE: 90, STRATEGY: 180 };
  if (durationMin > limits[type]) {
    return {
      error: `${type} 会议时长不能超过 ${limits[type]} 分钟`,
    };
  }
  if (!person) return { error: "当前账号没有人员档案" };
  if (!participantIds.includes(person.id)) participantIds.push(person.id);

  const validParticipants = await dependencies.prisma.person.findMany({
    where: { id: { in: participantIds }, organizationId: orgId },
    select: { id: true },
  });
  if (validParticipants.length !== participantIds.length) {
    return { error: "参与人必须属于当前组织" };
  }
  if (circleId) {
    const circle = await dependencies.prisma.circle.findFirst({
      where: { id: circleId, organizationId: orgId, status: { not: "ARCHIVED" } },
      select: { id: true },
    });
    if (!circle) return { error: "所属回路必须属于当前组织" };
  }

  let meetingId: string | null = null;

  try {
    const result = await dependencies.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.findUnique({
        where: { id: orgId },
        select: { lifecycleStatus: true },
      });
      const lifecycle = evaluateMeetingLifecycle(organization?.lifecycleStatus);
      if (!lifecycle.allowed) {
        return { error: MEETING_LIFECYCLE_DENIAL } as const;
      }

      const created = await tx.meeting.create({
        data: {
          organizationId: orgId,
          title,
          type: type as never,
          durationMin,
          startedAt: new Date(startedAtStr),
          circleId,
          agenda,
          participants: { connect: participantIds.map((id) => ({ id })) },
        },
      });
      await dependencies.notifyMeetingParticipants({
        organizationId: orgId,
        meetingId: created.id,
        meetingTitle: created.title,
        startedAt: created.startedAt,
        recipientIds: participantIds,
        actorId: person.id,
        client: tx as unknown as NotificationClient,
      });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if ("error" in result) {
      return result;
    }
    meetingId = result.id;
  } catch (e) {
    console.error("创建会议失败:", e);
    return { error: "创建失败" };
  }

  // ★ redirect 必须在 try-catch 外调用（它抛 NEXT_REDIRECT 异常实现跳转）
  dependencies.revalidatePath("/app/meetings");
  dependencies.redirect(`/app/meetings/${meetingId}`);
}
