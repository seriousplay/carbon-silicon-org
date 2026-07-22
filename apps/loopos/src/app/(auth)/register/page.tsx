"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction, type AuthState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    registerAction,
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
          <div className="mb-8 flex gap-1.5">
            {/* 一颗种子即将发芽的意象 */}
            <div className="relative h-12 w-12">
              <div className="absolute inset-0 rounded-full border-2 border-moss/30 animate-breathe" />
              <div className="absolute inset-2.5 rounded-full bg-moss/20" />
              <div className="absolute inset-4 rounded-full bg-moss" />
            </div>
          </div>
          <p className="font-serif text-2xl leading-relaxed">
            种下一颗
            <br />
            <span className="text-moss">组织的种子。</span>
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            从一个回路开始。
            <br />
            让组织学会感知自己的张力，
            <br />
            在呼吸中持续生长。
          </p>
        </div>

        <p className="text-xs text-muted-foreground">回路OS · 让组织学会自我生长</p>
      </div>

      {/* 右侧表单 */}
      <div className="flex w-full md:w-1/2 items-center justify-center p-6">
        <div className="w-full max-w-sm animate-fade-rise">
          <h1 className="font-serif text-2xl font-medium mb-2">创建组织</h1>
          <p className="text-sm text-muted-foreground mb-8">
            填写信息，开启你的回路制之旅
          </p>

          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">组织名称</Label>
              <Input
                id="orgName"
                name="orgName"
                placeholder="如：你的团队名"
                required
              />
              <p className="text-xs text-muted-foreground">组织在回路OS 里的名字</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">你的姓名</Label>
              <Input id="name" name="name" placeholder="如何称呼你" required />
            </div>

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
                autoComplete="new-password"
              />
            </div>

            {state?.error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-input px-3 py-2">
                {state.error}
              </p>
            )}

            <Button type="submit" disabled={pending} className="w-full" size="lg">
              {pending ? "创建中…" : "创建组织"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            已有账号？{" "}
            <Link href="/login" className="text-moss hover:underline">
              直接登录
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
