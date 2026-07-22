import { createNotification, type NotificationClient } from "./index";

type Commitment = {
  id: string;
  organizationId: string;
  title: string;
  deadline: Date | null;
  ownerId: string | null;
};

export type CommitmentReconciliationClient = NotificationClient & {
  tension: {
    findMany(args: {
      where: {
        organizationId: string;
        ownerId: { not: null };
        deadline: { not: null; lte: Date };
        status: { notIn: string[] };
      };
      select: {
        id: true;
        organizationId: true;
        title: true;
        deadline: true;
        ownerId: true;
      };
    }): Promise<Commitment[]>;
  };
};

export type ReconciliationResult = {
  candidates: number;
  created: number;
};

const APPROACHING_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Deterministic worker entrypoint for deadline-driven notifications. */
export async function reconcileCommitmentNotificationsForOrg(
  organizationId: string,
  options: {
    now?: Date;
    client: CommitmentReconciliationClient;
  },
): Promise<ReconciliationResult> {
  const now = options.now ?? new Date();
  const client = options.client;
  const commitments = await client.tension.findMany({
    where: {
      organizationId,
      ownerId: { not: null },
      deadline: { not: null, lte: new Date(now.getTime() + APPROACHING_WINDOW_MS) },
      status: { notIn: ["RESOLVED", "REJECTED"] },
    },
    select: {
      id: true,
      organizationId: true,
      title: true,
      deadline: true,
      ownerId: true,
    },
  });

  let created = 0;
  for (const commitment of commitments) {
    if (!commitment.ownerId || !commitment.deadline || commitment.organizationId !== organizationId) continue;
    const overdue = commitment.deadline.getTime() <= now.getTime();
    const type = overdue ? "commitment_overdue" : "commitment_approaching";
    const eventKey = `commitment:${commitment.id}:deadline:${commitment.deadline.toISOString()}:${overdue ? "overdue" : "approaching"}`;
    const wasCreated = await createNotification({
      organizationId,
      recipientId: commitment.ownerId,
      type,
      eventKey,
      title: `${overdue ? "承诺已逾期" : "承诺即将到期"}：${commitment.title.slice(0, 40)}`,
      body: overdue
        ? `截止时间为 ${commitment.deadline.toLocaleString("zh-CN")}，请立即更新结果或阻塞原因。`
        : `截止时间为 ${commitment.deadline.toLocaleString("zh-CN")}，请确认交付状态。`,
      targetUrl: `/app/tracker/${commitment.id}`,
    }, client);
    if (wasCreated) created += 1;
  }

  return { candidates: commitments.length, created };
}
