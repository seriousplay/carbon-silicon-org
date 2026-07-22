import Link from "next/link";
import { getCurrentOrgId, requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { cardStatusMap } from "@/lib/constants";
import { StatusBadge } from "@/components/shared/status-badge";
import { InviteMemberForm } from "./invite-member-form";
import { OrganizationSubnav } from "../organization/organization-subnav";

export default async function PeoplePage() {
  const session = await requireSession();
  const orgId = await getCurrentOrgId();

  const [people, circles, membership] = await Promise.all([
    prisma.person.findMany({
    where: { organizationId: orgId },
    include: {
      homeCircle: { select: { id: true, name: true } },
      roles: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          purpose: true,
          accountabilities: true,
          actions: {
            where: { status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "BLOCKED"] } },
            select: { id: true, description: true, status: true, deadline: true, actionContext: true },
            orderBy: { deadline: "asc" },
          },
        },
      },
      tensionsOwned: {
        where: { status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "BLOCKED"] } },
        select: {
          id: true,
          description: true,
          status: true,
          deadline: true,
          roleId: true,
          role: { select: { name: true } },
          actionContext: true,
        },
        orderBy: { deadline: "asc" },
      },
    },
      orderBy: { name: "asc" },
    }),
    prisma.circle.findMany({
      where: { organizationId: orgId, status: { not: "ARCHIVED" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.membership.findUnique({
      where: { userId_organizationId: { userId: session.user.id, organizationId: orgId } },
      select: { role: true },
    }),
  ]);

  return (
    <div className="max-w-5xl mx-auto animate-fade-rise space-y-6">
      <OrganizationSubnav active="people" />

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl font-medium mb-1">人员</h1>
          <p className="text-sm text-muted-foreground">
            碳基与硅基员工共同参与组织治理，归属唯一回路。
          </p>
        </div>
      </div>

      {membership?.role === "ORG_ADMIN" && <InviteMemberForm circles={circles} />}

      {people.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-card/50 p-12 text-center">
          <p className="text-sm text-muted-foreground">还没有成员</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {people.map((person, i) => {
            const cardInfo = cardStatusMap[person.cardStatus];
            const isAgent = person.entityType === "AGENT";
            return (
              <div
                key={person.id}
                className={`rounded-card border bg-card p-4 shadow-soft animate-fade-rise ${
                  isAgent ? "border-moss/30" : "border-border"
                }`}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-center gap-4">
                  {/* 头像（智能体用机器人图标）*/}
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${
                    isAgent ? "bg-moss/20 text-moss" : "bg-moss-pale text-moss"
                  }`}>
                    {isAgent ? "🤖" : person.name.slice(0, 2)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{person.name}</p>
                      {isAgent && (
                        <span className="text-[10px] bg-moss/20 text-moss rounded-full px-2 py-0.5 font-medium">
                          硅基
                        </span>
                      )}
                      <StatusBadge
                        variant={cardInfo.badge as never}
                        label={cardInfo.label}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {person.email ?? "—"}
                    </p>
                  </div>

                  {/* 归属回路 */}
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">归属回路</p>
                    <Link
                      href={`/app/circles/${person.homeCircle.id}`}
                      className="text-sm font-medium text-moss hover:underline"
                    >
                      {person.homeCircle.name}
                    </Link>
                  </div>

                  {/* 角色数 */}
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="text-xs text-muted-foreground">角色</p>
                    <p className="text-sm font-medium">{person.roles.length}</p>
                  </div>
                </div>

                {/* 按角色分组的进行中行动 */}
                {person.tensionsOwned.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                      进行中的行动 ({person.tensionsOwned.length})
                    </p>
                    <div className="space-y-1.5">
                      {person.tensionsOwned.map((b) => (
                        <Link
                          key={b.id}
                          href={`/app/tracker/${b.id}`}
                          className="flex items-center gap-2 rounded-input border border-border px-3 py-1.5 hover:bg-muted/30 transition-colors group"
                        >
                          <span className="text-xs text-muted-foreground shrink-0 w-16">
                            {b.deadline?.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
                          </span>
                          {b.role && (
                            <span className="text-xs text-moss shrink-0 font-medium">
                              {b.role.name}
                            </span>
                          )}
                          <span className="text-xs flex-1 truncate group-hover:text-foreground">
                            {b.description}
                          </span>
                          {b.actionContext && (
                            <span className="text-[10px] text-muted-foreground/70 truncate hidden md:inline max-w-32">
                              ← {b.actionContext.slice(0, 30)}
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
