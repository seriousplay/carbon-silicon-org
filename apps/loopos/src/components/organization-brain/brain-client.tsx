"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import {
  Activity,
  AlertCircle,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  FileCheck2,
  History,
  Inbox,
  LoaderCircle,
  LockKeyhole,
  MessageSquarePlus,
  RotateCcw,
  Send,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { BrainActionResult } from "@/app/app/brain/actions";
import type {
  OrganizationBrainConversationDetail,
  OrganizationBrainConversationSummary,
  StoredOrganizationBrainResponse,
} from "@/lib/organization-brain/conversation-store";
import type { BrainCommandPreviewSummary, GovernanceProposalContext, RoleApplicationContext, TacticalOutcomeContext, TensionRaiseContext } from "@/lib/organization-brain/command-preview-service";
import type { PrivateBrief, PrivateBriefSignal } from "@/lib/organization-brain/private-brief-types";
import type { MemoryCandidate, MemoryCandidateSourceRef } from "@/lib/organization-brain/memory-candidate-types";

const STATUS_LABELS: Record<StoredOrganizationBrainResponse["status"], string> = {
  ANSWERED: "已回答",
  EVIDENCE_ONLY: "仅展示事实",
  INSUFFICIENT_EVIDENCE: "证据不足",
  DENIED: "无法提供",
  REJECTED: "请求未通过",
  UNAVAILABLE: "模型不可用",
  FAILED: "处理失败",
};

const STATUS_TONES: Record<StoredOrganizationBrainResponse["status"], string> = {
  ANSWERED: "bg-emerald-500/10 text-[var(--brain-success)]",
  EVIDENCE_ONLY: "bg-cyan-500/10 text-[var(--brain-info)]",
  INSUFFICIENT_EVIDENCE: "bg-amber-500/10 text-[var(--brain-warning)]",
  DENIED: "bg-red-500/10 text-[var(--brain-danger)]",
  REJECTED: "bg-red-500/10 text-[var(--brain-danger)]",
  UNAVAILABLE: "bg-amber-500/10 text-[var(--brain-warning)]",
  FAILED: "bg-red-500/10 text-[var(--brain-danger)]",
};

type BrainActionModule = typeof import("@/app/app/brain/actions");

type ClientFailure = Extract<BrainActionResult<unknown>, { ok: false }>;

type QuestionFocusControl = Pick<HTMLTextAreaElement, "disabled" | "focus">;

export function restoreQuestionFocus({
  pending,
  requestId,
  restoredRequestId,
  control,
}: {
  pending: boolean;
  requestId: number;
  restoredRequestId: number;
  control: QuestionFocusControl | null;
}): number {
  if (pending || requestId === restoredRequestId || !control || control.disabled) {
    return restoredRequestId;
  }
  control.focus();
  return requestId;
}

export type PendingTurn = Readonly<{
  conversationId: string | null;
  clientTurnId: string;
  question: string;
}>;

type SharedRetryTarget = "create" | "submit";

export type BrainRequestState = Readonly<{
  pendingConversationId: string | null;
  pendingTurn: PendingTurn | null;
  operation: SharedRetryTarget | null;
  retry: SharedRetryTarget | null;
  failure: ClientFailure | null;
}>;

export type BrainRequestMemory = Readonly<{
  getSnapshot: () => BrainRequestState;
  subscribe: (listener: () => void) => () => void;
  update: (updater: (current: BrainRequestState) => BrainRequestState) => void;
}>;

export const TEMPORARY_BRAIN_FAILURE = Object.freeze({
  ok: false,
  code: "TEMPORARY_FAILURE",
  message: "组织大脑暂时不可用，请稍后重试。",
} as const satisfies ClientFailure);

function initialBrainRequestState(): BrainRequestState {
  return {
    pendingConversationId: null,
    pendingTurn: null,
    operation: null,
    retry: null,
    failure: null,
  };
}

export function markBrainRequestTemporaryFailure(
  current: BrainRequestState,
  retry: SharedRetryTarget,
): BrainRequestState {
  return {
    ...current,
    operation: null,
    retry,
    failure: TEMPORARY_BRAIN_FAILURE,
  };
}

export function createBrainRequestMemory(): BrainRequestMemory {
  let state = initialBrainRequestState();
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(updater) {
      const next = updater(state);
      if (Object.is(next, state)) return;
      state = next;
      listeners.forEach((listener) => listener());
    },
  };
}

async function invokeBrainAction<T>(
  invocation: () => Promise<BrainActionResult<T>>,
): Promise<BrainActionResult<T>> {
  try {
    return await invocation();
  } catch {
    return TEMPORARY_BRAIN_FAILURE;
  }
}

export function createBrainActionInvoker(dependencies: {
  create: BrainActionModule["createBrainConversation"];
  list: BrainActionModule["listBrainConversations"];
  load: BrainActionModule["loadBrainConversation"];
  submit: BrainActionModule["submitBrainTurn"];
  listPreviews: BrainActionModule["listBrainCommandPreviewCards"];
  confirmPreview: BrainActionModule["confirmBrainCommandPreviewCard"];
  loadBrief: BrainActionModule["loadBrainPrivateBrief"];
  submitMemoryCandidate: BrainActionModule["submitBrainMemoryCandidate"];
  listReviewableMemoryCandidates: BrainActionModule["listBrainReviewableMemoryCandidates"];
  confirmMemoryCandidate: BrainActionModule["confirmBrainMemoryCandidate"];
  rejectMemoryCandidate: BrainActionModule["rejectBrainMemoryCandidate"];
  loadGovernanceProposalContext: BrainActionModule["loadBrainGovernanceProposalContext"];
  createGovernanceProposalPreview: BrainActionModule["createBrainGovernanceProposalPreview"];
  loadRoleApplicationContext: BrainActionModule["loadBrainRoleApplicationContext"];
  createRoleApplicationPreview: BrainActionModule["createBrainRoleApplicationPreview"];
  loadTensionRaiseContext: BrainActionModule["loadBrainTensionRaiseContext"];
  createTensionRaisePreview: BrainActionModule["createBrainTensionRaisePreview"];
  loadTacticalOutcomeContext: BrainActionModule["loadBrainTacticalOutcomeContext"];
  createTacticalOutcomePreview: BrainActionModule["createBrainTacticalOutcomePreview"];
}) {
  return {
    create: (input: Parameters<BrainActionModule["createBrainConversation"]>[0]) =>
      invokeBrainAction(() => dependencies.create(input)),
    list: (input: Parameters<BrainActionModule["listBrainConversations"]>[0]) =>
      invokeBrainAction(() => dependencies.list(input)),
    load: (input: Parameters<BrainActionModule["loadBrainConversation"]>[0]) =>
      invokeBrainAction(() => dependencies.load(input)),
    submit: (input: Parameters<BrainActionModule["submitBrainTurn"]>[0]) =>
      invokeBrainAction(() => dependencies.submit(input)),
    listPreviews: (input: Parameters<BrainActionModule["listBrainCommandPreviewCards"]>[0]) =>
      invokeBrainAction(() => dependencies.listPreviews(input)),
    confirmPreview: (input: Parameters<BrainActionModule["confirmBrainCommandPreviewCard"]>[0]) =>
      invokeBrainAction(() => dependencies.confirmPreview(input)),
    loadBrief: (input: Parameters<BrainActionModule["loadBrainPrivateBrief"]>[0]) =>
      invokeBrainAction(() => dependencies.loadBrief(input)),
    submitMemoryCandidate: (input: Parameters<BrainActionModule["submitBrainMemoryCandidate"]>[0]) =>
      invokeBrainAction(() => dependencies.submitMemoryCandidate(input)),
    listReviewableMemoryCandidates: (
      input: Parameters<BrainActionModule["listBrainReviewableMemoryCandidates"]>[0],
    ) => invokeBrainAction(() => dependencies.listReviewableMemoryCandidates(input)),
    confirmMemoryCandidate: (input: Parameters<BrainActionModule["confirmBrainMemoryCandidate"]>[0]) =>
      invokeBrainAction(() => dependencies.confirmMemoryCandidate(input)),
    rejectMemoryCandidate: (input: Parameters<BrainActionModule["rejectBrainMemoryCandidate"]>[0]) =>
      invokeBrainAction(() => dependencies.rejectMemoryCandidate(input)),
    loadGovernanceProposalContext: () => invokeBrainAction(() => dependencies.loadGovernanceProposalContext()),
    createGovernanceProposalPreview: (input: Parameters<BrainActionModule["createBrainGovernanceProposalPreview"]>[0]) =>
      invokeBrainAction(() => dependencies.createGovernanceProposalPreview(input)),
    loadRoleApplicationContext: () => invokeBrainAction(() => dependencies.loadRoleApplicationContext()),
    createRoleApplicationPreview: (input: Parameters<BrainActionModule["createBrainRoleApplicationPreview"]>[0]) =>
      invokeBrainAction(() => dependencies.createRoleApplicationPreview(input)),
    loadTensionRaiseContext: () => invokeBrainAction(() => dependencies.loadTensionRaiseContext()),
    createTensionRaisePreview: (input: Parameters<BrainActionModule["createBrainTensionRaisePreview"]>[0]) =>
      invokeBrainAction(() => dependencies.createTensionRaisePreview(input)),
    loadTacticalOutcomeContext: () => invokeBrainAction(() => dependencies.loadTacticalOutcomeContext()),
    createTacticalOutcomePreview: (input: Parameters<BrainActionModule["createBrainTacticalOutcomePreview"]>[0]) =>
      invokeBrainAction(() => dependencies.createTacticalOutcomePreview(input)),
  };
}

const brainActions = createBrainActionInvoker({
  create: async (input) =>
    (await import("@/app/app/brain/actions")).createBrainConversation(input),
  list: async (input) =>
    (await import("@/app/app/brain/actions")).listBrainConversations(input),
  load: async (input) =>
    (await import("@/app/app/brain/actions")).loadBrainConversation(input),
  submit: async (input) =>
    (await import("@/app/app/brain/actions")).submitBrainTurn(input),
  listPreviews: async (input) =>
    (await import("@/app/app/brain/actions")).listBrainCommandPreviewCards(input),
  confirmPreview: async (input) =>
    (await import("@/app/app/brain/actions")).confirmBrainCommandPreviewCard(input),
  loadBrief: async (input) =>
    (await import("@/app/app/brain/actions")).loadBrainPrivateBrief(input),
  submitMemoryCandidate: async (input) =>
    (await import("@/app/app/brain/actions")).submitBrainMemoryCandidate(input),
  listReviewableMemoryCandidates: async (input) =>
    (await import("@/app/app/brain/actions")).listBrainReviewableMemoryCandidates(input),
  confirmMemoryCandidate: async (input) =>
    (await import("@/app/app/brain/actions")).confirmBrainMemoryCandidate(input),
  rejectMemoryCandidate: async (input) =>
    (await import("@/app/app/brain/actions")).rejectBrainMemoryCandidate(input),
  loadGovernanceProposalContext: async () =>
    (await import("@/app/app/brain/actions")).loadBrainGovernanceProposalContext(),
  createGovernanceProposalPreview: async (input) =>
    (await import("@/app/app/brain/actions")).createBrainGovernanceProposalPreview(input),
  loadRoleApplicationContext: async () =>
    (await import("@/app/app/brain/actions")).loadBrainRoleApplicationContext(),
  createRoleApplicationPreview: async (input) =>
    (await import("@/app/app/brain/actions")).createBrainRoleApplicationPreview(input),
  loadTensionRaiseContext: async () =>
    (await import("@/app/app/brain/actions")).loadBrainTensionRaiseContext(),
  createTensionRaisePreview: async (input) =>
    (await import("@/app/app/brain/actions")).createBrainTensionRaisePreview(input),
  loadTacticalOutcomeContext: async () =>
    (await import("@/app/app/brain/actions")).loadBrainTacticalOutcomeContext(),
  createTacticalOutcomePreview: async (input) =>
    (await import("@/app/app/brain/actions")).createBrainTacticalOutcomePreview(input),
});

const BrainRequestMemoryContext = createContext<BrainRequestMemory | null>(null);

export function OrganizationBrainProvider({ children }: { children: React.ReactNode }) {
  const [memory] = useState(createBrainRequestMemory);
  return (
    <BrainRequestMemoryContext.Provider value={memory}>
      {children}
    </BrainRequestMemoryContext.Provider>
  );
}

function useBrainRequestMemory() {
  const memory = useContext(BrainRequestMemoryContext);
  if (!memory) throw new Error("OrganizationBrainProvider is required");
  const state = useSyncExternalStore(
    memory.subscribe,
    memory.getSnapshot,
    memory.getSnapshot,
  );
  return { memory, state };
}

type RetryTarget =
  | Readonly<{ kind: "list" }>
  | Readonly<{ kind: "load"; conversationId: string }>
  | Readonly<{ kind: "create" }>
  | Readonly<{ kind: "submit" }>;

export function formatUntitledConversationLabel(createdAt: string): string {
  return `对话 ${new Date(createdAt).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })}`;
}

function conversationLabel(conversation: OrganizationBrainConversationSummary): string {
  if (conversation.title) return conversation.title;
  return formatUntitledConversationLabel(conversation.createdAt);
}

function AnswerSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border pt-3 first:border-t-0 first:pt-0">
      <h4 className="mb-2 text-xs font-medium text-muted-foreground">{title}</h4>
      {children}
    </section>
  );
}

const MEMORY_ROUTE_LABELS = {
  GOAL_STRATEGY: "目标策略确认",
  GOVERNANCE: "治理确认",
  TACTICAL: "战术确认",
  MEETING_RECORD: "会议记录确认",
  TENSION: "张力确认",
} as const;

export function BrainAnswer({ result }: { result: StoredOrganizationBrainResponse }) {
  const confirmedMemory = result.confirmedMemory ?? [];
  const hasStructuredContent =
    confirmedMemory.length > 0 ||
    result.facts.length > 0 ||
    result.inferences.length > 0 ||
    result.recommendations.length > 0 ||
    result.missingEvidence.length > 0 ||
    result.sources.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          data-brain-status={result.status}
          className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_TONES[result.status])}
        >
          {STATUS_LABELS[result.status]}
        </span>
        <p className="text-sm leading-6">{result.message}</p>
      </div>

      {confirmedMemory.length > 0 && (
        <AnswerSection title="已确认组织记忆">
          <div className="space-y-3">
            {confirmedMemory.map((memory) => (
              <div
                key={`${memory.claim}-${memory.validFrom}`}
                className="border-l-2 border-moss/40 pl-3"
              >
                <p className="break-words text-sm leading-6">{memory.claim}</p>
                {memory.rationale && (
                  <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
                    {memory.rationale}
                  </p>
                )}
                <dl className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="inline">确认路径：</dt>
                    <dd className="inline text-foreground">
                      {MEMORY_ROUTE_LABELS[memory.authorityRoute.kind]}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="inline">确认人：</dt>
                    <dd className="inline text-foreground">{memory.confirmedBy.label}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="inline">生效：</dt>
                    <dd className="inline text-foreground">{memory.validFrom}</dd>
                  </div>
                  {memory.validUntil && (
                    <div className="min-w-0">
                      <dt className="inline">截止：</dt>
                      <dd className="inline text-foreground">{memory.validUntil}</dd>
                    </div>
                  )}
                </dl>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {memory.applicationUrl && (
                    <a
                      href={memory.applicationUrl}
                      className="inline-flex min-h-10 items-center gap-1 text-moss hover:underline"
                    >
                      打开确认流程
                      <ExternalLink aria-hidden="true" className="h-3 w-3" />
                    </a>
                  )}
                  {memory.sourceRefs.map((source, index) => source.applicationUrl ? (
                    <a
                      key={`${source.type}-${source.id}-${index}`}
                      href={source.applicationUrl}
                      className="inline-flex min-h-10 items-center gap-1 text-moss hover:underline"
                    >
                      {source.label}
                      <ExternalLink aria-hidden="true" className="h-3 w-3" />
                    </a>
                  ) : (
                    <span
                      key={`${source.type}-${source.id}-${index}`}
                      className="text-muted-foreground"
                    >
                      {source.label}
                    </span>
                  ))}
                  <a
                    href={memory.correctionUrl}
                    className="inline-flex min-h-10 items-center gap-1 text-moss hover:underline"
                  >
                    提出纠偏张力
                    <ExternalLink aria-hidden="true" className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </AnswerSection>
      )}

      {result.facts.length > 0 && (
        <AnswerSection title="确认事实">
          <div className="space-y-3">
            {result.facts.map((fact) => (
              <div key={fact.evidenceId} className="border-l-2 border-moss/40 pl-3">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-moss">{fact.resourceLabel}</span>
                  {fact.applicationUrl && (
                    <a
                      href={fact.applicationUrl}
                      className="inline-flex min-h-10 items-center gap-1 text-xs text-moss hover:underline"
                    >
                      查看
                      <ExternalLink aria-hidden="true" className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <dl className="space-y-1">
                  {fact.fields.map((field) => (
                    <div key={field.name} className="grid grid-cols-[5rem_1fr] gap-2 text-xs">
                      <dt className="text-muted-foreground">{field.label}</dt>
                      <dd className="min-w-0 break-words text-foreground">
                        {field.value}{field.truncated ? "…" : ""}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </AnswerSection>
      )}

      {result.inferences.length > 0 && (
        <AnswerSection title="推断">
          <ul className="space-y-2 text-sm leading-6">
            {result.inferences.map((item, index) => (
              <li key={`${item.text}-${index}`}>{item.text}</li>
            ))}
          </ul>
        </AnswerSection>
      )}

      {result.recommendations.length > 0 && (
        <AnswerSection title="建议">
          <ul className="space-y-2 text-sm leading-6">
            {result.recommendations.map((item, index) => (
              <li key={`${item.text}-${index}`}>{item.text}</li>
            ))}
          </ul>
        </AnswerSection>
      )}

      {result.missingEvidence.length > 0 && (
        <AnswerSection title="缺失证据">
          <ul className="space-y-1 text-sm text-muted-foreground">
            {result.missingEvidence.map((item, index) => (
              <li key={`${item.text}-${index}`}>{item.text}</li>
            ))}
          </ul>
        </AnswerSection>
      )}

      {result.sources.length > 0 && (
        <AnswerSection title="来源">
          <ul className="space-y-1.5">
            {result.sources.map((source) => (
              <li key={source.evidenceId} className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate text-muted-foreground">
                  {source.resourceLabel}
                </span>
                {source.applicationUrl ? (
                  <a
                    href={source.applicationUrl}
                    className="inline-flex min-h-10 shrink-0 items-center gap-1 text-moss hover:underline"
                  >
                    打开来源
                    <ExternalLink aria-hidden="true" className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="shrink-0 text-muted-foreground">无页面入口</span>
                )}
              </li>
            ))}
          </ul>
        </AnswerSection>
      )}

      {!hasStructuredContent && (
        <p className="text-xs text-muted-foreground">本次回答没有可展示的授权证据。</p>
      )}
    </div>
  );
}

const COMMAND_LABELS: Record<BrainCommandPreviewSummary["commandName"], string> = {
  "goal_proposal.create_draft": "创建目标草案",
  "goal_proposal.append_returned_revision": "提交目标修订",
  "goal_check_in.append": "追加目标进展",
  "tension.raise": "提出张力",
  "tactical_outcome.submit_proposal": "提交战术提案",
  "meeting_notes.update": "更新会议纪要",
  "governance_proposal.create": "创建治理提案",
  "role_application.create": "申请承担角色",
};

const COMMAND_STATUS_LABELS: Record<BrainCommandPreviewSummary["status"], string> = {
  PREVIEWED: "待确认",
  SUCCEEDED: "已执行",
  REJECTED: "未执行",
  EXPIRED: "已过期",
};

function terminalText(preview: BrainCommandPreviewSummary): string {
  if (preview.status === "SUCCEEDED") return "命令已通过确认并完成。";
  if (preview.terminalCode) return `结果：${preview.terminalCode}`;
  if (preview.expired) return "预览已过期，需要重新生成。";
  return "确认前不会修改组织数据。";
}

function BrainCommandPreviewCards({
  previews,
  pending,
  onConfirm,
}: {
  previews: readonly BrainCommandPreviewSummary[];
  pending: boolean;
  onConfirm: (previewId: string) => void;
}) {
  if (previews.length === 0) return null;
  return (
    <section className="mb-4 border-y border-border bg-amber-500/[0.04]" aria-label="组织大脑命令预览">
      <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground">
        <Activity className="size-4" aria-hidden="true" />
        组织大脑命令预览
      </div>
      {previews.map((preview) => {
        const canConfirm = preview.status === "PREVIEWED" && !preview.expired;
        return (
          <article key={preview.id} className="border-t border-border px-3 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{COMMAND_LABELS[preview.commandName]}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {preview.expired && preview.status === "PREVIEWED"
                      ? "已过期"
                      : COMMAND_STATUS_LABELS[preview.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{terminalText(preview)}</p>
              </div>
              {canConfirm && (
                <Button
                  type="button"
                  size="sm"
                  className="min-h-10"
                  disabled={pending}
                  onClick={() => onConfirm(preview.id)}
                >
                  {pending ? (
                    <LoaderCircle aria-hidden="true" className="animate-spin" />
                  ) : (
                    <CheckCircle2 aria-hidden="true" />
                  )}
                  确认执行
                </Button>
              )}
            </div>
            <dl className="mt-3 space-y-2">
              {preview.humanDiff.map((row) => (
                <div key={`${preview.id}-${row.label}`} className="grid gap-1 text-xs sm:grid-cols-[7rem_1fr]">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="min-w-0 [overflow-wrap:anywhere]">
                    <span className="text-muted-foreground">{row.before ?? "空"}</span>
                    <span className="mx-2 text-muted-foreground">→</span>
                    <span>{row.after ?? "空"}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </article>
        );
      })}
    </section>
  );
}

function safeApplicationUrl(url: string | null): string | null {
  return url?.startsWith("/app/") ? url : null;
}

function evidenceAgeLabel(days: number | null): string {
  if (days === null) return "证据缺失";
  if (days === 0) return "今天";
  return `${days} 天前`;
}

function signalSeverityLabel(signal: PrivateBriefSignal): string {
  return signal.severity === "risk" ? "风险" : "关注";
}

export type MemoryCandidateDraftReview = Readonly<{
  claim: string;
  rationale: string;
  sourceRefs: readonly MemoryCandidateSourceRef[];
}>;

export function memoryCandidateDraftFromSignal(
  signal: PrivateBriefSignal,
): MemoryCandidateDraftReview | null {
  const sourceRefs = signal.sources
    .filter((source) => safeApplicationUrl(source.applicationUrl))
    .map((source) => ({
      type: source.type,
      id: source.id,
      label: source.label,
      applicationUrl: source.applicationUrl as string,
      observedAt: source.observedAt,
    } satisfies MemoryCandidateSourceRef));
  if (sourceRefs.length === 0) return null;
  return Object.freeze({
    claim: signal.title,
    rationale: signal.reason,
    sourceRefs: Object.freeze(sourceRefs),
  });
}

const MEMORY_CANDIDATE_STATUS_LABELS: Record<MemoryCandidate["status"], string> = {
  DRAFT: "草稿",
  SUBMITTED: "已提交",
  CONFIRMED: "已确认",
  REJECTED: "已拒绝",
  SUPERSEDED: "已替代",
};

function MemoryCandidateDraftEditor({
  draft,
  submitted,
  pending,
  failure,
  onChange,
  onCancel,
  onSubmit,
}: {
  draft: MemoryCandidateDraftReview | null;
  submitted: MemoryCandidate | null;
  pending: boolean;
  failure: ClientFailure | null;
  onChange: (draft: MemoryCandidateDraftReview) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  if (!draft && !submitted) return null;
  return (
    <section className="mb-4 border-y border-emerald-700/25 bg-emerald-500/[0.04] p-3" aria-label="候选记忆草稿">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium">候选记忆</h3>
            <span className="rounded-full bg-background px-2 py-0.5 text-[11px] text-moss">
              {submitted ? MEMORY_CANDIDATE_STATUS_LABELS[submitted.status] : "提交前仅你可见"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {submitted
              ? `来源权威：${submitted.authorityRoute.label}`
              : "提交后才会进入来源权威审核，不会直接成为已确认事实。"}
          </p>
        </div>
        {!submitted && (
          <Button type="button" size="xs" className="min-h-10" variant="ghost" disabled={pending} onClick={onCancel}>
            取消
          </Button>
        )}
      </div>

      {submitted ? (
        <div className="mt-3 space-y-2 text-xs">
          <p className="font-medium [overflow-wrap:anywhere]">{submitted.claim}</p>
          <p className="text-muted-foreground [overflow-wrap:anywhere]">{submitted.rationale}</p>
          <a
            href={submitted.authorityRoute.applicationUrl}
            className="inline-flex min-h-10 items-center gap-1 text-moss hover:underline"
          >
            打开审核入口
            <ExternalLink aria-hidden="true" className="h-3 w-3" />
          </a>
        </div>
      ) : draft && (
        <div className="mt-3 space-y-3">
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="memory-candidate-claim">
            候选事实
          </label>
          <Textarea
            id="memory-candidate-claim"
            value={draft.claim}
            disabled={pending}
            maxLength={600}
            rows={2}
            onChange={(event) => onChange({ ...draft, claim: event.target.value })}
            className="min-h-16 resize-none bg-background"
          />
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="memory-candidate-rationale">
            提交理由
          </label>
          <Textarea
            id="memory-candidate-rationale"
            value={draft.rationale}
            disabled={pending}
            maxLength={1200}
            rows={3}
            onChange={(event) => onChange({ ...draft, rationale: event.target.value })}
            className="min-h-20 resize-none bg-background"
          />
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">来源</p>
            {draft.sourceRefs.map((source) => (
              <a
                key={`${source.type}-${source.label}`}
                href={source.applicationUrl}
                className="mr-2 inline-flex min-h-10 max-w-full items-center gap-1 border-b border-border px-2 text-xs text-moss hover:bg-muted"
              >
                <span className="truncate">{source.label}</span>
                <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" />
              </a>
            ))}
          </div>
          {failure && (
            <div className="rounded-input bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {failure.message}
            </div>
          )}
          <Button
            type="button"
            size="sm"
            className="min-h-10"
            disabled={pending || !draft.claim.trim() || !draft.rationale.trim()}
            onClick={onSubmit}
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <FileCheck2 aria-hidden="true" />
            )}
            提交候选记忆
          </Button>
        </div>
      )}
    </section>
  );
}

function MemoryCandidateReviewCards({
  candidates,
  pending,
  failure,
  onConfirm,
  onReject,
  onRetry,
}: {
  candidates: readonly MemoryCandidate[];
  pending: boolean;
  failure: ClientFailure | null;
  onConfirm: (candidateId: string) => void;
  onReject: (candidateId: string) => void;
  onRetry: () => void;
}) {
  if (!pending && !failure && candidates.length === 0) return null;
  return (
    <section className="mb-4 border-y border-border bg-background py-3 text-left" aria-label="候选记忆审核">
      <div className="px-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">候选记忆审核</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            仅显示你基于来源流程有权审核的候选，不代表组织大脑已确认这些内容。
          </p>
        </div>
        {pending && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="h-3 w-3 animate-spin" />
            正在同步
          </span>
        )}
      </div>
      {failure && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-input bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <span>{failure.message}</span>
          <Button type="button" size="xs" className="min-h-10" variant="ghost" onClick={onRetry}>
            重试
          </Button>
        </div>
      )}
      </div>
      {candidates.length > 0 && (
        <div className="mt-3 divide-y divide-border border-t border-border">
          {candidates.map((candidate) => (
            <article key={candidate.id} className="bg-muted/15 px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                      {MEMORY_CANDIDATE_STATUS_LABELS[candidate.status]}
                    </span>
                    <span className="text-xs text-moss">{candidate.authorityRoute.label}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium [overflow-wrap:anywhere]">{candidate.claim}</p>
                  <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                    {candidate.rationale}
                  </p>
                </div>
                {candidate.status === "SUBMITTED" && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      size="xs"
                      className="min-h-10"
                      disabled={pending}
                      onClick={() => onConfirm(candidate.id)}
                      aria-label={`确认候选记忆：${candidate.claim}`}
                    >
                      <CheckCircle2 aria-hidden="true" />
                      确认
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      className="min-h-10"
                      variant="outline"
                      disabled={pending}
                      onClick={() => onReject(candidate.id)}
                      aria-label={`拒绝候选记忆：${candidate.claim}`}
                    >
                      <AlertCircle aria-hidden="true" />
                      拒绝
                    </Button>
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={candidate.authorityRoute.applicationUrl}
                  className="inline-flex min-h-10 items-center gap-1 border-b border-border px-2 text-xs text-moss hover:bg-muted"
                >
                  打开来源流程
                  <ExternalLink aria-hidden="true" className="h-3 w-3" />
                </a>
                {candidate.sourceRefs.map((source) => (
                  <a
                    key={`${source.type}-${source.id}`}
                    href={source.applicationUrl}
                    className="inline-flex min-h-10 max-w-full items-center gap-1 border-b border-border px-2 text-xs text-muted-foreground hover:bg-muted"
                  >
                    <span className="truncate">{source.label}</span>
                    <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" />
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function PrivateBriefPanel({
  brief,
  pending,
  failure,
  onRetry,
  onStartMemoryCandidate,
}: {
  brief: PrivateBrief | null;
  pending: boolean;
  failure: ClientFailure | null;
  onRetry?: () => void;
  onStartMemoryCandidate?: (draft: MemoryCandidateDraftReview) => void;
}) {
  const signals = brief?.signals ?? [];
  return (
    <section
      aria-label="私人简报"
      className="mb-4 w-full border-y border-border bg-cyan-500/[0.025] py-3 text-left"
    >
      <div className="px-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium">私人简报</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-[var(--brain-success)]">
              <ShieldCheck aria-hidden="true" className="h-3 w-3" />
              仅你可见
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {brief ? `最近 ${brief.windowDays} 天 · ${signals.length} 条信号` : "正在读取授权信号"}
          </p>
        </div>
        {pending && (
          <LoaderCircle
            aria-label="正在加载私人简报"
            className="h-4 w-4 animate-spin text-muted-foreground"
          />
        )}
      </div>

      {failure ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-input bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <span className="inline-flex min-w-0 items-center gap-2">
            <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
            {failure.message}
          </span>
          {onRetry && (
            <Button type="button" size="xs" className="min-h-10" variant="ghost" disabled={pending} onClick={onRetry}>
              <RotateCcw aria-hidden="true" />
              重试
            </Button>
          )}
        </div>
      ) : signals.length === 0 ? (
        <div className="mt-3 flex min-h-10 items-center gap-2 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Inbox aria-hidden="true" className="h-4 w-4 shrink-0" />
          暂无需要处理的私人信号
        </div>
      ) : (
        <div className="mt-3 divide-y divide-border border-t border-border">
          {signals.map((signal) => {
            const actionUrl = safeApplicationUrl(signal.action.applicationUrl);
            const memoryCandidateDraft = memoryCandidateDraftFromSignal(signal);
            return (
              <article key={signal.dedupeKey} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    signal.severity === "risk"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-moss-pale text-moss",
                  )}>
                    {signalSeverityLabel(signal)}
                  </span>
                  <h4 className="min-w-0 flex-1 text-sm font-medium [overflow-wrap:anywhere]">
                    {signal.title}
                  </h4>
                  <span className="text-[11px] text-muted-foreground">
                    {evidenceAgeLabel(signal.evidenceAgeDays)}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                  {signal.reason}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {signal.sources.map((source) => {
                    const sourceUrl = safeApplicationUrl(source.applicationUrl);
                    return sourceUrl ? (
                      <a
                        key={`${signal.dedupeKey}-${source.label}`}
                        href={sourceUrl}
                        className="inline-flex min-h-10 min-w-0 items-center gap-1 border-b border-border px-2 text-xs text-moss hover:bg-muted"
                      >
                        <span className="max-w-40 truncate">{source.label}</span>
                        <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" />
                      </a>
                    ) : null;
                  })}
                  {actionUrl && (
                    <a
                      href={actionUrl}
                      className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-moss px-3 text-xs font-medium text-white hover:bg-moss/90"
                    >
                      {signal.action.label}
                      <ExternalLink aria-hidden="true" className="h-3 w-3" />
                    </a>
                  )}
                  {memoryCandidateDraft && onStartMemoryCandidate && (
                    <Button
                      type="button"
                      size="xs"
                      className="min-h-10"
                      variant="outline"
                      disabled={pending}
                      onClick={() => onStartMemoryCandidate(memoryCandidateDraft)}
                    >
                      <FileCheck2 aria-hidden="true" />
                      作为候选记忆提交
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {brief?.truncated && (
        <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
          只显示优先级最高的部分信号。
        </p>
      )}
      </div>
    </section>
  );
}

export function BrainUserMessage({ content }: { content: string }) {
  return (
    <div className="ml-auto min-w-0 max-w-[88%] [overflow-wrap:anywhere] rounded-card bg-muted px-3 py-2 text-sm leading-6">
      {content}
    </div>
  );
}

function GovernanceProposalComposer({
  context,
  conversationId,
  onCreated,
}: {
  context: GovernanceProposalContext | null;
  conversationId: string | null;
  onCreated: () => void;
}) {
  const [tensionId, setTensionId] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [currentStructure, setCurrentStructure] = useState("");
  const [proposedStructure, setProposedStructure] = useState("");
  const [rationale, setRationale] = useState("");
  const [expectedImpact, setExpectedImpact] = useState("");
  const [circleId, setCircleId] = useState("");
  const [roleName, setRoleName] = useState("");
  const [rolePurpose, setRolePurpose] = useState("");
  const [roleAccountabilities, setRoleAccountabilities] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!context || !conversationId || !context.latestUserMessageId) return null;
  const activeContext = context;
  const activeConversationId = conversationId;
  const activeUserMessageId = context.latestUserMessageId;
  const selectedCircleId = circleId || activeContext.circles[0]?.id || "";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const structuralChange = { schemaVersion: 1, operation: "ROLE_CREATED", ownershipType: "HOME", circleId: selectedCircleId, name: roleName, purpose: rolePurpose, domain: null, accountabilities: roleAccountabilities, category: "EXPERT" };
    const result = await brainActions.createGovernanceProposalPreview({ conversationId: activeConversationId, userMessageId: activeUserMessageId, tensionId, meetingId, currentStructure, proposedStructure, rationale, expectedImpact, structuralChange });
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setMessage("治理提案已生成待确认预览。");
    onCreated();
  }

  return (
    <section className="border-y border-border bg-amber-500/[0.04] px-3 py-3 sm:px-5" aria-labelledby="brain-governance-composer-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 id="brain-governance-composer-heading" className="text-sm font-semibold">起草治理提案</h3>
          <p className="mt-1 text-xs text-muted-foreground">由张力提出者起草，提交后进入治理会审核。</p>
        </div>
        <span className="text-xs text-muted-foreground">需确认</span>
      </div>
      <form onSubmit={submit} className="grid gap-2 sm:grid-cols-2">
        <select aria-label="选择张力" value={tensionId} onChange={(event) => setTensionId(event.target.value)} required className="min-h-10 rounded-md border border-border bg-background px-2 text-sm">
          <option value="">选择我的开放治理张力</option>
          {activeContext.tensions.map((tension) => <option key={tension.id} value={tension.id}>{tension.title}</option>)}
        </select>
        <select aria-label="选择治理会议" value={meetingId} onChange={(event) => setMeetingId(event.target.value)} required className="min-h-10 rounded-md border border-border bg-background px-2 text-sm">
          <option value="">选择治理会议</option>
          {activeContext.meetings.map((meeting) => <option key={meeting.id} value={meeting.id}>{meeting.title}</option>)}
        </select>
        <Textarea aria-label="当前结构" value={currentStructure} onChange={(event) => setCurrentStructure(event.target.value)} required placeholder="当前结构" rows={2} className="bg-background sm:col-span-2" />
        <Textarea aria-label="提议结构" value={proposedStructure} onChange={(event) => setProposedStructure(event.target.value)} required placeholder="提议结构" rows={2} className="bg-background sm:col-span-2" />
        <Textarea aria-label="提案理由" value={rationale} onChange={(event) => setRationale(event.target.value)} required placeholder="为什么现在需要改变？" rows={2} className="bg-background" />
        <Textarea aria-label="预期影响" value={expectedImpact} onChange={(event) => setExpectedImpact(event.target.value)} required placeholder="预期影响与可逆性" rows={2} className="bg-background" />
        <select aria-label="拟创建角色所属回路" value={selectedCircleId} onChange={(event) => setCircleId(event.target.value)} required className="min-h-10 rounded-md border border-border bg-background px-2 text-sm">
          {activeContext.circles.map((circle) => <option key={circle.id} value={circle.id}>{circle.name}</option>)}
        </select>
        <Input aria-label="拟创建角色名称" value={roleName} onChange={(event) => setRoleName(event.target.value)} required placeholder="拟创建角色名称" className="bg-background" />
        <Input aria-label="角色目的" value={rolePurpose} onChange={(event) => setRolePurpose(event.target.value)} required placeholder="角色目的" className="bg-background" />
        <Textarea aria-label="角色职责" value={roleAccountabilities} onChange={(event) => setRoleAccountabilities(event.target.value)} required placeholder="角色职责，一行一项" rows={3} className="bg-background sm:col-span-2" />
        <div className="flex items-center justify-between gap-3 sm:col-span-2">
          <span className="text-xs text-muted-foreground" aria-live="polite">{message ?? ""}</span>
          <Button type="submit" size="sm" disabled={pending || activeContext.tensions.length === 0 || activeContext.meetings.length === 0 || activeContext.circles.length === 0}>{pending ? "生成中…" : "生成治理预览"}</Button>
        </div>
      </form>
    </section>
  );
}

function RoleApplicationComposer({
  context,
  conversationId,
  onCreated,
}: {
  context: RoleApplicationContext | null;
  conversationId: string | null;
  onCreated: () => void;
}) {
  const [roleId, setRoleId] = useState("");
  const [motivation, setMotivation] = useState("");
  const [capabilitySummary, setCapabilitySummary] = useState("");
  const [commitment, setCommitment] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!context || !conversationId || !context.latestUserMessageId) return null;
  const activeContext = context;
  const activeConversationId = conversationId;
  const activeUserMessageId = context.latestUserMessageId;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const result = await brainActions.createRoleApplicationPreview({ conversationId: activeConversationId, userMessageId: activeUserMessageId, roleId, motivation, capabilitySummary, commitment });
    setPending(false);
    if (!result.ok) { setMessage(result.message); return; }
    setMessage("角色申请已生成待确认预览。");
    onCreated();
  }
  return (
    <section className="border-y border-border bg-cyan-500/[0.04] px-3 py-3 sm:px-5" aria-labelledby="brain-role-application-heading">
      <div className="mb-3 flex items-center justify-between gap-3"><div><h3 id="brain-role-application-heading" className="text-sm font-semibold">申请承担角色</h3><p className="mt-1 text-xs text-muted-foreground">组织大脑只提交申请，不会自动任命。</p></div><span className="text-xs text-muted-foreground">需确认</span></div>
      <form onSubmit={submit} className="grid gap-2 sm:grid-cols-2">
        <select aria-label="选择空缺角色" value={roleId} onChange={(event) => setRoleId(event.target.value)} required className="min-h-10 rounded-md border border-border bg-background px-2 text-sm sm:col-span-2"><option value="">选择空缺角色</option>{activeContext.roles.map((role) => <option key={role.id} value={role.id}>{role.name} · {role.circleName}</option>)}</select>
        <Textarea aria-label="申请动机" value={motivation} onChange={(event) => setMotivation(event.target.value)} required placeholder="申请动机" rows={2} className="bg-background" />
        <Textarea aria-label="相关能力" value={capabilitySummary} onChange={(event) => setCapabilitySummary(event.target.value)} required placeholder="相关能力" rows={2} className="bg-background" />
        <Textarea aria-label="投入承诺" value={commitment} onChange={(event) => setCommitment(event.target.value)} required placeholder="投入承诺" rows={2} className="bg-background sm:col-span-2" />
        <div className="flex items-center justify-between gap-3 sm:col-span-2"><span className="text-xs text-muted-foreground" aria-live="polite">{message ?? ""}</span><Button type="submit" size="sm" disabled={pending || activeContext.roles.length === 0}>{pending ? "生成中…" : "生成申请预览"}</Button></div>
      </form>
    </section>
  );
}

function TensionRaiseComposer({ context, conversationId, onCreated }: { context: TensionRaiseContext | null; conversationId: string | null; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [circleId, setCircleId] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!context || !conversationId || !context.latestUserMessageId) return null;
  const activeConversationId = conversationId;
  const activeUserMessageId = context.latestUserMessageId;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage(null);
    const result = await brainActions.createTensionRaisePreview({ conversationId: activeConversationId, userMessageId: activeUserMessageId, title, description, type: "PROBLEMATIC", circleIds: [circleId], handlingMode: "UNROUTED" });
    setPending(false); if (!result.ok) { setMessage(result.message); return; }
    setMessage("张力已生成待确认预览。"); onCreated();
  }
  return <section className="border-y border-border bg-amber-500/[0.04] px-3 py-3 sm:px-5" aria-labelledby="brain-tension-composer-heading">
    <div className="mb-3"><h3 id="brain-tension-composer-heading" className="text-sm font-semibold">提出张力</h3><p className="mt-1 text-xs text-muted-foreground">组织大脑只起草，确认后才会进入组织记录。</p></div>
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-2">
      <select aria-label="选择所属回路" value={circleId} onChange={(event) => setCircleId(event.target.value)} required className="min-h-10 rounded-md border border-border bg-background px-2 text-sm"><option value="">选择所属回路</option>{context.circles.map((circle) => <option key={circle.id} value={circle.id}>{circle.name}</option>)}</select>
      <Textarea aria-label="张力标题" value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="张力标题" rows={1} className="bg-background" />
      <Textarea aria-label="张力描述" value={description} onChange={(event) => setDescription(event.target.value)} required placeholder="发生了什么？" rows={2} className="bg-background sm:col-span-2" />
      <div className="flex items-center justify-between gap-3 sm:col-span-2"><span className="text-xs text-muted-foreground" aria-live="polite">{message ?? ""}</span><Button type="submit" size="sm" disabled={pending || context.circles.length === 0}>{pending ? "生成中…" : "生成张力预览"}</Button></div>
    </form>
  </section>;
}

function TacticalOutcomeComposer({ context, conversationId, onCreated }: { context: TacticalOutcomeContext | null; conversationId: string | null; onCreated: () => void }) {
  const [tensionId, setTensionId] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [kind, setKind] = useState<"PROJECT" | "ACTION">("ACTION");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [circleId, setCircleId] = useState("");
  const [responsiblePersonId, setResponsiblePersonId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!context || !conversationId || !context.latestUserMessageId) return null;
  const activeContext = context;
  const activeConversationId = conversationId;
  const activeUserMessageId = context.latestUserMessageId;
  const tension = activeContext.tensions.find((item) => item.id === tensionId);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tension) return;
    setPending(true); setMessage(null);
    const result = await brainActions.createTacticalOutcomePreview({ conversationId: activeConversationId, userMessageId: activeUserMessageId, tensionId, meetingId, expectedRevision: tension.revision, kind, title, description, circleId, responsiblePersonId, dueDate: dueDate || undefined });
    setPending(false);
    if (!result.ok) { setMessage(result.message); return; }
    setMessage("战术结果已生成待确认预览。"); onCreated();
  }
  return <section className="border-y border-border bg-moss/5 px-3 py-3 sm:px-5" aria-labelledby="brain-tactical-outcome-heading">
    <div className="mb-3"><h3 id="brain-tactical-outcome-heading" className="text-sm font-semibold">准备战术结果</h3><p className="mt-1 text-xs text-muted-foreground">把张力转成 Project 或 Action，确认后进入战术会议流程。</p></div>
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-2">
      <select aria-label="选择战术张力" value={tensionId} onChange={(event) => setTensionId(event.target.value)} required className="min-h-10 rounded-md border border-border bg-background px-2 text-sm"><option value="">选择我的开放战术张力</option>{activeContext.tensions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
      <select aria-label="选择战术会议" value={meetingId} onChange={(event) => setMeetingId(event.target.value)} required className="min-h-10 rounded-md border border-border bg-background px-2 text-sm"><option value="">选择战术会议</option>{activeContext.meetings.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
      <select aria-label="结果类型" value={kind} onChange={(event) => setKind(event.target.value as "PROJECT" | "ACTION")} className="min-h-10 rounded-md border border-border bg-background px-2 text-sm"><option value="ACTION">行动</option><option value="PROJECT">项目</option></select>
      <input aria-label="结果标题" value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="结果标题" className="min-h-10 rounded-md border border-border bg-background px-3 text-sm" />
      <Textarea aria-label="预期结果或验收标准" value={description} onChange={(event) => setDescription(event.target.value)} required placeholder={kind === "PROJECT" ? "项目预期结果" : "行动验收标准"} rows={2} className="bg-background sm:col-span-2" />
      <select aria-label="归属回路" value={circleId} onChange={(event) => setCircleId(event.target.value)} required className="min-h-10 rounded-md border border-border bg-background px-2 text-sm"><option value="">选择归属回路</option>{activeContext.circles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <select aria-label="负责人" value={responsiblePersonId} onChange={(event) => setResponsiblePersonId(event.target.value)} required className="min-h-10 rounded-md border border-border bg-background px-2 text-sm"><option value="">选择负责人</option>{activeContext.people.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      {kind === "ACTION" && <input aria-label="截止日期" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="min-h-10 rounded-md border border-border bg-background px-3 text-sm" />}
      <div className="flex items-center justify-between gap-3 sm:col-span-2"><span className="text-xs text-muted-foreground" aria-live="polite">{message ?? ""}</span><Button type="submit" size="sm" disabled={pending || activeContext.tensions.length === 0 || activeContext.meetings.length === 0}>{pending ? "生成中…" : "生成战术预览"}</Button></div>
    </form>
  </section>;
}

export function BrainClient({
  mode,
  className,
}: {
  mode: "panel" | "workspace";
  className?: string;
}) {
  const { memory: requestMemory, state: sharedRequest } = useBrainRequestMemory();
  const [conversations, setConversations] = useState<readonly OrganizationBrainConversationSummary[]>([]);
  const [detail, setDetail] = useState<OrganizationBrainConversationDetail | null>(null);
  const [commandPreviews, setCommandPreviews] = useState<readonly BrainCommandPreviewSummary[]>([]);
  const [governanceContext, setGovernanceContext] = useState<GovernanceProposalContext | null>(null);
  const [roleApplicationContext, setRoleApplicationContext] = useState<RoleApplicationContext | null>(null);
  const [tensionRaiseContext, setTensionRaiseContext] = useState<TensionRaiseContext | null>(null);
  const [tacticalOutcomeContext, setTacticalOutcomeContext] = useState<TacticalOutcomeContext | null>(null);
  const [privateBrief, setPrivateBrief] = useState<PrivateBrief | null>(null);
  const [privateBriefPending, setPrivateBriefPending] = useState(false);
  const [privateBriefFailure, setPrivateBriefFailure] = useState<ClientFailure | null>(null);
  const [memoryCandidateDraft, setMemoryCandidateDraft] = useState<MemoryCandidateDraftReview | null>(null);
  const [submittedMemoryCandidate, setSubmittedMemoryCandidate] = useState<MemoryCandidate | null>(null);
  const [memoryCandidatePending, setMemoryCandidatePending] = useState(false);
  const [memoryCandidateFailure, setMemoryCandidateFailure] = useState<ClientFailure | null>(null);
  const [reviewableMemoryCandidates, setReviewableMemoryCandidates] =
    useState<readonly MemoryCandidate[]>([]);
  const [memoryCandidateReviewPending, setMemoryCandidateReviewPending] = useState(false);
  const [memoryCandidateReviewFailure, setMemoryCandidateReviewFailure] = useState<ClientFailure | null>(null);
  const [localQuestion, setLocalQuestion] = useState("");
  const [localFailure, setLocalFailure] = useState<ClientFailure | null>(null);
  const [localRetryTarget, setLocalRetryTarget] = useState<RetryTarget | null>(null);
  const [activity, setActivity] = useState("正在加载对话…");
  const [focusRequestId, setFocusRequestId] = useState(0);
  const [transitionPending, startTransition] = useTransition();
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const restoredFocusRequestIdRef = useRef(0);
  const currentConversationIdRef = useRef<string | null>(null);
  const conversationRequestVersionRef = useRef(0);
  const pending = transitionPending || sharedRequest.operation !== null;
  const failure = localFailure ?? sharedRequest.failure;
  const retryTarget = localRetryTarget ??
    (sharedRequest.retry ? { kind: sharedRequest.retry } : null);
  const question = sharedRequest.pendingTurn?.question ?? localQuestion;
  const anyPending = pending || memoryCandidatePending || memoryCandidateReviewPending;

  const loadPrivateBrief = useCallback(async () => {
    setPrivateBriefPending(true);
    setPrivateBriefFailure(null);
    const result = await brainActions.loadBrief({ windowDays: 7, maxSignals: 6 });
    setPrivateBriefPending(false);
    if (!result.ok) {
      setPrivateBrief(null);
      setPrivateBriefFailure(result);
      return false;
    }
    setPrivateBrief(result.data);
    return true;
  }, []);

  const loadReviewableMemoryCandidates = useCallback(async () => {
    setMemoryCandidateReviewPending(true);
    setMemoryCandidateReviewFailure(null);
    const result = await brainActions.listReviewableMemoryCandidates({ limit: 12 });
    setMemoryCandidateReviewPending(false);
    if (!result.ok) {
      setReviewableMemoryCandidates([]);
      setMemoryCandidateReviewFailure(result);
      return false;
    }
    setReviewableMemoryCandidates(result.data);
    return true;
  }, []);

  const loadCommandPreviews = useCallback(async (conversationId: string) => {
    const result = await brainActions.listPreviews({ conversationId, limit: 12 });
    if (!result.ok) {
      setCommandPreviews([]);
      if (result.code === "TEMPORARY_FAILURE") setLocalFailure(result);
      return false;
    }
    setCommandPreviews(result.data.previews);
    return true;
  }, []);

  const loadGovernanceContext = useCallback(async () => {
    const result = await brainActions.loadGovernanceProposalContext();
    if (result.ok) setGovernanceContext(result.data);
    return result.ok;
  }, []);

  const loadRoleApplicationContext = useCallback(async () => {
    const result = await brainActions.loadRoleApplicationContext();
    setRoleApplicationContext(result.ok ? result.data : null);
    return result.ok;
  }, []);

  const loadTensionRaiseContext = useCallback(async () => {
    const result = await brainActions.loadTensionRaiseContext();
    setTensionRaiseContext(result.ok ? result.data : null);
    return result.ok;
  }, []);

  const loadTacticalOutcomeContext = useCallback(async () => {
    const result = await brainActions.loadTacticalOutcomeContext();
    setTacticalOutcomeContext(result.ok ? result.data : null);
    return result.ok;
  }, []);

  const loadSelected = useCallback(async (conversationId: string) => {
    const requestVersion = conversationRequestVersionRef.current + 1;
    conversationRequestVersionRef.current = requestVersion;
    setLocalFailure(null);
    setLocalRetryTarget(null);
    setActivity("正在加载对话…");
    const result = await brainActions.load({ conversationId, messageLimit: 30 });
    if (requestVersion !== conversationRequestVersionRef.current) {
      return false;
    }
    if (!result.ok) {
      setLocalFailure(result);
      if (result.code === "TEMPORARY_FAILURE") {
        setLocalRetryTarget({ kind: "load", conversationId });
      }
      setActivity(result.message);
      return false;
    }
    currentConversationIdRef.current = conversationId;
    setDetail(result.data);
    await loadCommandPreviews(conversationId);
    if (requestVersion !== conversationRequestVersionRef.current) {
      return false;
    }
    await loadGovernanceContext();
    await loadRoleApplicationContext();
    await loadTensionRaiseContext();
    await loadTacticalOutcomeContext();
    if (requestVersion !== conversationRequestVersionRef.current) {
      return false;
    }
    setActivity("对话已加载");
    return true;
  }, [loadCommandPreviews, loadGovernanceContext, loadRoleApplicationContext, loadTensionRaiseContext, loadTacticalOutcomeContext]);

  const refreshList = useCallback(async (preferredConversationId?: string) => {
    setLocalFailure(null);
    setLocalRetryTarget(null);
    const result = await brainActions.list({ limit: 20 });
    if (!result.ok) {
      setLocalFailure(result);
      if (result.code === "TEMPORARY_FAILURE") {
        setLocalRetryTarget({ kind: "list" });
      }
      setActivity(result.message);
      return;
    }
    setConversations(result.data.conversations);
    const target =
      preferredConversationId ??
      currentConversationIdRef.current ??
      result.data.conversations[0]?.id;
    if (target) {
      await loadSelected(target);
    } else {
      currentConversationIdRef.current = null;
      setDetail(null);
      setCommandPreviews([]);
      setActivity("还没有对话");
    }
  }, [loadSelected]);

  useEffect(() => {
    void Promise.resolve().then(() => refreshList());
    void Promise.resolve().then(() => loadPrivateBrief());
    void Promise.resolve().then(() => loadReviewableMemoryCandidates());
  }, [loadPrivateBrief, loadReviewableMemoryCandidates, refreshList]);

  useEffect(() => {
    restoredFocusRequestIdRef.current = restoreQuestionFocus({
      pending,
      requestId: focusRequestId,
      restoredRequestId: restoredFocusRequestIdRef.current,
      control: questionRef.current,
    });
  }, [focusRequestId, pending]);

  const requestQuestionFocus = useCallback(() => {
    setFocusRequestId((current) => current + 1);
  }, []);

  async function createConversation(
    explicitNew: boolean,
    failureTarget: "create" | "submit" = "create",
  ) {
    if (explicitNew) {
      conversationRequestVersionRef.current += 1;
      currentConversationIdRef.current = null;
      setDetail(null);
      setCommandPreviews([]);
      requestMemory.update(() => initialBrainRequestState());
      setLocalQuestion("");
    }
    const clientConversationId =
      requestMemory.getSnapshot().pendingConversationId ?? crypto.randomUUID();
    requestMemory.update((current) => ({
      ...current,
      pendingConversationId: clientConversationId,
      operation: "create",
      retry: null,
      failure: null,
    }));
    setLocalFailure(null);
    setLocalRetryTarget(null);
    setActivity("正在创建私人对话…");
    const result = await brainActions.create({ clientConversationId });
    if (!result.ok) {
      if (result.code === "TEMPORARY_FAILURE") {
        requestMemory.update((current) =>
          markBrainRequestTemporaryFailure(current, failureTarget),
        );
      } else {
        requestMemory.update((current) => ({
          ...current,
          pendingConversationId: null,
          pendingTurn: failureTarget === "submit" ? null : current.pendingTurn,
          operation: null,
          retry: null,
          failure: null,
        }));
        setLocalFailure(result);
      }
      setActivity(result.message);
      return null;
    }
    requestMemory.update((current) => ({
      ...current,
      pendingConversationId: null,
      operation: null,
      retry: null,
      failure: null,
    }));
    currentConversationIdRef.current = result.data.id;
    setConversations((current) => [
      result.data,
      ...current.filter((item) => item.id !== result.data.id),
    ]);
    setDetail({
      schemaVersion: 1,
      conversation: result.data,
      messages: [],
      hasMore: false,
    });
    setCommandPreviews([]);
    setActivity("新对话已建立");
    return result.data;
  }

  async function submitQuestion() {
    const normalizedQuestion = question.trim();
    if (!normalizedQuestion) {
      setLocalFailure({
        ok: false,
        code: "INVALID_INPUT",
        message: "请求内容不符合要求。",
      });
      setActivity("请输入问题");
      return;
    }

    const existingTurn = requestMemory.getSnapshot().pendingTurn;
    const reusesPendingTurn = existingTurn?.question === normalizedQuestion;
    let turn =
      reusesPendingTurn
        ? existingTurn
        : {
            conversationId: currentConversationIdRef.current,
            clientTurnId: crypto.randomUUID(),
            question: normalizedQuestion,
          };
    requestMemory.update((current) => ({
      ...current,
      pendingConversationId: reusesPendingTurn
        ? current.pendingConversationId
        : null,
      pendingTurn: turn,
      retry: null,
      failure: null,
    }));

    setLocalFailure(null);
    setLocalRetryTarget(null);
    setActivity("组织大脑正在处理…");
    let conversationId = turn.conversationId ?? currentConversationIdRef.current;
    if (!conversationId) {
      const created = await createConversation(false, "submit");
      if (!created) {
        return;
      }
      conversationId = created.id;
      turn = { ...turn, conversationId };
      requestMemory.update((current) => ({
        ...current,
        pendingTurn: turn,
      }));
    }

    requestMemory.update((current) => ({
      ...current,
      pendingTurn: turn,
      operation: "submit",
      retry: null,
      failure: null,
    }));
    const result = await brainActions.submit({
      conversationId,
      clientTurnId: turn.clientTurnId,
      question: turn.question,
    });
    if (!result.ok) {
      setActivity(result.message);
      if (result.code === "TEMPORARY_FAILURE") {
        requestMemory.update((current) =>
          markBrainRequestTemporaryFailure(current, "submit"),
        );
      } else {
        requestMemory.update((current) => ({
          ...current,
          pendingConversationId: null,
          pendingTurn: null,
          operation: null,
          retry: null,
          failure: null,
        }));
        setLocalFailure(result);
        if (result.code === "RETRY_CONFLICT") {
          setLocalRetryTarget({ kind: "submit" });
        }
      }
      return;
    }

    requestMemory.update(() => initialBrainRequestState());
    setLocalQuestion("");
    setActivity(`回答已保存：${STATUS_LABELS[result.data.result.status]}`);
    await refreshList(conversationId);
  }

  async function confirmPreview(previewId: string) {
    setLocalFailure(null);
    setLocalRetryTarget(null);
    setActivity("正在确认命令预览…");
    const result = await brainActions.confirmPreview({
      previewId,
      mutationKey: crypto.randomUUID(),
    });
    if (!result.ok) {
      setLocalFailure(result);
      setActivity(result.message);
      return;
    }
    if (!result.data.confirmation.ok) {
      setLocalFailure({
        ok: false,
        code: result.data.confirmation.error.code === "RETRY_CONFLICT"
          ? "RETRY_CONFLICT"
          : "TEMPORARY_FAILURE",
        message: result.data.confirmation.error.message,
      });
    }
    const conversationId = currentConversationIdRef.current;
    if (conversationId) await loadCommandPreviews(conversationId);
    setActivity(result.data.confirmation.ok ? "命令已确认执行" : "命令未执行");
  }

  async function submitMemoryCandidateDraft() {
    if (!memoryCandidateDraft) return;
    setMemoryCandidatePending(true);
    setMemoryCandidateFailure(null);
    setSubmittedMemoryCandidate(null);
    setActivity("正在提交候选记忆…");
    const result = await brainActions.submitMemoryCandidate({
      claim: memoryCandidateDraft.claim,
      rationale: memoryCandidateDraft.rationale,
      sourceRefs: memoryCandidateDraft.sourceRefs,
    });
    setMemoryCandidatePending(false);
    if (!result.ok) {
      setMemoryCandidateFailure(result);
      setActivity(result.message);
      return;
    }
    setMemoryCandidateDraft(null);
    setSubmittedMemoryCandidate(result.data);
    setActivity("候选记忆已提交，等待来源权威审核");
    await loadReviewableMemoryCandidates();
  }

  async function decideMemoryCandidate(candidateId: string, decision: "confirm" | "reject") {
    setMemoryCandidateReviewPending(true);
    setMemoryCandidateReviewFailure(null);
    setActivity(decision === "confirm" ? "正在确认候选记忆…" : "正在拒绝候选记忆…");
    const result = decision === "confirm"
      ? await brainActions.confirmMemoryCandidate({
          candidateId,
          reason: "Confirmed through source-authority review surface.",
        })
      : await brainActions.rejectMemoryCandidate({
          candidateId,
          reason: "Rejected through source-authority review surface.",
        });
    setMemoryCandidateReviewPending(false);
    if (!result.ok) {
      setMemoryCandidateReviewFailure(result);
      setActivity(result.message);
      return;
    }
    setActivity(decision === "confirm" ? "候选记忆已确认" : "候选记忆已拒绝");
    await loadReviewableMemoryCandidates();
  }

  function startMemoryCandidateDraft(draft: MemoryCandidateDraftReview) {
    setMemoryCandidateDraft(draft);
    setSubmittedMemoryCandidate(null);
    setMemoryCandidateFailure(null);
    setActivity("候选记忆草稿已准备");
  }

  function runSubmit() {
    startTransition(async () => {
      await submitQuestion();
      requestQuestionFocus();
    });
  }

  function runCreate() {
    startTransition(async () => {
      await createConversation(true);
      requestQuestionFocus();
    });
  }

  function runLoad(conversationId: string) {
    startTransition(async () => {
      await loadSelected(conversationId);
    });
  }

  function runRetry() {
    const target = retryTarget;
    if (!target) return;
    startTransition(async () => {
      if (target.kind === "list") await refreshList();
      if (target.kind === "load") await loadSelected(target.conversationId);
      if (target.kind === "create") await createConversation(false, "create");
      if (target.kind === "submit") await submitQuestion();
      requestQuestionFocus();
    });
  }

  function runConfirmPreview(previewId: string) {
    startTransition(async () => {
      await confirmPreview(previewId);
    });
  }

  function runPrivateBriefRetry() {
    startTransition(async () => {
      await loadPrivateBrief();
    });
  }

  function runReviewableMemoryCandidateRetry() {
    startTransition(async () => {
      await loadReviewableMemoryCandidates();
    });
  }

  function updateQuestion(nextQuestion: string) {
    const pendingTurn = requestMemory.getSnapshot().pendingTurn;
    if (pendingTurn && nextQuestion.trim() !== pendingTurn.question) {
      requestMemory.update(() => initialBrainRequestState());
    }
    setLocalQuestion(nextQuestion);
  }

  const conversationPicker = (
    <div className="flex min-w-0 items-center gap-2 border-b border-border bg-muted/15 p-3">
      <label className="sr-only" htmlFor={`brain-conversation-${mode}`}>
        选择对话
      </label>
      <select
        id={`brain-conversation-${mode}`}
        value={detail?.conversation.id ?? ""}
        disabled={pending || conversations.length === 0}
        onChange={(event) => runLoad(event.target.value)}
        className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {conversations.length === 0 && <option value="">暂无对话</option>}
        {conversations.map((conversation) => (
          <option key={conversation.id} value={conversation.id}>
            {conversationLabel(conversation)}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        className="min-h-10"
        variant="outline"
        disabled={pending}
        onClick={runCreate}
        aria-label="新建组织大脑对话"
      >
        <MessageSquarePlus aria-hidden="true" />
        <span className={cn(mode === "panel" && "sr-only sm:not-sr-only")}>新对话</span>
      </Button>
    </div>
  );

  const operationalPanels = (
    <>
      <PrivateBriefPanel
        brief={privateBrief}
        pending={privateBriefPending}
        failure={privateBriefFailure}
        onRetry={runPrivateBriefRetry}
        onStartMemoryCandidate={startMemoryCandidateDraft}
      />
      <MemoryCandidateDraftEditor
        draft={memoryCandidateDraft}
        submitted={submittedMemoryCandidate}
        pending={anyPending}
        failure={memoryCandidateFailure}
        onChange={setMemoryCandidateDraft}
        onCancel={() => {
          setMemoryCandidateDraft(null);
          setMemoryCandidateFailure(null);
        }}
        onSubmit={() => {
          startTransition(async () => {
            await submitMemoryCandidateDraft();
          });
        }}
      />
      <MemoryCandidateReviewCards
        candidates={reviewableMemoryCandidates}
        pending={memoryCandidateReviewPending}
        failure={memoryCandidateReviewFailure}
        onConfirm={(candidateId) => {
          startTransition(async () => {
            await decideMemoryCandidate(candidateId, "confirm");
          });
        }}
        onReject={(candidateId) => {
          startTransition(async () => {
            await decideMemoryCandidate(candidateId, "reject");
          });
        }}
        onRetry={runReviewableMemoryCandidateRetry}
      />
      <GovernanceProposalComposer
        context={governanceContext}
        conversationId={detail?.conversation.id ?? null}
        onCreated={() => {
          const id = detail?.conversation.id;
          if (id) void loadCommandPreviews(id);
        }}
      />
      <RoleApplicationComposer
        context={roleApplicationContext}
        conversationId={detail?.conversation.id ?? null}
        onCreated={() => {
          const id = detail?.conversation.id;
          if (id) void loadCommandPreviews(id);
        }}
      />
      <TensionRaiseComposer
        context={tensionRaiseContext}
        conversationId={detail?.conversation.id ?? null}
        onCreated={() => {
          const id = detail?.conversation.id;
          if (id) void loadCommandPreviews(id);
        }}
      />
      <TacticalOutcomeComposer
        context={tacticalOutcomeContext}
        conversationId={detail?.conversation.id ?? null}
        onCreated={() => {
          const id = detail?.conversation.id;
          if (id) void loadCommandPreviews(id);
        }}
      />
      <BrainCommandPreviewCards
        previews={commandPreviews}
        pending={pending}
        onConfirm={runConfirmPreview}
      />
    </>
  );

  const operationalPanelSurface = (
    <details className="border-b border-border bg-muted/10">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-medium marker:hidden sm:px-5">
        <span className="inline-flex min-w-0 items-center gap-2">
          <Activity className="size-4 text-moss" aria-hidden="true" />
          <span>感知与行动</span>
          <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
            简报、候选记忆和可确认草案
          </span>
        </span>
        <span className="text-xs font-normal text-muted-foreground">展开</span>
      </summary>
      <div className="max-h-[45vh] overflow-y-auto border-t border-border bg-background/80 py-3">
        {operationalPanels}
      </div>
    </details>
  );

  const conversationBody = (
    <div className="flex min-h-0 flex-1 flex-col">
      {operationalPanelSurface}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5" aria-busy={pending}>
        {!detail && pending ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
            <span>正在加载对话</span>
          </div>
        ) : detail?.messages.length ? (
          <div className="space-y-4">
            {detail.hasMore && (
              <p className="text-center text-xs text-muted-foreground">仅显示最近 30 条消息</p>
            )}
            {detail.messages.map((message) =>
              message.role === "USER" ? (
                <BrainUserMessage key={message.id} content={message.content} />
              ) : (
                <div key={message.id} className="max-w-full border-l-2 border-moss/30 pl-3">
                  <BrainAnswer result={message.result} />
                </div>
              ),
            )}
          </div>
        ) : (
          <div className="flex h-full min-h-32 flex-col sm:min-h-48">
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-4 text-center sm:py-8">
              <span className="flex size-10 items-center justify-center rounded-lg bg-foreground text-background">
                <BrainCircuit className="size-5" aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-semibold">向组织大脑提问</p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                它只会使用你有权访问的组织信息，并为可核验事实提供来源。
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link href="/app/tensions/new" className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted">提出张力</Link>
                <Link href="/app/meetings/new" className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted">准备会议</Link>
                <Link href="/app/roles/market" className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted">发现角色</Link>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border bg-background p-3 sm:p-4">
        {failure && (
          <div className="mb-3 flex min-h-10 items-center justify-between gap-3 border-l-2 border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <span className="min-w-0 break-words">{failure.message}</span>
            {retryTarget && (
              <Button type="button" size="xs" className="min-h-10" variant="ghost" disabled={pending} onClick={runRetry}>
                <RotateCcw aria-hidden="true" />
                重试
              </Button>
            )}
          </div>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            runSubmit();
          }}
          className="flex min-w-0 items-end gap-2"
        >
          <label htmlFor={`brain-question-${mode}`} className="sr-only">
            向组织大脑提问
          </label>
          <Textarea
            ref={questionRef}
            id={`brain-question-${mode}`}
            value={question}
            disabled={pending}
            maxLength={2048}
            rows={2}
            placeholder="询问角色、任职申请、回路、目标、张力、项目或会议…"
            onChange={(event) => updateQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                (event.metaKey || event.ctrlKey)
              ) {
                event.preventDefault();
                runSubmit();
              }
            }}
            className="max-h-32 min-h-16 min-w-0 resize-none bg-muted/15 [overflow-wrap:anywhere]"
          />
          <Button
            type="submit"
            size="icon-lg"
            className="size-10"
            disabled={pending || !question.trim()}
            aria-label="发送问题"
            title="发送问题"
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <Send aria-hidden="true" />
            )}
          </Button>
        </form>
        <div className="mt-2 flex min-h-5 items-center justify-between gap-3 text-xs text-muted-foreground" aria-live="polite">
          <span className="inline-flex min-w-0 items-center gap-1.5 break-words">
            {pending ? (
              <LoaderCircle aria-hidden="true" className="size-3.5 shrink-0 animate-spin text-[var(--brain-info)]" />
            ) : (
              <CircleDot aria-hidden="true" className="size-3.5 shrink-0 text-[var(--brain-success)]" />
            )}
            {activity}
          </span>
          <span className="hidden shrink-0 items-center gap-1 sm:inline-flex">
            <LockKeyhole className="size-3.5" aria-hidden="true" />
            私人工作区
          </span>
        </div>
      </div>
    </div>
  );

  if (mode === "workspace") {
    return (
      <section
        data-brain-mode="workspace"
        className={cn("grid min-w-0 overflow-hidden border-y border-border bg-background md:grid-cols-[15rem_minmax(0,1fr)]", className)}
      >
        <aside className="hidden min-h-0 border-r border-border bg-muted/15 md:flex md:flex-col" aria-label="近期私人对话">
          <div className="flex min-h-14 items-center justify-between border-b border-border px-3">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <History className="size-4" aria-hidden="true" />
              近期工作
            </span>
            <Button
              type="button"
              size="icon-sm"
              className="size-10"
              variant="ghost"
              disabled={pending}
              onClick={runCreate}
              aria-label="新建组织大脑对话"
              title="新对话"
            >
              <MessageSquarePlus aria-hidden="true" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {conversations.length === 0 ? (
              <div className="flex min-h-24 flex-col items-center justify-center gap-2 px-3 text-center text-xs text-muted-foreground">
                <Inbox className="size-4" aria-hidden="true" />
                暂无近期对话
              </div>
            ) : conversations.map((conversation) => {
              const selected = detail?.conversation.id === conversation.id;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  disabled={pending}
                  aria-pressed={selected}
                  onClick={() => runLoad(conversation.id)}
                  className={cn(
                    "mb-1 min-h-10 w-full break-words border-l-2 px-3 py-2 text-left text-xs leading-5 transition-colors",
                    selected
                      ? "border-foreground bg-background font-semibold text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  {conversationLabel(conversation)}
                </button>
              );
            })}
          </div>
        </aside>
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="hidden min-h-14 items-center justify-between gap-3 border-b border-border px-5 md:flex">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted-foreground">当前协作</p>
              <p className="mt-0.5 truncate text-sm font-semibold">
                {detail ? conversationLabel(detail.conversation) : "新对话"}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              <CircleDot className={cn("size-3.5", pending ? "text-[var(--brain-warning)]" : "text-[var(--brain-success)]")} aria-hidden="true" />
              {pending ? "处理中" : "可交互"}
            </span>
          </div>
          <div className="md:hidden">{conversationPicker}</div>
          {conversationBody}
        </div>
      </section>
    );
  }

  return (
    <section data-brain-mode="panel" className={cn("flex min-h-0 min-w-0 flex-col bg-background", className)}>
      {conversationPicker}
      {conversationBody}
    </section>
  );
}
