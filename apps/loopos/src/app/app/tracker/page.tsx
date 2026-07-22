import Link from "next/link";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";
import { blockerStatusMap } from "@/lib/constants";

// 看板分列：按状态分组
const COLUMN_ORDER = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "BLOCKED",
  "ESCALATED_L2",
  "ESCALATED_L3",
  "RESOLVED",
] as const;

export default async function TrackerPage() {
  const orgId = await getCurrentOrgId();
  const person = await getCurrentPerson();

  const blockers = await prisma.tension.findMany({
    where: { organizationId: orgId },
    include: {
      owner: { select: { id: true, name: true } },
      circle: { select: { id: true, name: true } },
      role: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // 按状态分组
  const grouped: Record<string, typeof blockers> = {};
  for (const status of COLUMN_ORDER) {
    grouped[status] = blockers.filter((b) => b.status === status);
  }

  const now = new Date().getTime();
  const isOverdue = (updatedAt: Date) =>
    (now - updatedAt.getTime()) / 3600000 > 48;

  return (
    <div className="animate-fade-rise">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-medium mb-1">追踪看板</h1>
          <p className="text-sm text-muted-foreground">
            组织的短期记忆。行动必须有负责人和验收标准，DDL 可按需承诺。
          </p>
        </div>
      </div>

      {/* 看板 */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMN_ORDER.map((status) => {
          const info = blockerStatusMap[status];
          const items = grouped[status];

          return (
            <div key={status} className="w-72 shrink-0">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{info.icon}</span>
                  <span className="text-sm font-medium">{info.label}</span>
                </div>
                <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                  {items.length}
                </span>
              </div>

              <div className="space-y-2 min-h-[100px]">
                {items.length === 0 ? (
                  <div className="rounded-card border border-dashed border-border/50 p-4 text-center">
                    <p className="text-xs text-muted-foreground/50">—</p>
                  </div>
                ) : (
                  items.map((b) => {
                    const overdue = isOverdue(b.updatedAt);
                    const mine = b.ownerId === person?.id;

                    return (
                      <Link
                        key={b.id}
                        href={`/app/tracker/${b.id}`}
                        className={`block rounded-card border bg-card p-3 shadow-soft card-hover ${
                          overdue ? "border-urgent/40" : "border-border"
                        }`}
                      >
                        <p className="text-sm leading-snug line-clamp-2 mb-2">
                          {b.description}
                        </p>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {b.circle?.name ?? "—"}
                          </span>
                          {overdue && (
                            <span className="text-urgent font-medium">⚠ 超时</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-xs text-muted-foreground">
                            {b.owner?.name ?? "未指派"}
                            {b.role && <span className="text-moss"> · {b.role.name}</span>}
                            {mine && " · 我"}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {b.deadline
                              ? (b.deadline.getTime() - now) / 86400000 < 0
                                ? "已过 DDL"
                                : `${Math.ceil((b.deadline.getTime() - now) / 86400000)}天`
                              : "No time commitment"}
                          </span>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
