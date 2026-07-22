"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { recordTacticalOutcomeDecisionAction, submitTacticalOutcomeProposalAction, type TacticalOutcomeActionState } from "./tactical-outcome-actions";

export type TacticalOutcomeProposalView = {
  id: string;
  status: "PROPOSED" | "RETURNED" | "REJECTED" | "APPROVED";
  revision: number;
  kind: "PROJECT" | "ACTION";
  title: string;
  expectedResult: string | null;
  acceptanceCriteria: string | null;
  deadline: Date | null;
  meetingDecisionNote: string | null;
  proposer: { id: string; name: string };
  recordedBy: { id: string; name: string } | null;
  circle: { id: string; name: string };
  responsiblePerson: { id: string; name: string };
  outcomeProject: { id: string; name: string } | null;
  outcomeAction: { id: string; title: string } | null;
};

export function TacticalOutcomeProposal({ tension, meetingId, currentPersonId, isMeetingParticipant, people, circles, proposal }: {
  tension: { id: string; title: string; raiser: { id: string; name: string }; circles: Array<{ id: string; name: string }> };
  meetingId: string;
  currentPersonId: string | null;
  isMeetingParticipant: boolean;
  people: Array<{ id: string; name: string }>;
  circles: Array<{ id: string; name: string }>;
  proposal: TacticalOutcomeProposalView | null;
}) {
  const isProposer = currentPersonId === tension.raiser.id;
  if (!proposal || proposal.status === "RETURNED" || proposal.status === "REJECTED") {
    if (!isProposer || !isMeetingParticipant) {
      if (isProposer) {
        return <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">只有本次战术会参与人可以提交或修改提案。</p>;
      }
      return <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">等待张力提出人提交 Project 或 Action 提案。</p>;
    }
    return <ProposalForm tension={tension} meetingId={meetingId} people={people} circles={circles} proposal={proposal} />;
  }

  return (
    <div className="mt-3 min-w-0 space-y-3 border-t border-border pt-3">
      <ProposalSummary proposal={proposal} />
      {proposal.status === "APPROVED" ? (
        <div className="rounded-input border border-moss/30 bg-moss-pale p-3 text-sm">
          <p className="font-medium">会议结果已记录，{proposal.kind === "PROJECT" ? "Project" : "Action"} 已创建</p>
          {proposal.outcomeProject ? <Link className="mt-1 inline-block text-moss hover:underline" href={`/app/projects/${proposal.outcomeProject.id}`}>{proposal.outcomeProject.name} · 查看来源链路</Link> : null}
          {proposal.outcomeAction ? <Link className="mt-1 inline-block text-moss hover:underline" href={`/app/tracker/${proposal.outcomeAction.id}`}>{proposal.outcomeAction.title} · 查看来源链路</Link> : null}
          {proposal.recordedBy ? <p className="mt-1 text-xs text-muted-foreground">会议结果记录人：{proposal.recordedBy.name}</p> : null}
        </div>
      ) : isMeetingParticipant ? (
        <div className="grid min-w-0 items-start gap-3 lg:grid-cols-3">
          <DecisionForm proposal={proposal} meetingId={meetingId} decision="APPROVED" label="记录会议通过并创建" />
          <DecisionForm proposal={proposal} meetingId={meetingId} decision="RETURNED" label="退回修改" requireNote />
          <DecisionForm proposal={proposal} meetingId={meetingId} decision="REJECTED" label="记录不采纳" requireNote />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">提案已提交，等待本次战术会参与人记录会议结果。</p>
      )}
    </div>
  );
}

function ProposalForm({ tension, meetingId, people, circles, proposal }: {
  tension: { id: string; title: string; circles: Array<{ id: string; name: string }> };
  meetingId: string;
  people: Array<{ id: string; name: string }>;
  circles: Array<{ id: string; name: string }>;
  proposal: TacticalOutcomeProposalView | null;
}) {
  const [kind, setKind] = useState<"PROJECT" | "ACTION">(proposal?.kind ?? "PROJECT");
  const [mutationKey] = useState(() => crypto.randomUUID());
  const action = submitTacticalOutcomeProposalAction.bind(null, tension.id, meetingId) as (_previous: TacticalOutcomeActionState, formData: FormData) => Promise<TacticalOutcomeActionState>;
  const [state, formAction, pending] = useActionState(action, null);
  const defaultCircleId = proposal?.circle.id ?? tension.circles[0]?.id ?? (circles.length === 1 ? circles[0].id : "");
  const [selectedCircleId, setSelectedCircleId] = useState(defaultCircleId);
  const [selectedResponsiblePersonId, setSelectedResponsiblePersonId] = useState(proposal?.responsiblePerson.id ?? "");
  return (
    <form action={formAction} className="mt-3 min-w-0 space-y-3 border-t border-border pt-3">
      {proposal?.meetingDecisionNote ? <p className="rounded-input bg-needs-light-pale p-2 text-xs text-needs-light">会议说明：{proposal.meetingDecisionNote}</p> : null}
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="expectedRevision" value={proposal?.revision ?? 0} />
      <input type="hidden" name="mutationKey" value={mutationKey} />
      <div className="grid grid-cols-2 rounded-input bg-muted p-1" aria-label="提案类型">
        <button type="button" onClick={() => setKind("PROJECT")} className={`min-w-0 rounded-md px-3 py-2 text-sm ${kind === "PROJECT" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Project</button>
        <button type="button" onClick={() => setKind("ACTION")} className={`min-w-0 rounded-md px-3 py-2 text-sm ${kind === "ACTION" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Action</button>
      </div>
      <p className="text-xs text-muted-foreground">{kind === "PROJECT" ? "需要持续行动才能达成的结果。" : "一次具体行动即可获得的结果。"}</p>
      <div className="space-y-1.5">
        <Label htmlFor={`proposal-title-${tension.id}`}>{kind === "PROJECT" ? "项目名称" : "行动标题"}</Label>
        <Input id={`proposal-title-${tension.id}`} name="title" defaultValue={proposal?.title ?? tension.title} required />
      </div>
      {kind === "PROJECT" ? <div className="space-y-1.5"><Label htmlFor={`expected-result-${tension.id}`}>预期结果</Label><Textarea id={`expected-result-${tension.id}`} name="expectedResult" defaultValue={proposal?.expectedResult ?? ""} required /></div> : <div className="space-y-1.5"><Label htmlFor={`acceptance-${tension.id}`}>验收标准</Label><Textarea id={`acceptance-${tension.id}`} name="acceptanceCriteria" defaultValue={proposal?.acceptanceCriteria ?? ""} required /></div>}
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-1.5"><Label htmlFor={`proposal-circle-${tension.id}`}>归属回路</Label><select id={`proposal-circle-${tension.id}`} name="circleId" value={selectedCircleId} onChange={(event) => setSelectedCircleId(event.target.value)} required className="h-9 w-full min-w-0 rounded-input border border-border bg-background px-3 text-sm"><option value="" disabled>选择回路</option>{circles.map((circle) => <option key={circle.id} value={circle.id}>{circle.name}</option>)}</select></div>
        <div className="min-w-0 space-y-1.5"><Label htmlFor={`proposal-person-${tension.id}`}>{kind === "PROJECT" ? "Project owner" : "负责人"}</Label><select id={`proposal-person-${tension.id}`} name="responsiblePersonId" value={selectedResponsiblePersonId} onChange={(event) => setSelectedResponsiblePersonId(event.target.value)} required className="h-9 w-full min-w-0 rounded-input border border-border bg-background px-3 text-sm"><option value="" disabled>选择负责人</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></div>
      </div>
      {kind === "ACTION" ? <div className="space-y-1.5"><Label htmlFor={`deadline-${tension.id}`}>截止日期（可选）</Label><Input id={`deadline-${tension.id}`} name="deadline" type="date" defaultValue={proposal?.deadline ? proposal.deadline.toISOString().slice(0, 10) : ""} /></div> : null}
      {state?.error ? <p className="break-words text-sm text-destructive" role="alert">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "提交中…" : proposal ? "重新提交提案" : "提交会议提案"}</Button>
    </form>
  );
}

function ProposalSummary({ proposal }: { proposal: TacticalOutcomeProposalView }) {
  return <div className="min-w-0 rounded-input border border-border bg-muted/30 p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{proposal.kind === "PROJECT" ? "Project 提案" : "Action 提案"} · {proposal.title}</p><span className="text-xs text-muted-foreground">提出人：{proposal.proposer.name}</span></div><p className="mt-2 break-words text-muted-foreground">{proposal.kind === "PROJECT" ? proposal.expectedResult : proposal.acceptanceCriteria}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>回路：{proposal.circle.name}</span><span>{proposal.kind === "PROJECT" ? "Project owner" : "负责人"}：{proposal.responsiblePerson.name}</span>{proposal.deadline ? <span>截止：{proposal.deadline.toLocaleDateString("zh-CN")}</span> : null}</div></div>;
}

function DecisionForm({ proposal, meetingId, decision, label, requireNote = false }: { proposal: TacticalOutcomeProposalView; meetingId: string; decision: "APPROVED" | "RETURNED" | "REJECTED"; label: string; requireNote?: boolean }) {
  const [mutationKey] = useState(() => crypto.randomUUID());
  const action = recordTacticalOutcomeDecisionAction.bind(null, proposal.id, meetingId) as (_previous: TacticalOutcomeActionState, formData: FormData) => Promise<TacticalOutcomeActionState>;
  const [state, formAction, pending] = useActionState(action, null);
  return <form action={formAction} className="min-w-0 space-y-2 rounded-input border border-border p-3"><input type="hidden" name="decision" value={decision} /><input type="hidden" name="expectedRevision" value={proposal.revision} /><input type="hidden" name="mutationKey" value={mutationKey} />{requireNote ? <><Label htmlFor={`${decision}-note-${proposal.id}`}>会议说明</Label><Textarea id={`${decision}-note-${proposal.id}`} name="note" required className="min-h-20 w-full min-w-0" /></> : null}{state?.error ? <p className="break-words text-xs text-destructive" role="alert">{state.error}</p> : null}<Button className="w-full whitespace-normal" type="submit" variant={decision === "APPROVED" ? "default" : "outline"} disabled={pending}>{pending ? "记录中…" : label}</Button></form>;
}
