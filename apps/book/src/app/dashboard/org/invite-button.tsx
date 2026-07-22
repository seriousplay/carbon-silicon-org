"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

export function InviteButton() {
  const [code, setCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function createInvite() {
    setSubmitting(true);
    const response = await fetch("/api/dashboard/org/invites", { method: "POST" });
    const payload = (await response.json().catch(() => null)) as { ok?: boolean; code?: string } | null;
    setSubmitting(false);
    if (response.ok && payload?.ok && payload.code) setCode(payload.code);
  }

  return (
    <button
      type="button"
      onClick={createInvite}
      disabled={submitting}
      className="inline-flex items-center justify-center rounded-full bg-emerald-300 px-5 py-3 text-sm font-black text-[#06110f] transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Plus className="mr-2 h-4 w-4" />
      {code ? `邀请码 ${code}` : submitting ? "生成中..." : "生成邀请码"}
    </button>
  );
}
