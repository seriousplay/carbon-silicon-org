import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { routeUnroutedTensionAction } from "../actions";
import { prisma } from "@/lib/db";
import { blockerStatusMap, tensionTypeMap, conflictLevelMap } from "@/lib/constants";
import { StatusBadge } from "@/components/shared/status-badge";

export default async function TensionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [orgId, person] = await Promise.all([getCurrentOrgId(), getCurrentPerson()]);

  const tension = await prisma.tension.findFirst({
    where: { id, organizationId: orgId },
    include: {
      raiser: { select: { id: true, name: true } },
      circles: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
      role: { select: { id: true, name: true, purpose: true } },
      circle: { select: { id: true, name: true } },
    },
  });

  if (!tension) notFound();

  const statusInfo = blockerStatusMap[tension.status];
  const typeInfo = tensionTypeMap[tension.type];
  const conflictInfo = tension.conflictLevel
    ? conflictLevelMap[tension.conflictLevel]
    : null;

  return (
    <div className="max-w-3xl mx-auto animate-fade-rise">
      <Link
        href="/app/tensions"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 inline-block"
      >
        ← 张力
      </Link>

      <div className="flex items-center gap-2 mb-3">
        <StatusBadge variant={statusInfo.badge as never} label={statusInfo.label} />
        <StatusBadge variant={typeInfo.color as never} label={typeInfo.label} />
        {conflictInfo && (
          <StatusBadge variant="needs-light" label={conflictInfo.label} />
        )}
      </div>

      <h1 className="font-serif text-2xl font-medium mb-4">{tension.title}</h1>

      {tension.handlingMode === "UNROUTED" && tension.status === "OPEN" && tension.raiserId === person?.id ? (
        <form action={routeUnroutedTensionAction.bind(null, tension.id)} className="mb-6 flex flex-wrap items-center gap-2 border border-border p-4">
          <span className="text-sm font-medium">确认处理方式</span>
          <button className="text-sm text-moss hover:underline" name="handlingMode" value="TACTICAL">战术处理</button>
          <button className="text-sm text-moss hover:underline" name="handlingMode" value="GOVERNANCE">治理处理</button>
        </form>
      ) : null}

      <div className="rounded-card border border-border bg-card p-6 shadow-soft mb-6">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
          描述
        </h2>
        <p className="text-sm leading-relaxed whitespace-pre-line">{tension.description}</p>
      </div>

      {tension.aiTranslation && (
        <div className="rounded-card border border-moss/30 bg-moss-pale/30 p-6 mb-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-moss mb-2">
            AI 结构化翻译（草稿）
          </h2>
          <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">
            {tension.aiTranslation}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-card border border-border bg-card p-4 shadow-soft">
          <p className="text-xs text-muted-foreground mb-1">提出人</p>
          <p className="text-sm font-medium">{tension.raiser.name}</p>
        </div>
        <div className="rounded-card border border-border bg-card p-4 shadow-soft">
          <p className="text-xs text-muted-foreground mb-1">涉及回路</p>
          <p className="text-sm font-medium">
            {tension.circles.length > 0
              ? tension.circles.map((c) => c.name).join(", ")
              : tension.circle?.name ?? "—"}
          </p>
        </div>
      </div>

      {/* 行动信息（分配行动后显示）*/}
      {tension.ownerId && (
        <div className="rounded-card border border-border bg-card p-6 shadow-soft mb-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            行动分配
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">负责人</p>
              <p className="text-sm font-medium">{tension.owner?.name ?? "—"}</p>
              {tension.role && (
                <p className="text-xs text-moss mt-1">以角色：{tension.role.name}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">截止时间</p>
              <p className="text-sm font-medium">
                {tension.deadline?.toLocaleDateString("zh-CN") ?? "—"}
              </p>
            </div>
          </div>
          {tension.acceptanceCriteria && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">验收标准</p>
              <p className="text-sm">{tension.acceptanceCriteria}</p>
            </div>
          )}
          {tension.actionContext && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">行动归属</p>
              <p className="text-xs bg-muted/30 rounded px-2 py-1.5">{tension.actionContext}</p>
            </div>
          )}
          <div className="mt-3">
            <Link
              href={`/app/tracker/${tension.id}`}
              className="text-sm text-moss hover:underline"
            >
              在追踪看板中查看 →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
