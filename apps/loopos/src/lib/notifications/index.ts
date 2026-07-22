import { createHash } from "node:crypto";

export type NotificationType =
  | "invitation_received"
  | "meeting_participation"
  | "outcome_assigned"
  | "commitment_approaching"
  | "commitment_overdue"
  | "blocker_overdue"
  | "blocker_escalated"
  | "blocker_assigned"
  | "meeting_reminder"
  | "tension_received"
  | "role_application_submitted"
  | "role_application_accepted"
  | "interface_validation_overdue"
  | "ddl_approaching";

export type NotificationClient = {
  person: {
    findFirst(args: {
      where: { id: string; organizationId: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
  notification: {
    createMany(args: {
      data: Array<{
        id: string;
        organizationId: string;
        recipientId: string;
        type: string;
        title: string;
        body: string;
        targetUrl?: string;
      }>;
      skipDuplicates: true;
    }): Promise<{ count: number }>;
  };
};

export type CreateNotificationInput = {
  organizationId: string;
  recipientId: string;
  type: NotificationType;
  eventKey: string;
  title: string;
  body: string;
  targetUrl?: string;
};

export function notificationIdForEvent(input: Pick<CreateNotificationInput,
  "organizationId" | "recipientId" | "type" | "eventKey"
>): string {
  const identity = [input.organizationId, input.recipientId, input.type, input.eventKey].join("\u001f");
  return `ntf_${createHash("sha256").update(identity).digest("hex").slice(0, 32)}`;
}

/** Create one recipient-scoped notification for one immutable domain event. */
export async function createNotification(
  input: CreateNotificationInput,
  client?: NotificationClient,
): Promise<boolean> {
  const scopedClient = client ?? await productionNotificationClient();
  const recipient = await scopedClient.person.findFirst({
    where: { id: input.recipientId, organizationId: input.organizationId },
    select: { id: true },
  });
  if (!recipient) throw new Error("通知接收人不属于当前组织");

  const result = await scopedClient.notification.createMany({
    data: [{
      id: notificationIdForEvent(input),
      organizationId: input.organizationId,
      recipientId: input.recipientId,
      type: input.type,
      title: input.title,
      body: input.body,
      targetUrl: input.targetUrl,
    }],
    skipDuplicates: true,
  });
  return result.count === 1;
}

export async function notifyMeetingParticipants(input: {
  organizationId: string;
  meetingId: string;
  meetingTitle: string;
  startedAt: Date;
  recipientIds: string[];
  actorId: string;
  client?: NotificationClient;
}): Promise<void> {
  const client = input.client ?? await productionNotificationClient();
  for (const recipientId of new Set(input.recipientIds)) {
    if (recipientId === input.actorId) continue;
    await createNotification({
      organizationId: input.organizationId,
      recipientId,
      type: "meeting_participation",
      eventKey: `meeting:${input.meetingId}:participant:${recipientId}`,
      title: `你已加入会议：${input.meetingTitle}`,
      body: `会议时间：${input.startedAt.toLocaleString("zh-CN")}。`,
      targetUrl: `/app/meetings/${input.meetingId}`,
    }, client);
  }
}

export async function notifyOutcomeAssignment(input: {
  organizationId: string;
  proposalId: string;
  outcomeKind: "PROJECT" | "ACTION";
  outcomeId: string;
  title: string;
  recipientId: string;
  client?: NotificationClient;
}): Promise<boolean> {
  return createNotification({
    organizationId: input.organizationId,
    recipientId: input.recipientId,
    type: "outcome_assigned",
    eventKey: `tactical-outcome:${input.proposalId}:${input.outcomeKind}:${input.outcomeId}`,
    title: `已指派${input.outcomeKind === "PROJECT" ? "项目" : "行动"}：${input.title}`,
    body: "会议已批准该结果，请进入工作项确认并推进。",
    targetUrl: input.outcomeKind === "PROJECT"
      ? `/app/projects/${input.outcomeId}`
      : `/app/tracker/${input.outcomeId}`,
  }, input.client ?? await productionNotificationClient());
}

export async function getUnreadCount(organizationId: string, personId: string): Promise<number> {
  const client = await productionNotificationClient();
  return client.notification.count({
    where: { organizationId, recipientId: personId, readAt: null },
  });
}

export async function markAsRead(
  organizationId: string,
  personId: string,
  notificationId: string,
): Promise<void> {
  const client = await productionNotificationClient();
  await client.notification.updateMany({
    where: { id: notificationId, organizationId, recipientId: personId },
    data: { readAt: new Date() },
  });
}

export async function markAllAsRead(organizationId: string, personId: string): Promise<void> {
  const client = await productionNotificationClient();
  await client.notification.updateMany({
    where: { organizationId, recipientId: personId, readAt: null },
    data: { readAt: new Date() },
  });
}

async function productionNotificationClient() {
  const { prisma } = await import("@/lib/db");
  return prisma;
}
