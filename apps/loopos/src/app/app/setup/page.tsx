import Link from "next/link";
import { getCurrentOrgId, requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getOrganizationModelSettingsSummary } from "@/lib/ai/organization-model-settings";
import { allTemplates } from "@/lib/org-templates";
import { ModelSettingsForm } from "./model-settings-form";
import { isOrgInitialized } from "./actions";
import { getOrganizationGovernanceConfig } from "@/lib/organization-governance-config";
import { TerminologyForm } from "./terminology-form";
import { GovernanceRulesForm } from "./governance-rules-form";
import { OrganizationProfileForm } from "./organization-profile-form";
import { AiTemplateForm } from "./ai-template-form";

export default async function SetupPage() {
  const session = await requireSession();
  const orgId = await getCurrentOrgId();
  const initialized = await isOrgInitialized();

  const [circleCount, membership, modelSettings, governanceConfig, organization] = await Promise.all([
    prisma.circle.count({
      where: { organizationId: orgId, status: { not: "ARCHIVED" } },
    }),
    prisma.membership.findUnique({
      where: { userId_organizationId: { userId: session.user.id, organizationId: orgId } },
      select: { role: true },
    }),
    getOrganizationModelSettingsSummary(orgId),
    getOrganizationGovernanceConfig(orgId),
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, purpose: true } }),
  ]);
  const canEdit = membership?.role === "ORG_ADMIN";

  return (
    <div className="max-w-3xl mx-auto animate-fade-rise">
      <Link
        href="/app"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 inline-block"
      >
        ← 返回
      </Link>

      <h1 className="font-serif text-2xl font-medium mb-2">组织初始化</h1>
      <p className="text-sm text-muted-foreground mb-8">
        配置组织基本信息，AI 智能生成初始回路结构。
      </p>

      <div className="mb-8">
        <OrganizationProfileForm name={organization?.name ?? ""} purpose={organization?.purpose ?? ""} profile={governanceConfig.profile} canEdit={canEdit} />
      </div>

      <div className="mb-8">
        <ModelSettingsForm summary={modelSettings} canEdit={canEdit} />
      </div>

      {initialized ? (
        <div className="rounded-card border border-border bg-card p-8 text-center">
          <div className="text-3xl mb-3 text-moss">✓</div>
          <h2 className="font-serif text-lg font-medium mb-2">组织已初始化</h2>
          <p className="text-sm text-muted-foreground mb-6">
            当前有 {circleCount} 个回路。各回路负责人可在回路详情中设定自己的目标。
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/app/circles">
              <span className="text-sm text-moss hover:underline">查看回路</span>
            </Link>
            <Link href="/app/circles/map">
              <span className="text-sm text-moss hover:underline">回路地图</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6 mb-8">
          <h2 className="font-serif text-lg font-medium">建立组织结构</h2>
          <AiTemplateForm fallbackTemplates={allTemplates} />
        </div>
      )}

      <div className="mb-8">
        <TerminologyForm terminology={governanceConfig.terminology} version={governanceConfig.version} canEdit={canEdit} />
      </div>

      <div className="mb-8">
        <GovernanceRulesForm rules={governanceConfig.rules} version={governanceConfig.version} canEdit={canEdit} />
      </div>
    </div>
  );
}
