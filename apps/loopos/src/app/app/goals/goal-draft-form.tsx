"use client";

import { useActionState, useId, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, ReactNode, SetStateAction } from "react";
import {
  CheckCircle2,
  CircleX,
  FilePenLine,
  LoaderCircle,
  Plus,
  RefreshCw,
  Send,
  Target,
  Trash2,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import type { GoalTreeMetricOption, GoalTreeNode, GoalTreeProposal, GoalTreeRoleOption } from "@/lib/goals/read-model";
import {
  appendGoalProposalRevisionAction,
  createGoalProposalAction,
  directAdoptGoalProposalAction,
  withdrawGoalProposalAction,
} from "./actions";

type ProposalKind = GoalTreeProposal["kind"];
type ProposalStatus = GoalTreeProposal["status"];
type PublicErrorCode =
  | "INVALID_INPUT"
  | "NOT_AVAILABLE"
  | "STALE_REVISION"
  | "INVALID_STATE"
  | "INVALID_REFERENCE"
  | "RETRY_CONFLICT"
  | "TEMPORARY_FAILURE";
type GoalActionState =
  | { proposalId: string; currentRevision: number; status: ProposalStatus; meetingId?: string }
  | { code: PublicErrorCode }
  | undefined;
type GoalAction = (state: GoalActionState, formData: FormData) => Promise<GoalActionState>;

type NumericTarget = {
  key: string;
  kind: "NUMERIC";
  label: string;
  baselineValue: string;
  desiredValue: string;
  unit: string;
  metricId: string;
  metricName: string | null;
};
type MilestoneTarget = {
  key: string;
  kind: "MILESTONE";
  label: string;
  acceptanceCriteria: string;
};
type DraftTarget = NumericTarget | MilestoneTarget;
type DraftTargetUpdate = {
  label?: string;
  baselineValue?: string;
  desiredValue?: string;
  unit?: string;
  metricId?: string;
  metricName?: string | null;
  acceptanceCriteria?: string;
};

const errorMessages: Record<PublicErrorCode, string> = {
  INVALID_INPUT: "请检查必填项和目标格式。",
  NOT_AVAILABLE: "当前提案不可操作，请刷新后重试。",
  STALE_REVISION: "提案已被更新，请刷新后基于最新修订继续。",
  INVALID_STATE: "提案当前状态不允许此操作。",
  INVALID_REFERENCE: "目标、角色或上级目标已失效，请刷新后重试。",
  RETRY_CONFLICT: "保存时发生冲突，请稍后重试。",
  TEMPORARY_FAILURE: "服务暂时不可用，请稍后重试。",
};

const kindLabels: Record<ProposalKind, string> = {
  CREATE: "建立目标",
  REPLACE: "替换目标",
  CLOSE: "关闭目标",
};

const statusLabels: Record<ProposalStatus, string> = {
  DRAFT: "草稿",
  SUBMITTED: "待审议",
  ADOPTED: "已通过",
  RETURNED: "已退回",
  DECLINED: "未通过",
  WITHDRAWN: "已撤回",
};

function successState(state: GoalActionState) {
  return state && !("code" in state) ? state : null;
}

function actionError(state: GoalActionState) {
  return state && "code" in state ? errorMessages[state.code] : null;
}

function emptyMilestone(key: string): MilestoneTarget {
  return { key, kind: "MILESTONE", label: "", acceptanceCriteria: "" };
}

function targetsFromProposal(proposal?: GoalTreeProposal | null): DraftTarget[] {
  const targets = proposal?.revision?.targets ?? [];
  if (targets.length === 0) return [emptyMilestone("target-1")];
  return targets.map((target, index) => target.kind === "NUMERIC"
    ? {
        key: target.id || `target-${index + 1}`,
        kind: "NUMERIC",
        label: target.label,
        baselineValue: target.baselineValue ?? "",
        desiredValue: target.desiredValue ?? "",
        unit: target.unit ?? "",
        metricId: target.metricId ?? "",
        metricName: target.metric?.name ?? null,
      }
    : {
        key: target.id || `target-${index + 1}`,
        kind: "MILESTONE",
        label: target.label,
        acceptanceCriteria: target.acceptanceCriteria ?? "",
      });
}

function serializeTargets(targets: DraftTarget[]) {
  return JSON.stringify(targets.map((target) => target.kind === "NUMERIC"
    ? {
        kind: target.kind,
        label: target.label,
        baselineValue: target.baselineValue,
        desiredValue: target.desiredValue,
        unit: target.unit,
        ...(target.metricId.trim() ? { metricId: target.metricId } : {}),
      }
    : {
        kind: target.kind,
        label: target.label,
        acceptanceCriteria: target.acceptanceCriteria,
      }));
}

function pinnedOwnerRoleOptions(
  revisionOwnerRole: GoalTreeRoleOption | null | undefined,
  currentOwnerRole: GoalTreeRoleOption | null | undefined,
  previewRoles: GoalTreeRoleOption[],
) {
  const roles = [revisionOwnerRole, currentOwnerRole, ...previewRoles];
  return roles.filter((role, index): role is GoalTreeRoleOption => (
    role != null && roles.findIndex((candidate) => candidate?.id === role.id) === index
  ));
}

function ProposalMetadata({
  cycleId,
  circleId,
  kind,
  proposalId,
  expectedRevision,
  replacedGoalId,
  targets,
}: {
  cycleId: string;
  circleId: string;
  kind: ProposalKind;
  proposalId: string;
  expectedRevision: number | "";
  replacedGoalId: string;
  targets: string;
}) {
  return (
    <>
      <input type="hidden" name="proposalId" value={proposalId} />
      <input type="hidden" name="expectedRevision" value={expectedRevision} />
      <input type="hidden" name="cycleId" value={cycleId} />
      <input type="hidden" name="circleId" value={circleId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="replacedGoalId" value={replacedGoalId} />
      <input type="hidden" name="targets" value={targets} />
    </>
  );
}

function ActionMessage({ state, success }: { state: GoalActionState; success?: string }) {
  const error = actionError(state);
  const completed = successState(state);
  if (!error && !completed) return <p className="sr-only" aria-live="polite" />;
  return (
    <p
      className={error ? "text-sm text-destructive" : "text-sm text-growing"}
      role={error ? "alert" : "status"}
      aria-live="polite"
    >
      {error ?? success}
    </p>
  );
}

function PendingIcon({ pending, fallback }: { pending: boolean; fallback: ReactNode }) {
  return pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : fallback;
}

function ProposalLifecycleControls({
  cycleId,
  circleId,
  kind,
  replacedGoalId,
  targets,
  proposalId,
  currentRevision,
  status,
  canSubmit,
  canWithdraw,
}: {
  cycleId: string;
  circleId: string;
  kind: ProposalKind;
  replacedGoalId: string;
  targets: string;
  proposalId: string;
  currentRevision: number;
  status: ProposalStatus;
  canSubmit: boolean;
  canWithdraw: boolean;
}) {
  const [adoptState, adoptAction, adoptPending] = useActionState<GoalActionState, FormData>(
    directAdoptGoalProposalAction as GoalAction,
    undefined,
  );
  const [withdrawState, withdrawAction, withdrawPending] = useActionState<GoalActionState, FormData>(
    withdrawGoalProposalAction as GoalAction,
    undefined,
  );
  const latest = successState(withdrawState) ?? successState(adoptState);
  const effectiveStatus = latest?.status ?? status;
  const pending = adoptPending || withdrawPending;

  // 目标已采纳
  if (effectiveStatus === "ADOPTED") {
    return (
      <div className="space-y-2 border-t border-border pt-4">
        <p className="text-sm text-growing" role="status">
          <CheckCircle2 aria-hidden="true" className="mr-1 inline size-4" />
          目标已设定。系统将持续跟踪进展。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          修订 <span className="font-medium text-foreground">{latest?.currentRevision ?? currentRevision}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {canSubmit ? (
            <form action={adoptAction}>
              <ProposalMetadata
                cycleId={cycleId}
                circleId={circleId}
                kind={kind}
                proposalId={latest?.proposalId ?? proposalId}
                expectedRevision={latest?.currentRevision ?? currentRevision}
                replacedGoalId={replacedGoalId}
                targets={targets}
              />
              <Button type="submit" disabled={pending} aria-label="直接设定目标">
                <PendingIcon pending={adoptPending} fallback={<CheckCircle2 aria-hidden="true" />} />
                {adoptPending ? "设定中" : "直接设定目标"}
              </Button>
            </form>
          ) : null}
          {canWithdraw ? (
            <form action={withdrawAction}>
              <ProposalMetadata
                cycleId={cycleId}
                circleId={circleId}
                kind={kind}
                proposalId={latest?.proposalId ?? proposalId}
                expectedRevision={latest?.currentRevision ?? currentRevision}
                replacedGoalId={replacedGoalId}
                targets={targets}
              />
              <Button type="submit" variant="outline" disabled={pending} aria-label="撤回目标草稿">
                <PendingIcon pending={withdrawPending} fallback={<Undo2 aria-hidden="true" />} />
                {withdrawPending ? "撤回中" : "撤回"}
              </Button>
            </form>
          ) : null}
        </div>
      </div>
      <ActionMessage state={adoptState} success="目标已设定。" />
      <ActionMessage state={withdrawState} success="草稿已撤回。" />
    </div>
  );
}

function DefinitionTargets({
  idPrefix,
  targets,
  setTargets,
  pending,
  nextTargetNumberRef,
  metrics,
}: {
  idPrefix: string;
  targets: DraftTarget[];
  setTargets: Dispatch<SetStateAction<DraftTarget[]>>;
  pending: boolean;
  nextTargetNumberRef: MutableRefObject<number>;
  metrics: GoalTreeMetricOption[];
}) {
  function updateTarget(index: number, update: DraftTargetUpdate) {
    setTargets((current) => current.map((target, targetIndex) => (
      targetIndex === index ? { ...target, ...update } as DraftTarget : target
    )));
  }

  function changeKind(index: number, kind: DraftTarget["kind"]) {
    setTargets((current) => current.map((target, targetIndex) => {
      if (targetIndex !== index || target.kind === kind) return target;
      return kind === "NUMERIC"
        ? { key: target.key, kind, label: target.label, baselineValue: "", desiredValue: "", unit: "", metricId: "", metricName: null }
        : { key: target.key, kind, label: target.label, acceptanceCriteria: "" };
    }));
  }

  return (
    <fieldset className="space-y-3" disabled={pending}>
      <legend className="sr-only">目标判据</legend>
      <div className="flex items-center justify-between gap-3">
        <span aria-hidden="true" className="text-sm font-medium">目标判据</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={targets.length >= 20 || pending}
          aria-label="添加目标判据"
          onClick={() => {
            nextTargetNumberRef.current += 1;
            setTargets((current) => [...current, emptyMilestone(`target-${nextTargetNumberRef.current}`)]);
          }}
        >
          <Plus aria-hidden="true" />
          添加判据
        </Button>
      </div>
      <div className="divide-y divide-border border-y border-border">
        {targets.map((target, index) => {
          const baseId = `${idPrefix}-${target.key}`;
          const metricOptions = target.kind === "NUMERIC" && target.metricId && target.metricName
            && !metrics.some((metric) => metric.id === target.metricId)
            ? [{ id: target.metricId, name: target.metricName }, ...metrics]
            : metrics;
          return (
            <div key={target.key} className="space-y-3 py-4">
              <div className="flex items-end gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor={`${baseId}-kind`}>判据 {index + 1} 类型</Label>
                  <Select
                    items={{ NUMERIC: "数值", MILESTONE: "里程碑" }}
                    value={target.kind}
                    onValueChange={(value) => changeKind(index, value as DraftTarget["kind"])}
                  >
                    <SelectTrigger id={`${baseId}-kind`} className="w-full" aria-label={`判据 ${index + 1} 类型`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NUMERIC">数值</SelectItem>
                      <SelectItem value="MILESTONE">里程碑</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={targets.length === 1 || pending}
                  aria-label={`删除判据 ${index + 1}`}
                  onClick={() => setTargets((current) => current.filter((_, targetIndex) => targetIndex !== index))}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${baseId}-label`}>判据名称</Label>
                <Input
                  id={`${baseId}-label`}
                  value={target.label}
                  onChange={(event) => updateTarget(index, { label: event.target.value })}
                  placeholder={target.kind === "NUMERIC" ? "如：月活跃用户" : "如：完成首批客户验收"}
                  required
                />
              </div>
              {target.kind === "NUMERIC" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`${baseId}-baseline`}>基线值</Label>
                    <Input id={`${baseId}-baseline`} inputMode="decimal" value={target.baselineValue} onChange={(event) => updateTarget(index, { baselineValue: event.target.value })} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${baseId}-desired`}>期望值</Label>
                    <Input id={`${baseId}-desired`} inputMode="decimal" value={target.desiredValue} onChange={(event) => updateTarget(index, { desiredValue: event.target.value })} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${baseId}-unit`}>单位</Label>
                    <Input id={`${baseId}-unit`} value={target.unit} onChange={(event) => updateTarget(index, { unit: event.target.value })} placeholder="如：人、%、万元" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${baseId}-metric`}>关联指标（可选）</Label>
                    <Select
                      items={[
                        { value: "__NONE__", label: "不关联指标" },
                        ...metricOptions.map((metric) => ({ value: metric.id, label: metric.name })),
                      ]}
                      value={target.metricId || "__NONE__"}
                      onValueChange={(value) => {
                        const metricId = value === "__NONE__" || value === null ? "" : value;
                        updateTarget(index, {
                          metricId,
                          metricName: metricOptions.find((metric) => metric.id === metricId)?.name ?? null,
                        });
                      }}
                    >
                      <SelectTrigger id={`${baseId}-metric`} className="w-full" aria-label={`判据 ${index + 1} 关联指标`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__NONE__">不关联指标</SelectItem>
                        {metricOptions.map((metric) => (
                          <SelectItem key={metric.id} value={metric.id}>{metric.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor={`${baseId}-acceptance`}>验收标准</Label>
                  <Textarea
                    id={`${baseId}-acceptance`}
                    value={target.acceptanceCriteria}
                    onChange={(event) => updateTarget(index, { acceptanceCriteria: event.target.value })}
                    rows={3}
                    required
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">最多 20 项。进展由后续证据计算，无需填写完成百分比。</p>
    </fieldset>
  );
}

function GoalRevisionEditor({
  cycleId,
  node,
  suggestedParentGoal,
  kind,
  proposal,
}: {
  cycleId: string;
  node: GoalTreeNode;
  suggestedParentGoal: { id: string; title: string; url: string } | null;
  kind: ProposalKind;
  proposal?: GoalTreeProposal | null;
}) {
  const revision = proposal?.revision;
  const formId = useId().replaceAll(":", "");
  const ownerRoleOptions = pinnedOwnerRoleOptions(
    revision?.ownerRole,
    node.goal?.ownerRole,
    node.draftOwnerRoles,
  );
  const [title, setTitle] = useState(revision?.title ?? (kind === "REPLACE" ? node.goal?.title ?? "" : ""));
  const [intendedOutcome, setIntendedOutcome] = useState(revision?.intendedOutcome ?? (kind === "REPLACE" ? node.goal?.intendedOutcome ?? "" : ""));
  const [ownerRoleId, setOwnerRoleId] = useState(revision?.ownerRole?.id ?? node.goal?.ownerRole?.id ?? ownerRoleOptions[0]?.id ?? "");
  const [targets, setTargets] = useState<DraftTarget[]>(() => targetsFromProposal(proposal));
  const [closeResult, setCloseResult] = useState<"ACHIEVED" | "NOT_ACHIEVED">(revision?.closeResult ?? "ACHIEVED");
  const [conclusion, setConclusion] = useState(revision?.conclusion ?? "");
  const nextTargetNumberRef = useRef(targets.length);
  const action = proposal ? appendGoalProposalRevisionAction : createGoalProposalAction;
  const [state, formAction, pending] = useActionState<GoalActionState, FormData>(action as GoalAction, undefined);
  const saved = successState(state);
  const targetsJson = kind === "CLOSE" ? "[]" : serializeTargets(targets);
  const replacedGoalId = kind === "CREATE" ? "" : node.goal?.id ?? "";
  const isDefinition = kind === "CREATE" || kind === "REPLACE";

  if (saved) {
    return (
      <div className="space-y-3">
        <ActionMessage state={state} success={`提案草稿已保存为修订 ${saved.currentRevision}。`} />
        <ProposalLifecycleControls
          cycleId={cycleId}
          circleId={node.circle.id}
          kind={kind}
          replacedGoalId={replacedGoalId}
          targets={targetsJson}
          proposalId={saved.proposalId}
          currentRevision={saved.currentRevision}
          status={saved.status}
          canSubmit
          canWithdraw
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-5">
      <ProposalMetadata
        cycleId={cycleId}
        circleId={node.circle.id}
        kind={kind}
        proposalId={proposal?.id ?? ""}
        expectedRevision={proposal?.currentRevision ?? ""}
        replacedGoalId={replacedGoalId}
        targets={targetsJson}
      />
      {isDefinition ? (
        <>
          <input type="hidden" name="parentGoalId" value={suggestedParentGoal?.id ?? ""} />
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-title`}>目标名称</Label>
            <Input id={`${formId}-title`} name="title" value={title} onChange={(event) => setTitle(event.target.value)} disabled={pending} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-outcome`}>期望结果</Label>
            <Textarea id={`${formId}-outcome`} name="intendedOutcome" value={intendedOutcome} onChange={(event) => setIntendedOutcome(event.target.value)} disabled={pending} rows={4} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-owner-role`}>目标承担角色</Label>
            <Select
              items={ownerRoleOptions.map((role) => ({
                value: role.id,
                label: role.name,
              }))}
              name="ownerRoleId"
              value={ownerRoleId}
              onValueChange={(value) => setOwnerRoleId(value ?? "")}
              disabled={pending || ownerRoleOptions.length === 0}
              required
            >
              <SelectTrigger id={`${formId}-owner-role`} className="w-full" aria-label="选择目标承担角色">
                <SelectValue placeholder="选择角色" />
              </SelectTrigger>
              <SelectContent>
                {ownerRoleOptions.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}{role.assigneeCount > 0 ? ` · ${role.assigneeCount} 位承担者` : " · 尚未分配"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {ownerRoleOptions.length === 0 ? <p className="text-xs text-destructive">当前回路没有可承担目标的有效角色。</p> : null}
            {node.draftOwnerRolesHasMore ? <p className="text-xs text-muted-foreground">仅显示前 50 个有效角色。</p> : null}
          </div>
          <div className="border-y border-border py-3">
            <p className="text-xs text-muted-foreground">上级目标支持</p>
            {suggestedParentGoal ? (
              <a className="mt-1 inline-block break-words text-sm font-medium hover:underline" href={suggestedParentGoal.url}>
                {suggestedParentGoal.title}
              </a>
            ) : <p className="mt-1 text-sm font-medium">根回路目标，无上级目标</p>}
          </div>
          <DefinitionTargets
            idPrefix={formId}
            targets={targets}
            setTargets={setTargets}
            pending={pending}
            nextTargetNumberRef={nextTargetNumberRef}
            metrics={node.draftMetrics}
          />
          {node.draftMetricsHasMore ? <p className="text-xs text-muted-foreground">指标选择仅显示前 50 项。</p> : null}
        </>
      ) : (
        <fieldset className="space-y-4" disabled={pending}>
          <legend className="text-sm font-medium">关闭结论</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="目标关闭结果">
            <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${closeResult === "ACHIEVED" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}>
              <input className="sr-only" type="radio" name="closeResult" value="ACHIEVED" checked={closeResult === "ACHIEVED"} onChange={() => setCloseResult("ACHIEVED")} />
              <CheckCircle2 aria-hidden="true" className="size-4" />
              已达成
            </label>
            <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${closeResult === "NOT_ACHIEVED" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}>
              <input className="sr-only" type="radio" name="closeResult" value="NOT_ACHIEVED" checked={closeResult === "NOT_ACHIEVED"} onChange={() => setCloseResult("NOT_ACHIEVED")} />
              <CircleX aria-hidden="true" className="size-4" />
              未达成
            </label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-conclusion`}>结论说明</Label>
            <Textarea id={`${formId}-conclusion`} name="conclusion" value={conclusion} onChange={(event) => setConclusion(event.target.value)} rows={4} required />
          </div>
        </fieldset>
      )}
      <ActionMessage state={state} />
      <Button type="submit" disabled={pending || (isDefinition && !ownerRoleId)} aria-label={proposal ? "保存目标提案新修订" : `保存${kindLabels[kind]}提案草稿`}>
        <PendingIcon pending={pending} fallback={proposal ? <RefreshCw aria-hidden="true" /> : <FilePenLine aria-hidden="true" />} />
        {pending ? "保存中" : proposal ? "保存新修订" : "保存提案草稿"}
      </Button>
      </form>
      {proposal?.status === "RETURNED" && proposal.capabilities.canWithdraw ? (
        <ProposalLifecycleControls
          cycleId={cycleId}
          circleId={node.circle.id}
          kind={kind}
          replacedGoalId={replacedGoalId}
          targets={targetsJson}
          proposalId={proposal.id}
          currentRevision={proposal.currentRevision}
          status={proposal.status}
          canSubmit={false}
          canWithdraw
        />
      ) : null}
    </div>
  );
}

function proposalTargetsJson(proposal: GoalTreeProposal) {
  return proposal.kind === "CLOSE" ? "[]" : serializeTargets(targetsFromProposal(proposal));
}

export function GoalDraftForm({
  cycleId,
  node,
  suggestedParentGoal,
  proposal,
}: {
  cycleId: string;
  node: GoalTreeNode;
  suggestedParentGoal: { id: string; title: string; url: string } | null;
  proposal?: GoalTreeProposal | null;
}) {
  const headingId = useId().replaceAll(":", "");
  const availableKinds: ProposalKind[] = [];
  if (node.capabilities.canDraftCreate) availableKinds.push("CREATE");
  if (node.capabilities.canDraftReplace) availableKinds.push("REPLACE");
  if (node.capabilities.canDraftClose) availableKinds.push("CLOSE");
  const [preferredKind, setPreferredKind] = useState<ProposalKind>(availableKinds[0] ?? "CREATE");
  const kind = availableKinds.includes(preferredKind) ? preferredKind : availableKinds[0];
  const actionableReturned = proposal?.status === "RETURNED"
    && (proposal.capabilities.canAppendRevision || proposal.capabilities.canWithdraw);
  const actionableLifecycle = proposal
    && (proposal.status === "DRAFT" || proposal.status === "SUBMITTED")
    && (proposal.capabilities.canSubmit || proposal.capabilities.canWithdraw);
  const actionableRevisionTitle = proposal?.revision?.title?.trim()
    || proposal?.revision?.conclusion?.trim()
    || "修订标题不可用";

  if (actionableReturned && proposal) {
    return (
      <section className="space-y-4 border-t border-border pt-5" aria-labelledby={headingId}>
        <div>
          <p className="text-xs font-medium text-needs-light">提案已退回</p>
          <h3 id={headingId} className="mt-1 text-base font-medium">修订{kindLabels[proposal.kind]}提案</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            当前为修订 {proposal.currentRevision}
            {proposal.capabilities.canAppendRevision ? "，保存后生成下一版草稿。" : "，可撤回该提案。"}
          </p>
        </div>
        {proposal.capabilities.canAppendRevision ? (
          <GoalRevisionEditor
            key={`${proposal.id}-${proposal.currentRevision}`}
            cycleId={cycleId}
            node={node}
            suggestedParentGoal={suggestedParentGoal}
            kind={proposal.kind}
            proposal={proposal}
          />
        ) : (
          <ProposalLifecycleControls
            cycleId={cycleId}
            circleId={node.circle.id}
            kind={proposal.kind}
            replacedGoalId={proposal.replacedGoalId ?? ""}
            targets={proposalTargetsJson(proposal)}
            proposalId={proposal.id}
            currentRevision={proposal.currentRevision}
            status={proposal.status}
            canSubmit={false}
            canWithdraw
          />
        )}
      </section>
    );
  }

  if (actionableLifecycle && proposal) {
    return (
      <section className="space-y-3 border-t border-border pt-5" aria-labelledby={headingId}>
        <div>
          <p className="text-xs text-muted-foreground">{kindLabels[proposal.kind]}提案</p>
          <h3 id={headingId} className="mt-1 text-base font-medium">
            {proposal.status === "DRAFT" ? "草稿待提交" : "提案等待审议"}
          </h3>
          <p className="mt-1 break-words text-sm text-foreground">当前修订：{actionableRevisionTitle}</p>
        </div>
        <ProposalLifecycleControls
          cycleId={cycleId}
          circleId={node.circle.id}
          kind={proposal.kind}
          replacedGoalId={proposal.replacedGoalId ?? ""}
          targets={proposalTargetsJson(proposal)}
          proposalId={proposal.id}
          currentRevision={proposal.currentRevision}
          status={proposal.status}
          canSubmit={proposal.capabilities.canSubmit}
          canWithdraw={proposal.capabilities.canWithdraw}
        />
      </section>
    );
  }

  if (!kind) {
    return (
      <section className="border-t border-border pt-5" aria-labelledby={headingId}>
        <h3 id={headingId} className="sr-only">目标提案</h3>
        <p className="text-sm text-muted-foreground">当前回路没有可发起的目标提案操作。</p>
      </section>
    );
  }

  return (
    <section className="space-y-5 border-t border-border pt-5" aria-labelledby={headingId}>
      <div>
        <h3 id={headingId} className="text-base font-medium">发起目标提案</h3>
        <p className="mt-1 text-sm text-muted-foreground">保存草稿后可直接设定目标，无需会议审议。</p>
      </div>
      {availableKinds.length > 1 ? (
        <div className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-border p-1" role="group" aria-label="目标提案类型">
          {availableKinds.map((availableKind) => (
            <Button
              key={availableKind}
              type="button"
              size="sm"
              variant={kind === availableKind ? "secondary" : "ghost"}
              aria-pressed={kind === availableKind}
              onClick={() => setPreferredKind(availableKind)}
            >
              {availableKind === "CREATE" ? <Plus aria-hidden="true" /> : availableKind === "REPLACE" ? <RefreshCw aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
              {kindLabels[availableKind]}
            </Button>
          ))}
        </div>
      ) : null}
      <GoalRevisionEditor
        key={`${cycleId}-${node.id}-${kind}`}
        cycleId={cycleId}
        node={node}
        suggestedParentGoal={suggestedParentGoal}
        kind={kind}
      />
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Target aria-hidden="true" className="size-3.5" />
        目标属于运营决策，设定后系统自动跟踪进展。
      </p>
    </section>
  );
}
