import { withdrawRoleApplicationAction } from "./actions";
import { RoleMarketForm } from "./role-market-form";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { getOrganizationGovernanceConfig, organizationRoleCategoryLabel } from "@/lib/organization-governance-config";
import { OrganizationSubnav } from "../../organization/organization-subnav";

export const dynamic = "force-dynamic";

export default async function RoleMarketPage() {
  const person = await getCurrentPerson();
  const organizationId = await getCurrentOrgId();
  if (!person) return null;

  const [roles, applications, governanceConfig] = await Promise.all([
    prisma.roleDef.findMany({
      where: { organizationId, status: "ACTIVE", assignees: { none: {} } },
      include: { circle: { select: { id: true, name: true } } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    prisma.roleAssignmentApplication.findMany({
      where: { organizationId, applicantId: person.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    getOrganizationGovernanceConfig(organizationId),
  ]);
  const applicationsByRole = new Map<string, typeof applications>();
  for (const application of applications) {
    const current = applicationsByRole.get(application.roleId) ?? [];
    if (current.length < 3) current.push(application);
    applicationsByRole.set(application.roleId, current);
  }

  return (
    <div className="mx-auto max-w-5xl animate-fade-rise space-y-6">
      <OrganizationSubnav active="role-market" />

      <div className="mb-8">
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-moss">角色市场</p>
        <h1 className="font-serif text-2xl font-medium">发现组织中的空缺角色</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">申请只表达你的意愿，不会直接改变任职关系；任职需要经过后续确认流程。</p>
      </div>

      {roles.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground">当前没有无人承担的有效角色。</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {roles.map((role) => {
            const pending = applicationsByRole.get(role.id)?.find((application) => application.status === "PENDING");
            return (
              <article key={role.id} className="rounded-card border border-border bg-card p-5 shadow-soft">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-medium">{role.name}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{role.circle.name} · {organizationRoleCategoryLabel(governanceConfig.profile, role.category)} · 当前无人承担</p>
                  </div>
                  <span className="rounded-full bg-seed-pale px-2 py-1 text-[11px] text-seed">空缺</span>
                </div>
                <p className="mb-3 font-serif text-sm italic leading-6">{role.purpose}</p>
                <ul className="mb-5 space-y-1 text-xs text-muted-foreground">
                  {role.accountabilities.split("\n").filter(Boolean).slice(0, 4).map((accountability) => <li key={accountability}>· {accountability}</li>)}
                </ul>
                {pending ? (
                  <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-xs">
                    <span className="text-moss">已提交申请，等待处理</span>
                    <form action={withdrawRoleApplicationAction}><input type="hidden" name="applicationId" value={pending.id} /><Button type="submit" variant="outline" size="sm">撤回申请</Button></form>
                  </div>
                ) : (
                  <details className="border-t border-border pt-3">
                    <summary className="cursor-pointer text-sm font-medium text-moss">申请承担这个角色</summary>
                    <RoleMarketForm roleId={role.id} />
                  </details>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
