import Link from "next/link";
import { getCurrentOrgId } from "@/lib/session";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/shared/status-badge";
import { isAIAvailable } from "@/lib/ai/provider";
import { DraftLogButton } from "./draft-log-button";
import { PublishLogButton } from "./publish-log-button";
import { OrganizationSubnav } from "../organization/organization-subnav";

const decisionTypeLabel = {
  ROLE_CHANGE: "角色修改",
  STRATEGY_CHANGE: "策略修改",
  CIRCLE_STRUCTURE_CHANGE: "回路结构",
  CONFLICT_ADJUDICATION: "冲突裁决",
  CHARTER_AMENDMENT: "宪章修订",
} as const;

export default async function GovernancePage() {
  const orgId = await getCurrentOrgId();
  const aiOn = isAIAvailable();

  const [decisions, changes, logs, charters] = await Promise.all([
    prisma.decisionRecord.findMany({
      where: { organizationId: orgId },
      include: {
        decisionMaker: { select: { name: true } },
        meeting: { select: { title: true, startedAt: true } },
      },
      orderBy: { effectiveAt: "desc" },
      take: 20,
    }),
    prisma.changeLog.findMany({
      where: { organizationId: orgId },
      include: { initiator: { select: { name: true } } },
      orderBy: { effectiveAt: "desc" },
      take: 20,
    }),
    prisma.governanceLog.findMany({
      where: { organizationId: orgId },
      orderBy: { period: "desc" },
      take: 12,
    }),
    prisma.charter.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const currentPeriod = new Date().toISOString().slice(0, 7);
  const currentLog = logs.find((l) => l.period === currentPeriod);
  const ratifiedCharter = charters.find((c) => c.status === "ratified");

  return (
    <div className="max-w-5xl mx-auto animate-fade-rise space-y-6">
      <OrganizationSubnav active="governance" />

      <div className="mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-medium mb-1">治理</h1>
            <p className="text-sm text-muted-foreground">
              组织的进化轨迹。决策可追溯，变更可审计，日志 AI 起草，宪章随进化而演进。
            </p>
          </div>
          <Link
            href="/app/governance/weekly"
            className="inline-flex shrink-0 items-center justify-center rounded-input border border-moss/30 bg-moss-pale px-3 py-2 text-sm font-medium text-moss hover:bg-moss-pale/80"
          >
            周治理候选
          </Link>
        </div>
      </div>

      {/* 治理日志（AI 起草） */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg font-medium">治理日志（月度）</h2>
          {!aiOn && (
            <span className="text-xs text-muted-foreground">AI 未配置，起草不可用</span>
          )}
        </div>

        {/* 当月起草入口 */}
        <div className="rounded-card border border-border bg-card p-5 shadow-soft mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{currentPeriod} 月度日志</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {currentLog
                  ? currentLog.status === "draft"
                    ? `草稿已生成（可信度 ${((currentLog.credibilityScore ?? 0.5) * 100).toFixed(0)}%）`
                    : "已发布"
                  : "尚未起草"}
              </p>
            </div>
            {currentLog ? (
              currentLog.status === "draft" ? (
                <PublishLogButton logId={currentLog.id} />
              ) : (
                <StatusBadge variant="mature" label="已发布" />
              )
            ) : (
              <DraftLogButton period={currentPeriod} aiOn={aiOn} />
            )}
          </div>
        </div>

        {/* 历史日志 */}
        {logs.length > 0 && (
          <div className="space-y-2">
            {logs.filter((l) => l.period !== currentPeriod).map((log) => {
              const patterns: string[] = (() => {
                try { return JSON.parse(log.patterns); } catch { return []; }
              })();
              return (
                <div key={log.id} className="rounded-input border border-border p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">{log.title}</p>
                    <StatusBadge
                      variant={log.status === "published" ? "mature" : "seed"}
                      label={log.status === "published" ? "已发布" : "草稿"}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{log.content}</p>
                  {patterns.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {patterns.map((p, i) => (
                        <span key={i} className="text-[10px] bg-needs-light-pale/50 text-needs-light rounded px-1.5 py-0.5">
                          ∿ {p}
                        </span>
                      ))}
                    </div>
                  )}
                  {log.risks && (
                    <p className="text-[10px] text-urgent mt-1.5">⚠ {log.risks.slice(0, 60)}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 组织宪章 */}
      <section className="mb-10">
        <div className="mb-4">
          <h2 className="font-serif text-lg font-medium">组织宪章</h2>
        </div>

        {ratifiedCharter ? (
          <div className="rounded-card border border-moss/30 bg-moss-pale/20 p-6">
            <div className="flex items-center gap-2 mb-3">
              <StatusBadge variant="growing" label={ratifiedCharter.version} />
              <span className="text-xs text-muted-foreground">
                批准于 {ratifiedCharter.ratifiedAt?.toLocaleDateString("zh-CN")}
              </span>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-line line-clamp-6">
              {ratifiedCharter.content}
            </p>
            {ratifiedCharter.changeSummary && (
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                本版变更：{ratifiedCharter.changeSummary}
              </p>
            )}
          </div>
        ) : charters.length > 0 ? (
          <div className="space-y-2">
            {charters.map((c) => (
              <div key={c.id} className="rounded-input border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{c.version}</span>
                  <StatusBadge
                    variant={c.status === "ratified" ? "mature" : "seed"}
                    label={c.status === "ratified" ? "已批准" : c.status === "archived" ? "已归档" : "草稿"}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-card border border-dashed border-border bg-card/50 p-8 text-center">
            <div className="text-3xl mb-3 text-moss/60">❋</div>
            <h3 className="font-serif text-base font-medium mb-2">宪章尚未建立</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              每季度一次，从三个月运转中提取规则——哪些有效（固化）、哪些过时（废弃）、需新增什么。
              ≤1 页纸，像组织的 DNA。
            </p>
          </div>
        )}
      </section>

      {/* 决策记录 */}
      <section className="mb-10">
        <h2 className="font-serif text-lg font-medium mb-4">决策记录</h2>
        {decisions.length === 0 ? (
          <div className="rounded-card border border-dashed border-border bg-card/50 p-8 text-center">
            <div className="text-3xl mb-3 text-moss/60">◇</div>
            <p className="text-sm text-muted-foreground">
              还没有治理决议。在治理会上产出的决策会记录在这里。
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {decisions.map((d) => (
              <div id={`decision-${d.id}`} key={d.id} className="scroll-mt-6 rounded-card border border-border bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <StatusBadge variant="growing" label={decisionTypeLabel[d.type]} />
                    <h3 className="font-medium text-sm mt-2">{d.title}</h3>
                  </div>
                  {d.status === "SUPERSEDED" && (
                    <StatusBadge variant="mature" label="已被取代" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{d.content}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  {d.decisionMaker && <span>— {d.decisionMaker.name}</span>}
                  <span>·</span>
                  <span>{d.effectiveAt.toLocaleDateString("zh-CN")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 变更审计 */}
      <section>
        <h2 className="font-serif text-lg font-medium mb-4">变更审计</h2>
        {changes.length === 0 ? (
          <div className="rounded-card border border-dashed border-border bg-card/50 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              还没有结构变更。归属变更、角色修改会记录在这里。
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {changes.map((c) => (
              <div id={`change-${c.id}`} key={c.id} className="scroll-mt-6 rounded-input border border-border p-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{c.objectDesc}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.effectiveAt.toLocaleDateString("zh-CN")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {c.beforeValue} → {c.afterValue}
                </p>
                <p className="text-xs text-muted-foreground mt-1">— {c.initiator.name}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
