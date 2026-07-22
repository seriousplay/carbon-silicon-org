"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, Check, CirclePause, Loader2, Play, Send, Sparkles, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { MeetingCoachSuggestion } from "@/lib/meeting-facilitation/coach-schema";
import type { MeetingFacilitationCommand } from "@/lib/meeting-facilitation/repository";
import type { MeetingFacilitationReadModel } from "@/lib/meeting-facilitation/read-model";

import { joinMeetingAction } from "./meeting-agent-actions";
import {
  confirmMeetingRoleRepresentationAction,
  executeMeetingFacilitationAction,
  initializeMeetingFacilitationAction,
  requestMeetingCoachSuggestionAction,
} from "./meeting-facilitation-actions";
import { COACH_PERSONAS } from "./coach-personas";
import { phaseLabel, StructurePanel, type CockpitEvent } from "./structure-panel";

export type CockpitParticipant = Readonly<{
  id: string;
  personId: string;
  name: string;
  status: string;
  roleIds: readonly string[];
  roleNames: readonly string[];
}>;

type AvailableRole = Readonly<{ id: string; name: string; purpose: string }>;
type AgendaSource = Readonly<{ id: string; label: string; kind: "TENSION" | "PROPOSAL"; revision?: number }>;
const inputClass = "rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-moss/50 focus:ring-2 focus:ring-moss/10";

export function MeetingAgentClient({
  meetingId,
  meetingType,
  currentPersonId,
  isOnline,
  participants: initialParticipants,
  availableRoles,
  agendaSources,
  initialSnapshot,
  initialEvents,
}: {
  meetingId: string;
  meetingType: "TACTICAL" | "GOVERNANCE";
  currentPersonId: string;
  isOnline: boolean;
  participants: readonly CockpitParticipant[];
  availableRoles: readonly AvailableRole[];
  agendaSources: readonly AgendaSource[];
  initialSnapshot: MeetingFacilitationReadModel | null;
  initialEvents: readonly CockpitEvent[];
}) {
  const persona = COACH_PERSONAS[meetingType];
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [events, setEvents] = useState<CockpitEvent[]>([...initialEvents]);
  const [participants, setParticipants] = useState([...initialParticipants]);
  const [cursor, setCursor] = useState(initialSnapshot?.nextEventCursor ?? initialEvents.at(-1)?.sequence ?? 0);
  const [draft, setDraft] = useState("");
  const draftRef = useRef(draft);
  const [agendaLabel, setAgendaLabel] = useState("");
  const [agendaRoleId, setAgendaRoleId] = useState(availableRoles[0]?.id ?? "");
  const [agendaSourceId, setAgendaSourceId] = useState(agendaSources[0]?.id ?? "");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(
    initialParticipants.find((participant) => participant.personId === currentPersonId)?.roleIds.slice() ?? [],
  );
  const [objection, setObjection] = useState({ statement: "", harm: "", cause: "", role: "", safe: "" });
  const [stanceReason, setStanceReason] = useState("");
  const [integrationRevision, setIntegrationRevision] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [coachThinking, setCoachThinking] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => { draftRef.current = draft; }, [draft]);

  const refreshSnapshot = useCallback(async () => {
    const response = await fetch(`/api/meetings/${meetingId}/snapshot`, { cache: "no-store" });
    if (!response.ok) return;
    const body = await response.json() as {
      snapshot?: MeetingFacilitationReadModel | null;
      preflight?: { participants: CockpitParticipant[] };
    };
    if (body.snapshot) {
      setSnapshot(body.snapshot);
      setCursor((current) => Math.max(current, body.snapshot!.nextEventCursor));
    }
    if (body.preflight) setParticipants(body.preflight.participants);
  }, [meetingId]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        if (snapshot) {
          const response = await fetch(`/api/meetings/${meetingId}/events?after=${cursor}`, { cache: "no-store" });
          if (response.ok) {
            const body = await response.json() as { events: CockpitEvent[]; nextCursor: number };
            if (!cancelled && body.events.length > 0) {
              setEvents((current) => mergeEvents(current, body.events));
              setCursor(body.nextCursor);
              await refreshSnapshot();
            }
          }
        } else {
          await refreshSnapshot();
        }
      } finally {
        if (!cancelled) timer = setTimeout(poll, snapshot ? 1_200 : 2_000);
      }
    }
    timer = setTimeout(poll, 600);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [cursor, meetingId, refreshSnapshot, snapshot]);

  const myParticipant = participants.find((participant) => participant.personId === currentPersonId);
  const participantLabels = useMemo(() => Object.fromEntries(participants.map((participant) => [
    participant.id,
    participant.roleNames.length > 0 ? participant.roleNames.join(" / ") : participant.name,
  ])), [participants]);

  async function execute(command: MeetingFacilitationCommand, coachTrigger?: "PHASE_ENTERED" | "OBJECTION_RECORDED" | "OUTPUT_CANDIDATE") {
    if (!snapshot || isPending) return null;
    setError(null);
    const previousPhase = snapshot.phase;
    let next: MeetingFacilitationReadModel | null = null;
    await new Promise<void>((resolve) => {
      startTransition(async () => {
        const result = await executeMeetingFacilitationAction(meetingId, snapshot.revision, command);
        if (!result.ok) {
          setError(errorMessage(result.errorCode));
          if (result.errorCode === "STALE_MEETING_REVISION") await refreshSnapshot();
          resolve();
          return;
        }
        next = result.snapshot;
        setSnapshot(result.snapshot);
        if (command.type === "COMPLETE_TURN") setDraft("");
        if (coachTrigger || result.snapshot.phase !== previousPhase) {
          await requestCoach(result.snapshot, coachTrigger ?? "PHASE_ENTERED");
        }
        resolve();
      });
    });
    return next;
  }

  async function requestCoach(current: MeetingFacilitationReadModel, trigger: "PHASE_ENTERED" | "OBJECTION_RECORDED" | "OUTPUT_CANDIDATE" | "PROCESS_QUESTION") {
    setCoachThinking(true);
    const result = await requestMeetingCoachSuggestionAction(meetingId, current.revision, { type: trigger });
    setCoachThinking(false);
    if (!result.ok) {
      setError(errorMessage(result.errorCode));
      return null;
    }
    const event: CockpitEvent = {
      sequence: result.nextEventCursor,
      stateRevision: current.revision,
      actorPersonId: currentPersonId,
      type: "COACH_SUGGESTION",
      payload: { trigger: { type: trigger }, suggestion: result.suggestion },
      createdAt: new Date().toISOString(),
    };
    setEvents((existing) => mergeEvents(existing, [event]));
    setCursor((existing) => Math.max(existing, event.sequence));
    return result.suggestion;
  }

  async function join() {
    setError(null);
    const result = await joinMeetingAction(meetingId);
    if (result.error) setError(result.error);
    else window.location.reload();
  }

  async function saveRoles() {
    const result = await confirmMeetingRoleRepresentationAction(meetingId, selectedRoleIds);
    if (!result.ok) setError(errorMessage(result.errorCode));
    else await refreshSnapshot();
  }

  async function startMeeting() {
    const result = await initializeMeetingFacilitationAction(meetingId);
    if (!result.ok) setError(errorMessage(result.errorCode));
    else {
      setSnapshot(result.snapshot);
      setCursor(result.snapshot.nextEventCursor);
    }
  }

  if (!isOnline) {
    return (
      <PreflightShell persona={persona}>
        <div className="mx-auto max-w-md py-16 text-center">
          <Users className="mx-auto h-9 w-9 text-moss" />
          <h2 className="mt-4 text-xl font-semibold">加入真实会议空间</h2>
          <p className="mt-2 text-sm text-muted-foreground">加入后选择本次代表的真实角色。AI 不会模拟尚未到场的人。</p>
          <Button className="mt-6" onClick={join}>加入会议</Button>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </div>
      </PreflightShell>
    );
  }

  if (!snapshot) {
    const online = participants.filter((participant) => participant.status === "ONLINE");
    const allReady = online.length > 0 && online.every((participant) => participant.roleIds.length > 0);
    return (
      <PreflightShell persona={persona}>
        <div className="grid gap-8 p-6 lg:grid-cols-[1.1fr_.9fr]">
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-moss">会前角色确认</p>
            <h2 className="mt-2 text-2xl font-semibold">你今天代表哪些角色？</h2>
            <p className="mt-2 text-sm text-muted-foreground">教练只依据你勾选的角色理解权责，不用姓名或职位替代治理身份。</p>
            <div className="mt-5 space-y-2">
              {availableRoles.map((role) => (
                <label key={role.id} className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${selectedRoleIds.includes(role.id) ? "border-moss/40 bg-moss/5" : "border-border"}`}>
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.includes(role.id)}
                    onChange={() => setSelectedRoleIds((current) => current.includes(role.id) ? current.filter((id) => id !== role.id) : [...current, role.id])}
                    className="mt-1 h-4 w-4"
                  />
                  <span><span className="block text-sm font-medium">{role.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{role.purpose}</span></span>
                </label>
              ))}
              {availableRoles.length === 0 && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">你目前没有可代表的活动角色。</p>}
            </div>
            <Button className="mt-4" variant="outline" onClick={saveRoles} disabled={selectedRoleIds.length === 0}>确认本次代表角色</Button>
          </section>
          <section className="rounded-2xl border border-border bg-muted/20 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">到场与就绪</p>
            <div className="mt-4 space-y-3">
              {participants.map((participant) => (
                <div key={participant.id} className="flex items-center gap-3 rounded-xl bg-background p-3">
                  <span className={`h-2 w-2 rounded-full ${participant.status === "ONLINE" ? "bg-moss" : "bg-muted-foreground/30"}`} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{participant.name}</p><p className="truncate text-xs text-muted-foreground">{participant.roleNames.join(" / ") || "待确认角色"}</p></div>
                  {participant.roleIds.length > 0 && <Check className="h-4 w-4 text-moss" />}
                </div>
              ))}
            </div>
            {online.length === 1 && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">当前只有一人在线。现在开始将明确标记为单人演练，AI 不会生成其他人的观点。</p>}
            <Button className="mt-5 w-full" onClick={startMeeting} disabled={!allReady}>{online.length === 1 ? "开始单人演练" : "开始会议"}</Button>
            {!allReady && <p className="mt-2 text-center text-xs text-muted-foreground">等待所有在线参与者确认角色</p>}
          </section>
        </div>
        {error && <p className="px-6 pb-4 text-sm text-destructive">{error}</p>}
      </PreflightShell>
    );
  }

  const activeAgenda = snapshot.agenda.find((item) => item.id === snapshot.activeAgendaItemId) ?? null;
  const myTurnDone = myParticipant ? snapshot.completedParticipantIds.includes(myParticipant.id) : false;
  const currentTurnParticipantId = snapshot.pendingParticipantIds[0] ?? null;
  const currentTurnLabel = currentTurnParticipantId ? participantLabels[currentTurnParticipantId] : null;

  return (
    <div className="grid min-h-[680px] lg:grid-cols-[minmax(0,1fr)_340px]">
      <main className="flex min-w-0 flex-col">
        <header className="border-b border-border bg-gradient-to-r from-moss/10 via-background to-background px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-2xl">{persona.avatarEmoji}</span>
            <div><p className="text-sm font-semibold">{persona.name} · {persona.title}</p><p className="text-xs text-muted-foreground">{phaseLabel(snapshot.phase)}{currentTurnLabel ? ` · 当前：${currentTurnLabel}` : ""}</p></div>
            <div className="ml-auto flex items-center gap-2">
              {snapshot.paused
                ? <Button size="sm" variant="outline" onClick={() => execute({ type: "RESUME" })}><Play className="mr-1 h-3.5 w-3.5" />恢复</Button>
                : <Button size="sm" variant="outline" onClick={() => execute({ type: "PAUSE", reason: "participant requested pause" })}><CirclePause className="mr-1 h-3.5 w-3.5" />暂停</Button>}
              <Button size="sm" variant="ghost" onClick={() => execute({ type: "BACK" })}><ArrowLeft className="mr-1 h-3.5 w-3.5" />回退</Button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <CoachStage snapshot={snapshot} persona={persona} activeAgendaLabel={activeAgenda?.label ?? null} />
          <div className="mt-5 space-y-3">
            {events.slice(-40).map((event) => <EventBubble key={event.sequence} event={event} isMe={event.actorPersonId === currentPersonId} />)}
            {coachThinking && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{persona.name} 正在核对当前阶段、角色与证据…</div>}
          </div>
        </div>

        <div className="border-t border-border bg-background p-4">
          {error && <div className="mb-3 flex items-center justify-between rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"><span>{error}</span><button onClick={() => setError(null)}><X className="h-3.5 w-3.5" /></button></div>}
          <PhaseControls
            snapshot={snapshot}
            meetingType={meetingType}
            myParticipant={myParticipant ?? null}
            myTurnDone={myTurnDone}
            activeAgenda={activeAgenda}
            availableRoles={availableRoles}
            agendaSources={agendaSources}
            draft={draft}
            setDraft={setDraft}
            agendaLabel={agendaLabel}
            setAgendaLabel={setAgendaLabel}
            agendaRoleId={agendaRoleId}
            setAgendaRoleId={setAgendaRoleId}
            agendaSourceId={agendaSourceId}
            setAgendaSourceId={setAgendaSourceId}
            objection={objection}
            setObjection={setObjection}
            stanceReason={stanceReason}
            setStanceReason={setStanceReason}
            integrationRevision={integrationRevision}
            setIntegrationRevision={setIntegrationRevision}
            isPending={isPending || coachThinking}
            execute={execute}
            requestCoach={() => requestCoach(snapshot, "PROCESS_QUESTION")}
            assessObjections={async () => {
              let current = snapshot;
              for (const item of current.objections.filter((candidate) => candidate.aiValidity === null)) {
                const suggestion = await requestCoach(current, "OBJECTION_RECORDED");
                if (!suggestion?.objectionAssessment) return;
                const next = await executeFrom(current, {
                  type: "RECORD_AI_ASSESSMENT",
                  objectionId: item.id,
                  assessment: {
                    validity: suggestion.objectionAssessment.validity,
                    rationale: suggestion.objectionAssessment.rationale,
                    confidence: suggestion.confidence,
                    criteria: { items: suggestion.objectionAssessment.criteria },
                    evidenceRefs: suggestion.evidenceRefs,
                  },
                });
                if (!next) return;
                current = next;
              }
              const reviewed = await executeFrom(current, { type: "CONFIRM_AI_ASSESSMENTS" });
              if (reviewed) current = reviewed;
              setSnapshot(current);
            }}
          />
        </div>
      </main>
      <StructurePanel snapshot={snapshot} events={events} participantLabels={participantLabels} />
    </div>
  );

  async function executeFrom(current: MeetingFacilitationReadModel, command: MeetingFacilitationCommand) {
    const result = await executeMeetingFacilitationAction(meetingId, current.revision, command);
    if (!result.ok) { setError(errorMessage(result.errorCode)); return null; }
    setSnapshot(result.snapshot);
    return result.snapshot;
  }
}

function PhaseControls(props: {
  snapshot: MeetingFacilitationReadModel;
  meetingType: "TACTICAL" | "GOVERNANCE";
  myParticipant: CockpitParticipant | null;
  myTurnDone: boolean;
  activeAgenda: MeetingFacilitationReadModel["agenda"][number] | null;
  availableRoles: readonly AvailableRole[];
  agendaSources: readonly AgendaSource[];
  draft: string;
  setDraft(value: string): void;
  agendaLabel: string;
  setAgendaLabel(value: string): void;
  agendaRoleId: string;
  setAgendaRoleId(value: string): void;
  agendaSourceId: string;
  setAgendaSourceId(value: string): void;
  objection: { statement: string; harm: string; cause: string; role: string; safe: string };
  setObjection(value: { statement: string; harm: string; cause: string; role: string; safe: string }): void;
  stanceReason: string;
  setStanceReason(value: string): void;
  integrationRevision: number;
  setIntegrationRevision(value: number): void;
  isPending: boolean;
  execute(command: MeetingFacilitationCommand, coachTrigger?: "PHASE_ENTERED" | "OBJECTION_RECORDED" | "OUTPUT_CANDIDATE"): Promise<MeetingFacilitationReadModel | null>;
  requestCoach(): void;
  assessObjections(): Promise<void>;
}) {
  const { snapshot, myParticipant, activeAgenda } = props;
  if (snapshot.paused) return <p className="text-center text-sm text-muted-foreground">会议已暂停。任何参会者都可以恢复。</p>;
  if (snapshot.phase === "ENTRY") return <Primary onClick={() => props.execute({ type: "START" })} disabled={props.isPending}>开始签到轮</Primary>;
  if (snapshot.phase === "COMPLETED") return <p className="text-center text-sm font-medium text-moss">会议已由人类确认结束，结构化成果已归档。</p>;
  if (snapshot.phase === "CLOSING_ROUND" && snapshot.pendingParticipantIds.length === 0) {
    return <Primary onClick={() => props.execute({ type: "CONFIRM_END" })} disabled={props.isPending}>人类确认结束会议并归档成果</Primary>;
  }

  if (snapshot.phase === "BUILD_AGENDA") {
    const source = props.agendaSources.find((item) => item.id === props.agendaSourceId);
    return (
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_160px_180px_auto]">
          <input value={props.agendaLabel} onChange={(event) => props.setAgendaLabel(event.target.value)} placeholder="一到两个词的标签" className={inputClass} />
          <select value={props.agendaRoleId} onChange={(event) => props.setAgendaRoleId(event.target.value)} className={inputClass}>{props.availableRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select>
          <select value={props.agendaSourceId} onChange={(event) => props.setAgendaSourceId(event.target.value)} className={inputClass}><option value="">不关联现有记录</option>{props.agendaSources.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
          <Button
            variant="outline"
            disabled={!props.agendaLabel.trim() || !props.agendaRoleId || props.isPending || (props.meetingType === "GOVERNANCE" && !source)}
            onClick={async () => {
              await props.execute({
                type: "ADD_AGENDA_ITEM",
                roleId: props.agendaRoleId,
                label: props.agendaLabel,
                ...(source?.kind === "TENSION" ? { linkedTensionId: source.id } : {}),
                ...(source?.kind === "PROPOSAL" ? { linkedProposalId: source.id } : {}),
              });
              props.setAgendaLabel("");
            }}
          >加入议程</Button>
        </div>
        <TurnSubmit {...props} placeholder="若还有标签可继续添加；准备好后完成本轮" contentOptional />
      </div>
    );
  }

  if (["CHECK_IN", "CHECKLIST_REVIEW", "METRICS_REVIEW", "PROJECT_UPDATES", "CLARIFYING_QUESTIONS", "REACTION_ROUND", "CLOSING_ROUND"].includes(snapshot.phase)) {
    return <TurnSubmit {...props} placeholder={turnPlaceholder(snapshot.phase)} />;
  }

  if (snapshot.phase === "TRIAGE_ITEM" && activeAgenda) {
    const isOwner = activeAgenda.ownerParticipantId === myParticipant?.id;
    if (!activeAgenda.need) {
      return isOwner
        ? <Composer value={props.draft} setValue={props.setDraft} placeholder="为了处理这个张力，你需要什么？" action="确认需要" disabled={props.isPending} onSubmit={() => props.execute({ type: "CONFIRM_NEED", itemId: activeAgenda.id, need: props.draft }, "OUTPUT_CANDIDATE")} />
        : <Waiting text="等待议程拥有者确认需要。其他人先不要替他定义。" />;
    }
    return (
      <div className="space-y-2">
        {!activeAgenda.outputConfirmed && <Composer value={props.draft} setValue={props.setDraft} placeholder="记录候选 Action、Project 或信息答复" action="确认候选输出" disabled={props.isPending || !props.draft.trim()} onSubmit={() => props.execute({ type: "CONFIRM_OUTPUT", itemId: activeAgenda.id, candidateOutput: { summary: props.draft } }, "OUTPUT_CANDIDATE")} />}
        {isOwner && <Button className="w-full" onClick={() => props.execute({ type: "CONFIRM_NEED_MET", itemId: activeAgenda.id })}>我得到了所需，处理下一项</Button>}
      </div>
    );
  }

  if (snapshot.phase === "PRESENT_PROPOSAL" && activeAgenda) {
    const isProposer = snapshot.proposerParticipantId === myParticipant?.id;
    const source = props.agendaSources.find((item) => item.id === activeAgenda.linkedProposalId && item.kind === "PROPOSAL");
    return isProposer
      ? <Primary onClick={() => props.execute({ type: "PRESENT_PROPOSAL", itemId: activeAgenda.id, proposalRevision: source?.revision ?? 1 })} disabled={props.isPending}>提案已呈现，进入澄清</Primary>
      : <Waiting text="等待提案人呈现最小可行治理变更。" />;
  }

  if (snapshot.phase === "AMEND_OR_CLARIFY") {
    const isProposer = snapshot.proposerParticipantId === myParticipant?.id;
    return isProposer
      ? <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => props.execute({ type: "PROPOSER_DECISION", amended: false, proposalRevision: snapshot.proposalRevision ?? 1 })}>保持当前提案</Button><Button onClick={() => props.execute({ type: "PROPOSER_DECISION", amended: true, proposalRevision: (snapshot.proposalRevision ?? 1) + 1 })}>已提交新修订</Button></div>
      : <Waiting text="提案人正在决定修改、澄清或保持原案。" />;
  }

  if (snapshot.phase === "OBJECTION_ROUND") {
    if (props.myTurnDone) return <Waiting text="你的反对轮已完成，等待其他角色。" />;
    const recorded = snapshot.objections.some((item) => item.objectorParticipantId === myParticipant?.id);
    if (recorded) {
      return <Primary onClick={() => props.execute({ type: "COMPLETE_TURN", content: "OBJECTION_RECORDED" })} disabled={props.isPending}>反对已记录，完成我的本轮</Primary>;
    }
    return (
      <div className="space-y-2">
        <Textarea value={props.objection.statement} onChange={(event) => props.setObjection({ ...props.objection, statement: event.target.value })} placeholder="这个提案会造成什么具体损害？" />
        <div className="grid gap-2 sm:grid-cols-2">
          <input className={inputClass} value={props.objection.cause} onChange={(event) => props.setObjection({ ...props.objection, cause: event.target.value })} placeholder="损害是否由提案新增？" />
          <input className={inputClass} value={props.objection.role} onChange={(event) => props.setObjection({ ...props.objection, role: event.target.value })} placeholder="与你代表的角色有何关系？" />
          <input className={inputClass} value={props.objection.harm} onChange={(event) => props.setObjection({ ...props.objection, harm: event.target.value })} placeholder="实质损害是什么？" />
          <input className={inputClass} value={props.objection.safe} onChange={(event) => props.setObjection({ ...props.objection, safe: event.target.value })} placeholder="能否安全试行后再调整？" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => props.execute({ type: "COMPLETE_TURN", content: "NO_OBJECTION" })}>没有反对</Button>
          <Button disabled={!props.objection.statement.trim() || !props.agendaRoleId} onClick={() => props.execute({
              type: "RECORD_OBJECTION",
              objectionId: crypto.randomUUID(),
              objectorRoleId: props.agendaRoleId,
              statement: props.objection.statement,
              criteria: props.objection,
            }, "OBJECTION_RECORDED")}>提交反对</Button>
        </div>
      </div>
    );
  }

  if (snapshot.phase === "AI_ASSESSMENT") return <Primary onClick={props.assessObjections} disabled={props.isPending}>AI 按四项标准逐条初判</Primary>;
  if (snapshot.phase === "DISTRIBUTED_REVIEW") {
    const objection = snapshot.objections[0];
    if (!objection) return <Primary onClick={() => props.execute({ type: "CONFIRM_DISTRIBUTED_REVIEW" })}>确认复核完成</Primary>;
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">任何人都可以推翻 AI。只要一人维持有效，就进入整合。</p>
        <input className={`${inputClass} w-full`} value={props.stanceReason} onChange={(event) => props.setStanceReason(event.target.value)} placeholder="说明你的角色依据" />
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" disabled={!props.stanceReason.trim()} onClick={() => props.execute({ type: "RECORD_HUMAN_STANCE", objectionId: objection.id, validity: "INVALID", reason: props.stanceReason })}>推翻为无效</Button>
          <Button variant="outline" disabled={!props.stanceReason.trim()} onClick={() => props.execute({ type: "RECORD_HUMAN_STANCE", objectionId: objection.id, validity: "VALID", reason: props.stanceReason })}>维持有效</Button>
          <Button onClick={() => props.execute({ type: "CONFIRM_DISTRIBUTED_REVIEW" })}>确认复核完成</Button>
        </div>
      </div>
    );
  }
  if (snapshot.phase === "INTEGRATION") {
    const objection = snapshot.objections.find((item) => item.effectiveValidity && !item.integrated);
    if (!objection) return <Waiting text="等待有效反对进入逐条整合。" />;
    const isObjector = objection.objectorParticipantId === myParticipant?.id;
    const isProposer = snapshot.proposerParticipantId === myParticipant?.id;
    return <div className="space-y-2"><input className={`${inputClass} w-full`} type="number" min={(snapshot.proposalRevision ?? 1) + 1} value={props.integrationRevision} onChange={(event) => props.setIntegrationRevision(Number(event.target.value))} /><div className="grid gap-2 sm:grid-cols-2">{isObjector ? <Button variant="outline" disabled={objection.objectorConfirmed} onClick={() => props.execute({ type: "CONFIRM_INTEGRATION", objectionId: objection.id, capacity: "OBJECTOR", proposalRevision: props.integrationRevision })}>{objection.objectorConfirmed ? "反对者已确认" : "我以反对者身份确认"}</Button> : <Waiting text="等待反对者确认整合" />}{isProposer ? <Button disabled={objection.proposerConfirmed} onClick={() => props.execute({ type: "CONFIRM_INTEGRATION", objectionId: objection.id, capacity: "PROPOSER", proposalRevision: props.integrationRevision })}>{objection.proposerConfirmed ? "提案人已确认" : "我以提案人身份确认"}</Button> : <Waiting text="等待提案人确认整合" />}</div></div>;
  }
  if (snapshot.phase === "ADOPTION_CONFIRMATION") return <Primary onClick={() => props.execute({ type: "CONFIRM_ADOPTION" })}>人类确认采纳当前治理修订</Primary>;

  return <div className="flex gap-2"><Button variant="outline" onClick={props.requestCoach}><Sparkles className="mr-1 h-4 w-4" />解释当前流程</Button></div>;
}

function TurnSubmit(props: Parameters<typeof PhaseControls>[0] & { placeholder: string; contentOptional?: boolean }) {
  if (props.myTurnDone) return <Waiting text="你的本轮发言已完成，等待其他角色。" />;
  return <Composer value={props.draft} setValue={props.setDraft} placeholder={props.placeholder} action="完成我的本轮" disabled={props.isPending || (!props.contentOptional && !props.draft.trim())} onSubmit={() => props.execute({ type: "COMPLETE_TURN", ...(props.draft.trim() ? { content: props.draft.trim() } : {}) })} />;
}

function Composer({ value, setValue, placeholder, action, disabled, onSubmit }: { value: string; setValue(value: string): void; placeholder: string; action: string; disabled: boolean; onSubmit(): void }) {
  return <div className="flex gap-2"><Textarea value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} className="min-h-12 flex-1 resize-none" /><Button onClick={onSubmit} disabled={disabled} className="self-end"><Send className="mr-1 h-4 w-4" />{action}</Button></div>;
}

function Primary({ children, onClick, disabled }: { children: React.ReactNode; onClick(): void; disabled?: boolean }) {
  return <Button className="w-full" onClick={onClick} disabled={disabled}>{children}</Button>;
}

function Waiting({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-border p-3 text-center text-sm text-muted-foreground">{text}</p>;
}

function CoachStage({ snapshot, persona, activeAgendaLabel }: { snapshot: MeetingFacilitationReadModel; persona: { name: string }; activeAgendaLabel: string | null }) {
  return <div className="rounded-2xl border border-moss/20 bg-moss/5 p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-moss">{persona.name} 正在守护</p><p className="mt-2 text-sm leading-relaxed">{stageInstruction(snapshot.engine, snapshot.phase, activeAgendaLabel)}</p><p className="mt-2 text-xs text-muted-foreground">规则由状态机执行；AI 建议不能替代人类确认。</p></div>;
}

function EventBubble({ event, isMe }: { event: CockpitEvent; isMe: boolean }) {
  const coach = coachSuggestion(event);
  const content = eventContent(event);
  if (!coach && !content) return null;
  return <div className={`flex ${isMe && !coach ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${coach ? "border border-moss/20 bg-background" : isMe ? "bg-moss text-white" : "bg-muted"}`}><p className="mb-1 text-[10px] opacity-70">{coach ? "AI 教练 · 可被任何人质疑" : `事件 #${event.sequence}`}</p>{coach?.speech ?? content}</div></div>;
}

function coachSuggestion(event: CockpitEvent): MeetingCoachSuggestion | null {
  if (event.type !== "COACH_SUGGESTION") return null;
  const value = event.payload.suggestion;
  return value && typeof value === "object" && !Array.isArray(value) ? value as MeetingCoachSuggestion : null;
}

function eventContent(event: CockpitEvent): string | null {
  const command = event.payload.command;
  if (command && typeof command === "object" && !Array.isArray(command)) {
    const value = command as Record<string, unknown>;
    if (typeof value.content === "string") return value.content;
    if (typeof value.statement === "string") return `反对：${value.statement}`;
    if (value.type === "ADD_AGENDA_ITEM" && typeof value.label === "string") return `加入议程：${value.label}`;
  }
  const labels: Record<string, string> = {
    SESSION_INITIALIZED: "会议状态机已建立。",
    MEETING_PAUSED: "会议已暂停。",
    MEETING_RESUMED: "会议已恢复。",
    PHASE_REVERSED: "流程已回退到上一可逆阶段。",
    GOVERNANCE_PROPOSAL_ADOPTION_CONFIRMED: "治理修订已由人类确认采纳。",
    MEETING_COMPLETED: "会议已由人类确认结束。",
  };
  return labels[event.type] ?? null;
}

function PreflightShell({ persona, children }: { persona: { avatarEmoji: string; name: string; title: string }; children: React.ReactNode }) {
  return <div className="min-h-[520px]"><div className="flex items-center gap-3 border-b border-border bg-moss/5 px-5 py-4"><span className="text-2xl">{persona.avatarEmoji}</span><div><p className="text-sm font-semibold">{persona.name}</p><p className="text-xs text-muted-foreground">{persona.title}</p></div></div>{children}</div>;
}

function mergeEvents(current: readonly CockpitEvent[], incoming: readonly CockpitEvent[]): CockpitEvent[] {
  const bySequence = new Map(current.map((event) => [event.sequence, event]));
  for (const event of incoming) bySequence.set(event.sequence, { ...event, createdAt: String(event.createdAt) });
  return [...bySequence.values()].sort((left, right) => left.sequence - right.sequence);
}

function turnPlaceholder(phase: string): string {
  const labels: Record<string, string> = {
    CHECK_IN: "一句话签到，不回应他人",
    CHECKLIST_REVIEW: "完成 / 未完成 / 不适用",
    METRICS_REVIEW: "只陈述指标事实或必要澄清",
    PROJECT_UPDATES: "只报告自上次会议以来的变化",
    CLARIFYING_QUESTIONS: "只提理解性问题；不要夹带观点",
    REACTION_ROUND: "分享回应；不讨论，不要求提案人答辩",
    CLOSING_ROUND: "一句话结束感受，不讨论",
  };
  return labels[phase] ?? "完成当前轮次";
}

function stageInstruction(engine: "TACTICAL" | "GOVERNANCE", phase: string, agenda: string | null): string {
  const common: Record<string, string> = {
    ENTRY: "确认参与者和代表角色，然后开始。",
    CHECK_IN: "逐人签到，不回应、不讨论。",
    BUILD_AGENDA: "每人提交短标签，先不解释。",
    CLOSING_ROUND: "逐人分享结束感受，最后由人类确认结束。",
  };
  if (common[phase]) return common[phase];
  if (engine === "TACTICAL") {
    const tactical: Record<string, string> = {
      CHECKLIST_REVIEW: "只报告完成、未完成或不适用；张力先进入议程。",
      METRICS_REVIEW: "只暴露指标现实；观点与请求稍后分诊。",
      PROJECT_UPDATES: "只报告变化，不重复背景。",
      TRIAGE_ITEM: `当前议程「${agenda ?? "未命名"}」：只服务议程拥有者确认的需要。`,
    };
    return tactical[phase] ?? "按战术会议状态机继续。";
  }
  const governance: Record<string, string> = {
    PRESENT_PROPOSAL: "提案人提出处理张力的最小治理变更。",
    CLARIFYING_QUESTIONS: "只允许理解性问题。",
    REACTION_ROUND: "提案人只听，其他角色逐人回应。",
    AMEND_OR_CLARIFY: "只有提案人决定修改、澄清或保持。",
    OBJECTION_ROUND: "逐人检验是否存在由提案新增的具体损害。",
    AI_ASSESSMENT: "AI 逐条给出四项标准初判与证据。",
    DISTRIBUTED_REVIEW: "任何人可以推翻 AI；一人维持有效即进入整合。",
    INTEGRATION: "一次整合一条反对，同时保护反对者与提案人。",
    ADOPTION_CONFIRMATION: "无人维持有效反对后，由人类显式确认采纳。",
  };
  return governance[phase] ?? "按治理会议状态机继续。";
}

function errorMessage(code: string): string {
  const messages: Record<string, string> = {
    STALE_MEETING_REVISION: "会议刚被其他参与者推进，已同步最新状态，请重试。",
    REPRESENTED_ROLE_REQUIRED: "请至少选择一个本次代表角色。",
    ROLE_NOT_ASSIGNED_TO_PARTICIPANT: "只能选择你真实承担的活动角色。",
    SESSION_ALREADY_INITIALIZED: "会议已经由另一位参与者启动。",
    MEETING_PAUSED: "会议当前已暂停。",
    TURN_ALREADY_COMPLETED: "你已经完成本轮。",
    COMMAND_NOT_ALLOWED_FOR_TACTICAL_MEETING: "该动作不属于战术会议流程。",
    COMMAND_NOT_ALLOWED_FOR_GOVERNANCE_MEETING: "该动作不属于治理会议流程。",
  };
  return messages[code] ?? `操作未完成：${code}`;
}
