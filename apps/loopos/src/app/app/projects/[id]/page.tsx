import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { ProjectLifecycleControls } from "./project-lifecycle-controls";
import { prisma } from "@/lib/db";

const statusLabel: Record<string, string> = {
  ACTIVE: "进行中",
  COMPLETED: "已完成",
  PAUSED: "已暂停",
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [orgId, person] = await Promise.all([getCurrentOrgId(), getCurrentPerson()]);

  const project = await prisma.project.findFirst({
    where: { id, organizationId: orgId },
    include: {
      circle: { select: { id: true, name: true } },
      bearer: { select: { id: true, name: true } },
      sourceTension: { select: { id: true, title: true } },
      tacticalOutcomeProposal: { select: { id: true, provenanceKind: true, proposer: { select: { name: true } }, recordedBy: { select: { name: true } }, meeting: { select: { id: true, title: true } }, run: { select: { id: true } } } },
      tensions: {
        select: { id: true, title: true, status: true },
        orderBy: { updatedAt: "desc" },
      },
      validationRunsAsSource: {
        select: {
          id: true,
          dataVersion: true,
          status: true,
          smokeRunResult: true,
          tacticalResolution: true,
          deferReason: true,
          sourceTension: { select: { id: true, title: true } },
          resolutionMeeting: { select: { id: true, title: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
      validationRunsCreated: {
        select: {
          id: true,
          dataVersion: true,
          status: true,
          smokeRunResult: true,
          tacticalResolution: true,
          deferReason: true,
          sourceTension: { select: { id: true, title: true } },
          resolutionMeeting: { select: { id: true, title: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!project) notFound();

  const validationRuns = [
    ...project.validationRunsAsSource,
    ...project.validationRunsCreated,
  ];

  return (
    <div className="max-w-3xl mx-auto animate-fade-rise">
      <Link
        href="/app/projects"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 inline-block"
      >
        ← 项目
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-2xl font-medium mb-2">{project.name}</h1>
          <p className="text-sm text-muted-foreground">{project.goal}</p>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {statusLabel[project.status] ?? project.status}
        </span>
      </div>
      {project.bearerId === person?.id && project.status !== "COMPLETED" ? <div className="mb-6"><ProjectLifecycleControls projectId={project.id} status={project.status} /></div> : null}

      {project.tacticalOutcomeProposal ? (
        <div className="rounded-card border border-border bg-card p-4 shadow-soft mb-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">战术提案来源</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <span>提出人：{project.tacticalOutcomeProposal.proposer.name}</span>
            <span>会议结果记录人：{project.tacticalOutcomeProposal.recordedBy?.name ?? "—"}</span>
            <Link className="text-moss hover:underline" href={`/app/meetings/${project.tacticalOutcomeProposal.meeting.id}`}>来源会议：{project.tacticalOutcomeProposal.meeting.title}</Link>
            {project.tacticalOutcomeProposal.provenanceKind === "INTERFACE_RUN" && project.tacticalOutcomeProposal.run ? <Link className="text-moss hover:underline" href={`/app/interfaces/runs/${project.tacticalOutcomeProposal.run.id}`}>查看接口运行来源</Link> : <span>普通张力来源</span>}
          </div>
        </div>
      ) : null}

      <div className="rounded-card border border-border bg-card p-6 shadow-soft mb-6">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          项目最小字段
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">项目承担人</p>
            <p className="text-sm font-medium">{project.bearer?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">归属回路</p>
            <Link href={`/app/circles/${project.circle.id}`} className="text-sm text-moss hover:underline">
              {project.circle.name}
            </Link>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">关联数据版本</p>
            <p className="text-sm font-medium">{project.linkedDataVersion ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">来源张力</p>
            {project.sourceTension ? (
              <Link href={`/app/tensions/${project.sourceTension.id}`} className="text-sm text-moss hover:underline">
                {project.sourceTension.title}
              </Link>
            ) : (
              <p className="text-sm font-medium">—</p>
            )}
          </div>
        </div>
        {project.expectedResult && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-1">预期结果</p>
            <p className="text-sm leading-relaxed whitespace-pre-line">{project.expectedResult}</p>
          </div>
        )}
      </div>

      <div className="rounded-card border border-border bg-card p-6 shadow-soft mb-6">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          行动项
        </h2>
        {project.tensions.length === 0 ? (
          <p className="text-sm text-muted-foreground">还没有关联行动项。</p>
        ) : (
          <div className="space-y-2">
            {project.tensions.map((tension) => (
              <Link
                key={tension.id}
                href={`/app/tracker/${tension.id}`}
                className="flex items-center justify-between rounded-input border border-border px-3 py-2 text-sm hover:bg-muted/30"
              >
                <span>{tension.title}</span>
                <span className="text-xs text-muted-foreground">{tension.status}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {validationRuns.length > 0 && (
        <div className="rounded-card border border-border bg-card p-6 shadow-soft">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            关联验证记录
          </h2>
          <div className="space-y-2">
            {validationRuns.map((run) => (
              <div
                key={run.id}
                className="rounded-input border border-border px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/app/interfaces/data-pretraining?run=${run.id}`} className="text-moss hover:underline">
                    {run.dataVersion}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {run.status}{run.smokeRunResult ? ` / ${run.smokeRunResult}` : ""}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {run.tacticalResolution && <span>处置：{run.tacticalResolution}</span>}
                  {run.sourceTension && (
                    <Link href={`/app/tensions/${run.sourceTension.id}`} className="text-moss hover:underline">
                      来源张力：{run.sourceTension.title}
                    </Link>
                  )}
                  {run.resolutionMeeting && (
                    <Link href={`/app/meetings/${run.resolutionMeeting.id}`} className="text-moss hover:underline">
                      来源会议：{run.resolutionMeeting.title}
                    </Link>
                  )}
                  {run.deferReason && <span>延期原因：{run.deferReason}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
