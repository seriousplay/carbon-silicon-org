import Link from "next/link";
import { ArrowRight, Play, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requireSession, getCurrentPerson } from "@/lib/session";
import { canStartInterfaceWorkflow, canViewInterfaceWorkflow } from "@/lib/interface-workbench/runtime-permissions";
import { startRunAction } from "./actions";

type PageSearchParams = Promise<{ message?: string | string[] }>;

export default async function InterfaceRunsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const session = await requireSession();
  const person = await getCurrentPerson();
  if (!person) return null;
  const [membership, actorRoles] = await Promise.all([
    prisma.membership.findUnique({
      where: { userId_organizationId: { userId: session.user.id, organizationId: person.organizationId } },
      select: { role: true },
    }),
    prisma.roleDef.findMany({
      where: { organizationId: person.organizationId, assignees: { some: { id: person.id } } },
      select: { id: true },
    }),
  ]);
  if (!membership) return null;
  const runAuthorization = membership.role === "ORG_ADMIN" ? {} : {
    workbench: { interface: { is: { OR: [
      { ownerId: person.id },
      { fromCircle: { is: { leadPersonId: person.id } } },
      { toCircle: { is: { leadPersonId: person.id } } },
      { supportPeople: { some: { id: person.id } } },
      { supportRoles: { some: { id: { in: actorRoles.map((role) => role.id) } } } },
    ] } } },
  };
  const [workbenches, runs] = await Promise.all([
    prisma.interfaceWorkbench.findMany({
      where: { organizationId: person.organizationId, activeVersionId: { not: null }, interface: { status: { not: "ARCHIVED" } } },
      select: {
        id: true,
        activeVersion: { select: { version: true, sourceSnapshot: true } },
        interface: { select: {
          name: true, organizationId: true, ownerId: true,
          owner: { select: { id: true, name: true } },
          fromCircle: { select: { name: true, leadPersonId: true } },
          toCircle: { select: { name: true, leadPersonId: true } },
          supportPeople: { select: { id: true, name: true } },
          supportRoles: { where: { status: "ACTIVE" }, select: { id: true, name: true } },
        } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.interfaceWorkflowRun.findMany({
      where: { organizationId: person.organizationId, ...runAuthorization },
      select: {
        id: true, status: true, updatedAt: true, currentNodeId: true,
        version: { select: { version: true, compiledSnapshot: true } },
        workbench: { select: { interface: { select: {
          name: true, organizationId: true, ownerId: true,
          fromCircle: { select: { name: true, leadPersonId: true } },
          toCircle: { select: { name: true, leadPersonId: true } },
          supportPeople: { select: { id: true } }, supportRoles: { select: { id: true } },
        } } } },
        waitingRoleBinding: { select: { person: { select: { name: true } }, roleDef: { select: { name: true } } } },
        roleBindings: { select: { roleId: true, person: { select: { name: true } }, roleDef: { select: { name: true } } } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
  ]);
  const actor = { organizationId: person.organizationId, personId: person.id, membershipRole: membership.role, assignedRoleDefIds: actorRoles.map((role) => role.id) };
  const eligible = workbenches.filter((workbench) => canStartInterfaceWorkflow(actor, permissionContext(workbench.interface)));
  const visibleRuns = runs.filter((run) => canViewInterfaceWorkflow(actor, permissionContext(run.workbench.interface)));
  const params = await searchParams;
  const message = firstParam(params.message);

  return <main className="mx-auto max-w-5xl space-y-8 animate-fade-rise">
    <header className="flex items-end justify-between gap-4 border-b border-border pb-4">
      <div><p className="text-xs text-muted-foreground">接口运行</p><h1 className="mt-1 font-serif text-2xl font-medium">工作流运行台</h1></div>
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/app/interfaces" />}>返回接口</Button>
    </header>
    {message ? <p className="rounded-input border border-border bg-muted/40 px-3 py-2 text-sm" role="status">{messageText(message)}</p> : null}
    <section className="space-y-3">
      <div className="flex items-center justify-between"><h2 className="text-sm font-medium">可启动工作流</h2><span className="text-xs text-muted-foreground">{eligible.length} 个已发布版本</span></div>
      {eligible.length ? eligible.map((workbench) => {
        const roles = sourceRoleIds(workbench.activeVersion?.sourceSnapshot);
        const people = uniquePeople(person, workbench.interface.owner, workbench.interface.supportPeople);
        return <form key={workbench.id} action={startRunAction.bind(null, workbench.id)} className="rounded-card border border-border bg-card p-4 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><div className="flex items-center gap-2 text-sm font-medium"><span>{workbench.interface.fromCircle.name}</span><ArrowRight className="size-3.5 text-muted-foreground"/><span>{workbench.interface.toCircle.name}</span></div><p className="mt-1 text-xs text-muted-foreground">{workbench.interface.name} · v{workbench.activeVersion?.version}</p></div>
            <Button type="submit" size="sm" disabled={!roles}><Play />启动</Button>
          </div>
          {roles?.length ? <div className="mt-4 grid gap-3 border-t border-border pt-3 md:grid-cols-2">{roles.map((roleId) => <label key={roleId} className="grid gap-1 text-xs"><span className="text-muted-foreground">运行角色 · {roleId}</span><select name={`binding:${roleId}`} defaultValue={`person:${person.id}`} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">{people.map((item) => <option key={`person:${item.id}`} value={`person:${item.id}`}>{item.id === person.id ? "当前人员 · " : "人员 · "}{item.name}</option>)}{workbench.interface.supportRoles.map((role) => <option key={`role:${role.id}`} value={`role:${role.id}`}>支援角色 · {role.name}</option>)}</select></label>)}</div> : null}
        </form>;
      }) : <div className="rounded-card border border-dashed border-border p-6 text-sm text-muted-foreground">当前没有你可启动的已发布工作流。</div>}
    </section>
    <section className="space-y-3">
      <div className="flex items-center justify-between"><h2 className="text-sm font-medium">可见运行</h2><span className="text-xs text-muted-foreground">最近 {visibleRuns.length} 条</span></div>
      <div className="divide-y divide-border rounded-card border border-border bg-card">{visibleRuns.map((run) => <Link key={run.id} href={`/app/interfaces/runs/${run.id}`} className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/30"><div className="min-w-0"><p className="truncate text-sm font-medium">{run.workbench.interface.name}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">{run.workbench.interface.fromCircle.name}<ArrowRight className="size-3"/>{run.workbench.interface.toCircle.name} · v{run.version.version}</p></div><div className="flex shrink-0 items-center gap-3"><span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex"><UserRound className="size-3.5"/>{responsibilityLabel(run)}</span><Badge variant="outline">{statusLabel(run.status)}</Badge></div></Link>)}{!visibleRuns.length ? <p className="px-4 py-6 text-sm text-muted-foreground">尚无可见运行。</p> : null}</div>
    </section>
  </main>;
}

function permissionContext(value: { organizationId: string; ownerId: string; fromCircle: { leadPersonId: string | null }; toCircle: { leadPersonId: string | null }; supportPeople: { id: string }[]; supportRoles: { id: string }[] }) {
  return { organizationId: value.organizationId, ownerId: value.ownerId, fromCircleLeadPersonId: value.fromCircle.leadPersonId, toCircleLeadPersonId: value.toCircle.leadPersonId, supportPersonIds: value.supportPeople.map((item) => item.id), supportRoleDefIds: value.supportRoles.map((item) => item.id) };
}

function sourceRoleIds(value: unknown): string[] | null {
  if (!isRecord(value) || !Array.isArray(value.roles)) return null;
  const roles = value.roles.map((role) => isRecord(role) && typeof role.id === "string" && role.id ? role.id : null);
  return roles.every((role) => role !== null) && new Set(roles).size === roles.length ? roles : null;
}

function currentRoleId(compiled: unknown, nodeId: string): string | null {
  if (!isRecord(compiled) || !Array.isArray(compiled.nodes)) return null;
  const node = compiled.nodes.find((item) => isRecord(item) && item.id === nodeId);
  return isRecord(node) && isRecord(node.config) && typeof node.config.roleId === "string" ? node.config.roleId : null;
}

function responsibilityLabel(run: { status: string; currentNodeId: string; version: { compiledSnapshot: unknown }; waitingRoleBinding: { person: { name: string } | null; roleDef: { name: string } | null } | null; roleBindings: { roleId: string; person: { name: string } | null; roleDef: { name: string } | null }[] }): string {
  if (["COMPLETED", "TERMINATED"].includes(run.status)) return "已结束";
  const binding = run.status === "WAITING" ? run.waitingRoleBinding : run.roleBindings.find((item) => item.roleId === currentRoleId(run.version.compiledSnapshot, run.currentNodeId));
  return binding?.person?.name ?? (binding?.roleDef ? `角色：${binding.roleDef.name}` : run.status === "PAUSED" ? "需要检查" : "未分配");
}

function uniquePeople(current: { id: string; name: string }, owner: { id: string; name: string }, support: { id: string; name: string }[]) {
  return [...new Map([current, owner, ...support].map((item) => [item.id, item])).values()];
}

function statusLabel(status: string): string { return ({ ACTIVE: "待处理", WAITING: "等待中", COMPLETED: "已完成", TERMINATED: "已终止", PAUSED: "已暂停" } as Record<string, string>)[status] ?? "未知"; }
function messageText(message: string): string { return ({ denied: "你无权访问该工作流。", "invalid-binding": "角色绑定无效，请重新选择。", "version-changed": "发布版本已变化，请重新启动。", "start-failed": "启动失败，请刷新后重试。" } as Record<string, string>)[message] ?? "操作未完成，请重试。"; }
function firstParam(value: string | string[] | undefined): string | undefined { return Array.isArray(value) ? value[0] : value; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
