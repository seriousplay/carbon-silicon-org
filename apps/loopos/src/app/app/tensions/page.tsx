import Link from "next/link";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";
import { blockerStatusMap, tensionTypeMap } from "@/lib/constants";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  closeCandidateTensionAction,
  confirmCandidateTensionAction,
  mergeCandidateTensionAction,
} from "./actions";

export default async function TensionsPage() {
  const orgId = await getCurrentOrgId();
  const person = await getCurrentPerson();

  const tensions = await prisma.tension.findMany({
    where: { organizationId: orgId },
    include: {
      raiser: { select: { id: true, name: true } },
      circles: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const candidateTensions = await prisma.candidateTension.findMany({
    where: { organizationId: orgId },
    include: {
      ownerRole: {
        select: {
          id: true,
          name: true,
          assignees: person
            ? {
                where: { id: person.id, entityType: "HUMAN" },
                select: { id: true },
              }
            : false,
        },
      },
      detectedBy: { select: { id: true, name: true, entityType: true } },
      confirmedTension: { select: { id: true, title: true } },
    },
    orderBy: [{ status: "asc" }, { detectedAt: "desc" }],
    take: 20,
  });

  return (
    <div className="max-w-5xl mx-auto animate-fade-rise">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl font-medium mb-1">张力</h1>
          <p className="text-sm text-muted-foreground">
            组织天然的摩擦不是错误，是生命信号。暴露它，闭环它。
          </p>
        </div>
        <Link href="/app/tensions/new">
          <Button>提一个张力</Button>
        </Link>
      </div>

      <section className="mb-8 rounded-card border border-border bg-card p-5 shadow-soft">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AI 候选张力</p>
            <h2 className="mt-1 font-serif text-xl font-medium">等待相关角色确认的组织信号</h2>
          </div>
          <StatusBadge variant="seed" label={`${candidateTensions.length} 条候选`} />
        </div>
        {candidateTensions.length === 0 ? (
          <div className="rounded-input border border-dashed border-border bg-background/60 p-5 text-sm text-muted-foreground">
            当前没有候选张力。AI 后续识别出的信号会先进入这里，相关角色确认后才会成为正式张力。
          </div>
        ) : (
          <div className="space-y-3">
            {candidateTensions.map((candidate) => (
              <article key={candidate.id} className="rounded-input border border-border bg-background p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusBadge variant={candidate.status === "DETECTED" ? "needs-light" : "growing"} label={candidateStatusLabel(candidate.status)} />
                      {candidate.suggestedMode ? <StatusBadge variant="seed" label={candidate.suggestedMode === "TACTICAL" ? "建议战术处理" : "建议治理处理"} /> : null}
                    </div>
                    <h3 className="text-sm font-medium">{candidate.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{candidate.evidenceSummary}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>角色：{candidate.ownerRole.name}</span>
                      <span>来源：{candidateSourceLabel(candidate.sourceKind)}</span>
                      <span>识别者：{candidate.detectedBy.name}</span>
                    </div>
                    <p className="mt-2 break-words rounded-input border border-border bg-card px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
                      {formatCandidateSourceRef(candidate.sourceRef)}
                    </p>
                    {candidate.confirmedTension ? (
                      <Link className="mt-2 inline-block text-xs text-moss hover:underline" href={`/app/tensions/${candidate.confirmedTension.id}`}>
                        已确认为：{candidate.confirmedTension.title}
                      </Link>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">
                    {candidate.detectedAt.toLocaleDateString("zh-CN")}
                  </div>
                </div>
                {candidate.status === "DETECTED" ? (
                  <CandidateReviewActions
                    candidateId={candidate.id}
                    canReview={candidate.ownerRole.assignees.length > 0}
                    formalTensions={tensions.map((tension) => ({ id: tension.id, title: tension.title }))}
                    mergeCandidates={candidateTensions
                      .filter((item) => item.status === "DETECTED" && item.id !== candidate.id)
                      .map((item) => ({ id: item.id, title: item.title }))}
                  />
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {tensions.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="text-4xl mb-4 text-needs-light/60">∿</div>
          <h2 className="font-serif text-lg font-medium mb-2">组织很平静</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            没有被提出的张力。
            <br />
            或者——有些该说的话还没说出口。
          </p>
          <Link href="/app/tensions/new">
            <Button>提一个张力</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {tensions.map((tension, i) => {
            const statusInfo = blockerStatusMap[tension.status];
            const typeInfo = tensionTypeMap[tension.type];
            const isMine = tension.raiserId === person?.id;

            return (
              <Link
                key={tension.id}
                href={`/app/tensions/${tension.id}`}
                className="block rounded-card border border-border bg-card p-4 shadow-soft card-hover animate-fade-rise"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge variant={typeInfo.color as never} label={typeInfo.label} />
                      {isMine && (
                        <span className="text-xs text-muted-foreground">我提出的</span>
                      )}
                    </div>
                    <h3 className="font-medium text-sm mb-1">{tension.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {tension.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{tension.raiser.name}</span>
                      {tension.circles.length > 0 && (
                        <>
                          <span>·</span>
                          <span>{tension.circles.map((c) => c.name).join(", ")}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <StatusBadge
                    variant={statusInfo.badge as never}
                    label={statusInfo.label}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CandidateReviewActions({
  candidateId,
  canReview,
  formalTensions,
  mergeCandidates,
}: {
  candidateId: string;
  canReview: boolean;
  formalTensions: Array<{ id: string; title: string }>;
  mergeCandidates: Array<{ id: string; title: string }>;
}) {
  if (!canReview) {
    return (
      <p className="mt-4 rounded-input border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        只有该候选张力归属角色的人类承担者可以处理。
      </p>
    );
  }

  return (
    <div className="mt-4 grid gap-3 border-t border-border pt-4 lg:grid-cols-3">
      <form action={confirmCandidateTensionAction.bind(null, candidateId)} className="space-y-2">
        <label className="grid gap-1 text-xs text-muted-foreground">
          <span>确认为正式张力</span>
          <select name="confirmedTensionId" required className="h-9 min-w-0 rounded-input border border-border bg-card px-2 text-xs">
            <option value="">选择已有张力</option>
            {formalTensions.map((tension) => (
              <option key={tension.id} value={tension.id}>
                {tension.title}
              </option>
            ))}
          </select>
        </label>
        <Button size="sm" type="submit" disabled={formalTensions.length === 0}>
          确认
        </Button>
      </form>

      <form action={closeCandidateTensionAction.bind(null, candidateId)} className="space-y-2">
        <label className="grid gap-1 text-xs text-muted-foreground">
          <span>驳回或标记误报</span>
          <input name="reason" required placeholder="原因" className="h-9 min-w-0 rounded-input border border-border bg-card px-2 text-xs" />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" type="submit" variant="outline">
            驳回
          </Button>
          <Button size="sm" type="submit" variant="outline" name="falsePositive" value="true">
            误报
          </Button>
        </div>
      </form>

      <form action={mergeCandidateTensionAction.bind(null, candidateId)} className="space-y-2">
        <label className="grid gap-1 text-xs text-muted-foreground">
          <span>合并到候选</span>
          <select name="mergedIntoId" required className="h-9 min-w-0 rounded-input border border-border bg-card px-2 text-xs">
            <option value="">选择候选张力</option>
            {mergeCandidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.title}
              </option>
            ))}
          </select>
        </label>
        <input name="reason" required placeholder="合并原因" className="h-9 w-full min-w-0 rounded-input border border-border bg-card px-2 text-xs" />
        <Button size="sm" type="submit" variant="outline" disabled={mergeCandidates.length === 0}>
          合并
        </Button>
      </form>
    </div>
  );
}

function candidateStatusLabel(status: string): string {
  return {
    DETECTED: "待确认",
    CONFIRMED: "已确认",
    DISMISSED: "已驳回",
    MERGED: "已合并",
    FALSE_POSITIVE: "误报",
  }[status] ?? status;
}

function candidateSourceLabel(sourceKind: string): string {
  return {
    GOAL: "目标",
    METRIC: "指标",
    PROJECT: "项目",
    ACTION: "行动",
    ROLE: "角色",
    BUSINESS_LOOP: "业务回路",
    AI_EXECUTION_AUDIT: "AI 执行审计",
    MEMORY: "组织记忆",
    MEETING: "会议",
    EXTERNAL_SIGNAL: "外部信号",
  }[sourceKind] ?? sourceKind;
}

function formatCandidateSourceRef(sourceRef: unknown): string {
  if (!sourceRef || typeof sourceRef !== "object") return "sourceRef: unavailable";
  const entries = Object.entries(sourceRef as Record<string, unknown>)
    .filter(([, value]) => value !== null && value !== undefined && typeof value !== "object")
    .slice(0, 6)
    .map(([key, value]) => `${key}: ${String(value)}`);
  if (entries.length === 0) return "sourceRef: structured source evidence";
  return entries.join(" · ");
}
