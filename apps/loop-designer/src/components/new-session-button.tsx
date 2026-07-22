"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { readApiResponse } from "@/lib/api-response";

export function NewSessionButton({
  templateId,
  sourceSessionId,
  workflow = "loop_design",
  label = "开始设计",
  loadingLabel,
  className = "inline-flex items-center gap-3 bg-[var(--acid)] px-6 py-4 font-black text-[#0b130f] hover:bg-white disabled:opacity-50",
}: {
  templateId?: string;
  sourceSessionId?: string;
  workflow?: "questionnaire" | "diagnosis" | "blueprint" | "loop_design";
  label?: string;
  loadingLabel?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div>
      <button
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError(null);
          try {
            const response = await fetch("/loop-designer/api/sessions", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ ...(templateId ? { templateId } : {}), ...(sourceSessionId ? { sourceSessionId } : {}), workflow }),
            });
            const payload = await readApiResponse<{ id?: string }>(response, "无法建立回路");
            if (response.ok && payload.id) router.push(sessionPath(payload.id, workflow));
            else setError(payload.error || "无法建立回路");
          } catch {
            setError("网络连接中断，请稍后重试。");
          } finally {
            setLoading(false);
          }
        }}
        className={className}
      >
        {loading ? loadingLabel ?? defaultLoadingLabel(workflow) : label} <ArrowRight size={18} />
      </button>
      {error ? <p className="mt-3 text-sm text-orange-200">{error}</p> : null}
    </div>
  );
}

function defaultLoadingLabel(workflow: "questionnaire" | "diagnosis" | "blueprint" | "loop_design") {
  if (workflow === "questionnaire") return "正在进入问卷...";
  if (workflow === "diagnosis" || workflow === "blueprint") return "正在启动蓝图...";
  return "正在建立回路...";
}

function sessionPath(sessionId: string, workflow: "questionnaire" | "diagnosis" | "blueprint" | "loop_design") {
  if (workflow === "questionnaire" || workflow === "blueprint") return `/sessions/${sessionId}/questionnaire`;
  if (workflow === "diagnosis") return `/sessions/${sessionId}/diagnosis`;
  return `/sessions/${sessionId}`;
}
