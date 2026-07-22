"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type AuthState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    loginAction,
    {}
  );

  return (
    <div className="flex min-h-screen">
      {/* 左侧品牌氛围 */}
      <div className="hidden md:flex md:w-1/2 flex-col justify-between bg-sidebar p-12">
        <Link href="/" className="flex items-center gap-2 w-fit">
          <div className="h-8 w-8 rounded-full border-2 border-moss flex items-center justify-center">
            <div className="h-3 w-3 rounded-full bg-moss" />
          </div>
          <span className="font-serif text-lg font-medium">回路OS</span>
        </Link>

        <div className="max-w-sm">
          <div className="mb-8">
            <div className="relative h-12 w-12">
              <div className="absolute inset-0 rounded-full border-2 border-moss/30 animate-breathe" />
              <div className="absolute inset-2.5 rounded-full bg-moss/20" />
              <div className="absolute inset-4 rounded-full bg-moss" />
            </div>
          </div>
          <p className="font-serif text-2xl leading-relaxed">
            回来照护
            <br />
            <span className="text-moss">这个活的生命体。</span>
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            组织不是机器，不需要被管控。
            <br />
            它需要被看见，被滋养，被允许呼吸。
          </p>
        </div>

        <p className="text-xs text-muted-foreground">回路OS · 让组织学会自我生长</p>
      </div>

      {/* 右侧表单 */}
      <div className="flex w-full md:w-1/2 items-center justify-center p-6">
        <div className="w-full max-w-sm animate-fade-rise">
          <h1 className="font-serif text-2xl font-medium mb-2">欢迎回来</h1>
          <p className="text-sm text-muted-foreground mb-8">登录你的组织</p>

          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@org.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="至少 8 位"
                required
                autoComplete="current-password"
              />
            </div>

            {state?.error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-input px-3 py-2">
                {state.error}
              </p>
            )}

            <Button type="submit" disabled={pending} className="w-full" size="lg">
              {pending ? "登录中…" : "登录"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            还没有账号？{" "}
            <Link href="/register" className="text-moss hover:underline">
              创建组织
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
