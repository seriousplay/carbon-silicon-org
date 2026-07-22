import Link from "next/link";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center px-5">
      <section className="panel w-full max-w-xl p-8 md:p-12">
        <div className="mono text-[10px] tracking-[.2em] text-[var(--signal)]">FEISHU AUTH ERROR</div>
        <h1 className="mt-5 text-3xl font-black">飞书登录未完成</h1>
        <p className="mt-4 leading-7 text-white/60">{reason || "授权过程中发生错误，请重新登录。"}</p>
        <Link
          href="/auth/login"
          className="mt-8 inline-flex bg-[var(--acid)] px-5 py-3 font-black text-[#0b130f]"
        >
          返回登录页
        </Link>
      </section>
    </main>
  );
}
