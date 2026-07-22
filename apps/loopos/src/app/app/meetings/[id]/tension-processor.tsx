"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createTacticalMeetingTensionAction, type CollaborationState } from "./collaboration-actions";

import { StatusBadge } from "@/components/shared/status-badge";
import {
  TacticalOutcomeProposal,
  type TacticalOutcomeProposalView,
} from "./tactical-outcome-proposal";

type ValidationRun = {
  id: string;
  dataVersion: string;
  status: string;
  tacticalResolution: string | null;
  deferReason: string | null;
  createdProject: { id: string; name: string } | null;
  createdAction: { id: string; title: string } | null;
};

type Tension = {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  raiser: { id: string; name: string };
  circles: { id: string; name: string }[];
  validationRun: ValidationRun | null;
  genericProposal: TacticalOutcomeProposalView | null;
  isGenericRouted: boolean;
};

type Person = { id: string; name: string };
type Circle = { id: string; name: string };
type Role = { id: string; name: string; purpose: string; accountabilities: string; circleId: string };
type Project = { id: string; name: string; linkedDataVersion: string | null };

export function MeetingTensionProcessor({
  tensions,
  people,
  circles,
  meetingId,
  currentPersonId,
  isMeetingParticipant,
  circleId,
}: {
  tensions: Tension[];
  people: Person[];
  circles: Circle[];
  roles: Role[];
  projects: Project[];
  meetingId: string;
  meetingType: string;
  currentPersonId: string | null;
  isMeetingParticipant: boolean;
  circleId: string | null;
}) {
  const [selectedId, setSelectedId] = useState(tensions[0]?.id ?? null);
  if (tensions.length === 0) {
    return (
      <div className="space-y-4">
        <QuickTensionForm meetingId={meetingId} circleId={circleId} isMeetingParticipant={isMeetingParticipant} />
        <div className="rounded-card border border-dashed border-border bg-card/50 p-8 text-center">
        <div className="text-3xl mb-3 text-muted-foreground/40">∿</div>
        <p className="text-sm text-muted-foreground">本会议没有关联的待处理张力。</p>
        </div>
      </div>
    );
  }

  const selected = tensions.find((tension) => tension.id === selectedId) ?? tensions[0];
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <div className="space-y-4">
        <QuickTensionForm meetingId={meetingId} circleId={circleId} isMeetingParticipant={isMeetingParticipant} />
        <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">本次张力清单 · {tensions.length}</p>
        {tensions.map((tension) => (
          <button key={tension.id} type="button" onClick={() => setSelectedId(tension.id)} className={`w-full rounded-input border p-3 text-left transition-colors ${selected.id === tension.id ? "border-moss bg-moss-pale/30" : "border-border hover:bg-muted/40"}`}>
            <p className="truncate text-sm font-medium">{tension.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">提出人：{tension.raiser.name}</p>
          </button>
        ))}
        </div>
      </div>
      <div>
        <TensionCard tension={selected} people={people} circles={circles} meetingId={meetingId} currentPersonId={currentPersonId} isMeetingParticipant={isMeetingParticipant} />
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          {tensions.filter((tension) => tension.id !== selected.id).map((tension) => <button key={tension.id} type="button" onClick={() => setSelectedId(tension.id)} className="text-xs text-moss hover:underline">处理下一个：{tension.title}</button>)}
        </div>
      </div>
    </div>
  );
}

function QuickTensionForm({ meetingId, circleId, isMeetingParticipant }: { meetingId: string; circleId: string | null; isMeetingParticipant: boolean }) {
  const action = createTacticalMeetingTensionAction.bind(null, meetingId, circleId ?? "");
  const [state, formAction, pending] = useActionState<CollaborationState, FormData>(action, undefined);
  return (
    <form action={formAction} className="rounded-card border border-dashed border-moss/40 bg-moss-pale/10 p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold">现场快速录入张力</p>
        <p className="mt-1 text-xs text-muted-foreground">
          战术会进行中始终维持张力清单；这里只需要先写张力名称，背景和处理建议在选中张力后补充。
        </p>
      </div>
      <div className="flex gap-2">
        <Input name="title" placeholder="例如：评测数据交付延迟" required disabled={!isMeetingParticipant || pending} />
        <Button type="submit" size="sm" disabled={!isMeetingParticipant || pending}>{pending ? "加入中..." : "加入清单"}</Button>
      </div>
      {!isMeetingParticipant ? <p className="mt-2 text-xs text-muted-foreground">只有会议参与人可以现场录入张力。</p> : null}
      {state?.error ? <p className="mt-2 text-xs text-destructive">{state.error}</p> : null}
      {state?.ok ? <p className="mt-2 text-xs text-moss">已加入张力清单。</p> : null}
    </form>
  );
}

function TensionCard({
  tension,
  people,
  circles,
  meetingId,
  currentPersonId,
  isMeetingParticipant,
}: {
  tension: Tension;
  people: Person[];
  circles: Circle[];
  meetingId: string;
  currentPersonId: string | null;
  isMeetingParticipant: boolean;
}) {
  const typeLabel: Record<string, string> = {
    PROBLEMATIC: "问题性",
    CONSTRUCTIVE: "建设性",
    CLARIFYING: "澄清性",
  };
  const typeColor: Record<string, string> = {
    PROBLEMATIC: "needs-light",
    CONSTRUCTIVE: "growing",
    CLARIFYING: "seed",
  };

  return (
    <div className="rounded-card border border-border bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge variant={typeColor[tension.type] as never} label={typeLabel[tension.type]} />
            <span className="text-xs text-muted-foreground">{tension.raiser.name}</span>
          </div>
          <h3 className="font-medium text-sm">{tension.title}</h3>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tension.description}</p>
          {tension.validationRun && (
            <p className="mt-2 rounded-input bg-needs-light-pale px-2 py-1 text-xs text-needs-light">
              验证异常 · {tension.validationRun.dataVersion} · {tension.validationRun.status}
              {tension.validationRun.tacticalResolution
                ? ` · 历史处置：${tension.validationRun.tacticalResolution}`
                : ""}
            </p>
          )}
        </div>
      </div>

      {tension.isGenericRouted ? (
        <TacticalOutcomeProposal
          tension={tension}
          meetingId={meetingId}
          currentPersonId={currentPersonId}
          isMeetingParticipant={isMeetingParticipant}
          people={people}
          circles={circles}
          proposal={tension.genericProposal}
        />
      ) : (
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
          直接分配、直接闭环和旧治理结果入口已停用；该张力需先进入已选择的战术结果提案流程。
        </p>
      )}
    </div>
  );
}
