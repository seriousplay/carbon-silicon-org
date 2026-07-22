import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "碳硅组织 | AI时代的商业进化论",
  description: "《碳硅组织》书籍官方网站 — 探索AI时代的组织进化框架、诊断工具与工作坊。",
};

export default function BookHomePage() {
  return (
    <main className="min-h-screen bg-[#06110f] text-white">
      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pb-24 pt-32 text-center">
        <p className="text-sm font-medium tracking-widest text-emerald-300/70">
          碳硅组织 · CARBON-SILICON ORGANIZATION
        </p>
        <h1 className="mt-6 text-5xl font-black tracking-tight sm:text-6xl">
          AI 时代的
          <br />
          <span className="text-emerald-300">商业进化论</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-emerald-50/65">
          从人力规模到智能密度，新一代组织正在涌现。本书提供完整的碳硅组织框架——
          一套将 AI 深度嵌入组织基因的方法论、诊断工具与实践路径。
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/loop-designer/studio"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-300 px-8 py-3 text-sm font-black text-[#06110f] transition hover:bg-emerald-200"
          >
            进入回路设计器
            <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="/book/tools"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 px-8 py-3 text-sm font-bold text-emerald-100 transition hover:border-emerald-200/40 hover:bg-white/5"
          >
            浏览配套工具
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 pb-32">
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200/10 bg-white/[0.03] p-6">
            <div className="text-2xl">📖</div>
            <h3 className="mt-4 text-lg font-bold">组织诊断</h3>
            <p className="mt-2 text-sm text-emerald-50/55">
              基于螺旋模型与能量模型的在线测评，5 分钟定位组织进化阶段。
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200/10 bg-white/[0.03] p-6">
            <div className="text-2xl">🔧</div>
            <h3 className="mt-4 text-lg font-bold">22 个 OD 工具</h3>
            <p className="mt-2 text-sm text-emerald-50/55">
              按章节编排的方法论工具库，每个工具配有操作指南和 AI 辅助提示词。
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200/10 bg-white/[0.03] p-6">
            <div className="text-2xl">🏭</div>
            <h3 className="mt-4 text-lg font-bold">企业工作坊</h3>
            <p className="mt-2 text-sm text-emerald-50/55">
              支持现场工作坊的数据采集、实时分析与群体报告生成。
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-emerald-200/10">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="text-2xl font-black">准备好进化你的组织？</h2>
          <p className="mt-3 text-emerald-50/55">
            从一次在线诊断开始，或直接进入回路设计器创建你的第一个 AI 原生回路。
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/book/e/20260517-hr-od-workshop/start"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-300 px-8 py-3 text-sm font-black text-[#06110f] transition hover:bg-emerald-200"
            >
              开始组织诊断
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
