import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listPlatformEnterprises, requirePlatformAdmin } from "@/lib/platform-admin";
import { PlatformEnterprisesClient } from "./platform-enterprises-client";

export default async function PlatformAdminPage() {
  let enterprises: Awaited<ReturnType<typeof listPlatformEnterprises>> = [];
  try {
    const user = await getCurrentUser();
    if (!user) redirect("/?error=unauthorized");
    await requirePlatformAdmin(user);
    enterprises = await listPlatformEnterprises();
  } catch {
    redirect("/?error=unauthorized");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 bg-black/20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-10">
          <div>
            <div className="mono text-[10px] tracking-[.2em] text-white/40">
              PLATFORM ADMIN
            </div>
            <h1 className="text-2xl font-bold">平台租户管理</h1>
            <p className="mt-2 text-sm text-white/50">
              活动后可逐个关闭或恢复企业租户访问；租户数据不会被删除。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/prework/624/report" className="mono text-xs text-[var(--cyan)] hover:text-[var(--acid)]">
              6.24问卷报告
            </Link>
            <Link href="/" className="mono text-xs text-white/55 hover:text-[var(--acid)]">
              ← 返回应用
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 md:px-10">
        <PlatformEnterprisesClient initialEnterprises={enterprises} />
      </main>
    </div>
  );
}
