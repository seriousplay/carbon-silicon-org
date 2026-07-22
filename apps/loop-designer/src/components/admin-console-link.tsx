import Link from "next/link";
import { isEnterpriseAdmin } from "@/lib/admin-console";
import { getCurrentUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-admin";

/**
 * 管理员入口链接
 * 仅对企业管理员可见
 */
export async function AdminConsoleLink() {
  const user = await getCurrentUser();
  if (!user) return null;

  const isAdmin = await isEnterpriseAdmin(user);
  const isPlatform = await isPlatformAdmin(user);
  if (!isAdmin && !isPlatform) return null;

  return (
    <>
      {isPlatform ? (
        <Link
          href="/admin/platform"
          className="rounded border border-[var(--acid)]/30 px-3 py-1.5 text-xs text-[var(--acid)] hover:bg-white/10"
        >
          平台租户
        </Link>
      ) : null}
      {isAdmin ? (
        <Link
          href="/admin/prework/624/report"
          className="rounded border border-[var(--cyan)]/30 px-3 py-1.5 text-xs text-[var(--cyan)] hover:bg-[var(--cyan)]/10"
        >
          6.24问卷报告
        </Link>
      ) : null}
      {isAdmin ? (
        <Link
          href="/admin/enterprise"
          className="rounded border border-purple-500/30 px-3 py-1.5 text-xs text-purple-400 hover:bg-purple-500/10"
        >
          管理后台
        </Link>
      ) : null}
    </>
  );
}
