"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { initializeOrgAction } from "./actions";

export function InitForm({
  templateId,
  templateName,
}: {
  templateId: string;
  templateName: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleInit() {
    setPending(true);
    setError(null);

    const formData = new FormData();
    formData.set("templateId", templateId);

    try {
      const result = await initializeOrgAction(undefined, formData);
      setPending(false);
      if (result?.error) {
        setError(result.error);
      } else if (result?.ok) {
        router.push("/app/organization");
        router.refresh();
      }
    } catch {
      setPending(false);
      setError("初始化请求失败，请刷新页面后重试。");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={handleInit} disabled={pending}>
        {pending ? "正在初始化…" : `用「${templateName}」初始化`}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
