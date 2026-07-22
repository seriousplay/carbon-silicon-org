"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createBrowserAuthClient } from "@/lib/auth/client";

export function HeaderAuth() {
  const supabase = useMemo(() => createBrowserAuthClient(), []);
  const [loading, setLoading] = useState(() => Boolean(supabase));
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  if (loading) {
    return <span className="rounded-full px-3 py-2 text-emerald-50/45">...</span>;
  }

  if (!user) {
    return (
      <Link className="rounded-full px-3 py-2 hover:bg-white/10 hover:text-white" href="/login">
        登录
      </Link>
    );
  }

  const displayName =
    stringValue(user.user_metadata?.display_name) ??
    stringValue(user.user_metadata?.full_name) ??
    stringValue(user.user_metadata?.name) ??
    user.email ??
    "已登录";

  return (
    <span className="flex items-center gap-2">
      <Link className="max-w-48 truncate rounded-full px-3 py-2 text-emerald-100 hover:bg-white/10 hover:text-white" href="/dashboard" prefetch={false}>
        {displayName}
      </Link>
      <Link className="rounded-full px-3 py-2 text-emerald-50/60 hover:bg-white/10 hover:text-white" href="/auth/signout" prefetch={false}>
        退出登录
      </Link>
    </span>
  );
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
