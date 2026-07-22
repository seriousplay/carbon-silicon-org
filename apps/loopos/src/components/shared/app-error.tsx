"use client";
/**
 * 通用 Error Boundary — 活体组织美学风格
 */
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-md mx-auto mt-20 text-center">
      <div className="text-4xl mb-4 text-needs-light/60">◑</div>
      <h2 className="font-serif text-xl font-medium mb-2">页面暂时无法打开</h2>
      <p className="text-sm text-muted-foreground mb-6">
        组织正在调整呼吸。请稍后重试。
      </p>
      <Button onClick={reset}>重试</Button>
    </div>
  );
}
