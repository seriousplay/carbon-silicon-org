import Link from "next/link";
import { getCurrentOrgId } from "@/lib/session";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/shared/status-badge";

type ProposedChangeSummary = {
  title?: string;
  suggestedChange?: string;
  validationRunId?: string;
  dataVersion?: string;
  sourceTensionId?: string;
};

type WeeklyCandidate = Awaited<ReturnType<typeof getWeeklyGovernanceCandidates>>[number];

const tacticalResolutionLabels = {
  CREATE_PROJECT: "项目",
  CREATE_ACTION: "行动",
  DEFERRED: "延期",
} as const;

function parseProposedChange(value: string): ProposedChangeSummary {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return {};

    const record = parsed as Record<string, unknown>;
    return {
      title: typeof record.title === "string" ? record.title : undefined,
      suggestedChange:
        typeof record.suggestedChange === "string" ? record.suggestedChange : undefined,
      validationRunId:
        typeof record.validationRunId === "string" ? record.validationRunId : undefined,
      dataVersion: typeof record.dataVersion === "string" ? record.dataVersion : undefined,
      sourceTensionId:
        typeof record.sourceTensionId === "string" ? record.sourceTensionId : undefined,
    };
  } catch {
    return {};
  }
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}

async function getWeeklyGovernanceCandidates(orgId: string) {
  const proposals = await prisma.governanceProposal.findMany({
    where: {
      organizationId: orgId,
      status: "PROPOSED",
      tension: {
        validationRunsCreated: {
          some: {
            tacticalResolution: "GOVERNANCE_CANDIDATE",
          },
        },
      },
    },
    include: {
      tension: {
        select: {
          id: true,
          title: true,
          description: true,
          validationRunsCreated: {
            where: { tacticalResolution: "GOVERNANCE_CANDIDATE" },
            orderBy: { updatedAt: "desc" },
            take: 5,
            include: {
              interface: {
                select: {
                  name: true,
                  fromCircle: { select: { name: true } },
                  toCircle: { select: { name: true } },
                },
              },
            },
          },
        },
      },
      meeting: { select: { id: true, title: true, startedAt: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return proposals
    .map((proposal) => {
      const proposedChange = parseProposedChange(proposal.proposedChange);
      const validationRun = proposal.tension.validationRunsCreated.find(
        (run) => run.id === proposedChange.validationRunId
      );

      if (!validationRun) return null;

      return {
        id: proposal.id,
        status: proposal.status,
        type: proposal.type,
        title: proposedChange.title ?? proposal.tension.title,
        suggestedChange: proposedChange.suggestedChange ?? proposal.proposedChange,
        rationale: proposal.rationale,
        createdAt: proposal.createdAt,
        sourceTension: proposal.tension,
        validationRun,
        meeting: proposal.meeting,
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);
}

async function getExcludedTacticalCounts(orgId: string) {
  const [projectCount, actionCount, deferredCount] = await Promise.all([
    prisma.interfaceValidationRun.count({
      where: { organizationId: orgId, tacticalResolution: "CREATE_PROJECT" },
    }),
    prisma.interfaceValidationRun.count({
      where: { organizationId: orgId, tacticalResolution: "CREATE_ACTION" },
    }),
    prisma.interfaceValidationRun.count({
      where: { organizationId: orgId, tacticalResolution: "DEFERRED" },
    }),
  ]);

  return {
    CREATE_PROJECT: projectCount,
    CREATE_ACTION: actionCount,
    DEFERRED: deferredCount,
  };
}

function CandidateCard({ candidate }: { candidate: WeeklyCandidate }) {
  return (
    <article className="rounded-card border border-moss/30 bg-card p-5 shadow-soft">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge variant="growing" label="结构治理候选" icon="dot" />
            <StatusBadge variant="seed" label={candidate.status} />
          </div>
          <h2 className="font-serif text-xl font-medium">{candidate.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            数据版本 {candidate.validationRun.dataVersion} · {candidate.validationRun.interface.fromCircle.name} →{" "}
            {candidate.validationRun.interface.toCircle.name}
          </p>
        </div>
        <span className="shrink-0 rounded-input bg-moss-pale px-2.5 py-1 text-xs font-medium text-moss">
          Weekly Review
        </span>
      </div>

      <div className="grid gap-4 border-y border-border py-4 md:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Source Tension
          </p>
          <Link
            href={`/app/tensions/${candidate.sourceTension.id}`}
            className="text-sm font-medium text-moss hover:underline"
          >
            {candidate.sourceTension.title}
          </Link>
          <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
            {candidate.sourceTension.description}
          </p>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Suggested Change
          </p>
          <p className="whitespace-pre-line text-sm leading-relaxed">{candidate.suggestedChange}</p>
        </div>
      </div>

      <details className="mt-4 rounded-input border border-border bg-muted/20 p-3">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
          Context / details
        </summary>
        <div className="mt-3 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
          <p>
            <span className="font-medium text-foreground">结构性理由：</span>
            {candidate.rationale}
          </p>
          <p>
            <span className="font-medium text-foreground">来源会议：</span>
            {candidate.meeting ? (
              <Link href={`/app/meetings/${candidate.meeting.id}`} className="text-moss hover:underline">
                {candidate.meeting.title}
              </Link>
            ) : (
              "未关联会议"
            )}
          </p>
          <p>
            <span className="font-medium text-foreground">候选类型：</span>
            {candidate.type}
          </p>
          <p>
            <span className="font-medium text-foreground">生成日期：</span>
            {formatDate(candidate.createdAt)}
          </p>
        </div>
      </details>
    </article>
  );
}

export default async function WeeklyGovernancePage() {
  const orgId = await getCurrentOrgId();
  const [candidates, excludedCounts] = await Promise.all([
    getWeeklyGovernanceCandidates(orgId),
    getExcludedTacticalCounts(orgId),
  ]);
  const excludedTotal =
    excludedCounts.CREATE_PROJECT + excludedCounts.CREATE_ACTION + excludedCounts.DEFERRED;

  return (
    <div className="mx-auto max-w-5xl animate-fade-rise">
      <div className="mb-8">
        <Link
          href="/app/governance"
          className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground"
        >
          ← 治理
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-medium">Weekly Governance Candidate Review</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              只汇总由验证异常战术处置标记出的结构性候选：SLA、验证标准或责任边界变化。普通项目、行动和延期不进入周治理候选清单。
            </p>
          </div>
          <div className="rounded-card border border-border bg-card px-4 py-3 shadow-soft">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Structural candidates
            </p>
            <p className="mt-1 font-serif text-2xl font-medium">{candidates.length}</p>
          </div>
        </div>
      </div>

      <section className="mb-6 rounded-card border border-dashed border-border bg-card/50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-medium">Tactical work excluded</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {excludedTotal} 条战术处置保持在项目、行动或延期流里，不作为治理候选展示。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(tacticalResolutionLabels) as Array<keyof typeof tacticalResolutionLabels>).map(
              (resolution) => (
                <StatusBadge
                  key={resolution}
                  variant="seed"
                  label={`${tacticalResolutionLabels[resolution]} ${excludedCounts[resolution]}`}
                />
              )
            )}
          </div>
        </div>
      </section>

      {candidates.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-card/50 p-10 text-center">
          <div className="mb-3 text-3xl text-moss/60">◇</div>
          <h2 className="font-serif text-lg font-medium">本周没有结构治理候选</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            在战术会里只有选择“标记治理候选”的验证异常会进入这里；项目、行动和延期会留在各自工作流中。
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {candidates.map((candidate) => (
            <CandidateCard key={candidate.id} candidate={candidate} />
          ))}
        </div>
      )}
    </div>
  );
}
