"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { draftLogAction } from "./log-actions";

export function DraftLogButton({ period, aiOn }: { period: string; aiOn: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleDraft() {
    setPending(true);
    setError(null);
    const result = await draftLogAction(period);
    if (result?.error) {
      setError(result.error);
      setPending(false);
    } else if (result?.ok) {
      router.refresh();
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={handleDraft} disabled={pending || !aiOn} size="sm">
        {pending ? "AI 起草中…" : "✨ AI 起草本月日志"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
