"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { publishLogAction } from "./log-actions";

export function PublishLogButton({ logId }: { logId: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handlePublish() {
    setPending(true);
    await publishLogAction(logId);
    router.refresh();
    setPending(false);
  }

  return (
    <Button onClick={handlePublish} disabled={pending} size="sm" variant="outline">
      {pending ? "发布中…" : "审阅后发布"}
    </Button>
  );
}
