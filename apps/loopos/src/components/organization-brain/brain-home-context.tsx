import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  FolderKanban,
  Goal,
  LockKeyhole,
  Radar,
  ShieldAlert,
  UserRound,
} from "lucide-react";

import type { OrganizationBrainHomeProjection } from "@/lib/organization-brain/home-read-model";

export function BrainHomeContext({
  projection,
}: {
  projection: OrganizationBrainHomeProjection;
}) {
  if (projection.status === "DENIED") {
    return (
      <section
        aria-label="组织感知不可用"
        className="border-y border-border bg-muted/20 px-4 py-5 sm:px-5"
      >
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">当前无法读取组织上下文</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              没有可展示的授权数据。组织大脑不会推测或暴露不可访问的信息。
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="brain-focus-heading" className="border-y border-border bg-background">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-[var(--brain-info)]">
            <Radar className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="brain-focus-heading" className="text-sm font-semibold">组织感知</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{projection.freshnessLabel}</p>
          </div>
        </div>
        <span
          className={projection.freshnessStatus === "LIMITED"
            ? "inline-flex min-h-8 items-center gap-1.5 rounded-full bg-amber-500/10 px-3 text-xs font-medium text-[var(--brain-warning)]"
            : "inline-flex min-h-8 items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 text-xs font-medium text-[var(--brain-success)]"}
        >
          {projection.freshnessStatus === "LIMITED" ? (
            <ShieldAlert className="size-3.5" aria-hidden="true" />
          ) : (
            <Radar className="size-3.5" aria-hidden="true" />
          )}
          {projection.freshnessStatus === "LIMITED" ? "新鲜度受限" : "感知已同步"}
        </span>
      </div>

      <div aria-label="当前运行状态" className="grid border-t border-border bg-muted/15 sm:grid-cols-4">
        <HealthyLink
          icon={<Goal className="size-4" aria-hidden="true" />}
          label="本周期目标"
          value={projection.healthyState.goal?.title ?? "尚未设置"}
          href={projection.healthyState.goal?.applicationUrl ?? "/app/goals"}
        />
        <HealthyLink
          icon={<CalendarDays className="size-4" aria-hidden="true" />}
          label="下一场会议"
          value={projection.healthyState.nextMeeting?.title ?? "暂无会议"}
          href={projection.healthyState.nextMeeting?.applicationUrl ?? "/app/meetings"}
        />
        <HealthyLink
          icon={<FolderKanban className="size-4" aria-hidden="true" />}
          label="我的进行中项目"
          value={projectSummary(projection.healthyState.activeProjects)}
          href={projection.healthyState.activeProjects[0]?.applicationUrl ?? "/app/projects"}
        />
        <HealthyLink
          icon={<UserRound className="size-4" aria-hidden="true" />}
          label="角色与任职"
          value="查看角色市场"
          href="/app/roles/market"
        />
      </div>

      <div className="border-t border-border px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold text-muted-foreground">当前焦点</h3>
          <span className="text-xs tabular-nums text-muted-foreground">
            {projection.focusItems.length}/3
          </span>
        </div>
        {projection.focusItems.length > 0 ? (
          <ol className="mt-2 divide-y divide-border">
            {projection.focusItems.map((item, index) => (
              <li
                key={item.id}
                className="grid min-w-0 gap-3 py-4 md:grid-cols-[2rem_minmax(0,1fr)_auto] md:items-start"
              >
                <span className="hidden size-7 items-center justify-center rounded-full border border-border text-xs font-semibold tabular-nums text-muted-foreground md:flex">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-1 break-words text-sm leading-6 text-foreground/85">
                    <span className="font-medium">变化：</span>{item.change}
                  </p>
                  <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">{item.summary}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 text-muted-foreground">
                    <span>{item.relevance}</span>
                    <Link
                      href={item.evidence.applicationUrl}
                      className="inline-flex min-h-10 items-center font-medium text-[var(--brain-info)] underline-offset-4 hover:underline"
                    >
                      证据：{item.evidence.label}
                    </Link>
                    <span>{observedLabel(item.evidence.observedAt)} · {item.evidence.freshnessLabel}</span>
                  </div>
                </div>
                <Link
                  href={item.action.applicationUrl}
                  className="inline-flex min-h-10 items-center gap-1.5 justify-self-start text-sm font-semibold text-primary underline-offset-4 hover:underline md:justify-self-end"
                >
                  {item.action.label}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-3 flex min-h-16 items-center gap-2 border-t border-border text-sm text-muted-foreground">
            <Radar className="size-4" aria-hidden="true" />
            当前没有需要优先处理的事项。
          </div>
        )}
      </div>
    </section>
  );
}

function HealthyLink({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-16 min-w-0 items-center gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-muted/40 hover:text-primary last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 sm:px-5"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="mt-0.5 block break-words text-sm font-semibold leading-5">{value}</span>
      </span>
    </Link>
  );
}

function observedLabel(value: string | null): string {
  if (!value) return "更新时间未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "更新时间未知";
  return `观察于 ${new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(date)}`;
}

function projectSummary(
  projects: Extract<OrganizationBrainHomeProjection, { status: "READY" }>["healthyState"]["activeProjects"],
): string {
  if (projects.length === 0) return "暂无项目";
  if (projects.length === 1) return projects[0].title;
  return `${projects[0].title} 等 ${projects.length} 个`;
}
