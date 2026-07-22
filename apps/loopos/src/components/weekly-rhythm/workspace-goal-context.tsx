import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarClock,
  CircleDot,
  ExternalLink,
  FolderKanban,
  ListChecks,
  Target,
  Waves,
} from "lucide-react";

import type {
  WorkspaceGoalEvidence,
  WorkspaceGoalItem,
  WorkspaceGoalProjection,
} from "@/lib/goals/workspace-read-model";

const healthLabel: Record<WorkspaceGoalItem["health"], { label: string; color: string }> = {
  NOT_UPDATED: { label: "未更新", color: "text-muted-foreground" },
  ON_TRACK: { label: "正常", color: "text-growing" },
  AT_RISK: { label: "有风险", color: "text-seed" },
  OFF_TRACK: { label: "已偏离", color: "text-needs-light" },
  ACHIEVED: { label: "已达成", color: "text-moss" },
  SUPERSEDED: { label: "已替代", color: "text-muted-foreground" },
  NOT_ACHIEVED: { label: "未达成", color: "text-needs-light" },
};

const assessmentLabel: Record<WorkspaceGoalEvidence["assessment"], string> = {
  ON_TRACK: "进展正常",
  AT_RISK: "存在风险",
  OFF_TRACK: "已经偏离",
  ACHIEVED: "已经达成",
};

const workKind = {
  PROJECT: { label: "项目", icon: FolderKanban },
  ACTION: { label: "行动", icon: ListChecks },
  BLOCKING_TENSION: { label: "阻塞张力", icon: Waves },
} as const;

export function WorkspaceGoalContext({ projection }: { projection: WorkspaceGoalProjection }) {
  if (projection.status === "NOT_AVAILABLE") {
    const message = projection.reason === "ACTIVE_CYCLE_NOT_FOUND"
      ? "当前没有进行中的目标周期。"
      : projection.reason === "VIEWER_NOT_FOUND"
        ? "当前身份无法读取目标上下文。"
        : "目标上下文暂时不可用。";
    return (
      <section className="mb-8" aria-labelledby="workspace-goal-context-title">
        <SectionHeading />
        <div className="border-y border-border py-5 text-sm text-muted-foreground">
          <p>{message}</p>
          <Link
            href={projection.allGoalsUrl}
            className="mt-2 inline-flex min-h-11 items-center gap-1 font-medium text-foreground hover:text-moss focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            查看目标 <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    );
  }

  if (projection.status === "EMPTY") {
    return (
      <section className="mb-8" aria-labelledby="workspace-goal-context-title">
        <SectionHeading cycleName={projection.cycle.name} />
        <div className="border-y border-border py-5 text-sm text-muted-foreground">
          <p>当前没有与你相关的主目标。</p>
          <Link
            href={projection.allGoalsUrl}
            className="mt-2 inline-flex min-h-11 items-center gap-1 font-medium text-foreground hover:text-moss focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            查看组织目标 <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8" aria-labelledby="workspace-goal-context-title">
      <SectionHeading
        cycleName={projection.cycle.name}
        count={projection.goals.length}
        action={projection.hasMore ? (
          <Link
            href={projection.allGoalsUrl}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-medium text-foreground hover:text-moss focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            查看全部目标 <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      />

      <div className="divide-y divide-border border-y border-border">
        {projection.goals.map((goal) => {
          const health = healthLabel[goal.health];
          return (
            <article key={goal.id} className="min-w-0 py-5">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={goal.url}
                    className="group inline-flex min-h-11 max-w-full items-center gap-2 text-sm font-semibold hover:text-moss focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="min-w-0 break-words">{goal.title}</span>
                    <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
                    {goal.intendedOutcome}
                  </p>
                </div>
                <span className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 text-xs font-medium ${health.color}`}>
                  <CircleDot aria-hidden="true" className="h-3.5 w-3.5" />
                  {health.label}
                </span>
              </div>

              <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <Link href={goal.circle.url} className="break-words hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {goal.circle.name}
                </Link>
                <Link href={goal.ownerRole.url} className="break-words hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  责任角色：{goal.ownerRole.name}{goal.ownerRole.viewerAssigned ? "（由你承担）" : ""}
                </Link>
                {goal.ownerRole.status !== "ACTIVE" ? (
                  <span className="text-needs-light">责任角色当前未激活</span>
                ) : goal.ownerRole.assigneeCount === 0 ? (
                  <span className="text-needs-light">责任角色尚未分配</span>
                ) : null}
              </div>

              <div className="mt-4 grid min-w-0 gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
                    <Target aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
                    进展证据
                  </h3>
                  <ul className="mt-2 min-w-0 divide-y divide-border/70">
                    {goal.targets.map((target) => (
                      <li key={target.id} className="min-w-0 py-2 first:pt-0">
                        <p className="break-words text-xs font-medium">
                          {target.position + 1}. {target.label}
                        </p>
                        {target.effectiveEvidence ? (
                          <div className="mt-1 min-w-0 text-xs leading-5 text-muted-foreground">
                            <p className="break-words">{target.effectiveEvidence.fact}</p>
                            <p className="break-words">{target.effectiveEvidence.evidenceSummary}</p>
                            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                              <span>{assessmentLabel[target.effectiveEvidence.assessment]}</span>
                              <span>{ageLabel(target.evidenceAgeDays)}</span>
                              {target.evidenceIsStale ? <span className="text-needs-light">已超过更新节奏</span> : null}
                              {target.effectiveEvidence.meetingUrl ? (
                                <Link
                                  href={target.effectiveEvidence.meetingUrl}
                                  className="font-medium text-foreground hover:text-moss focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  会议记录
                                </Link>
                              ) : null}
                              {target.effectiveEvidence.sourceUrl ? (
                                <a
                                  href={target.effectiveEvidence.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 break-words font-medium text-foreground hover:text-moss focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  外部证据 <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" />
                                </a>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">尚无进展证据</p>
                        )}
                      </li>
                    ))}
                  </ul>
                  {goal.targetsHasMore ? (
                    <Link
                      href={goal.url}
                      className="mt-1 inline-flex min-h-9 items-center gap-1 break-words text-xs font-medium text-foreground hover:text-moss focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      还有更多指标（共 {goal.targetCount} 个），查看目标
                      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    </Link>
                  ) : null}
                </div>

                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
                    <CalendarClock aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
                    相关战术会
                  </h3>
                  {goal.meetings.length === 0 ? (
                    <p className="mt-2 break-words text-xs leading-5 text-muted-foreground">
                      当前关联来自责任角色，没有待开的同回路战术会。
                    </p>
                  ) : (
                    <ul className="mt-2 min-w-0 space-y-1">
                      {goal.meetings.map((meeting) => (
                        <li key={meeting.id} className="min-w-0">
                          <Link
                            href={meeting.url}
                            className="flex min-h-9 min-w-0 items-center justify-between gap-3 text-xs hover:text-moss focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className="min-w-0 break-words">{meeting.title}</span>
                            <span className="shrink-0 text-muted-foreground">{formatDateTime(meeting.startedAt)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {goal.meetingsHasMore ? (
                    <Link
                      href={goal.meetingsUrl}
                      className="mt-1 inline-flex min-h-9 items-center gap-1 break-words text-xs font-medium text-foreground hover:text-moss focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      还有更多相关战术会（共 {goal.meetingCount} 场），查看会议
                      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    </Link>
                  ) : null}
                </div>

                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
                    <ListChecks aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
                    关联工作
                  </h3>
                  {goal.workLinks.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">暂无关联工作。</p>
                  ) : (
                    <ul className="mt-2 min-w-0 space-y-1">
                      {goal.workLinks.map((work) => {
                        const kind = workKind[work.kind];
                        const Icon = kind.icon;
                        return (
                          <li key={work.id} className="min-w-0">
                            <Link
                              href={work.url}
                              className="flex min-h-9 min-w-0 items-center gap-2 text-xs hover:text-moss focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="shrink-0 text-muted-foreground">{kind.label}</span>
                              <span className="min-w-0 break-words">{work.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {goal.workLinksHasMore ? (
                    <Link
                      href={goal.url}
                      className="mt-1 inline-flex min-h-9 items-center gap-1 break-words text-xs font-medium text-foreground hover:text-moss focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      还有更多关联工作（共 {goal.workLinkCount} 项），查看目标
                      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    </Link>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SectionHeading({
  cycleName,
  count,
  action,
}: {
  cycleName?: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex min-w-0 flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 id="workspace-goal-context-title" className="text-sm font-medium">目标上下文</h2>
        <p className="mt-1 break-words text-xs text-muted-foreground">
          {cycleName ? `${cycleName}${count === undefined ? "" : ` · ${count} 个相关目标`}` : "与你当前工作相关的主目标"}
        </p>
      </div>
      {action}
    </div>
  );
}

function ageLabel(days: number | null): string {
  if (days === null) return "";
  if (days === 0) return "今天更新";
  return `${days} 天前更新`;
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}
