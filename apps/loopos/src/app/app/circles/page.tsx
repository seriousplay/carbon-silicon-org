import Link from "next/link";
import { getCurrentOrgId } from "@/lib/session";
import { prisma } from "@/lib/db";
import { circleTypeMap, circleStatusMap, circleNumberMap } from "@/lib/constants";
import { StatusBadge } from "@/components/shared/status-badge";

export default async function CirclesPage() {
  const orgId = await getCurrentOrgId();

  const circles = await prisma.circle.findMany({
    where: { organizationId: orgId, status: { not: "ARCHIVED" } },
    include: {
      leadPerson: { select: { id: true, name: true } },
      _count: {
        select: {
          people: true,
          roles: { where: { status: "ACTIVE" } },
        },
      },
    },
    orderBy: [{ number: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="max-w-5xl mx-auto animate-fade-rise">
      {/* 页头 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl font-medium mb-1">回路</h1>
          <p className="text-sm text-muted-foreground">
            按生产链路编组的组织单元，回路之间相互滋养 ·{" "}
            <Link href="/app/circles/map" className="text-moss hover:underline">
              地图视图
            </Link>
          </p>
        </div>
      </div>

      {/* 回路列表 */}
      {circles.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="text-4xl mb-4 text-moss/60">❋</div>
          <h2 className="font-serif text-lg font-medium mb-2">还没有回路</h2>
          <p className="text-sm text-muted-foreground">
            组织结构变更需通过正式治理流程。
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {circles.map((circle, i) => {
            const typeInfo = circleTypeMap[circle.type];
            const statusInfo = circleStatusMap[circle.status];
            const numberInfo = circleNumberMap[circle.number];

            return (
              <Link
                key={circle.id}
                href={`/app/circles/${circle.id}`}
                className="rounded-card border border-border bg-card p-5 shadow-soft card-hover animate-fade-rise"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {/* 卡片头部 */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg text-moss">❋</span>
                    <div>
                      <h3 className="font-serif text-base font-medium leading-tight">
                        {circle.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {numberInfo.label} · {typeInfo.label}
                      </p>
                    </div>
                  </div>
                  <StatusBadge
                    variant={statusInfo.badge}
                    label={statusInfo.label}
                    icon={statusInfo.icon}
                    pulse={circle.status === "HALTED"}
                  />
                </div>

                {/* 回路目的 */}
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {circle.purpose}
                </p>

                {/* 底部统计 */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{circle._count.people} 人</span>
                  <span>·</span>
                  <span>{circle._count.roles} 角色</span>
                  {circle.leadPerson && (
                    <>
                      <span>·</span>
                      <span>负责人 {circle.leadPerson.name}</span>
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
