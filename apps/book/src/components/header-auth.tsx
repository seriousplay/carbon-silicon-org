"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export function HeaderAuth() {
  const { data: session, status } = useSession();
  const loading = status === "loading";
  const user = session?.user;

  if (loading) {
    return <span className="rounded-full px-3 py-2 text-emerald-50/45">...</span>;
  }

  if (!user) {
    return (
      <Link
        className="rounded-full px-3 py-2 hover:bg-white/10 hover:text-white"
        href="/login"
      >
        登录
      </Link>
    );
  }

  const displayName = user.name || user.email || "已登录";

  return (
    <span className="flex items-center gap-2">
      <Link
        className="max-w-48 truncate rounded-full px-3 py-2 text-emerald-100 hover:bg-white/10 hover:text-white"
        href="/dashboard"
        prefetch={false}
      >
        {displayName}
      </Link>
      <Link
        className="rounded-full px-3 py-2 text-emerald-50/60 hover:bg-white/10 hover:text-white"
        href="/api/auth/signout"
        prefetch={false}
      >
        退出登录
      </Link>
    </span>
  );
}
