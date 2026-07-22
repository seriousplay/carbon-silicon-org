import Link from "next/link";
import { getCurrentPerson, getCurrentOrgId } from "@/lib/session";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/shared/status-badge";
import { blockerStatusMap, cardStatusMap, roleCategoryMap } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { OrganizationSubnav } from "../organization/organization-subnav";

export default async function MyWorkspacePage() {
  const person = await getCurrentPerson();
  const orgId = await getCurrentOrgId();

  if (!person) return null;

  // 查我的角色（含回路信息）
  const myRoles = await prisma.roleDef.findMany({
    where: {
      organizationId: orgId,
      status: "ACTIVE",
      assignees: { some: { id: person.id } },
    },
    include: {
      circle: { select: { id: true, name: true } },
    },
    orderBy: { category: "asc" },
  });

  // 查我负责的张力（进行中的）
  const myTensions = await prisma.tension.findMany({
    where: {
      organizationId: orgId,
      ownerId: person.id,
      status: { notIn: ["RESOLVED", "REJECTED"] },
    },
    include: {
      role: { select: { id: true, name: true } },
      circle: { select: { id: true, name: true } },
    },
    orderBy: { deadline: "asc" },
  });

  // 查我提出的张力
  const raisedTensions = await prisma.tension.count({
    where: {
      organizationId: orgId,
      raiserId: person.id,
    },
  });

  // 查我闭环的数量
  const resolvedCount = await prisma.tension.count({
    where: {
      organizationId: orgId,
      ownerId: person.id,
      status: "RESOLVED",
    },
  });

  const nowMs = new Date().getTime();

  // 本周闭环数
  const weekAgo = new Date(nowMs - 7 * 86400000);
  const resolvedThisWeek = await prisma.tension.count({
    where: {
      organizationId: orgId,
      ownerId: person.id,
      status: "RESOLVED",
      resolvedAt: { gte: weekAgo },
    },
  });

  const cardInfo = cardStatusMap[person.cardStatus];

  return (
    <div className="max-w-5xl mx-auto animate-fade-rise space-y-6">
      <OrganizationSubnav active="my-roles" />

      {/* 头部：我是谁，归属哪里 */}
      <div className="flex items-center gap-4 mb-8">
        <div className="h-16 w-16 rounded-full bg-moss-pale text-moss flex items-center justify-center text-xl font-medium shrink-0">
          {person.name.slice(0, 2)}
        </div>
        <div className="flex-1">
          <h1 className="font-serif text-2xl font-medium">{person.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground">归属</span>
            <Link
              href={`/app/circles/${person.homeCircleId}`}
              className="text-sm font-medium text-moss hover:underline"
            >
              {person.homeCircle.name}
            </Link>
            <StatusBadge variant={cardInfo.badge as never} label={cardInfo.label} />
          </div>
        </div>
      </div>

      {/* 我的贡献（数据卡片）*/}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="rounded-card border border-border bg-card p-4 shadow-soft">
          <p className="text-xs text-muted-foreground mb-1">承担角色</p>
          <p className="font-serif text-2xl font-medium">{myRoles.length}</p>
        </div>
        <div className="rounded-card border border-border bg-card p-4 shadow-soft">
          <p className="text-xs text-muted-foreground mb-1">进行中行动</p>
          <p className="font-serif text-2xl font-medium">{myTensions.length}</p>
        </div>
        <div className="rounded-card border border-border bg-card p-4 shadow-soft">
          <p className="text-xs text-muted-foreground mb-1">已闭环</p>
          <p className="font-serif text-2xl font-medium text-moss">{resolvedCount}</p>
          {resolvedThisWeek > 0 && (
            <p className="text-xs text-growing mt-0.5">本周 +{resolvedThisWeek}</p>
          )}
        </div>
      </div>

      {/* 我的角色（核心：角色价值可视化）*/}
      <section className="mb-8">
        <h2 className="font-serif text-lg font-medium mb-4">我的角色</h2>
        {myRoles.length === 0 ? (
          <div className="rounded-card border border-dashed border-border bg-card/50 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              你还没有被分配角色。请联系回路负责人为你分配角色。
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {myRoles.map((role) => {
              const catInfo = roleCategoryMap[role.category];
              return (
                <Link
                  key={role.id}
                  href={`/app/roles/${role.id}`}
                  className="block rounded-card border border-border bg-card p-5 shadow-soft card-hover"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-base">{role.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge variant="growing" label={catInfo.label} />
                        <span className="text-xs text-muted-foreground">
                          {role.circle.name}
                        </span>
                      </div>
                    </div>
                    <span className="text-moss text-lg shrink-0">❋</span>
                  </div>

                  {/* Purpose（角色目的——价值感的核心）*/}
                  <div className="mb-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                      目的
                    </p>
                    <p className="text-sm font-serif italic text-foreground/80">
                      {role.purpose}
                    </p>
                  </div>

                  {/* Accountabilities（角色职责）*/}
                  {role.accountabilities && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                        持续承担
                      </p>
                      <ul className="space-y-0.5">
                        {role.accountabilities.split("\n").filter(Boolean).slice(0, 3).map((acc, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <span className="text-moss/50 mt-0.5">·</span>
                            <span>{acc}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {role.domain && (
                    <p className="text-xs text-muted-foreground/70 mt-2 pt-2 border-t border-border">
                      域：{role.domain}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* 我的行动（按角色分组）*/}
      <section className="mb-8">
        <h2 className="font-serif text-lg font-medium mb-4">
          进行中的行动 ({myTensions.length})
        </h2>
        {myTensions.length === 0 ? (
          <div className="rounded-card border border-dashed border-border bg-card/50 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              没有进行中的行动。去提一个张力，或在会议上认领行动项。
            </p>
            <Link href="/app/tensions/new" className="inline-block mt-3">
              <Button variant="outline" size="sm">提一个张力</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {myTensions.map((t) => {
              const statusInfo = blockerStatusMap[t.status];
              const daysToDeadline = t.deadline
                ? (t.deadline.getTime() - nowMs) / 86400000
                : null;
              return (
                <Link
                  key={t.id}
                  href={`/app/tracker/${t.id}`}
                  className="block rounded-input border border-border bg-card px-4 py-3 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <StatusBadge variant={statusInfo.badge as never} label={statusInfo.label} />
                        {t.role && (
                          <span className="text-xs text-moss">· {t.role.name}</span>
                        )}
                      </div>
                      <p className="text-sm truncate">{t.title}</p>
                    </div>
                    <span className={`text-xs shrink-0 ${daysToDeadline !== null && daysToDeadline < 0 ? "text-urgent font-medium" : "text-muted-foreground"}`}>
                      {daysToDeadline !== null ? (
                        <>
                          {daysToDeadline < 0
                            ? "已过 DDL"
                            : `${Math.ceil(daysToDeadline)}天`}
                        </>
                      ) : (
                        "No time commitment"
                      )}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* 我提出的张力 */}
      {raisedTensions > 0 && (
        <section>
          <h2 className="font-serif text-lg font-medium mb-4">我提出的张力</h2>
          <p className="text-sm text-muted-foreground">
            你累计提出了 <span className="font-medium text-foreground">{raisedTensions}</span> 个张力——
            每一个张力都是组织感知到差距的信号，是改进的燃料。
          </p>
        </section>
      )}
    </div>
  );
}
