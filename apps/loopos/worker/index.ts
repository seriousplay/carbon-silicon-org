/**
 * 回路OS 独立 worker
 *
 * 基于 review/v1 工程 P0-3：定时任务零实现
 * 基于 docs/09 决策：独立 Node worker 进程（node-cron），不依赖 Vercel
 *
 * 职责：
 *   - 每小时扫描一次所有组织的阻塞点，检测超时和升级信号
 *   - 创建站内通知 + （配置后）发送邮件
 *
 * 启动: pnpm worker  （或 node --import tsx worker/index.ts）
 */
import "dotenv/config";
import cron from "node-cron";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { detectEscalation, canTransition } from "../src/lib/statemachine";
import { reconcileCommitmentNotificationsForOrg, type CommitmentReconciliationClient } from "../src/lib/notifications/reconcile";
import { createNotification, type NotificationClient, type NotificationType } from "../src/lib/notifications";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool, { schema: "public" });
const prisma = new PrismaClient({ adapter });

async function scanAllOrgs() {
  const orgs = await prisma.organization.findMany({ select: { id: true } });
  console.log(`[${new Date().toISOString()}] 扫描 ${orgs.length} 个组织...`);

  for (const org of orgs) {
    await scanOrg(org.id);
  }
  console.log(`[${new Date().toISOString()}] 扫描完成`);
}

async function scanOrg(orgId: string) {
  const blockers = await prisma.tension.findMany({
    where: {
      organizationId: orgId,
      status: { notIn: ["RESOLVED", "REJECTED"] },
    },
    include: {
      owner: { select: { id: true, name: true } },
      circle: { select: { name: true } },
    },
  });

  for (const blocker of blockers) {
    if (!blocker.ownerId) continue;
    const hoursSinceUpdate = (Date.now() - blocker.updatedAt.getTime()) / 3600000;

    // 48h 超时检测 → 创建通知
    if (hoursSinceUpdate > 48) {
      await maybeNotify({
        orgId,
        personId: blocker.ownerId,
        type: "blocker_overdue",
        eventKey: `tension:${blocker.id}:inactive:${blocker.updatedAt.toISOString()}`,
        title: `张力超时：${blocker.title.slice(0, 40)}`,
        body: `「${blocker.circle?.name ?? "未分配"}」回路中你负责的张力已 ${Math.floor(hoursSinceUpdate)}h 无更新。请更新状态。`,
        targetUrl: `/app/tracker/${blocker.id}`,
      });
    }

    // DDL 临近（24h 内）→ 通知
    if (blocker.deadline) {
      const hoursToDeadline = (blocker.deadline.getTime() - Date.now()) / 3600000;
      if (hoursToDeadline > 0 && hoursToDeadline < 24) {
        await maybeNotify({
          orgId,
          personId: blocker.ownerId,
          type: "ddl_approaching",
          eventKey: `tension:${blocker.id}:deadline:${blocker.deadline.toISOString()}:approaching`,
          title: `DDL 临近：${blocker.title.slice(0, 40)}`,
          body: `「${blocker.circle?.name ?? "未分配"}」的张力将在 ${Math.ceil(hoursToDeadline)}h 后到期。`,
          targetUrl: `/app/tracker/${blocker.id}`,
        });
      }
    }

    // ★ 接入 detectEscalation：自动状态升级（review/v2 P0-2）
    const signal = detectEscalation({
      status: blocker.status,
      hoursSinceUpdate,
    });

    if (signal && signal.auto && canTransition(blocker.status, signal.toStatus)) {
      // 自动升级状态
      const data: Record<string, unknown> = {
        status: signal.toStatus,
        consecutiveMissed: { increment: 1 },
      };
      await prisma.tension.update({ where: { id: blocker.id }, data });

      console.log(`  ⬆ 自动升级 ${blocker.title.slice(0, 30)}: ${blocker.status} → ${signal.toStatus} (${signal.reason})`);

      // 升级通知（给负责人 + 如果升到 L3 也通知）
      await maybeNotify({
        orgId,
        personId: blocker.ownerId,
        type: "blocker_escalated",
        eventKey: `tension:${blocker.id}:escalated:${blocker.status}:${signal.toStatus}`,
        title: `已自动升级：${blocker.title.slice(0, 30)}`,
        body: `${signal.reason}。当前状态：${signal.toStatus}`,
        targetUrl: `/app/tracker/${blocker.id}`,
      });
    }
  }

  const commitments = await reconcileCommitmentNotificationsForOrg(orgId, {
    client: prisma as unknown as CommitmentReconciliationClient,
  });
  if (commitments.created > 0) {
    console.log(`  → 新建 ${commitments.created} 条承诺时间通知`);
  }
}

async function maybeNotify(params: {
  orgId: string;
  personId: string;
  type: NotificationType;
  eventKey: string;
  title: string;
  body: string;
  targetUrl?: string;
}) {
  const created = await createNotification({
    organizationId: params.orgId,
    recipientId: params.personId,
    type: params.type,
    eventKey: params.eventKey,
    title: params.title,
    body: params.body,
    targetUrl: params.targetUrl,
  }, prisma as unknown as NotificationClient);
  if (created) {
    console.log(`  → 通知 ${params.personId}: ${params.title}`);
  }
}

// ─── 启动定时任务 ──────────────────────────────────────────
console.log("回路OS worker 启动");

// 每小时整点扫描
cron.schedule("0 * * * *", async () => {
  try {
    await scanAllOrgs();
  } catch (e) {
    console.error("扫描失败:", e);
  }
});

// 启动时立即执行一次
scanAllOrgs().catch(console.error);

// 优雅退出
process.on("SIGTERM", async () => {
  console.log("worker 退出");
  await pool.end();
  process.exit(0);
});
