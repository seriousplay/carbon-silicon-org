"use client";

import { CheckCircle2, Circle, FileCheck2, ListTodo, Scale, Sparkles } from "lucide-react";

import type { MeetingFacilitationReadModel } from "@/lib/meeting-facilitation/read-model";

export type CockpitEvent = Readonly<{
  sequence: number;
  stateRevision: number;
  actorPersonId: string | null;
  type: string;
  payload: Readonly<Record<string, unknown>>;
  createdAt: string;
}>;

export function StructurePanel({
  snapshot,
  events,
  participantLabels,
}: {
  snapshot: MeetingFacilitationReadModel;
  events: readonly CockpitEvent[];
  participantLabels: Readonly<Record<string, string>>;
}) {
  const outputs = events.filter((event) => [
    "TACTICAL_OUTPUT_CONFIRMED",
    "GOVERNANCE_PROPOSAL_ADOPTION_CONFIRMED",
    "OBJECTION_INTEGRATED",
    "INTEGRATION_COMPLETED_RESTART_OBJECTION_ROUND",
  ].includes(event.type));
  const latestCoach = [...events].reverse().find((event) => event.type === "COACH_SUGGESTION");

  return (
    <aside className="h-full min-h-[620px] border-l border-border bg-muted/10 p-5 space-y-6 overflow-y-auto">
      <section>
        <Eyebrow icon={<FileCheck2 className="h-3.5 w-3.5" />} label="会议进展" />
        <div className="mt-3 rounded-xl border border-border bg-background p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{phaseLabel(snapshot.phase)}</span>
            <span className="text-[11px] text-muted-foreground">rev {snapshot.revision}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-moss transition-[width] duration-500"
              style={{ width: `${phaseProgress(snapshot.engine, snapshot.phase)}%` }}
            />
          </div>
          {snapshot.paused && <p className="mt-2 text-xs font-medium text-amber-700">会议已暂停</p>}
        </div>
      </section>

      <section>
        <Eyebrow icon={<ListTodo className="h-3.5 w-3.5" />} label={`动态议程 · ${snapshot.agenda.length}`} />
        <div className="mt-3 space-y-2">
          {snapshot.agenda.length === 0 && <Empty text="议程会在参与者提交后实时出现" />}
          {snapshot.agenda.map((item, index) => (
            <div key={item.id} className={`rounded-xl border p-3 ${item.status === "ACTIVE" ? "border-moss/40 bg-moss/5" : "border-border bg-background"}`}>
              <div className="flex items-start gap-2">
                {item.status === "COMPLETED"
                  ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-moss" />
                  : <Circle className={`mt-0.5 h-4 w-4 shrink-0 ${item.status === "ACTIVE" ? "text-moss" : "text-muted-foreground/40"}`} />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">#{index + 1}</span>
                    <p className="truncate text-sm font-medium">{item.label}</p>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {participantLabels[item.ownerParticipantId] ?? "未知角色"}
                  </p>
                  {item.need && <p className="mt-2 text-xs leading-relaxed">需要：{item.need}</p>}
                  {item.outputConfirmed && <p className="mt-1 text-xs text-moss">已确认候选输出</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {snapshot.engine === "GOVERNANCE" && (
        <section>
          <Eyebrow icon={<Scale className="h-3.5 w-3.5" />} label={`反对复核 · ${snapshot.objections.length}`} />
          <div className="mt-3 space-y-2">
            {snapshot.objections.length === 0 && <Empty text="当前修订没有待处理反对" />}
            {snapshot.objections.map((objection) => (
              <div key={objection.id} className="rounded-xl border border-border bg-background p-3">
                <p className="text-xs leading-relaxed">{objection.statement}</p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                  <span className={`rounded-full px-2 py-0.5 ${objection.effectiveValidity ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"}`}>
                    {objection.effectiveValidity ? "保护性有效" : "当前无效"}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                    AI {objection.aiValidity ?? "待判定"}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                    {objection.humanStanceCount} 人复核
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <Eyebrow icon={<Sparkles className="h-3.5 w-3.5" />} label="教练最近介入" />
        <div className="mt-3 rounded-xl border border-border bg-background p-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {coachSpeech(latestCoach) ?? "教练只在流程需要时介入，不会机械回复每条消息。"}
          </p>
        </div>
      </section>

      <section>
        <Eyebrow icon={<CheckCircle2 className="h-3.5 w-3.5" />} label={`关键输出 · ${outputs.length}`} />
        <div className="mt-3 space-y-2">
          {outputs.length === 0 && <Empty text="承诺、整合和采纳结果会在这里沉淀" />}
          {outputs.map((event) => (
            <div key={event.sequence} className="rounded-xl border border-moss/20 bg-moss/5 p-3">
              <p className="text-xs font-medium">{eventLabel(event.type)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">事件 #{event.sequence} · 状态 rev {event.stateRevision}</p>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

function Eyebrow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{icon}{label}</h3>;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">{text}</p>;
}

function coachSpeech(event: CockpitEvent | undefined): string | null {
  const suggestion = event?.payload.suggestion;
  if (!suggestion || typeof suggestion !== "object" || Array.isArray(suggestion)) return null;
  return typeof (suggestion as Record<string, unknown>).speech === "string"
    ? (suggestion as Record<string, string>).speech
    : null;
}

function eventLabel(type: string): string {
  const labels: Record<string, string> = {
    TACTICAL_OUTPUT_CONFIRMED: "战术输出已确认",
    GOVERNANCE_PROPOSAL_ADOPTION_CONFIRMED: "治理采纳已确认",
    OBJECTION_INTEGRATED: "一条反对已完成整合",
    INTEGRATION_COMPLETED_RESTART_OBJECTION_ROUND: "新修订已进入重新反对轮",
  };
  return labels[type] ?? type;
}

function phaseProgress(engine: "TACTICAL" | "GOVERNANCE", phase: string): number {
  const phases = engine === "TACTICAL"
    ? ["ENTRY", "CHECK_IN", "CHECKLIST_REVIEW", "METRICS_REVIEW", "PROJECT_UPDATES", "BUILD_AGENDA", "TRIAGE_ITEM", "CLOSING_ROUND", "COMPLETED"]
    : ["ENTRY", "CHECK_IN", "BUILD_AGENDA", "PRESENT_PROPOSAL", "CLARIFYING_QUESTIONS", "REACTION_ROUND", "AMEND_OR_CLARIFY", "OBJECTION_ROUND", "AI_ASSESSMENT", "DISTRIBUTED_REVIEW", "INTEGRATION", "ADOPTION_CONFIRMATION", "CLOSING_ROUND", "COMPLETED"];
  const index = phases.indexOf(phase);
  return index < 0 ? 0 : ((index + 1) / phases.length) * 100;
}

export function phaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    ENTRY: "角色确认",
    CHECK_IN: "签到轮",
    CHECKLIST_REVIEW: "检查清单",
    METRICS_REVIEW: "指标回顾",
    PROJECT_UPDATES: "项目增量",
    BUILD_AGENDA: "构建议程",
    TRIAGE_ITEM: "逐项分诊",
    PRESENT_PROPOSAL: "提出提案",
    CLARIFYING_QUESTIONS: "澄清问题",
    REACTION_ROUND: "回应轮",
    AMEND_OR_CLARIFY: "修改或澄清",
    OBJECTION_ROUND: "反对轮",
    AI_ASSESSMENT: "AI 初判",
    DISTRIBUTED_REVIEW: "分布式复核",
    INTEGRATION: "逐条整合",
    ADOPTION_CONFIRMATION: "采纳确认",
    CLOSING_ROUND: "结束轮",
    COMPLETED: "会议完成",
  };
  return labels[phase] ?? phase;
}
