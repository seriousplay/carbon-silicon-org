import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginClient from "./login-client";

export const metadata: Metadata = {
  title: "碳硅组织设计工作室 - 登录",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    const next = (await searchParams).next || "/loop-designer";
    redirect(toAppPath(next));
  }

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-white/40">加载中...</div>}>
      <LoginClient />
    </Suspense>
  );
}

function toAppPath(value: string) {
  if (value === "/loop-designer") return "/";
  if (value.startsWith("/loop-designer/")) return value.slice("/loop-designer".length);
  if (value.startsWith("/")) return value;
  return "/";
}
