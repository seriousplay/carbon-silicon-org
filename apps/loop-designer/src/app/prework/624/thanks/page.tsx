import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "课前问卷已提交",
};

export default function Prework624ThanksPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <section className="panel max-w-lg p-8 text-center">
        <CheckCircle2 className="mx-auto text-[var(--acid)]" size={54} />
        <div className="mono mt-5 text-[10px] tracking-[.22em] text-[var(--acid)]">SUBMITTED</div>
        <h1 className="mt-4 text-4xl font-black">问卷已提交</h1>
        <p className="mt-4 leading-7 text-white/58">
          感谢完成 6.24 闭门会课前问卷。
        </p>
        <Link href="/prework/624" className="mt-7 inline-flex border border-white/15 px-5 py-3 text-sm text-white/62 hover:border-[var(--acid)] hover:text-[var(--acid)]">
          返回问卷入口
        </Link>
      </section>
    </main>
  );
}
