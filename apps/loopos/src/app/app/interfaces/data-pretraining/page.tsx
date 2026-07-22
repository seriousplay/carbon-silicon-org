import Link from "next/link";
import { getCurrentOrgId } from "@/lib/session";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  closePassingValidationAction,
  createFailureTensionDraftAction,
  recordSmokeRunResultAction,
  submitValidationAction,
  updateOverdueValidationRunsAction,
} from "./actions";

const columns = [
  {
    status: "TO_SUBMIT",
    label: "To Submit",
    hint: "数据版本待提交",
    badge: "seed",
  },
  {
    status: "AWAITING_SMOKE_RUN",
    label: "Awaiting Smoke Run",
    hint: "24h 内提交烟测证据",
    badge: "needs-light",
  },
  {
    status: "PASSED",
    label: "Passed",
    hint: "烟测信号正常",
    badge: "growing",
  },
  {
    status: "FAILED",
    label: "Failed",
    hint: "需要生成张力草稿",
    badge: "urgent",
  },
  {
    status: "OVERDUE",
    label: "Overdue",
    hint: "SLA 已逾期",
    badge: "urgent",
  },
] as const;

type BoardStatus = (typeof columns)[number]["status"];

type ValidationRun = Awaited<ReturnType<typeof getRuns>>[number];

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateTime(value: Date | null): string {
  if (!value) return "-";
  return value.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hoursSince(value: Date | null): string {
  if (!value) return "-";
  const hours = Math.max(0, (Date.now() - value.getTime()) / 3600000);
  return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
}

async function getPilotInterface(orgId: string) {
  return prisma.circleInterface.findFirst({
    where: {
      organizationId: orgId,
      status: { not: "ARCHIVED" },
      OR: [
        {
          fromCircle: { name: { contains: "数据" } },
          toCircle: { name: { contains: "预训练" } },
        },
        {
          fromCircle: { name: { contains: "Data" } },
          toCircle: { name: { contains: "Pretraining" } },
        },
        {
          name: { contains: "Data -> Pretraining" },
        },
      ],
    },
    include: {
      fromCircle: { select: { id: true, name: true } },
      toCircle: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

async function getRuns(orgId: string, interfaceId: string) {
  return prisma.interfaceValidationRun.findMany({
    where: {
      organizationId: orgId,
      interfaceId,
      status: { in: columns.map((column) => column.status) },
    },
    include: {
      createdTension: { select: { id: true, title: true } },
      createdProject: { select: { id: true, name: true } },
      createdAction: { select: { id: true, title: true } },
      sourceTension: { select: { id: true, title: true } },
      sourceProject: { select: { id: true, name: true } },
      resolutionMeeting: { select: { id: true, title: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
}

function RunCard({
  run,
  selected,
}: {
  run: ValidationRun;
  selected: boolean;
}) {
  const isClosed = Boolean(run.closedAt);

  return (
    <Link
      href={`/app/interfaces/data-pretraining?run=${run.id}`}
      className={`block rounded-card border bg-card p-3 shadow-soft transition-colors ${
        selected ? "border-moss ring-2 ring-moss/20" : "border-border hover:border-moss/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 text-sm font-medium">{run.dataVersion}</h3>
        {isClosed && <span className="text-[11px] text-mature">closed</span>}
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
        {run.changeSummary}
      </p>
      <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
        <p>提交：{formatDateTime(run.submittedAt)}</p>
        <p>已过：{hoursSince(run.submittedAt)}</p>
        {run.smokeRunResult && <p>烟测：{run.smokeRunResult}</p>}
        {run.slaResult && <p>SLA：{run.slaResult}</p>}
        {run.tacticalResolution && <p>处置：{run.tacticalResolution}</p>}
      </div>
    </Link>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <p className="whitespace-pre-line text-sm">{value ?? "-"}</p>
    </div>
  );
}

function TacticalTrace({ run }: { run: ValidationRun }) {
  if (!run.tacticalResolution) return null;

  return (
    <div className="rounded-input bg-mature-pale px-3 py-2 text-sm text-mature">
      <p>战术处置：{run.tacticalResolution}</p>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <Link href={`/app/interfaces/data-pretraining?run=${run.id}`} className="hover:underline">
          验证记录：{run.dataVersion}
        </Link>
        {run.sourceTension && (
          <Link href={`/app/tensions/${run.sourceTension.id}`} className="hover:underline">
            来源张力：{run.sourceTension.title}
          </Link>
        )}
        {run.resolutionMeeting && (
          <Link href={`/app/meetings/${run.resolutionMeeting.id}`} className="hover:underline">
            来源会议：{run.resolutionMeeting.title}
          </Link>
        )}
      </div>
      {run.createdProject && (
        <Link href={`/app/projects/${run.createdProject.id}`} className="mt-1 block text-xs hover:underline">
          项目：{run.createdProject.name}
        </Link>
      )}
      {run.createdAction && (
        <Link href={`/app/tracker/${run.createdAction.id}`} className="mt-1 block text-xs hover:underline">
          行动：{run.createdAction.title}
        </Link>
      )}
      {run.deferReason && <p className="mt-1 text-xs">延期原因：{run.deferReason}</p>}
    </div>
  );
}

function SubmitForm({
  interfaceId,
  run,
}: {
  interfaceId: string;
  run?: ValidationRun;
}) {
  return (
    <form action={submitValidationAction} className="space-y-4">
      <input type="hidden" name="interfaceId" value={interfaceId} />
      {run && <input type="hidden" name="runId" value={run.id} />}
      <div className="space-y-1.5">
        <label htmlFor="dataVersion" className="text-sm font-medium">
          数据版本
        </label>
        <Input
          id="dataVersion"
          name="dataVersion"
          defaultValue={run?.dataVersion}
          placeholder="data-v2026.07.09"
          required
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="dataLocation" className="text-sm font-medium">
          数据位置
        </label>
        <Input
          id="dataLocation"
          name="dataLocation"
          defaultValue={run?.dataLocation}
          placeholder="s3://bucket/path 或内部数据地址"
          required
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="changeSummary" className="text-sm font-medium">
          变更摘要
        </label>
        <Textarea
          id="changeSummary"
          name="changeSummary"
          defaultValue={run?.changeSummary}
          rows={3}
          required
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="dataScopeScale" className="text-sm font-medium">
          范围 / 量级
        </label>
        <Textarea
          id="dataScopeScale"
          name="dataScopeScale"
          defaultValue={run?.dataScopeScale}
          rows={2}
          required
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="knownRisks" className="text-sm font-medium">
          已知风险
        </label>
        <Textarea id="knownRisks" name="knownRisks" defaultValue={run?.knownRisks ?? ""} rows={2} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="suggestedSmokeRunConfig" className="text-sm font-medium">
          建议烟测配置
        </label>
        <Textarea
          id="suggestedSmokeRunConfig"
          name="suggestedSmokeRunConfig"
          defaultValue={run?.suggestedSmokeRunConfig ?? ""}
          rows={3}
        />
      </div>
      <Button type="submit">{run ? "提交验证" : "提交数据版本"}</Button>
    </form>
  );
}

function SmokeRunForm({ run }: { run: ValidationRun }) {
  const action = recordSmokeRunResultAction.bind(null, run.id);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="smokeRunResult" className="text-sm font-medium">
          烟测结果
        </label>
        <select
          id="smokeRunResult"
          name="smokeRunResult"
          defaultValue={run.smokeRunResult ?? "PASS"}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          required
        >
          <option value="PASS">Pass</option>
          <option value="FAIL">Fail</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="lossSummary" className="text-sm font-medium">
          Loss 摘要
        </label>
        <Textarea id="lossSummary" name="lossSummary" defaultValue={run.lossSummary ?? ""} rows={2} required />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="throughputSummary" className="text-sm font-medium">
          Throughput 摘要
        </label>
        <Textarea
          id="throughputSummary"
          name="throughputSummary"
          defaultValue={run.throughputSummary ?? ""}
          rows={2}
          required
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="abnormalSampleRate" className="text-sm font-medium">
          异常样本率
        </label>
        <Input
          id="abnormalSampleRate"
          name="abnormalSampleRate"
          type="number"
          step="0.0001"
          min="0"
          defaultValue={run.abnormalSampleRate ?? ""}
          required
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="representativeSampleTrace" className="text-sm font-medium">
          代表样本 Trace
        </label>
        <Textarea
          id="representativeSampleTrace"
          name="representativeSampleTrace"
          defaultValue={run.representativeSampleTrace ?? ""}
          rows={3}
          required
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="trainingScheduleImpact" className="text-sm font-medium">
          训练排期影响
        </label>
        <Textarea
          id="trainingScheduleImpact"
          name="trainingScheduleImpact"
          defaultValue={run.trainingScheduleImpact ?? ""}
          rows={2}
          required
        />
      </div>
      <Button type="submit">记录烟测结果</Button>
    </form>
  );
}

function FailureTensionForm({ run }: { run: ValidationRun }) {
  const action = createFailureTensionDraftAction.bind(null, run.id);
  const defaultDescription = [
    `数据版本：${run.dataVersion}`,
    `Loss：${run.lossSummary ?? ""}`,
    `Throughput：${run.throughputSummary ?? ""}`,
    `异常样本率：${run.abnormalSampleRate ?? ""}`,
    `训练排期影响：${run.trainingScheduleImpact ?? ""}`,
  ].join("\n");

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="title" className="text-sm font-medium">
          张力标题
        </label>
        <Input id="title" name="title" defaultValue={`数据验证失败：${run.dataVersion}`} required />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="description" className="text-sm font-medium">
          张力描述
        </label>
        <Textarea id="description" name="description" defaultValue={defaultDescription} rows={6} required />
      </div>
      <Button type="submit" variant="destructive">
        确认创建张力草稿
      </Button>
    </form>
  );
}

function RunDetail({
  run,
  interfaceId,
}: {
  run: ValidationRun | undefined;
  interfaceId: string;
}) {
  if (!run) {
    return (
      <div className="rounded-card border border-border bg-card p-5 shadow-soft">
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Next action
        </p>
        <h2 className="font-serif text-xl font-medium">提交新的数据版本</h2>
        <p className="mb-5 mt-2 text-sm text-muted-foreground">
          Data 回路点击提交后，Pretraining 的 24h 烟测 SLA 开始计时。
        </p>
        <SubmitForm interfaceId={interfaceId} />
      </div>
    );
  }

  const closeAction = closePassingValidationAction.bind(null, run.id);

  return (
    <div className="space-y-4 rounded-card border border-border bg-card p-5 shadow-soft">
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Next action
        </p>
        <h2 className="font-serif text-xl font-medium">{run.dataVersion}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {run.status === "TO_SUBMIT" && "补全提交信息并启动 24h SLA。"}
          {run.status === "AWAITING_SMOKE_RUN" && "录入烟测结果，确认训练信号是否正常。"}
          {run.status === "OVERDUE" && "已逾期，仍需录入烟测结果并保留 SLA miss。"}
          {run.status === "PASSED" && "关闭通过项，记录 SLA 是否达成。"}
          {run.status === "FAILED" && "由人确认失败证据，生成张力草稿。"}
        </p>
      </div>

      <div className="grid gap-3 border-y border-border py-4 sm:grid-cols-2">
        <Field label="位置" value={run.dataLocation} />
        <Field label="提交时间" value={formatDateTime(run.submittedAt)} />
        <Field label="范围 / 量级" value={run.dataScopeScale} />
        <Field label="SLA" value={run.slaResult ?? "未关闭"} />
      </div>

      <TacticalTrace run={run} />

      {!run.tacticalResolution && run.status === "TO_SUBMIT" && <SubmitForm interfaceId={interfaceId} run={run} />}

      {!run.tacticalResolution && (run.status === "AWAITING_SMOKE_RUN" || run.status === "OVERDUE") && (
        <SmokeRunForm run={run} />
      )}

      {!run.tacticalResolution && run.status === "PASSED" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Loss" value={run.lossSummary} />
            <Field label="Throughput" value={run.throughputSummary} />
            <Field label="异常样本率" value={run.abnormalSampleRate} />
            <Field label="训练排期影响" value={run.trainingScheduleImpact} />
          </div>
          {run.closedAt ? (
            <p className="rounded-input bg-mature-pale px-3 py-2 text-sm text-mature">
              已关闭：{formatDateTime(run.closedAt)} / SLA {run.slaResult}
            </p>
          ) : (
            <form action={closeAction}>
              <Button type="submit">关闭并记录 SLA</Button>
            </form>
          )}
        </div>
      )}

      {!run.tacticalResolution && run.status === "FAILED" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Loss" value={run.lossSummary} />
            <Field label="Throughput" value={run.throughputSummary} />
            <Field label="异常样本率" value={run.abnormalSampleRate} />
            <Field label="训练排期影响" value={run.trainingScheduleImpact} />
          </div>
          {run.createdTension ? (
            <Link href={`/app/tensions/${run.createdTension.id}`} className="text-sm text-moss hover:underline">
              查看张力草稿：{run.createdTension.title}
            </Link>
          ) : (
            <FailureTensionForm run={run} />
          )}
        </div>
      )}
    </div>
  );
}

export default async function DataPretrainingWorkbenchPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string | string[] }>;
}) {
  const orgId = await getCurrentOrgId();
  const pilotInterface = await getPilotInterface(orgId);
  const params = await searchParams;
  const selectedRunId = firstParam(params.run);

  if (!pilotInterface) {
    return (
      <div className="mx-auto max-w-4xl animate-fade-rise">
        <Link
          href="/app/interfaces"
          className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
        >
          ← 接口
        </Link>
        <div className="rounded-card border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="mb-4 text-4xl text-moss/60">⇄</div>
          <h1 className="font-serif text-2xl font-medium">缺少 Data → Pretraining 接口</h1>
          <p className="mx-auto mb-6 mt-3 max-w-lg text-sm text-muted-foreground">
            这个工作台只服务 Data → Pretraining 试点。请先用专用初始化流程应用大模型团队模板。
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/app/setup">
              <Button>初始化组织</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const runs = await getRuns(orgId, pilotInterface.id);
  const runsByStatus = columns.reduce<Record<BoardStatus, ValidationRun[]>>(
    (acc, column) => {
      acc[column.status] = [];
      return acc;
    },
    {} as Record<BoardStatus, ValidationRun[]>
  );

  for (const run of runs) {
    if (run.status in runsByStatus) {
      runsByStatus[run.status as BoardStatus].push(run);
    }
  }

  const selectedRun =
    selectedRunId && selectedRunId !== "new"
      ? runs.find((run) => run.id === selectedRunId)
      : undefined;

  return (
    <div className="animate-fade-rise">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/app/interfaces"
            className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground"
          >
            ← 接口
          </Link>
          <h1 className="font-serif text-2xl font-medium">Data → Pretraining 验证工作台</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {pilotInterface.fromCircle.name} 向 {pilotInterface.toCircle.name} 提交数据版本；烟测结果决定通过、失败或逾期。
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            接口：{pilotInterface.name} · SLA：提交后 24h 内完成烟测 · 负责人：{pilotInterface.owner.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={updateOverdueValidationRunsAction}>
            <input type="hidden" name="interfaceId" value={pilotInterface.id} />
            <Button type="submit" variant="outline">
              刷新逾期
            </Button>
          </form>
          <Link href="/app/interfaces/data-pretraining?run=new">
            <Button>提交数据版本</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="overflow-x-auto pb-2">
          <div className="grid min-w-[1040px] grid-cols-5 gap-3">
            {columns.map((column) => (
              <div key={column.status} className="rounded-card border border-border bg-muted/30 p-3">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-medium">{column.label}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">{column.hint}</p>
                  </div>
                  <StatusBadge
                    variant={column.badge as never}
                    label={String(runsByStatus[column.status].length)}
                    pulse={column.status === "OVERDUE" && runsByStatus[column.status].length > 0}
                  />
                </div>
                <div className="min-h-80 space-y-3">
                  {runsByStatus[column.status].length === 0 ? (
                    <div className="rounded-card border border-dashed border-border bg-card/50 p-4 text-center text-xs text-muted-foreground">
                      暂无记录
                    </div>
                  ) : (
                    runsByStatus[column.status].map((run) => (
                      <RunCard key={run.id} run={run} selected={run.id === selectedRunId} />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <RunDetail
            run={selectedRunId === "new" ? undefined : selectedRun}
            interfaceId={pilotInterface.id}
          />
        </aside>
      </div>
    </div>
  );
}
