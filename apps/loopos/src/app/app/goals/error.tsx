"use client";

import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function GoalsError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="mx-auto max-w-5xl border-y border-border py-12 text-center">
      <h2 className="text-base font-medium">目标暂时无法打开</h2>
      <p className="mt-2 text-sm text-muted-foreground">请重试，已保存的目标信息不会受影响。</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button type="button" variant="outline" onClick={() => unstable_retry()}>
          <RotateCcw aria-hidden="true" />
          重试
        </Button>
        <Button
          variant="ghost"
          nativeButton={false}
          render={<Link href="/app/goals" />}
        >
          <ArrowLeft aria-hidden="true" />
          回到目标页
        </Button>
      </div>
    </div>
  );
}
