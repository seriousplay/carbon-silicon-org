import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProfileCard } from "@/components/profile-card";
import { requireUser } from "@/lib/auth";
import { getUserProfile } from "@/lib/user-profile";

export default async function ProfilePage() {
  const user = await requireUser("/loop-designer/profile");
  const profile = await getUserProfile(user);

  return (
    <main className="min-h-screen px-5 py-6 md:px-10 md:py-10">
      <header className="mx-auto flex max-w-4xl items-center justify-between border-b border-white/10 pb-5">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/55 hover:text-white">
          <ArrowLeft size={16} /> 返回回路 Inbox
        </Link>
        <div className="mono text-[10px] tracking-[.18em] text-white/35">USER SETTINGS</div>
      </header>

      <section className="mx-auto max-w-4xl py-9">
        <div className="mb-6">
          <div className="mono text-[10px] tracking-[.2em] text-[var(--acid)]">ACCOUNT</div>
          <h1 className="mt-3 text-4xl font-black leading-tight">个人设置</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/52">
            修改用户名、公司信息和登录密码。手机号仍作为登录的唯一标识。
          </p>
        </div>
        <ProfileCard profile={profile} />
      </section>
    </main>
  );
}
