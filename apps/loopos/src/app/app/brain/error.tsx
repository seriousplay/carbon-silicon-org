"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OrganizationBrainError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="mx-auto max-w-4xl border-y border-border py-12 text-center">
      <h2 className="mb-2 text-base font-medium">组织大脑暂时无法打开</h2>
      <p className="mb-5 text-sm text-muted-foreground">请重试，不会丢失已保存的对话。</p>
      <Button type="button" variant="outline" onClick={() => unstable_retry()}>
        <RotateCcw aria-hidden="true" />
        重试
      </Button>
    </div>
  );
}
