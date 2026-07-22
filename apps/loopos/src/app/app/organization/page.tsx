import Link from "next/link";
import { CheckCircle2, CircleAlert, LockKeyhole } from "lucide-react";

import { getOrganizationModelSettingsSummary } from "@/lib/ai/organization-model-settings";
import { getCurrentOrgId, requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getOrganizationGovernanceConfig } from "@/lib/organization-governance-config";
import { allTemplates } from "@/lib/org-templates";
import {
  getSetupWorkspaceReadModel,
  setupWorkspaceStatusText,
} from "@/lib/organization-setup/setup-workspace-read-model";
import { GovernanceRulesForm } from "../setup/governance-rules-form";
import { InitForm } from "../setup/init-form";
import { isOrgInitialized } from "../setup/actions";
import { ModelSettingsForm } from "../setup/model-settings-form";
import { OrganizationProfileForm } from "../setup/organization-profile-form";
import { TerminologyForm } from "../setup/terminology-form";
import { ActivationForm } from "./activation-form";
import { OrganizationSubnav } from "./organization-subnav";

export default async function OrganizationEntryPage() {
  const organizationId = await getCurrentOrgId();
  const session = await requireSession();
  const [workspace, membership, governanceConfig, modelSettings, initialized] = await Promise.all([
    getSetupWorkspaceReadModel(organizationId),
    prisma.membership.findUnique({
      where: { userId_organizationId: { userId: session.user.id, organizationId } },
      select: { role: true },
    }),
    getOrganizationGovernanceConfig(organizationId),
    getOrganizationModelSettingsSummary(organizationId),
    isOrgInitialized(),
  ]);
  const isAdmin = membership?.role === "ORG_ADMIN";
  const active = workspace.organization.lifecycleStatus === "ACTIVE";
  const readinessActions = [
    { label: "组织目的", href: "#organization-identity", action: "填写组织名称和目的" },
    { label: "主结构", href: "#organization-structure", action: "初始化或检查主结构" },
    { label: "活跃角色", href: "/app/circles/map", action: "确保至少定义一个活跃角色" },
    { label: "组织大脑", href: "#system-configuration", action: "配置组织大脑模型" },
  ].filter((item) => workspace.readiness.some((check) => check.label === item.label && !check.done));

  if (active) {
    const activeCards = [
      {
        label: "组织结构",
        href: "/app/circles/map",
        summary: `${workspace.counts.structures} 个结构单元，${workspace.counts.roles} 个活跃角色`,
        action: "查看结构与角色",
      },
      {
        label: "业务回路",
        href: "/app/organization/business-loops",
        summary: "澄清价值和数据如何流动",
        action: "查看业务回路",
      },
      {
        label: "组织目标",
        href: "/app/goals",
        summary: `${workspace.counts.goalCycles} 个目标周期，${workspace.counts.activeGoals} 个活跃目标`,
        action: "进入目标工作区",
      },
      {
        label: "角色市场",
        href: "/app/roles/market",
        summary: `${workspace.counts.assignedLeadRoles} / ${workspace.counts.leadRoles} 个关键角色已任命`,
        action: "查看角色申请与任命",
      },
      {
        label: "成员",
        href: "/app/people",
        summary: `${workspace.counts.people} 个成员`,
        action: "管理成员",
      },
      {
        label: "系统配置",
        href: "/app/setup",
        summary: modelSettings.provider === "system" || modelSettings.hasApiKey
          ? "组织大脑模型已配置"
          : "组织大脑模型待配置",
        action: "调整配置",
      },
    ] as const;

    return (
      <div className="mx-auto max-w-6xl animate-fade-rise space-y-6">
        <OrganizationSubnav active="overview" />

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              组织
            </p>
            <h1 className="mt-2 font-serif text-3xl font-medium">{workspace.organization.name}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              组织已启用。这里是日常组织运营入口，不再显示初始设置工作台。
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-md border border-moss/30 bg-moss-pale/40 px-3 py-2 text-sm text-moss">
            <CheckCircle2 className="size-4" />
            已启用
          </span>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activeCards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="rounded-card border border-border bg-card p-5 text-sm shadow-soft transition hover:border-moss/40"
            >
              <h2 className="text-base font-semibold">{card.label}</h2>
              <p className="mt-2 min-h-10 leading-6 text-muted-foreground">{card.summary}</p>
              <span className="mt-4 inline-flex font-medium text-moss">{card.action}</span>
            </Link>
          ))}
        </section>

        <section className="rounded-card border border-border bg-card p-5">
          <h2 className="text-base font-semibold">组织运行状态</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {workspace.readiness.map((check) => (
              <div key={check.label} className="rounded-md border border-border bg-background p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {check.done
                    ? <CheckCircle2 className="size-4 text-moss" aria-hidden="true" />
                    : <CircleAlert className="size-4 text-amber-600" aria-hidden="true" />}
                  {check.label}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{setupWorkspaceStatusText(check.done)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl animate-fade-rise space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            组织
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium">{workspace.organization.name}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {active
              ? "组织已启用，可以进入结构、目标、角色和会议节奏。"
              : "组织处于设置模式。完成最低准备度检查后，由管理员确认启用。角色任命和目标设定由各回路负责人自行完成。"}
          </p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
          active ? "border-moss/30 bg-moss-pale/40 text-moss" : "border-amber-300 bg-amber-50 text-amber-800"
        }`}>
          {active ? <CheckCircle2 className="size-4" /> : <LockKeyhole className="size-4" />}
          {active ? "已启用" : "设置模式"}
        </span>
      </header>

      {!active && (
        <section className="rounded-card border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">最低准备度</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                满足以下条件即可启用组织。角色任命和目标设定可在启用后由各回路负责人完成。
              </p>
            </div>
            {isAdmin ? <ActivationForm disabled={!workspace.readyToActivate} /> : null}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {workspace.readiness.map((check) => (
              <div key={check.label} className="rounded-md border border-border bg-background p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {check.done
                    ? <CheckCircle2 className="size-4 text-moss" aria-hidden="true" />
                    : <CircleAlert className="size-4 text-amber-600" aria-hidden="true" />}
                  {check.label}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{setupWorkspaceStatusText(check.done)}</p>
              </div>
            ))}
          </div>
          {!isAdmin && (
            <p className="mt-4 text-sm text-muted-foreground">
              当前账号不是组织管理员，只能查看准备状态。
            </p>
          )}
        </section>
      )}

      {!active && (
        <section className="rounded-card border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">下一步准备度</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                按当前缺口顺序处理即可。全部就绪后，管理员可以确认启用组织。
              </p>
            </div>
            <span className={`rounded-md px-2 py-1 text-xs ${readinessActions.length === 0 ? "bg-moss-pale/50 text-moss" : "bg-amber-50 text-amber-700"}`}>
              {readinessActions.length === 0 ? "可以启用" : `${readinessActions.length} 个缺口`}
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {readinessActions.length === 0 ? (
              <div className="rounded-md border border-moss/20 bg-moss-pale/30 p-4 text-sm text-moss">
                最低准备度已满足。请复核组织结构后，由管理员确认启用。角色任命和目标可在启用后由各回路负责人完成。
              </div>
            ) : readinessActions.map((item, index) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-md border border-border bg-background p-4 text-sm transition hover:border-moss/40"
              >
                <p className="font-medium">
                  <span className="mr-2 text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                  {item.label}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.action}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-card border border-border bg-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">组织设置工作台</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              按顺序完成组织基础配置。角色任命和目标设定为非阻塞项，可由回路负责人后续完成。
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {workspace.steps.filter((step) => step.done).length} / {workspace.steps.length} 已完成
          </p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {workspace.steps.map((step) => (
            <Link
              key={step.key}
              href={step.href}
              className="rounded-md border border-border bg-background p-4 text-sm transition hover:border-moss/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    <span className="mr-2 text-xs text-muted-foreground">{String(step.index).padStart(2, "0")}</span>
                    {step.label}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{step.summary}</p>
                </div>
                <span className={`rounded-md px-2 py-1 text-xs ${step.done ? "bg-moss-pale/50 text-moss" : "bg-amber-50 text-amber-700"}`}>
                  {setupWorkspaceStatusText(step.done)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section id="organization-identity" className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">01 组织身份</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            先明确组织是谁、为什么存在，以及组织大脑理解团队时使用的基本上下文。
          </p>
        </div>
        <OrganizationProfileForm
          name={workspace.organization.name}
          purpose={workspace.organization.purpose ?? ""}
          profile={governanceConfig.profile}
          canEdit={isAdmin}
        />
      </section>

      <section id="organization-structure" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">02 组织结构</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              设置模式下可以基于模板生成初始结构；一旦产生运转历史或正式启用，就只能通过组织结构和治理流程持续调整。
            </p>
          </div>
          <Link href="/app/circles/map" className="text-sm font-medium text-moss hover:underline">
            打开组织结构
          </Link>
        </div>
        {initialized ? (
          <div className="rounded-card border border-border bg-card p-5">
            <h3 className="font-serif text-lg font-medium">组织结构初始化已关闭</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              当前有 {workspace.counts.structures} 个结构单元。初始化不可重新进入，后续结构变化应通过组织结构编辑或治理流程完成。
            </p>
            <Link href="/app/goals" className="mt-4 inline-flex text-sm font-medium text-moss hover:underline">
              下一步：打开组织目标
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {allTemplates.map((template) => (
              <div key={template.id} className="rounded-card border border-border bg-card p-5 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-lg font-medium">{template.name}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{template.description}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {template.circles.length} 结构 · {template.interfaces.length} 接口
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {template.circles.slice(0, 4).map((circle) => (
                    <div key={circle.key} className="rounded-md border border-border bg-background p-3">
                      <p className="text-sm font-medium">{circle.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{circle.purpose}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  {isAdmin ? (
                    <InitForm templateId={template.id} templateName={template.name} />
                  ) : (
                    <p className="text-xs text-muted-foreground">只有组织管理员可以初始化结构。</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-card border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">03 组织目标</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                目标需要进入目标工作区按周期设定。初始化可以先创建目标周期，但不会替组织决定主目标。
              </p>
            </div>
            <span className={`rounded-md px-2 py-1 text-xs ${workspace.counts.activeGoals > 0 ? "bg-moss-pale/50 text-moss" : "bg-amber-50 text-amber-700"}`}>
              {workspace.counts.activeGoals} 个活跃目标
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link href="/app/goals" className="font-medium text-moss hover:underline">
              打开目标工作区
            </Link>
            <span className="text-muted-foreground">
              {workspace.counts.goalCycles > 0 ? `${workspace.counts.goalCycles} 个目标周期` : "尚未建立目标周期"}
            </span>
          </div>
        </div>

        <div className="rounded-card border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">04 角色定义</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                角色定义承载目的、权责和责任。初始化后可在组织结构中继续查看和调整。
              </p>
            </div>
            <span className={`rounded-md px-2 py-1 text-xs ${workspace.counts.roles > 0 ? "bg-moss-pale/50 text-moss" : "bg-amber-50 text-amber-700"}`}>
              {workspace.counts.roles} 个活跃角色
            </span>
          </div>
          <Link href="/app/circles/map" className="mt-4 inline-flex text-sm font-medium text-moss hover:underline">
            查看组织结构和角色
          </Link>
        </div>

        <div className="rounded-card border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">05 成员邀请</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                设置模式下可先准备成员和 HELD 邀请；组织启用时再释放待发送邀请。
              </p>
            </div>
            <span className={`rounded-md px-2 py-1 text-xs ${workspace.counts.people > 0 ? "bg-moss-pale/50 text-moss" : "bg-amber-50 text-amber-700"}`}>
              {workspace.counts.people} 个成员
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link href="/app/people" className="font-medium text-moss hover:underline">
              管理成员邀请
            </Link>
            <span className="text-muted-foreground">
              {workspace.counts.heldInvitations} 个待激活发送邀请
            </span>
          </div>
        </div>

        <div className="rounded-card border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">06 角色任命</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                关键角色需要至少一个真人承担者。任命和申请应通过角色市场或治理流程留下依据。
              </p>
            </div>
            <span className={`rounded-md px-2 py-1 text-xs ${workspace.counts.assignedLeadRoles > 0 ? "bg-moss-pale/50 text-moss" : "bg-amber-50 text-amber-700"}`}>
              {workspace.counts.assignedLeadRoles} / {workspace.counts.leadRoles} 关键角色已任命
            </span>
          </div>
          <Link href="/app/roles/market" className="mt-4 inline-flex text-sm font-medium text-moss hover:underline">
            打开角色市场
          </Link>
        </div>
      </section>

      <section id="system-configuration" className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">07 系统配置</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            配置组织语言、治理规则和组织大脑模型。这里的配置会影响后续张力、会议和组织大脑交互。
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <TerminologyForm
            terminology={governanceConfig.terminology}
            version={governanceConfig.version}
            canEdit={isAdmin}
          />
          <GovernanceRulesForm
            rules={governanceConfig.rules}
            version={governanceConfig.version}
            canEdit={isAdmin}
          />
        </div>
        <ModelSettingsForm summary={modelSettings} canEdit={isAdmin} />
      </section>
    </div>
  );
}
