"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ModelThinkingMode,
  OrganizationModelProvider,
  OrganizationModelSettingsSummary,
} from "@/lib/ai/organization-model-settings";
import { saveModelSettingsAction, type ModelSettingsState } from "./actions";

const providerLabels: Record<OrganizationModelProvider, string> = {
  system: "继承系统默认",
  deepseek: "DeepSeek",
  openai: "OpenAI",
  anthropic: "Anthropic",
  stepfun: "阶跃 StepFun",
};

const providerDefaults: Record<
  Exclude<OrganizationModelProvider, "system">,
  { modelName: string; baseUrl: string; thinkingMode: ModelThinkingMode }
> = {
  deepseek: {
    modelName: "deepseek-v4-pro",
    baseUrl: "https://api.deepseek.com",
    thinkingMode: "disabled",
  },
  openai: { modelName: "gpt-4o-mini", baseUrl: "", thinkingMode: "disabled" },
  anthropic: {
    modelName: "claude-sonnet-4-20250514",
    baseUrl: "",
    thinkingMode: "disabled",
  },
  stepfun: {
    modelName: "step-3.7-flash",
    baseUrl: "https://api.stepfun.com/step_plan/v1",
    thinkingMode: "disabled",
  },
};

export function ModelSettingsForm({
  summary,
  canEdit,
}: {
  summary: OrganizationModelSettingsSummary;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState<ModelSettingsState, FormData>(
    saveModelSettingsAction,
    undefined,
  );
  const [provider, setProvider] = useState<OrganizationModelProvider>(summary.provider);
  const [modelName, setModelName] = useState(summary.modelName);
  const [baseUrl, setBaseUrl] = useState(summary.baseUrl);
  const [thinkingMode, setThinkingMode] = useState<ModelThinkingMode>(summary.thinkingMode);

  const apiKeyText = summary.hasApiKey
    ? `已配置${summary.apiKeyUpdatedAt ? `，${formatTime(summary.apiKeyUpdatedAt)} 更新` : ""}`
    : "未配置";
  const usingSystem = provider === "system";
  const effectiveText = useMemo(() => {
    if (provider === "system") {
      return `${providerLabels[summary.inheritedProvider]} · ${summary.inheritedModelName}`;
    }
    return `${providerLabels[provider]} · ${modelName || "未填写模型"}`;
  }, [modelName, provider, summary.inheritedModelName, summary.inheritedProvider]);

  function handleProviderChange(value: OrganizationModelProvider | null) {
    if (!value) return;
    const next = value;
    setProvider(next);
    if (next === "system") {
      setModelName(summary.inheritedModelName);
      setBaseUrl("");
      setThinkingMode("disabled");
      return;
    }
    const defaults = providerDefaults[next];
    setModelName(defaults.modelName);
    setBaseUrl(defaults.baseUrl);
    setThinkingMode(defaults.thinkingMode);
  }

  return (
    <form action={formAction} className="rounded-card border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-serif text-lg font-medium">组织大脑模型</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            管理员可为本组织单独配置模型服务。未配置时继承系统默认。
          </p>
        </div>
        <div className="rounded-input border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
          <span className="block text-foreground">{effectiveText}</span>
          <span>API key {apiKeyText}</span>
        </div>
      </div>

      <fieldset disabled={pending || !canEdit} className="mt-5 grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>模型服务商</Label>
            <Select name="provider" value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">{providerLabels.system}</SelectItem>
                <SelectItem value="deepseek">{providerLabels.deepseek}</SelectItem>
                <SelectItem value="openai">{providerLabels.openai}</SelectItem>
                <SelectItem value="anthropic">{providerLabels.anthropic}</SelectItem>
                <SelectItem value="stepfun">{providerLabels.stepfun}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model-name">模型名称</Label>
            <Input
              id="model-name"
              name="modelName"
              value={modelName}
              onChange={(event) => setModelName(event.target.value)}
              disabled={usingSystem}
              maxLength={120}
              placeholder="deepseek-v4-pro"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_180px]">
          <div className="space-y-2">
            <Label htmlFor="model-base-url">Base URL</Label>
            <Input
              id="model-base-url"
              name="baseUrl"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              disabled={usingSystem}
              maxLength={240}
              placeholder="https://api.deepseek.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Thinking</Label>
            <Select
              name="thinkingMode"
              value={thinkingMode}
              onValueChange={(value) => setThinkingMode(value === "enabled" ? "enabled" : "disabled")}
              disabled={usingSystem}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="disabled">关闭</SelectItem>
                <SelectItem value="enabled">开启</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="model-api-key">API key</Label>
          <Input
            id="model-api-key"
            name="apiKey"
            type="password"
            autoComplete="off"
            disabled={usingSystem}
            placeholder={summary.hasApiKey ? "已配置，留空则不变" : "首次启用组织级模型时填写"}
          />
          <p className="text-xs text-muted-foreground">
            API key 加密保存；页面不会显示已保存的明文。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending || !canEdit}>
            {pending ? "保存中…" : "保存模型配置"}
          </Button>
          {!canEdit ? (
            <span className="text-xs text-muted-foreground">只有组织管理员可以修改。</span>
          ) : null}
          {state?.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
          {state?.ok ? <span className="text-xs text-moss">模型配置已保存。</span> : null}
        </div>
      </fieldset>
    </form>
  );
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
