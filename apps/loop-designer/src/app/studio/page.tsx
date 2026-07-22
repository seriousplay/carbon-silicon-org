import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { StudioEntryGrid } from "@/components/studio-entry-grid";

export const metadata: Metadata = {
  title: "碳硅组织进化工作室",
  description: "AI时代领导者的组织设计工具集。",
};

const studioEntries = [
  {
    icon: "questionnaire" as const,
    label: "01",
    title: "课前问卷",
    href: "/start/questionnaire",
    action: "填写问卷",
    loadingAction: "正在进入问卷...",
  },
  {
    icon: "blueprint" as const,
    label: "02",
    title: "组织蓝图设计",
    href: "/start/blueprint",
    action: "进入蓝图",
    loadingAction: "正在启动蓝图...",
  },
  {
    icon: "loop" as const,
    label: "03",
    title: "业务回路设计",
    href: "/start/loop-design",
    action: "设计回路",
    loadingAction: "正在建立回路...",
  },
];

export default async function StudioPage() {
  const user = await getCurrentUser();

  return (
    <main className="min-h-screen overflow-hidden bg-[#06110f] text-[#eef9f4]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(98,217,207,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(98,217,207,0.05)_1px,transparent_1px)] bg-[size:44px_44px] opacity-80" />
      </div>

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <Link href="/studio" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center border border-[var(--acid)]/55 bg-[var(--acid)]/10 text-sm font-black text-[var(--acid)]">
              CSi
            </span>
            <span className="block text-sm font-black text-white">碳硅组织进化工作室</span>
          </Link>

          {user ? (
            <div className="flex items-center gap-3 text-xs font-semibold text-white/58">
              <Link href="/profile" className="hidden max-w-36 truncate hover:text-[var(--acid)] sm:inline">
                用户：{user.displayName}
              </Link>
              <form action="/loop-designer/api/auth/logout?next=/loop-designer/studio" method="post">
                <button className="border border-white/14 bg-black/20 px-4 py-2 text-xs font-black text-white/72 hover:border-[var(--acid)] hover:text-[var(--acid)]">
                  退出
                </button>
              </form>
            </div>
          ) : (
            <Link
              className="border border-white/14 bg-black/20 px-4 py-2 text-xs font-black text-white/72 hover:border-[var(--acid)] hover:text-[var(--acid)]"
              href="/auth/login?next=/loop-designer/studio"
            >
              登录
            </Link>
          )}
        </header>

        <div className="flex flex-1 flex-col justify-center gap-10 py-12 lg:py-16">
          <div className="max-w-4xl">
            <h1 className="text-5xl font-black leading-[1.02] text-white sm:text-6xl lg:text-7xl">
              碳硅组织进化工作室
            </h1>
            <p className="mt-6 text-xl font-semibold leading-8 text-white/70 sm:text-2xl">
              AI时代领导者的组织设计工具集
            </p>
          </div>

          <StudioEntryGrid entries={studioEntries} />
        </div>
      </section>
    </main>
  );
}
