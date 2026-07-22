import type { Metadata } from "next";
import { LoopDesignerLogo } from "@/components/loop-designer-logo";
import { PreworkLoginForm } from "@/components/prework-login-form";

export const metadata: Metadata = {
  title: "AI时代的组织进化 - 高维学堂闭门课",
  description: "请认真填写课前问卷，问卷内容将作为此次课程后续工具的输入上下文。",
};

export default async function Prework624Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const error = (await searchParams).error;
  return (
    <main className="min-h-screen overflow-hidden px-5 py-8 md:px-10 md:py-12">
      <section className="mx-auto grid min-h-[calc(100vh-6rem)] w-full max-w-6xl items-center gap-6 lg:grid-cols-[1.18fr_.82fr]">
        <div className="relative overflow-hidden border border-white/10 bg-[#07100f] p-6 shadow-[0_30px_120px_rgba(0,0,0,.36)] md:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(98,217,207,.26),transparent_26%),radial-gradient(circle_at_78%_24%,rgba(183,243,74,.2),transparent_24%),linear-gradient(135deg,rgba(233,240,232,.08),transparent_38%)]" />
          <div className="absolute -right-24 top-12 h-72 w-72 rounded-full border border-[var(--acid)]/25" />
          <div className="absolute -bottom-24 left-8 h-72 w-72 rounded-full border border-[var(--cyan)]/20" />
          <div className="relative">
            <div className="flex items-center justify-between gap-4">
              <LoopDesignerLogo className="h-20 w-20 md:h-24 md:w-24" />
              <div className="mono border border-[var(--acid)]/40 bg-black/20 px-3 py-2 text-right text-[10px] tracking-[.22em] text-[var(--acid)]">
                6.24 CEO PREWORK
              </div>
            </div>
            <div className="mt-16 max-w-2xl md:mt-24">
              <div className="mono text-[11px] tracking-[.28em] text-[var(--cyan)]">CARBON SILICON ORG STUDIO</div>
              <h1 className="mt-5 text-5xl font-black leading-[1.02] tracking-[-.05em] md:text-7xl">
                AI时代的<br />组织进化
              </h1>
              <p className="mt-5 text-xl font-semibold text-white/82">高维学堂闭门课</p>
              <p className="mt-7 max-w-xl text-base leading-8 text-white/58">
                请填写您的真实手机号，手机号将作为后续登录的唯一标识。同时，您提供的问卷回复信息将被用于课程后续工具的上下文输入，请务必认真填写。谢谢！
              </p>
            </div>
            <div className="mt-10 grid gap-3 text-xs text-white/55 sm:grid-cols-3">
              <div className="border border-white/10 bg-black/20 p-3">课前问卷</div>
              <div className="border border-white/10 bg-black/20 p-3">进化蓝图</div>
              <div className="border border-white/10 bg-black/20 p-3">回路设计</div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <PreworkLoginForm error={error} />

        </div>
      </section>
    </main>
  );
}
