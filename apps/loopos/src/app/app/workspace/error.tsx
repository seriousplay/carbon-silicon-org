"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WorkspaceError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="mx-auto max-w-5xl border-y border-border py-12 text-center">
      <h2 className="text-base font-medium">工作台暂时无法打开</h2>
      <p className="mt-2 text-sm text-muted-foreground">请重试，已保存的组织信息不会受影响。</p>
      <Button className="mt-5" type="button" variant="outline" onClick={() => unstable_retry()}>
        <RotateCcw aria-hidden="true" />
        重试
      </Button>
    </div>
  );
}
