"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/status-badge";
import { RoleCircleSearch } from "@/components/shared/role-circle-search";
import { createGovernanceMeetingTensionAction, type CollaborationState } from "./collaboration-actions";
import { executeCanonicalGovernanceAction, initializeCandidateGovernanceAction, initializeOrdinaryGovernanceAction, initializeRuntimeGovernanceAction, type ProposalState } from "./proposal-actions";

type Revision = { currentStructure: string; proposedStructure: string; rationale: string; expectedImpact: string; typedChange: unknown };
type Process = { id: string; state: string; currentRevision: number; activeClarification: unknown; activeObjection: unknown; provenanceKind: string; runId: string | null; outcomeRoleId: string | null; decisionId: string | null; changeLogId: string | null; currentRevisionRecord: Revision | null };
type Proposal = { id: string; type: string; status: string; proposedChange: unknown; rationale: string; proposer: { id: string; name: string }; sourceTension: { id: string; title: string }; isExactGenericRoute: boolean; runId: string | null; proposalArtifactId: string | null; routeArtifactId: string | null; governanceDecisionProcess: Process | null };
type Tension = { id: string; title: string; description: string; raiserId: string };
type Circle = { id: string; name: string };
type Role = { id: string; name: string };
type Person = { id: string; name: string };
type GovernanceItem =
  | { kind: "proposal"; id: string; label: string; proposer: string; state: string; proposal: Proposal }
  | { kind: "tension"; id: string; label: string; proposer: string; state: string; tension: Tension };

export function GovernanceWorkbench({ tensions, proposals, roles, circles, meetingId, meetingCircleId, selectedProposalId, currentPersonId, isMeetingParticipant, isMeetingEnded }: { tensions: Tension[]; proposals: Proposal[]; roles: Role[]; circles: Circle[]; meetingId: string; meetingCircleId: string | null; selectedProposalId: string | null; currentPersonId: string | null; isMeetingParticipant: boolean; isMeetingEnded?: boolean }) {
  const structuralCandidates = new Set(["ROLE", "ROLE_CREATED", "ROLE_MODIFIED", "ROLE_ARCHIVED", "ROLE_ASSIGNMENT", "ROLE_UNASSIGNMENT", "CIRCLE_CREATED", "CIRCLE_MODIFIED", "HOME_CHANGE", "AGENT_CREATED", "CHARTER_CREATED", "CHARTER_AMENDED"]);
  const canonical = proposals.filter((p) => p.governanceDecisionProcess !== null || (p.status === "CANDIDATE" && (p.isExactGenericRoute || structuralCandidates.has(p.type))));
  const legacy = proposals.filter((p) => !canonical.includes(p));
  const unresolvedTensions = tensions.filter((t) => !canonical.some((p) => p.sourceTension.id === t.id));
  const items: GovernanceItem[] = [
    ...canonical.map((proposal) => ({ kind: "proposal" as const, id: `proposal:${proposal.id}`, label: proposal.sourceTension.title, proposer: proposal.proposer.name, state: proposal.governanceDecisionProcess?.state ?? "待初始化", proposal })),
    ...unresolvedTensions.map((tension) => ({ kind: "tension" as const, id: `tension:${tension.id}`, label: tension.title, proposer: "现场/已有张力", state: "待提交提案", tension })),
  ];
  const initialSelected = selectedProposalId ? `proposal:${selectedProposalId}` : items[0]?.id ?? null;
  const [selectedItemId, setSelectedItemId] = useState<string | null>(initialSelected);
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? items[0] ?? null;
  useEffect(() => {
    if (!selectedProposalId) return;
    setSelectedItemId(`proposal:${selectedProposalId}`);
    document.getElementById(`governance-proposal-${selectedProposalId}`)?.scrollIntoView({ block: "center" });
  }, [selectedProposalId]);
  return <div className="space-y-4" data-meeting-id={meetingId}>
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="text-sm font-medium">治理张力清单</h3>
        <p className="mt-1 text-xs text-muted-foreground">系统已汇总本会议相关治理张力，也可以现场快速添加。</p>
      </div>
      <Link href={`/app/tensions/new?mode=GOVERNANCE&meetingId=${meetingId}`} className="text-xs text-moss hover:underline">完整提交</Link>
    </div>
    {!isMeetingEnded && isMeetingParticipant ? <QuickGovernanceTensionForm meetingId={meetingId} circleId={meetingCircleId ?? ""} /> : null}
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="space-y-2">
        {items.length === 0 ? <div className="rounded-input border border-dashed border-border p-4 text-sm text-muted-foreground">当前没有待处理治理张力。</div> : items.map((item) => (
          <button key={item.id} type="button" onClick={() => setSelectedItemId(item.id)} className="w-full rounded-input border border-border bg-background p-3 text-left transition hover:bg-muted/40 data-[selected=true]:border-moss data-[selected=true]:bg-moss-pale/30" data-selected={selectedItem?.id === item.id || undefined}>
            <span className="block text-sm font-medium">{item.label}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{item.proposer} · {item.state}</span>
          </button>
        ))}
      </div>
      <div className="min-w-0">
        {selectedItem?.kind === "proposal" ? <CanonicalCard proposal={selectedItem.proposal} meetingId={meetingId} currentPersonId={currentPersonId} isMeetingParticipant={isMeetingParticipant} isMeetingEnded={isMeetingEnded} circles={circles} roles={roles} selected={selectedItem.proposal.id === selectedProposalId} /> : null}
        {selectedItem?.kind === "tension" ? <TensionProposalCard tension={selectedItem.tension} meetingId={meetingId} currentPersonId={currentPersonId} isMeetingEnded={isMeetingEnded} circles={circles} roles={roles} /> : null}
      </div>
    </div>
    {legacy.length > 0 ? <section><h3 className="mb-2 text-xs font-medium text-muted-foreground">历史或暂不支持的提案（只读）</h3>{legacy.map((p) => <div key={p.id} className="border border-border p-3 text-sm"><span>{p.sourceTension.title}</span><span className="ml-2 text-xs text-muted-foreground">{p.type} · {p.status}</span></div>)}</section> : null}
  </div>;
}

function QuickGovernanceTensionForm({ meetingId, circleId }: { meetingId: string; circleId: string }) {
  const action = createGovernanceMeetingTensionAction.bind(null, meetingId, circleId);
  const [state, formAction, pending] = useActionState<CollaborationState, FormData>(action, undefined);
  return <form action={formAction} className="grid gap-2 rounded-input border border-border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
    <Input name="title" required placeholder="现场快速录入治理张力名称" />
    <Button type="submit" disabled={pending}>{pending ? "添加中" : "添加到清单"}</Button>
    {state?.error ? <p className="text-xs text-destructive sm:col-span-2">{state.error}</p> : null}
    {state?.ok ? <p className="text-xs text-moss sm:col-span-2">已加入本次治理会清单。</p> : null}
  </form>;
}

function TensionProposalCard({ tension, meetingId, currentPersonId, circles, roles, isMeetingEnded }: { tension: Tension; meetingId: string; currentPersonId: string | null; circles: Circle[]; roles: Role[]; isMeetingEnded?: boolean }) {
  return <article className="border border-border p-4">
    <h3 className="text-sm font-medium">{tension.title}</h3>
    <p className="mt-1 text-xs text-muted-foreground">{tension.description}</p>
    {currentPersonId === tension.raiserId && !isMeetingEnded ? <div className="mt-3"><RevisionForm tensionId={tension.id} meetingId={meetingId} circles={circles} roles={roles} /></div> : <p className="mt-3 text-xs text-muted-foreground">{isMeetingEnded ? "会议已结束" : "等待提出者现场提交治理提案。"}</p>}
  </article>;
}

function CanonicalCard({ proposal, meetingId, currentPersonId, isMeetingParticipant, isMeetingEnded, circles, roles, selected }: { proposal: Proposal; meetingId: string; currentPersonId: string | null; isMeetingParticipant: boolean; isMeetingEnded?: boolean; circles: Circle[]; roles: Role[]; selected: boolean }) {
  const process = proposal.governanceDecisionProcess;
  const isProposer = proposal.proposer.id === currentPersonId;
  if (!process) return <article id={`governance-proposal-${proposal.id}`} data-selected={selected || undefined} className="border border-border p-4"><div className="flex flex-wrap justify-between gap-2"><div><StatusBadge variant="growing" label="待初始化" /><h3 className="mt-2 text-sm font-medium">{proposal.sourceTension.title}</h3><p className="text-xs text-muted-foreground">提出者：{proposal.proposer.name}</p></div>{proposal.runId ? <Link className="text-xs text-moss hover:underline" href={`/app/interfaces/runs/${proposal.runId}`}>运行来源</Link> : null}</div>{isProposer ? <div className="mt-3"><RevisionForm proposalId={proposal.id} meetingId={meetingId} circles={circles} roles={roles} runtime={proposal.runId && proposal.proposalArtifactId && proposal.routeArtifactId ? { runId: proposal.runId, proposalArtifactId: proposal.proposalArtifactId, routeArtifactId: proposal.routeArtifactId } : undefined} candidate={!proposal.runId} /></div> : <p className="mt-3 text-sm text-muted-foreground">等待提出者初始化规范治理流程。</p>}</article>;
  const changeOperation = governanceChangeOperation(process.currentRevisionRecord?.typedChange);
  const changeLabel = changeOperation ? governanceChangeLabel(changeOperation) : null;
  // 构建变更摘要
  const summary = buildChangeSummary(process.currentRevisionRecord?.typedChange);

  return <article id={`governance-proposal-${proposal.id}`} data-selected={selected || undefined} className="border border-border p-4">
    <div className="flex flex-wrap justify-between gap-2">
      <div>
        <StatusBadge variant={process.state === "ADOPTED" ? "mature" : process.state === "OBJECTION_PENDING" ? "needs-light" : "growing"} label={stateLabel(process.state)} />
        {changeLabel && <span className="ml-2 text-xs text-muted-foreground">{changeLabel}</span>}
        <h3 className="mt-2 text-sm font-medium">{proposal.sourceTension.title}</h3>
        <p className="text-xs text-muted-foreground">提出者：{proposal.proposer.name} · revision {process.currentRevision}</p>
      </div>
      <div className="text-xs text-muted-foreground">{process.runId ? <Link className="text-moss hover:underline" href={`/app/interfaces/runs/${process.runId}`}>运行来源</Link> : "普通张力来源"}</div>
    </div>

    {/* 变更摘要 */}
    {summary && <div className="mt-3 bg-muted/20 rounded p-3 text-xs"><span className="font-medium">变更摘要：</span>{summary}</div>}

    {/* 提案内容 */}
    {process.currentRevisionRecord ? (
      <div className="mt-2 bg-muted/10 rounded p-3 text-xs">
        <p className="font-medium text-muted-foreground mb-1">提案内容</p>
        <p className="whitespace-pre-wrap">{formatProposalBody(process.currentRevisionRecord.proposedStructure || process.currentRevisionRecord.currentStructure)}</p>
      </div>
    ) : null}

    {/* ── 4步治理流程 ── */}

    {/* Step 1: 澄清与回应（仅提案人可见） */}
    {process.state === "CLARIFICATION_REQUIRED" && (
      <StepClarify process={process} proposalId={proposal.id} meetingId={meetingId} isProposer={isProposer} circles={circles} roles={roles} />
    )}

    {/* Step 2: 反对 or 不反对（所有参会人） */}
    {process.state === "READY" && isMeetingParticipant && !isMeetingEnded && (
      <StepVote proposalId={proposal.id} meetingId={meetingId} process={process} changeLabel={changeLabel} />
    )}

    {/* Step 3: 整合反对 + 提案人修改 */}
    {process.state === "OBJECTION_PENDING" && isMeetingParticipant && !isMeetingEnded && objectionRecord(process.activeObjection) && (
      <StepAssess proposalId={proposal.id} meetingId={meetingId} process={process} objection={objectionRecord(process.activeObjection)!} />
    )}
    {process.state === "AMENDMENT_REQUIRED" && isProposer && !isMeetingEnded && (
      <StepRevise proposalId={proposal.id} meetingId={meetingId} process={process} circles={circles} roles={roles} objection={objectionRecord(process.activeObjection)} />
    )}

    {/* Step 4: 采纳（所有参会人，READY且无反对或修订完成） */}
    {process.state === "READY" && isMeetingParticipant && !isMeetingEnded && !process.activeObjection && (
      <StepAdopt proposalId={proposal.id} meetingId={meetingId} process={process} changeLabel={changeLabel} />
    )}

    {/* 会议已结束提示 */}
    {isMeetingEnded && process.state !== "ADOPTED" && (
      <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">🔒 会议已结束，治理提案已锁定。如需变更请提新张力。</div>
    )}

    {/* 采纳后结果 */}
    {process.state === "ADOPTED" && (
      <div className="mt-3 flex flex-wrap gap-3 text-sm border-t border-border pt-3">
        {process.outcomeRoleId ? <Link className="text-moss" href={`/app/roles/${process.outcomeRoleId}`}>角色</Link> : null}
        {process.decisionId ? <Link className="text-moss" href={`/app/governance#decision-${process.decisionId}`}>决策记录</Link> : null}
        {process.changeLogId ? <Link className="text-moss" href={`/app/governance#change-${process.changeLogId}`}>变更记录</Link> : null}
        <Link className="text-moss" href={`/app/tensions/${proposal.sourceTension.id}`}>来源张力</Link>
        <span className="text-xs text-muted-foreground">✅ 已采纳，不可修改。如需变更请提新张力。</span>
      </div>
    )}

    {/* 未采纳 */}
    {process.state === "NOT_ADOPTED" && (
      <div className="mt-3 text-xs text-muted-foreground border-t border-border pt-3">本轮未采纳，提案人可提交修订或提新张力。</div>
    )}
  </article>;
}

function RevisionForm({ tensionId, proposalId, meetingId, circles, roles, process, runtime, candidate = false }: { tensionId?: string; proposalId?: string; meetingId: string; circles: Circle[]; roles: Role[]; process?: Process; runtime?: { runId: string; proposalArtifactId: string; routeArtifactId: string }; candidate?: boolean }) {
  const [mutationKey] = useState(() => crypto.randomUUID());
  const [changeType, setChangeType] = useState("ROLE_CREATED");
  const action = tensionId ? initializeOrdinaryGovernanceAction.bind(null, tensionId, meetingId) : candidate ? initializeCandidateGovernanceAction.bind(null, proposalId!, meetingId) : runtime ? initializeRuntimeGovernanceAction.bind(null, proposalId!, meetingId, runtime.runId, runtime.proposalArtifactId, runtime.routeArtifactId) : executeCanonicalGovernanceAction.bind(null, proposalId!, meetingId);
  const [state, formAction, pending] = useActionState<ProposalState, FormData>(action, null);

  const changeTypeOptions = [
    { value: "ROLE_CREATED", label: "创建角色" },
    { value: "ROLE_MODIFIED", label: "修改角色" },
    { value: "ROLE_ARCHIVED", label: "废弃角色" },
    { value: "CIRCLE_CREATED", label: "创建回路" },
    { value: "CIRCLE_MODIFIED", label: "修改回路" },
    { value: "HOME_CHANGE", label: "变更归属" },
    { value: "AGENT_CREATED", label: "创建智能体" },
    { value: "CHARTER_CREATED", label: "创建宪章" },
    { value: "CHARTER_AMENDED", label: "修订宪章" },
  ];

  return <form action={formAction} className="space-y-2 border border-border p-3">
    {process ? <><input type="hidden" name="operation" value="SUBMIT_REVISION" /><input type="hidden" name="expectedRevision" value={process.currentRevision} /><input type="hidden" name="operationScope" value={`revision-${process.currentRevision + 1}`} /></> : null}
    <input type="hidden" name="mutationKey" value={mutationKey} />
    {!candidate ? <>
      <div className="space-y-1">
        <Label className="text-xs">提案背景与结构</Label>
        <Textarea name="proposalBody" defaultValue={process?.currentRevisionRecord?.proposedStructure || process?.currentRevisionRecord?.currentStructure || ""} placeholder={`当前结构：（描述现状）
建议结构：（描述提议的变更）
理由：（为什么需要这个变更）
预期影响：（变更后会带来什么改落）`} className="min-h-[120px] text-sm" />
      </div>
      {!process && <>
        <div className="space-y-1">
          <Label htmlFor="changeType">提案类型</Label>
          <select id="changeType" name="changeType" value={changeType} onChange={(e) => setChangeType(e.target.value)} className="h-9 w-full border border-border bg-background px-2 text-sm">
            {changeTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <DynamicChangeFields changeType={changeType} circles={circles} roles={roles} />
      </>}
      {process?.currentRevisionRecord?.typedChange && (
        <input type="hidden" name="preserveTypedChange" value={JSON.stringify(process.currentRevisionRecord.typedChange)} />
      )}
    </> : <p className="text-xs text-muted-foreground">提案结构已由组织大脑生成，并将在会议流程中审核。</p>}
    {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    <Button type="submit" disabled={pending}>{pending ? "提交中" : process ? "提交新修订" : "初始化治理提案"}</Button>
  </form>;
}

function DynamicChangeFields({ changeType, circles, roles }: { changeType: string; circles: Circle[]; roles: Role[] }) {
  const selectCls = "h-9 w-full border border-border bg-background px-2 text-sm";
  const circleOpts = circles.map((c) => ({ id: c.id, name: c.name }));
  const roleOpts = roles.map((r) => ({ id: r.id, name: r.name }));
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  switch (changeType) {
    case "ROLE_CREATED":
      return <>
        <div className="space-y-1"><Label>目标圈子</Label><RoleCircleSearch options={circleOpts} value={fieldValues.circleId || ""} onChange={(id) => setFieldValues((v) => ({ ...v, circleId: id }))} placeholder="搜索圈子…" /><input type="hidden" name="circleId" value={fieldValues.circleId || ""} /></div>
        <Field name="roleName" label="角色名称" />
        <Field name="purpose" label="角色目的" />
        <Field name="domain" label="领域（可选）" required={false} />
        <Field name="accountabilities" label="职责" />
        <div className="space-y-1"><Label>类别</Label><select name="category" className={selectCls}><option value="OPERATIONS">运营</option><option value="EXPERT">专家</option><option value="CIRCLE_LEAD">回路负责人</option><option value="COACH">教练</option></select></div>
      </>;
    case "ROLE_MODIFIED":
    case "ROLE_ARCHIVED":
      return <div className="space-y-1"><Label>目标角色</Label><RoleCircleSearch options={roleOpts} value={fieldValues.targetId || ""} onChange={(id) => setFieldValues((v) => ({ ...v, targetId: id }))} placeholder="搜索角色…" /><input type="hidden" name="targetId" value={fieldValues.targetId || ""} /></div>;
    case "CIRCLE_CREATED":
      return <>
        <Field name="circleName" label="回路名称" />
        <Field name="purpose" label="回路目的" />
        <Field name="domain" label="领域（可选）" required={false} />
        <div className="space-y-1"><Label>编号</Label><select name="number" className={selectCls}><option value="CUSTOM">自定义</option><option value="ZERO">回路零</option><option value="ONE">回路一</option><option value="TWO">回路二</option><option value="THREE">回路三</option><option value="FOUR">回路四</option></select></div>
        <div className="space-y-1"><Label>类型</Label><select name="circleType" className={selectCls}><option value="PRODUCTION">生产</option><option value="INFRA">基座</option><option value="STRATEGY">战略</option><option value="CROSSCUTTING">横切</option></select></div>
        <div className="space-y-1"><Label>父回路（可选）</Label><RoleCircleSearch options={circleOpts} value={fieldValues.parentId || ""} onChange={(id) => setFieldValues((v) => ({ ...v, parentId: id }))} placeholder="搜索父回路…" /><input type="hidden" name="parentId" value={fieldValues.parentId || ""} /></div>
      </>;
    case "CIRCLE_MODIFIED":
      return <>
        <div className="space-y-1"><Label>目标回路</Label><RoleCircleSearch options={circleOpts} value={fieldValues.targetId || ""} onChange={(id) => setFieldValues((v) => ({ ...v, targetId: id }))} placeholder="搜索回路…" /><input type="hidden" name="targetId" value={fieldValues.targetId || ""} /></div>
        <Field name="circleName" label="新名称" />
        <Field name="purpose" label="新目的" />
        <Field name="domain" label="新领域（可选）" required={false} />
      </>;
    case "HOME_CHANGE":
      return <>
        <div className="space-y-1"><Label>目标人员 ID</Label><input type="hidden" name="targetId" value={fieldValues.targetId || ""} /><Field name="targetId" label="目标人员 ID" /></div>
        <div className="space-y-1"><Label>归属回路</Label><RoleCircleSearch options={circleOpts} value={fieldValues.homeCircleId || ""} onChange={(id) => setFieldValues((v) => ({ ...v, homeCircleId: id }))} placeholder="搜索回路…" /><input type="hidden" name="homeCircleId" value={fieldValues.homeCircleId || ""} /></div>
      </>;
    case "AGENT_CREATED":
      return <>
        <Field name="agentName" label="智能体名称（如：数据质量巡检员）" />
        <div className="space-y-1"><Label>归属圈子</Label><RoleCircleSearch options={circleOpts} value={fieldValues.circleId || ""} onChange={(id) => setFieldValues((v) => ({ ...v, circleId: id }))} placeholder="搜索圈子…" /><input type="hidden" name="circleId" value={fieldValues.circleId || ""} /></div>
        <Field name="agentAbilities" label="能力描述（一句话说明此智能体做什么、不能做什么）" />
        <div className="space-y-1"><Label>看护人（人类角色，为此智能体设定目标、裁决价值、承担责任）</Label><RoleCircleSearch options={roleOpts} value={fieldValues.guardianRoleId || ""} onChange={(id) => setFieldValues((v) => ({ ...v, guardianRoleId: id }))} placeholder="搜索看护角色…" /><input type="hidden" name="guardianRoleId" value={fieldValues.guardianRoleId || ""} /></div>
        <div className="text-[10px] text-muted-foreground -mt-1">看护人对智能体的输出负责，拥有最终决策权。系统将自动建立人机协同策略。</div>
        <input type="hidden" name="agentModel" value="auto" />
        <input type="hidden" name="agentEndpoint" value="" />
        <input type="hidden" name="agentConfig" value="{}" />
      </>;
    case "CHARTER_CREATED":
      return <>
        <Field name="version" label="版本号（如 v2026Q3）" />
        <Field name="content" label="宪章内容" />
        <Field name="changeSummary" label="变更摘要（可选）" required={false} />
      </>;
    case "CHARTER_AMENDED":
      return <>
        <div className="space-y-1"><Label>目标宪章 ID</Label><input type="hidden" name="targetId" value={fieldValues.targetId || ""} /><Field name="targetId" label="目标宪章 ID" /></div>
        <Field name="version" label="新版本号" />
        <Field name="content" label="新宪章内容" />
        <Field name="changeSummary" label="变更摘要（可选）" required={false} />
      </>;
    default:
      return null;
  }
}

// ── 4步简化流程组件 ──────────────────────────────────────────

function StepClarify({ process, proposalId, meetingId, isProposer, circles, roles }: { process: Process; proposalId: string; meetingId: string; isProposer: boolean; circles: Circle[]; roles: Role[] }) {
  const clarification = process.activeClarification as Record<string, string> | null;
  return (
    <div className="mt-3 border-t border-border pt-3 space-y-3">
      {clarification && (
        <div className="grid lg:grid-cols-2 gap-3 text-xs">
          <div className="bg-muted/20 rounded p-3">
            <p className="font-medium text-muted-foreground mb-1">❓ 需要澄清</p>
            <p>{clarification.question || "（无详情）"}</p>
          </div>
          <div className="bg-muted/20 rounded p-3">
            <p className="font-medium text-muted-foreground mb-1">💬 等待提案人回应</p>
            <p className="text-muted-foreground">{isProposer ? "请在下方提交回复" : "等待提案人回应澄清问题"}</p>
          </div>
        </div>
      )}
      {isProposer && <RevisionForm proposalId={proposalId} meetingId={meetingId} circles={circles} roles={roles} process={process} />}
    </div>
  );
}

function StepVote({ proposalId, meetingId, process, changeLabel }: { proposalId: string; meetingId: string; process: Process; changeLabel: string | null }) {
  const [key] = useState(() => crypto.randomUUID());
  const [mode, setMode] = useState<"none" | "approve" | "object">("none");
  const [objReason, setObjReason] = useState("");
  const [objIntegrate, setObjIntegrate] = useState("");
  const raw = executeCanonicalGovernanceAction.bind(null, proposalId, meetingId);
  const [_, formAction, pending] = useActionState<ProposalState, FormData>(async (_p: ProposalState, fd: FormData) => raw(_p, fd), null);

  if (mode === "none") {
    return (
      <div className="mt-3 border-t border-border pt-3">
        <p className="text-xs font-medium mb-2">📋 请表态：</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="text-moss border-moss/30 hover:bg-moss/5" onClick={() => setMode("approve")}>✅ 赞成</Button>
          <Button size="sm" variant="outline" className="text-urgent border-urgent/30 hover:bg-urgent/5" onClick={() => setMode("object")}>❌ 反对</Button>
          <SimpleForm proposalId={proposalId} meetingId={meetingId} process={process} operation="REQUEST_CLARIFICATION" fields={["question", "reason"]} submitLabel="💬 需澄清" />
        </div>
      </div>
    );
  }

  if (mode === "approve") {
    return (
      <div className="mt-3 border-t border-border pt-3">
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="operation" value="ADOPT_ROLE" />
          <input type="hidden" name="expectedRevision" value={process.currentRevision} />
          <input type="hidden" name="operationScope" value={`adopt-${key}`} />
          <input type="hidden" name="mutationKey" value={key} />
          <input type="hidden" name="note" value="赞成采纳" />
          <p className="text-xs text-moss mb-2">确认采纳此提案？</p>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>{changeLabel ? `确认采纳 · ${changeLabel}` : "确认采纳"}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setMode("none")}>取消</Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="operation" value="RAISE_OBJECTION" />
        <input type="hidden" name="expectedRevision" value={process.currentRevision} />
        <input type="hidden" name="operationScope" value={`object-${key}`} />
        <input type="hidden" name="mutationKey" value={key} />
        <p className="text-xs font-medium text-urgent">反对此提案</p>
        <Textarea name="materialHarm" placeholder="反对理由（此提案会造成什么实质损害）" defaultValue={objReason} className="text-xs min-h-[50px]" />
        <Textarea name="reversibility" placeholder="整合建议（如何将反对意见与提案进行整合）" defaultValue={objIntegrate} className="text-xs min-h-[50px]" />
        <input type="hidden" name="factVsWorry" value="基于事实判断" />
        <input type="hidden" name="safeToTry" value="建议先整合再表决" />
        <div className="flex gap-2">
          <Button type="submit" size="sm" variant="outline" disabled={pending}>提交反对</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setMode("none"); setObjReason(""); setObjIntegrate(""); }}>取消</Button>
        </div>
      </form>
    </div>
  );
}

function StepAssess({ proposalId, meetingId, process, objection }: { proposalId: string; meetingId: string; process: Process; objection: NonNullable<ReturnType<typeof objectionRecord>> }) {
  return (
    <div className="mt-3 border-t border-border pt-3 space-y-2">
      <div className="bg-urgent-pale/30 border border-urgent/10 rounded p-3 text-xs">
        <p className="font-medium text-urgent">⚠️ 反对意见</p>
        <p className="mt-1">理由：{objection.materialHarm}</p>
        <p>整合建议：{objection.reversibility || "暂无"}</p>
      </div>
      <p className="text-xs text-muted-foreground">评估反对是否有效：</p>
      <div className="flex gap-2">
        <AssessmentFormInline proposalId={proposalId} meetingId={meetingId} process={process} objection={objection} operation="ASSESS_OBJECTION_INVALID" label="反对不成立 · 返回表决" />
        <AssessmentFormInline proposalId={proposalId} meetingId={meetingId} process={process} objection={objection} operation="ASSESS_OBJECTION_VALID" label="反对成立 · 需修订" />
      </div>
    </div>
  );
}

function AssessmentFormInline({ proposalId, meetingId, process, objection, operation, label }: { proposalId: string; meetingId: string; process: Process; objection: Record<string, string>; operation: string; label: string }) {
  const [key] = useState(() => crypto.randomUUID());
  const action = executeCanonicalGovernanceAction.bind(null, proposalId, meetingId);
  const [state, formAction, pending] = useActionState<ProposalState, FormData>(action, null);
  return (
    <form action={formAction} className="space-y-2 border border-border p-3 flex-1">
      <input type="hidden" name="operation" value={operation} />
      <input type="hidden" name="expectedRevision" value={process.currentRevision} />
      <input type="hidden" name="operationScope" value={`assessment-${key}`} />
      <input type="hidden" name="mutationKey" value={key} />
      {Object.entries(objection).map(([k,v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Field name="assessmentNote" label="评估说明" />
      {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>{label}</Button>
    </form>
  );
}

function StepRevise({ proposalId, meetingId, process, circles, roles, objection }: { proposalId: string; meetingId: string; process: Process; circles: Circle[]; roles: Role[]; objection: ReturnType<typeof objectionRecord> }) {
  return (
    <div className="mt-3 border-t border-border pt-3 space-y-2">
      {objection && (
        <div className="bg-muted/20 rounded p-3 text-xs">
          <p className="font-medium">📝 需要整合的反对意见</p>
          <p className="mt-1">理由：{objection.materialHarm}</p>
          <p>整合建议：{objection.reversibility || "暂无"}</p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">请提案人根据反对意见修改提案：</p>
      <RevisionForm proposalId={proposalId} meetingId={meetingId} circles={circles} roles={roles} process={process} />
    </div>
  );
}

function StepAdopt({ proposalId, meetingId, process, changeLabel }: { proposalId: string; meetingId: string; process: Process; changeLabel: string | null }) {
  const [key] = useState(() => crypto.randomUUID());
  const raw = executeCanonicalGovernanceAction.bind(null, proposalId, meetingId);
  const [_, formAction, pending] = useActionState<ProposalState, FormData>(async (_p: ProposalState, fd: FormData) => raw(_p, fd), null);
  return (
    <div className="mt-3 border-t border-border pt-3">
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="operation" value="ADOPT_ROLE" />
        <input type="hidden" name="expectedRevision" value={process.currentRevision} />
        <input type="hidden" name="operationScope" value={`adopt-${key}`} />
        <input type="hidden" name="mutationKey" value={key} />
        <input type="hidden" name="note" value="无反对，共识采纳" />
        <p className="text-xs text-moss">✅ 无反对意见，可直接采纳：</p>
        <Button type="submit" size="sm" disabled={pending}>{changeLabel ? `采纳 · ${changeLabel}` : "采纳治理提案"}</Button>
      </form>
    </div>
  );
}
function SimpleForm({ proposalId, meetingId, process, operation, fields, submitLabel }: { proposalId: string; meetingId: string; process: Process; operation: string; fields: string[]; submitLabel?: string }) { const [key] = useState(() => crypto.randomUUID()); const action = executeCanonicalGovernanceAction.bind(null, proposalId, meetingId); const [state, formAction, pending] = useActionState<ProposalState, FormData>(action, null); return <form action={formAction} className="space-y-2 border border-border p-3"><input type="hidden" name="operation" value={operation} /><input type="hidden" name="expectedRevision" value={process.currentRevision} /><input type="hidden" name="operationScope" value={`${operation.toLowerCase()}-${key}`} /><input type="hidden" name="mutationKey" value={key} />{fields.map((f) => <Field key={f} name={f} label={fieldLabels[f] ?? f} />)}{state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}<Button type="submit" variant="outline" disabled={pending}>{submitLabel ?? operationLabels[operation] ?? operation}</Button></form>; }
function ObjectionForm({ proposalId, meetingId, process }: { proposalId: string; meetingId: string; process: Process }) { return <SimpleForm proposalId={proposalId} meetingId={meetingId} process={process} operation="RAISE_OBJECTION" fields={["materialHarm", "factVsWorry", "reversibility", "safeToTry"]} />; }
function AssessmentForm({ proposalId, meetingId, process, objection }: { proposalId: string; meetingId: string; process: Process; objection: Record<string, string> }) { return <div className="grid gap-2 sm:grid-cols-2">{["ASSESS_OBJECTION_INVALID", "ASSESS_OBJECTION_VALID"].map((op) => <Assessment key={op} proposalId={proposalId} meetingId={meetingId} process={process} objection={objection} operation={op} />)}</div>; }
function Assessment({ proposalId, meetingId, process, objection, operation }: { proposalId: string; meetingId: string; process: Process; objection: Record<string, string>; operation: string }) { const [key] = useState(() => crypto.randomUUID()); const action = executeCanonicalGovernanceAction.bind(null, proposalId, meetingId); const [state, formAction, pending] = useActionState<ProposalState, FormData>(action, null); return <form action={formAction} className="space-y-2 border border-border p-3"><input type="hidden" name="operation" value={operation} /><input type="hidden" name="expectedRevision" value={process.currentRevision} /><input type="hidden" name="operationScope" value={`assessment-${key}`} /><input type="hidden" name="mutationKey" value={key} />{Object.entries(objection).map(([k,v]) => <input key={k} type="hidden" name={k} value={v} />)}<Field name="assessmentNote" label="评估说明" />{state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}<Button type="submit" disabled={pending}>{operation.endsWith("VALID") && !operation.endsWith("INVALID") ? "反对有效" : "反对无效"}</Button></form>; }
function Field({ name, label, required = true }: { name: string; label: string; required?: boolean }) { return <div className="space-y-1"><Label htmlFor={name}>{label}</Label><Textarea id={name} name={name} required={required} /></div>; }
function objectionRecord(value: unknown): Record<string, string> | null { if (!value || typeof value !== "object" || Array.isArray(value)) return null; const record = value as Record<string, unknown>; return ["materialHarm", "factVsWorry", "reversibility", "safeToTry"].every((key) => typeof record[key] === "string") ? record as Record<string, string> : null; }
function governanceChangeOperation(value: unknown): string | null { if (!value || typeof value !== "object" || Array.isArray(value)) return null; const operation = (value as Record<string, unknown>).operation; return typeof operation === "string" ? operation : null; }
function governanceChangeLabel(operation: string): string { const labels: Record<string, string> = { ROLE_CREATED: "创建角色", ROLE_MODIFIED: "修改角色", ROLE_ARCHIVED: "废弃角色", ROLE_ASSIGNMENT: "确认任职", ROLE_UNASSIGNMENT: "确认退出", CIRCLE_CREATED: "创建回路", CIRCLE_MODIFIED: "修改回路", HOME_CHANGE: "变更归属", AGENT_CREATED: "创建智能体", CHARTER_CREATED: "创建宪章", CHARTER_AMENDED: "修订宪章" }; return labels[operation] ?? "治理提案"; }

const fieldLabels: Record<string, string> = { question: "需要澄清的问题", reason: "澄清原因", note: "会议记录", assessmentNote: "评估说明", materialHarm: "反对原因", factVsWorry: "支持事实", reversibility: "整合建议", safeToTry: "安全尝试理由" };
const operationLabels: Record<string, string> = { REQUEST_CLARIFICATION: "请求澄清", RAISE_OBJECTION: "提出反对", RECORD_NON_ADOPTION: "本轮不采纳", ADOPT_ROLE: "采纳治理提案", ASSESS_OBJECTION_INVALID: "反对无效", ASSESS_OBJECTION_VALID: "反对有效" };

function stateLabel(state: string): string { const labels: Record<string, string> = { READY: "待表决", CLARIFICATION_REQUIRED: "待澄清", OBJECTION_PENDING: "反对评估中", AMENDMENT_REQUIRED: "待修订", NOT_ADOPTED: "未采纳", ADOPTED: "已采纳" }; return labels[state] ?? state; }

function buildChangeSummary(typedChange: unknown): string | null {
  if (!typedChange || typeof typedChange !== "object") return null;
  const c = typedChange as Record<string, unknown>;
  const name = c.name || c.agentName || "";
  const op = String(c.operation || "");
  const circle = c.circleId ? `归属圈子 #${String(c.circleId).slice(-6)}` : "";
  switch (op) {
    case "ROLE_CREATED": return `新建角色「${name}」${circle}`;
    case "ROLE_MODIFIED": return `修改角色 → ${name || "更新属性"}`;
    case "ROLE_ARCHIVED": return `废弃角色`;
    case "CIRCLE_CREATED": return `新建圈子「${name || c.circleName || ""}」`;
    case "CIRCLE_MODIFIED": return `修改圈子`;
    case "AGENT_CREATED": return `创建智能体「${name}」${circle}`;
    case "HOME_CHANGE": return `变更归属`;
    case "CHARTER_CREATED": return `创建宪章 v${c.version || ""}`;
    case "CHARTER_AMENDED": return `修订宪章 v${c.version || ""}`;
    default: return `${op}: ${name}`;
  }
}

function formatProposalBody(text: string): string {
  if (!text) return "（无详细描述）";
  if (text.startsWith("{") && text.includes('"operation"')) {
    try {
      const parsed = JSON.parse(text);
      const parts: string[] = [];
      if (parsed.operation) parts.push(`变更类型: ${governanceChangeLabel(parsed.operation)}`);
      if (parsed.name) parts.push(`名称: ${parsed.name}`);
      if (parsed.purpose) parts.push(`目的: ${parsed.purpose}`);
      if (parsed.agentAbilities) parts.push(`能力: ${parsed.agentAbilities}`);
      if (parsed.accountabilities) parts.push(`职责: ${parsed.accountabilities}`);
      return parts.join("\n") || text;
    } catch { return text; }
  }
  return text;
}
