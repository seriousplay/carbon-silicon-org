import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import MembersTab from "./members-tab";
import SubscriptionTab from "./subscription-tab";
import AuditLogsTab from "./audit-logs-tab";
import SettingsTab from "./settings-tab";

/**
 * 企业管理员控制台
 *
 * 路由：/admin/enterprise
 * 权限：需要管理员权限
 *
 * Tab 结构：
 * - 成员管理（manage_members）
 * - 订阅管理（manage_billing）
 * - 审计日志（view_audit_logs）
 * - 企业设置（modify_settings）
 */

interface SearchParams {
  tab?: string;
}

const ADMIN_TABS = ["members", "subscription", "audit-logs", "settings"] as const;
type AdminTab = typeof ADMIN_TABS[number];

function normalizeTab(value: string | undefined): AdminTab {
  return ADMIN_TABS.includes(value as AdminTab) ? (value as AdminTab) : "members";
}

export default async function EnterpriseAdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const tab = normalizeTab((await searchParams).tab);

  // 验证管理员权限
  try {
    const user = await getCurrentUser();
    if (!user) redirect("/?error=unauthorized");
    await requireAdmin(
      user,
      ["manage_members", "manage_billing", "view_audit_logs", "modify_settings"]
    );
  } catch {
    redirect("/?error=unauthorized");
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20">
        <div className="mx-auto max-w-7xl px-5 py-4 md:px-10">
          <div className="flex items-center justify-between">
            <div>
              <div className="mono text-[10px] tracking-[.2em] text-white/40">
                ENTERPRISE ADMIN
              </div>
              <h1 className="text-2xl font-bold">企业管理员控制台</h1>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/admin/prework/624/report"
                className="mono text-xs text-[var(--cyan)] hover:text-[var(--acid)]"
              >
                6.24问卷报告
              </Link>
              <Link
                href="/"
                className="mono text-xs text-white/55 hover:text-[var(--acid)]"
              >
                ← 返回应用
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-white/10">
        <div className="mx-auto max-w-7xl px-5 md:px-10">
          <nav className="flex gap-1">
            <TabLink href="?tab=members" active={tab === "members"}>
              成员管理
            </TabLink>
            <TabLink href="?tab=subscription" active={tab === "subscription"}>
              订阅管理
            </TabLink>
            <TabLink href="?tab=audit-logs" active={tab === "audit-logs"}>
              审计日志
            </TabLink>
            <TabLink href="?tab=settings" active={tab === "settings"}>
              企业设置
            </TabLink>
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-5 py-8 md:px-10">
        <Suspense fallback={<div className="text-white/55">加载中...</div>}>
          {tab === "members" && <MembersTab />}
          {tab === "subscription" && <SubscriptionTab />}
          {tab === "audit-logs" && <AuditLogsTab />}
          {tab === "settings" && <SettingsTab />}
        </Suspense>
      </main>
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-4 py-3 text-sm font-medium transition-colors ${
        active
          ? "border-b-2 border-[var(--acid)] text-[var(--acid)]"
          : "text-white/55 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
