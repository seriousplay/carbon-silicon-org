"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ExternalLink,
  FileText,
  GitBranch,
  History,
  Link2,
  Network,
  Target,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { GoalDraftForm } from "./goal-draft-form";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type {
  GoalTreeCycle,
  GoalTreeGap,
  GoalTreeGoal,
  GoalTreeNode,
  GoalTreeProjection,
  GoalTreeProposal,
  GoalTreeTarget,
} from "@/lib/goals/read-model";

type ReadyProjection = Extract<GoalTreeProjection, { status: "READY" }>;

const cycleStatusLabels: Record<GoalTreeCycle["status"], string> = {
  PLANNED: "计划中",
  ACTIVE: "进行中",
  CLOSED: "已关闭",
  CANCELLED: "已取消",
};

const goalStatusLabels: Record<GoalTreeGoal["status"], string> = {
  ACTIVE: "生效中",
  SUPERSEDED: "已被替换",
  ACHIEVED: "已达成",
  NOT_ACHIEVED: "未达成",
};

const healthLabels: Record<GoalTreeGoal["health"], string> = {
  NOT_UPDATED: "待更新",
  OFF_TRACK: "偏离",
  AT_RISK: "有风险",
  ON_TRACK: "正常",
  SUPERSEDED: "已被替换",
  ACHIEVED: "已达成",
  NOT_ACHIEVED: "未达成",
};

const gapLabels: Record<GoalTreeGap["code"], string> = {
  ROOT_CIRCLE_MISSING: "缺少根回路",
  ROOT_CIRCLE_MULTIPLE: "存在多个根回路",
  VISIBLE_PARENT_MISSING: "上级回路不可见",
  MISSING_GOAL: "当前周期缺少主目标",
  MISSING_PARENT_SUPPORT: "缺少上级目标支撑关系",
  STALE_PARENT_SUPPORT: "上级目标支撑关系已失效",
  OWNER_ROLE_INACTIVE: "目标承担角色当前未生效",
  OWNER_ROLE_UNASSIGNED: "目标承担角色当前无人承担",
  MISSING_TARGET_EVIDENCE: "目标证据尚未更新",
  STALE_TARGET_EVIDENCE: "目标证据已过期",
};

const proposalKindLabels: Record<GoalTreeProposal["kind"], string> = {
  CREATE: "创建目标",
  REPLACE: "替换目标",
  CLOSE: "关闭目标",
};

const proposalStatusLabels: Record<GoalTreeProposal["status"], string> = {
  DRAFT: "草稿",
  SUBMITTED: "已提交",
  ADOPTED: "已采纳",
  RETURNED: "已退回",
  DECLINED: "未采纳",
  WITHDRAWN: "已撤回",
};

export function GoalTreeWorkspace({ projection }: { projection: ReadyProjection }) {
  const router = useRouter();
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const allNodes = useMemo(
    () => flattenNodes([...projection.roots, ...projection.detached]),
    [projection.detached, projection.roots],
  );
  const cycleOptions = useMemo(
    () => projection.cycles.some((cycle) => cycle.id === projection.cycle.id)
      ? projection.cycles
      : [projection.cycle, ...projection.cycles],
    [projection.cycle, projection.cycles],
  );
  const initialNodeId =
    allNodes.find((node) => node.goal?.id === projection.selectedGoal?.id)?.id ??
    allNodes[0]?.id ??
    null;
  const [selection, setSelection] = useState({
    cycleId: projection.cycle.id,
    nodeId: initialNodeId,
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const selectedNodeId =
    selection.cycleId === projection.cycle.id ? selection.nodeId : initialNodeId;
  const selectedNode = allNodes.find((node) => node.id === selectedNodeId) ?? null;

  const actionableProposals = selectedNode
    ? projection.actionableProposals.filter(
        (proposal) => proposal.circleId === selectedNode.circle.id,
      )
    : [];

  const suggestedParentGoal = useMemo(() => {
    if (
      !selectedNode?.parentId ||
      (projection.cycle.status !== "ACTIVE" && projection.cycle.status !== "PLANNED")
    ) {
      return null;
    }
    return allNodes.find((node) => node.id === selectedNode.parentId)?.goal ?? null;
  }, [allNodes, projection.cycle.status, selectedNode]);

  function selectNode(node: GoalTreeNode) {
    setSelection({ cycleId: projection.cycle.id, nodeId: node.id });
    router.replace(node.goal?.url ?? projection.cycle.url, { scroll: false });
    if (!window.matchMedia("(min-width: 1024px)").matches) setMobileOpen(true);
  }

  function changeCycle(cycleId: string | null) {
    if (!cycleId || cycleId === projection.cycle.id) return;
    const cycle = projection.cycles.find((item) => item.id === cycleId);
    if (cycle) router.replace(cycle.url, { scroll: false });
  }

  function changeMobileOpen(open: boolean) {
    setMobileOpen(open);
    if (!open && selectedNodeId) {
      window.requestAnimationFrame(() => buttonRefs.current.get(selectedNodeId)?.focus());
    }
  }

  const detail = selectedNode ? (
    <GoalDetail
      cycle={projection.cycle}
      node={selectedNode}
      proposals={projection.proposals.filter(
        (proposal) => proposal.circleId === selectedNode.circle.id,
      )}
      draft={
        projection.capabilities.canDraftProposal &&
        (actionableProposals.length > 0 ||
          selectedNode.capabilities.canDraftCreate ||
          selectedNode.capabilities.canDraftReplace ||
          selectedNode.capabilities.canDraftClose)
          ? actionableProposals.length > 0
            ? actionableProposals.map((proposal) => (
              <GoalDraftForm
                key={proposal.id}
                cycleId={projection.cycle.id}
                node={selectedNode}
                suggestedParentGoal={suggestedParentGoal}
                proposal={proposal}
              />
            ))
            : (
                <GoalDraftForm
                  cycleId={projection.cycle.id}
                  node={selectedNode}
                  suggestedParentGoal={suggestedParentGoal}
                />
              )
          : null
      }
    />
  ) : (
    <EmptyDetail cycle={projection.cycle} proposals={projection.proposals} />
  );

  return (
    <div className="min-w-0">
      <header className="border-b border-border pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-2xl font-medium">目标树</h2>
              <Badge variant={cycleBadgeVariant(projection.cycle.status)}>
                {cycleStatusLabels[projection.cycle.status]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              每个回路在一个周期内只保留一个主目标，并明确它对上级目标的支撑。
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm">
            <CalendarDays aria-hidden="true" className="size-4 text-muted-foreground" />
            <span className="sr-only">目标周期</span>
            <Select
              items={cycleOptions.map((cycle) => ({
                value: cycle.id,
                label: cycle.name,
              }))}
              value={projection.cycle.id}
              onValueChange={changeCycle}
            >
              <SelectTrigger className="w-full min-w-52 sm:w-64" aria-label="选择目标周期">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {cycleOptions.map((cycle) => (
                  <SelectItem key={cycle.id} value={cycle.id}>
                    <span className="min-w-0 truncate">{cycle.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {cycleStatusLabels[cycle.status]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span>{formatDate(projection.cycle.startAt)} 至 {formatDate(projection.cycle.endAt)}</span>
          <span>每 {projection.cycle.checkInCadenceDays} 天检查一次</span>
          <span>{cycleContext(projection.cycle.status)}</span>
          {projection.cyclesHasMore ? <span>仅显示最近 50 个周期</span> : null}
        </div>

        <GapSummary gaps={projection.gaps} />
        <ProposalPagination
          baseUrl={selectedNode?.goal?.url ?? projection.cycle.url}
          pagination={projection.proposalPagination}
        />
      </header>

      <div className="grid min-w-0 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(26rem,1.2fr)]">
        <section aria-labelledby="goal-tree-heading" className="min-w-0 py-5 lg:pr-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="goal-tree-heading" className="flex items-center gap-2 text-sm font-medium">
              <Network aria-hidden="true" className="size-4 text-muted-foreground" />
              回路目标
            </h2>
            <span className="text-xs text-muted-foreground">{allNodes.length} 个节点</span>
          </div>

          {projection.roots.length > 0 ? (
            <TreeList
              nodes={projection.roots}
              selectedNodeId={selectedNodeId}
              onSelect={selectNode}
              buttonRefs={buttonRefs}
            />
          ) : (
            <p className="border-y border-border py-6 text-sm text-muted-foreground">
              {projection.cycle.status === "CANCELLED"
                ? "周期已取消，不形成正式目标树。"
                : "这个周期还没有可展示的目标节点。"}
            </p>
          )}

          {projection.detached.length > 0 ? (
            <div className="mt-6 border-t border-border pt-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <GitBranch aria-hidden="true" className="size-4 text-amber-600" />
                未接入主树
              </div>
              <p className="mb-3 text-xs leading-5 text-muted-foreground">
                这些节点缺少可确认的上级关系，系统不会自动推断。
              </p>
              <TreeList
                nodes={projection.detached}
                selectedNodeId={selectedNodeId}
                onSelect={selectNode}
                buttonRefs={buttonRefs}
              />
            </div>
          ) : null}

          {projection.requestedGoalUnavailable ? (
            <p role="status" className="mt-4 text-xs text-amber-700">
              链接中的目标在当前组织或周期内不可用，未展示任何跨组织数据。
            </p>
          ) : null}
        </section>

        <aside className="hidden min-w-0 border-l border-border py-5 pl-6 lg:block">
          <div className="sticky top-20 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
            {detail}
          </div>
        </aside>
      </div>

      <Sheet open={mobileOpen} onOpenChange={changeMobileOpen}>
        <SheetContent
          side="right"
          className="w-full max-w-none gap-0 overflow-hidden p-0 sm:max-w-lg lg:hidden"
        >
          <SheetHeader className="border-b border-border pr-14">
            <SheetTitle>{selectedNode?.circle.name ?? "目标详情"}</SheetTitle>
            <SheetDescription>
              {selectedNode?.goal?.title ?? "当前回路尚未确认主目标"}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{detail}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ProposalPagination({
  baseUrl,
  pagination,
}: {
  baseUrl: string;
  pagination: ReadyProjection["proposalPagination"];
}) {
  if (!pagination.hasPrevious && !pagination.hasNext) return null;
  const href = (page: number) => page > 1 ? `${baseUrl}&proposalPage=${page}` : baseUrl;
  return (
    <nav aria-label="目标议案分页" className="mt-3 flex items-center justify-between gap-3 text-sm">
      {pagination.hasPrevious ? (
        <a className="inline-flex items-center gap-1 hover:underline" href={href(pagination.page - 1)}>
          <ChevronLeft aria-hidden="true" className="size-4" /> 上一页议案
        </a>
      ) : <span />}
      <span className="text-xs text-muted-foreground">议案第 {pagination.page} 页</span>
      {pagination.hasNext ? (
        <a className="inline-flex items-center gap-1 hover:underline" href={href(pagination.page + 1)}>
          下一页议案 <ChevronRight aria-hidden="true" className="size-4" />
        </a>
      ) : <span />}
    </nav>
  );
}

function TreeList({
  nodes,
  selectedNodeId,
  onSelect,
  buttonRefs,
}: {
  nodes: GoalTreeNode[];
  selectedNodeId: string | null;
  onSelect: (node: GoalTreeNode) => void;
  buttonRefs: React.RefObject<Map<string, HTMLButtonElement>>;
}) {
  return (
    <ul className="space-y-1">
      {nodes.map((node) => (
        <TreeItem
          key={node.id}
          node={node}
          depth={0}
          selectedNodeId={selectedNodeId}
          onSelect={onSelect}
          buttonRefs={buttonRefs}
        />
      ))}
    </ul>
  );
}

function TreeItem({
  node,
  depth,
  selectedNodeId,
  onSelect,
  buttonRefs,
}: {
  node: GoalTreeNode;
  depth: number;
  selectedNodeId: string | null;
  onSelect: (node: GoalTreeNode) => void;
  buttonRefs: React.RefObject<Map<string, HTMLButtonElement>>;
}) {
  const selected = node.id === selectedNodeId;
  const state = node.goal ? healthLabels[node.goal.health] : "缺少目标";

  return (
    <li>
      <button
        ref={(element) => {
          if (element) buttonRefs.current.set(node.id, element);
          else buttonRefs.current.delete(node.id);
        }}
        type="button"
        aria-current={selected ? "true" : undefined}
        aria-label={`${node.circle.name}，${node.goal?.title ?? "缺少主目标"}，${state}`}
        onClick={() => onSelect(node)}
        className={cn(
          "group flex min-h-14 w-full min-w-0 items-center gap-3 rounded-lg border px-3 py-2 text-left outline-none transition-colors",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          selected
            ? "border-moss/40 bg-moss-pale/35"
            : "border-transparent hover:border-border hover:bg-muted/50",
        )}
        style={{ paddingLeft: `${12 + Math.min(depth, 7) * 14}px` }}
      >
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg border",
            node.goal ? healthTone(node.goal.health) : "border-amber-300 bg-amber-50 text-amber-700",
          )}
        >
          {node.goal ? (
            <CircleDot aria-hidden="true" className="size-3.5" />
          ) : (
            <AlertTriangle aria-hidden="true" className="size-3.5" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs text-muted-foreground">{node.circle.name}</span>
          <span className="mt-0.5 block break-words text-sm font-medium leading-5">
            {node.goal?.title ?? "尚未确认主目标"}
          </span>
        </span>
        <span className={cn("shrink-0 text-xs", node.gaps.length > 0 ? "text-amber-700" : "text-muted-foreground")}>
          {node.gaps.length > 0 ? `${node.gaps.length} 项缺口` : state}
        </span>
      </button>
      {node.children.length > 0 ? (
        <ul className="ml-4 mt-1 space-y-1 border-l border-border">
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedNodeId={selectedNodeId}
              onSelect={onSelect}
              buttonRefs={buttonRefs}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function GoalDetail({
  cycle,
  node,
  proposals,
  draft,
}: {
  cycle: GoalTreeCycle;
  node: GoalTreeNode;
  proposals: GoalTreeProposal[];
  draft: React.ReactNode;
}) {
  const goal = node.goal;
  const draftHeadingId = useId();

  return (
    <div className="min-w-0">
      <section className="border-b border-border pb-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <a className="inline-flex items-center gap-1 hover:text-foreground" href={node.circle.url}>
            {node.circle.name}
            <ExternalLink aria-hidden="true" className="size-3" />
          </a>
          <span>回路状态：{circleStatusLabel(node.circle.status)}（当前）</span>
        </div>
        <h2 className="mt-2 break-words font-serif text-xl font-medium">
          {goal?.title ?? "尚未确认主目标"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {goal?.intendedOutcome || node.circle.purpose || "尚未记录预期结果。"}
        </p>
        {goal ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline">{goalStatusLabels[goal.status]}</Badge>
            <Badge variant={healthBadgeVariant(goal.health)}>{healthLabels[goal.health]}</Badge>
          </div>
        ) : null}
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{detailContext(cycle.status)}</p>
      </section>

      {goal ? <GoalFacts goal={goal} /> : (
        <section className="border-b border-border py-5">
          <p className="text-sm text-muted-foreground">
            系统不会用项目替代 Goal，也不会从回路目的自动推断主目标。
          </p>
        </section>
      )}

      <GapDetails gaps={node.gaps} targets={goal?.targets ?? []} />
      <ProposalHistory proposals={proposals} />

      {draft ? (
        <section aria-labelledby={draftHeadingId} className="border-t border-border pt-5">
          <div className="mb-4 flex items-center gap-2">
            <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
            <h3 id={draftHeadingId} className="text-sm font-medium">目标议案</h3>
          </div>
          {draft}
        </section>
      ) : null}
    </div>
  );
}

function GoalFacts({ goal }: { goal: GoalTreeGoal }) {
  return (
    <>
      <section className="grid gap-5 border-b border-border py-5 sm:grid-cols-2">
        <div>
          <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <UserRound aria-hidden="true" className="size-3.5" />
            承担角色（当前）
          </h3>
          <p className="mt-2 text-sm font-medium">{goal.ownerRole?.name ?? "未找到当前角色"}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {goal.ownerRole?.assignees.length
              ? goal.ownerRole.assignees.map((person) => person.name).join("、")
              : "当前无人承担"}
          </p>
          {goal.ownerRole ? (
            <p className="mt-1 text-xs text-muted-foreground">
              角色状态：{roleStatusLabel(goal.ownerRole.status)} · 共 {goal.ownerRole.assigneeCount} 位承担者
              {goal.ownerRole.assigneesHasMore ? "，仅显示前 5 位" : ""}
            </p>
          ) : null}
        </div>
        <div>
          <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <GitBranch aria-hidden="true" className="size-3.5" />
            支撑关系
          </h3>
          {goal.parentGoal ? (
            <a className="mt-2 inline-block break-words text-sm font-medium hover:underline" href={goal.parentGoal.url}>
              {goal.parentGoal.title}
            </a>
          ) : (
            <p className="mt-2 text-sm">组织根目标或未建立上级支撑</p>
          )}
        </div>
      </section>

      <section className="border-b border-border py-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Target aria-hidden="true" className="size-4 text-muted-foreground" />
            Targets
          </h3>
          <span className="text-xs text-muted-foreground">{goal.targets.length} 项</span>
        </div>
        {goal.targets.length ? (
          <div className="divide-y divide-border border-y border-border">
            {goal.targets.map((target) => <TargetDetail key={target.id} target={target} />)}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">没有定义可验证的 Target。</p>
        )}
      </section>

      <section className="border-b border-border py-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Link2 aria-hidden="true" className="size-4 text-muted-foreground" />
          关联工作
        </h3>
        {goal.workLinks.length ? (
          <ul className="divide-y divide-border border-y border-border">
            {goal.workLinks.map((work) => (
              <li key={work.id} className="flex min-w-0 items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <a className="break-words font-medium hover:underline" href={work.url}>{work.label}</a>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {workKindLabel(work.kind)} · 当前状态 {workStatusLabel(work)} · 关联于 {formatDate(work.createdAt)}
                  </p>
                </div>
                <ExternalLink aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">尚未关联项目、行动或阻塞张力。</p>
        )}
        {goal.workLinksHasMore ? (
          <p className="mt-2 text-xs text-muted-foreground">仅显示最近 50 项关联工作。</p>
        ) : null}
      </section>

      <section className="border-b border-border py-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
          <History aria-hidden="true" className="size-4 text-muted-foreground" />
          决策来源
        </h3>
        <DecisionSource label="采纳" source={goal.adoption} />
        {goal.terminalDecision ? <DecisionSource label="终止" source={goal.terminalDecision} /> : null}
        <p className="mt-3 text-xs text-muted-foreground">
          创建于 {formatDateTime(goal.createdAt)}
          {goal.terminalAt ? ` · 终止于 ${formatDateTime(goal.terminalAt)}` : ""}
        </p>
      </section>
    </>
  );
}

function TargetDetail({ target }: { target: GoalTreeTarget }) {
  const evidence = target.effectiveEvidence;
  return (
    <article className="py-4 first:pt-3 last:pb-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words text-sm font-medium">{target.position + 1}. {target.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {target.kind === "NUMERIC"
              ? `${target.baselineValue ?? "未设基线"} → ${target.desiredValue ?? "未设目标"}${target.unit ? ` ${target.unit}` : ""}`
              : target.acceptanceCriteria ?? "未记录验收标准"}
          </p>
        </div>
        <Badge variant={target.evidenceIsStale ? "destructive" : evidence ? "secondary" : "outline"}>
          {target.evidenceIsStale ? "证据过期" : evidence ? "已有证据" : "待更新"}
        </Badge>
      </div>
      {evidence ? (
        <div className="mt-3 border-l-2 border-border pl-3 text-xs leading-5 text-muted-foreground">
          <p className="text-foreground">{evidence.fact}</p>
          <p>{evidence.evidenceSummary}</p>
          <p>
            {evidence.currentValue !== null ? `当前值 ${evidence.currentValue}` : ""}
            {evidence.milestoneCompleted !== null ? (evidence.milestoneCompleted ? "里程碑已完成" : "里程碑未完成") : ""}
            {` · ${assessmentLabel(evidence.assessment)} · ${formatDateTime(evidence.recordedAt)}`}
          </p>
          {evidence.acceptanceEvidence ? <p>验收证据：{evidence.acceptanceEvidence}</p> : null}
          <p>记录人：{evidence.recorder.name}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {evidence.meetingUrl ? <a className="hover:underline" href={evidence.meetingUrl}>查看记录会议</a> : null}
            {evidence.sourceUrl ? <a className="hover:underline" href={evidence.sourceUrl}>查看证据来源</a> : null}
            {evidence.isCorrection ? <span>修正记录</span> : null}
          </div>
        </div>
      ) : null}
      {target.metric ? <p className="mt-2 text-[11px] text-muted-foreground">关联指标：{target.metric.name}</p> : null}
    </article>
  );
}

function DecisionSource({
  label,
  source,
}: {
  label: string;
  source: GoalTreeGoal["adoption"];
}) {
  if (!source) return <p className="text-sm text-muted-foreground">{label}来源不可用。</p>;
  return (
    <div className="mb-3 text-sm last:mb-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{label}：{decisionOutcomeLabel(source.outcome)}</span>
        <a className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" href={source.meetingUrl}>
          查看会议
          <ExternalLink aria-hidden="true" className="size-3" />
        </a>
      </div>
      <p className="mt-1 break-all text-xs text-muted-foreground">
        {proposalKindLabels[source.proposalKind]} · {source.proposalTitle ?? "提案内容不可用"} · 修订 {source.revision}
        {` · 记录人 ${source.recorder.name} · ${formatDateTime(source.decidedAt)}`}
      </p>
    </div>
  );
}

function GapSummary({ gaps }: { gaps: GoalTreeGap[] }) {
  if (!gaps.length) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-moss">
        <CheckCircle2 aria-hidden="true" className="size-3.5" />
        当前投影未发现目标树缺口
      </div>
    );
  }
  const counts = countGaps(gaps);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2" aria-label={`目标树共有 ${gaps.length} 项缺口`}>
      <AlertTriangle aria-hidden="true" className="size-3.5 text-amber-700" />
      {counts.map(([code, count]) => (
        <Badge key={code} variant="outline" className="border-amber-300 text-amber-800">
          {gapLabels[code]} {count}
        </Badge>
      ))}
    </div>
  );
}

function GapDetails({ gaps, targets }: { gaps: GoalTreeGap[]; targets: GoalTreeTarget[] }) {
  return (
    <section className="border-b border-border py-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
        <AlertTriangle aria-hidden="true" className={cn("size-4", gaps.length ? "text-amber-700" : "text-muted-foreground")} />
        结构与证据缺口
      </h3>
      {gaps.length ? (
        <ul className="space-y-2">
          {gaps.map((item, index) => (
            <li key={`${item.code}-${item.goalId}-${item.targetId}-${index}`} className="text-sm">
              <span>{gapLabels[item.code]}</span>
              {item.targetId ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  {targets.find((target) => target.id === item.targetId)?.label ?? "对应判据当前不可用"}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">所选节点没有已知缺口。</p>
      )}
    </section>
  );
}

function ProposalHistory({ proposals }: { proposals: GoalTreeProposal[] }) {
  return (
    <section className="border-b border-border py-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <History aria-hidden="true" className="size-4 text-muted-foreground" />
          议案历史
        </h3>
        <span className="text-xs text-muted-foreground">{proposals.length} 份</span>
      </div>
      {proposals.length ? (
        <ol className="divide-y divide-border border-y border-border">
          {proposals.map((proposal) => (
            <li key={proposal.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{proposalKindLabels[proposal.kind]}</span>
                <Badge variant="outline">{proposalStatusLabels[proposal.status]}</Badge>
                <span className="text-xs text-muted-foreground">修订 {proposal.currentRevision}</span>
              </div>
              <p className="mt-1 break-words text-muted-foreground">
                {proposal.revision?.title ?? proposal.revision?.conclusion ?? "当前修订内容不可用"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                提出者 {proposal.proposer.name}
                {proposal.submittedAt ? ` · 提交于 ${formatDateTime(proposal.submittedAt)}` : ""}
                {proposal.terminalAt ? ` · 终结于 ${formatDateTime(proposal.terminalAt)}` : ""}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">该回路在本周期没有目标议案记录。</p>
      )}
    </section>
  );
}

function EmptyDetail({ cycle, proposals }: { cycle: GoalTreeCycle; proposals: GoalTreeProposal[] }) {
  return (
    <div>
      <section className="border-b border-border pb-5">
        <h2 className="font-serif text-xl font-medium">{cycle.name}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{detailContext(cycle.status)}</p>
      </section>
      <ProposalHistory proposals={proposals} />
    </div>
  );
}

function flattenNodes(nodes: GoalTreeNode[]): GoalTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);
}

function countGaps(gaps: GoalTreeGap[]): Array<[GoalTreeGap["code"], number]> {
  const counts = new Map<GoalTreeGap["code"], number>();
  gaps.forEach((item) => counts.set(item.code, (counts.get(item.code) ?? 0) + 1));
  return [...counts.entries()];
}

function cycleContext(status: GoalTreeCycle["status"]): string {
  if (status === "ACTIVE") return "当前运行周期";
  if (status === "PLANNED") return "尚未将缺 Goal 视为运行缺口";
  if (status === "CLOSED") return "展示已确认的历史 Goal 支撑关系";
  return "仅保留提案记录";
}

function detailContext(status: GoalTreeCycle["status"]): string {
  if (status === "CLOSED") {
    return "Goal 支撑关系来自周期内已确认记录；回路、角色、承担者和关联工作显示当前资料，不代表关闭时快照。";
  }
  if (status === "CANCELLED") return "周期已取消，仅保留提案历史，不形成正式 Goal。";
  if (status === "PLANNED") return "这是规划中的周期；尚未确认 Goal 的回路不会被判定为运行缺口。";
  return "这是当前运行周期，健康度来自每个 Target 的有效证据。";
}

function formatDate(value: Date): string {
  return new Date(value).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Shanghai",
  });
}

function formatDateTime(value: Date): string {
  return new Date(value).toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Shanghai",
  });
}

function cycleBadgeVariant(status: GoalTreeCycle["status"]): "default" | "outline" | "secondary" | "destructive" {
  if (status === "ACTIVE") return "default";
  if (status === "CANCELLED") return "destructive";
  return status === "PLANNED" ? "secondary" : "outline";
}

function healthBadgeVariant(health: GoalTreeGoal["health"]): "default" | "outline" | "secondary" | "destructive" {
  if (health === "OFF_TRACK") return "destructive";
  if (health === "ON_TRACK" || health === "ACHIEVED") return "secondary";
  return "outline";
}

function healthTone(health: GoalTreeGoal["health"]): string {
  if (health === "ON_TRACK" || health === "ACHIEVED") return "border-moss/30 bg-moss-pale text-moss";
  if (health === "OFF_TRACK" || health === "NOT_ACHIEVED") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (health === "AT_RISK") return "border-amber-300 bg-amber-50 text-amber-700";
  return "border-border bg-muted text-muted-foreground";
}

function circleStatusLabel(status: GoalTreeNode["circle"]["status"]): string {
  return { NORMAL: "正常", WARNING: "预警", HALTED: "暂停", ARCHIVED: "已归档" }[status];
}

function roleStatusLabel(status: NonNullable<GoalTreeGoal["ownerRole"]>["status"]): string {
  return { ACTIVE: "生效", PAUSED: "暂停", ARCHIVED: "已归档" }[status];
}

function assessmentLabel(status: NonNullable<GoalTreeTarget["effectiveEvidence"]>["assessment"]): string {
  return { ON_TRACK: "正常", AT_RISK: "有风险", OFF_TRACK: "偏离", ACHIEVED: "已达成" }[status];
}

function workKindLabel(kind: GoalTreeGoal["workLinks"][number]["kind"]): string {
  return { PROJECT: "项目", ACTION: "行动", BLOCKING_TENSION: "阻塞张力" }[kind];
}

function workStatusLabel(work: GoalTreeGoal["workLinks"][number]): string {
  const projectLabels: Record<string, string> = {
    ACTIVE: "进行中",
    IN_PROGRESS: "进行中",
    COMPLETED: "已完成",
    PAUSED: "已暂停",
  };
  const tensionLabels: Record<string, string> = {
    OPEN: "待指派",
    ASSIGNED: "已指派",
    IN_PROGRESS: "处理中",
    BLOCKED: "受阻",
    ESCALATED_L0_5: "已紧急升级",
    ESCALATED_L2: "已升级至回路间协调",
    ESCALATED_L3: "已升级至治理流程",
    ESCALATED_L4: "已升级至战略层",
    RESOLVED: "已闭环",
    REJECTED: "不成立或重复",
  };
  const labels = work.kind === "PROJECT" ? projectLabels : tensionLabels;
  return labels[work.objectStatus] ?? "状态未知";
}

function decisionOutcomeLabel(outcome: NonNullable<GoalTreeGoal["adoption"]>["outcome"]): string {
  return { ADOPTED: "已采纳", RETURNED: "已退回", DECLINED: "未采纳" }[outcome];
}
