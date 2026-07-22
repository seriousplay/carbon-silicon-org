import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentOrgId } from "@/lib/session";
import { prisma } from "@/lib/db";
import {
  circleTypeMap,
  circleStatusMap,
  circleNumberMap,
  roleCategoryMap,
  roleOwnershipMap,
} from "@/lib/constants";
import { StatusBadge } from "@/components/shared/status-badge";
import { MetricSection } from "./metrics/metric-section";

export default async function CircleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await getCurrentOrgId();

  const circle = await prisma.circle.findFirst({
    where: { id, organizationId: orgId },
    include: {
      leadPerson: true,
      people: {
        orderBy: { joinedAt: "asc" },
      },
      roles: {
        where: { status: "ACTIVE" },
        orderBy: { category: "asc" },
      },
      parent: { select: { id: true, name: true } },
      metricDefs: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!circle) notFound();

  const typeInfo = circleTypeMap[circle.type];
  const statusInfo = circleStatusMap[circle.status];
  const numberInfo = circleNumberMap[circle.number];

  return (
    <div className="max-w-4xl mx-auto animate-fade-rise">
      {/* 面包屑 */}
      <Link
        href="/app/circles"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 inline-block"
      >
        ← 回路
      </Link>

      {/* 回路头部 */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl text-moss">❋</span>
          <h1 className="font-serif text-3xl font-medium">{circle.name}</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{numberInfo.label}</span>
          <span>·</span>
          <span>{typeInfo.label}回路</span>
          <span>·</span>
          <StatusBadge variant={statusInfo.badge} label={statusInfo.label} />
        </div>
      </div>

      {/* 回路目的（最重要的信息）*/}
      <div className="rounded-card border border-border bg-card p-6 shadow-soft mb-6">
        <div className="flex items-baseline gap-2 mb-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            目的
          </h2>
          <span className="text-xs text-muted-foreground font-mono">Purpose</span>
        </div>
        <p className="font-serif text-lg leading-relaxed">{circle.purpose}</p>
        {circle.domain && (
          <>
            <div className="flex items-baseline gap-2 mb-2 mt-6">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                域
              </h2>
              <span className="text-xs text-muted-foreground font-mono">Domain</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{circle.domain}</p>
          </>
        )}
      </div>

      {/* 负责人 */}
      {circle.leadPerson && (
        <div className="rounded-card border border-border bg-card p-5 shadow-soft mb-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            回路负责人
          </h2>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-moss-pale text-moss flex items-center justify-center text-sm font-medium">
              {circle.leadPerson.name.slice(0, 2)}
            </div>
            <div>
              <p className="font-medium">{circle.leadPerson.name}</p>
              <p className="text-xs text-muted-foreground">
                为回路目标负全责 · 绩效归属
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 角色（Holacracy Role）*/}
      <div className="rounded-card border border-border bg-card p-6 shadow-soft mb-6">
        <div className="mb-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            角色 <span className="font-mono normal-case">({circle.roles.length})</span>
          </h2>
        </div>

        {circle.roles.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            还没有角色。角色不是岗位——它是&quot;为回路目的承担的具体职责&quot;。
          </p>
        ) : (
          <div className="space-y-3">
            {circle.roles.map((role) => {
              const catInfo = roleCategoryMap[role.category];
              const ownInfo = roleOwnershipMap[role.ownershipType];
              return (
                <Link
                  key={role.id}
                  href={`/app/roles/${role.id}`}
                  className="block rounded-input border border-border p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h3 className="font-medium text-sm">{role.name}</h3>
                      <p className="text-xs text-moss mt-0.5">{role.purpose}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge variant="growing" label={catInfo.label} />
                      {role.ownershipType !== "HOME" && (
                        <StatusBadge variant="seed" label={ownInfo.label} />
                      )}
                    </div>
                  </div>
                  {role.accountabilities && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-3 whitespace-pre-line">
                      {role.accountabilities}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* 健康度指标 */}
      <MetricSection circleId={circle.id} existing={circle.metricDefs} />

      {/* 成员 */}
      <div className="rounded-card border border-border bg-card p-6 shadow-soft mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            成员 <span className="font-mono normal-case">({circle.people.length})</span>
          </h2>
          <span className="text-xs text-muted-foreground">
            主归属此回路的人
          </span>
        </div>

        {circle.people.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            还没有成员归属此回路。
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {circle.people.map((person) => (
              <div key={person.id} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-moss-pale text-moss flex items-center justify-center text-xs font-medium shrink-0">
                  {person.name.slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{person.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {person.email ?? "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
