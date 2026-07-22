"use client";

import { useState, useEffect } from "react";

interface EnterpriseSettings {
  defaultAiModel: string;
  enableAiClaude: boolean;
  enableCustomKnowledgeBase: boolean;
  dataRetentionDays?: number;
}

interface ModelProviderSummary {
  id: "deepseek" | "step" | "legacy";
  configured: boolean;
  label: string;
  model: string | null;
  endpoint: string | null;
}

export default function SettingsTab() {
  const [settings, setSettings] = useState<EnterpriseSettings | null>(null);
  const [modelProviders, setModelProviders] = useState<ModelProviderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/loop-designer/api/admin/settings");
        const data = await res.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to fetch settings");
        }

        setSettings(data.data.settings);
        setModelProviders(data.data.modelProviders || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    }

    void fetchSettings();
  }, []);

  if (loading) {
    return <div className="text-white/55">加载中...</div>;
  }

  if (error) {
    return <div className="text-red-400">{error}</div>;
  }

  if (!settings) {
    return <div className="text-white/55">暂无设置信息</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">企业设置</h2>
        <p className="mt-1 text-sm text-white/55">查看企业级应用选项与系统内置能力</p>
      </div>

      {/* AI 设置 */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-bold">AI 配置</h3>
            <p className="mt-2 text-sm leading-6 text-white/50">
              当前版本使用系统内置模型路由，企业侧暂不需要配置 API Key、App ID 或服务商。
            </p>
          </div>
          <span className="mono border border-[var(--acid)]/35 px-3 py-1 text-[10px] tracking-[.16em] text-[var(--acid)]">
            SYSTEM MANAGED
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <ModelProviderCard provider={findProvider(modelProviders, "deepseek")} title="DeepSeek V4 Pro" role="主模型" />
          <ModelProviderCard provider={findProvider(modelProviders, "step")} title="StepPlan（Step 3.7 Flash）" role="备用模型" />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <DisabledCapability title="Claude 模型" text="暂未启用。后续会作为企业自定义模型服务商接入。" />
          <DisabledCapability title="自定义知识库" text="暂未开放上传与索引。组织记忆仍由回路资产自动沉淀。" />
          <DisabledCapability title="自定义服务商 / App ID" text="预留能力。未来支持企业配置自己的 LLM 服务商和应用凭证。" />
        </div>
      </div>

      {/* GDPR 设置 */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-6">
        <h3 className="mb-4 font-bold">数据与合规</h3>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">
              数据保留天数
            </label>
            <input
              type="number"
              value={settings.dataRetentionDays || 365}
              disabled
              className="field w-full opacity-50"
            />
            <div className="mt-1 text-xs text-white/40">
              数据将在 365 天后自动删除
            </div>
          </div>

          <button
            onClick={() => alert("GDPR 数据导出功能待实现")}
            className="rounded border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
          >
            导出所有企业数据
          </button>
        </div>
      </div>
    </div>
  );
}

function findProvider(providers: ModelProviderSummary[], id: ModelProviderSummary["id"]) {
  return providers.find((provider) => provider.id === id) || null;
}

function ModelProviderCard({ provider, title, role }: { provider: ModelProviderSummary | null; title: string; role: string }) {
  const configured = provider?.configured ?? false;
  return (
    <div className="border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mono text-[10px] tracking-[.16em] text-[var(--cyan)]">{role}</div>
          <div className="mt-2 font-bold">{title}</div>
        </div>
        <span className={`shrink-0 border px-2 py-1 text-[10px] ${configured ? "border-[var(--acid)]/40 text-[var(--acid)]" : "border-white/12 text-white/35"}`}>
          {configured ? "已配置" : "未配置"}
        </span>
      </div>
      <div className="mt-4 space-y-2 text-xs leading-5 text-white/42">
        <div>模型：{provider?.model || "等待服务器配置"}</div>
        <div className="break-all">端点：{provider?.endpoint || "等待服务器配置"}</div>
      </div>
    </div>
  );
}

function DisabledCapability({ title, text }: { title: string; text: string }) {
  return (
    <div className="border border-white/8 bg-white/[.02] p-4 opacity-60">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium text-white/72">{title}</div>
        <span className="rounded border border-white/10 px-2 py-1 text-[10px] text-white/35">暂不可用</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-white/40">{text}</p>
    </div>
  );
}
