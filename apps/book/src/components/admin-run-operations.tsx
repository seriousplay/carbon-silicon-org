"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, Eye, EyeOff, ShieldCheck, Trash2 } from "lucide-react";
import { runStatusLabels } from "@/lib/runs/default-runs";
import type { AssessmentRun, RunStatus } from "@/lib/runs/types";

export function AdminRunOperations({ run, entryUrl }: { run: AssessmentRun; entryUrl: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<RunStatus>(run.status);
  const [accessCode, setAccessCode] = useState(run.accessCode ?? "");
  const [showOnHome, setShowOnHome] = useState(Boolean(run.showOnHome));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function updateRun() {
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/runs/${run.slug}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, accessCode, showOnHome }),
    });
    setBusy(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { reason?: string } | null;
      setMessage(payload?.reason ?? "更新失败");
      return;
    }

    setMessage("入口设置已更新。");
    router.refresh();
  }

  async function cleanupTestData() {
    const confirmed = window.confirm("只会清理姓名/公司/联系方式中包含 测试、test、codex、验收、演示、demo、smoke 的参与者。确认继续？");
    if (!confirmed) return;

    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/runs/${run.slug}?mode=test`, { method: "DELETE" });
    const payload = (await response.json().catch(() => null)) as { deleted?: number; reason?: string } | null;
    setBusy(false);

    if (!response.ok) {
      setMessage(payload?.reason ?? "清理失败");
      return;
    }

    setMessage(`已清理 ${payload?.deleted ?? 0} 个测试参与者。`);
    router.refresh();
  }

  async function copyEntryLink() {
    await navigator.clipboard.writeText(entryUrl);
    setMessage("测评入口链接已复制。");
  }

  return (
    <div className="rounded-3xl border border-emerald-200/15 bg-[#0c201c]/75 p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h2 className="text-2xl font-black text-white">入口运营</h2>
          <p className="mt-2 text-sm leading-7 text-emerald-50/60">复制唯一入口链接，控制入口状态、访问码、首页展示和测试样本清理。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyEntryLink}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-200/20 px-4 py-2 text-sm font-bold text-emerald-50"
          >
            <Copy className="h-4 w-4" />
            复制入口
          </button>
          <a
            href={`/api/runs/${run.slug}/export`}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-200/20 px-4 py-2 text-sm font-bold text-emerald-50"
          >
            <Download className="h-4 w-4" />
            导出 CSV
          </a>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-emerald-200/12 bg-black/18 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="grid flex-1 gap-2">
            <span className="text-sm font-bold text-emerald-100/80">参与者入口链接</span>
            <input className="input font-mono text-sm" value={entryUrl} readOnly />
          </label>
          <button
            type="button"
            onClick={copyEntryLink}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-300 px-5 py-3 text-sm font-black text-[#06110f]"
          >
            <Copy className="h-4 w-4" />
            复制发送链接
          </button>
        </div>
        <p className="mt-3 text-xs leading-5 text-emerald-50/48">这个链接是本入口的唯一访问地址，不需要参与者从网站首页查找。</p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[180px_1fr_180px_auto] md:items-end">
        <label className="grid gap-2">
          <span className="text-sm font-bold text-emerald-100/80">状态</span>
          <select className="input" value={status} onChange={(event) => setStatus(event.target.value as RunStatus)}>
            {Object.entries(runStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-bold text-emerald-100/80">访问码</span>
          <input className="input" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="留空则不需要访问码" />
        </label>
        <label className="flex min-h-[52px] items-center gap-3 rounded-2xl border border-emerald-200/10 bg-white/[0.035] px-4 py-3">
          <input
            type="checkbox"
            checked={showOnHome}
            onChange={(event) => setShowOnHome(event.target.checked)}
            className="h-4 w-4 accent-emerald-300"
          />
          <span className="flex items-center gap-2 text-sm font-bold text-emerald-50/75">
            {showOnHome ? <Eye className="h-4 w-4 text-emerald-200" /> : <EyeOff className="h-4 w-4 text-emerald-50/45" />}
            首页公开
          </span>
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={updateRun}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-300 px-5 py-3 text-sm font-black text-[#06110f] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShieldCheck className="h-4 w-4" />
          保存设置
        </button>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-emerald-200/10 pt-5 md:flex-row md:items-center md:justify-between">
        <p className="text-sm leading-7 text-emerald-50/55">测试样本清理只删除带有测试标记的参与者，正式样本不会被匹配。</p>
        <button
          type="button"
          disabled={busy}
          onClick={cleanupTestData}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-red-200/25 px-4 py-2 text-sm font-bold text-red-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          清理测试样本
        </button>
      </div>

      {message ? <div className="mt-4 rounded-2xl bg-white/[0.055] p-3 text-sm text-emerald-50/75">{message}</div> : null}
    </div>
  );
}
