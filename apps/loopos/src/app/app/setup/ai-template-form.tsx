"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateOrgTemplateAction, initFromTemplateAction } from "./ai-template-actions";
import type { OrgTemplate } from "@/lib/org-templates";

type TemplateCircle = OrgTemplate["circles"][number];
type TemplateInterface = OrgTemplate["interfaces"][number];

export function AiTemplateForm({ fallbackTemplates }: { fallbackTemplates: OrgTemplate[] }) {
  const router = useRouter();
  const [industry, setIndustry] = useState("");
  const [keyRoles, setKeyRoles] = useState("");
  const [generating, setGenerating] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<OrgTemplate | null>(null);

  async function handleGenerate() {
    if (!industry.trim() || !keyRoles.trim()) return;
    setGenerating(true);
    setError(null);
    setPreview(null);
    const result = await generateOrgTemplateAction(industry, keyRoles);
    if (!result) {
      setError("生成失败，请重试");
    } else if (result.error) {
      setError(result.error);
    } else if (result.template) {
      setPreview(result.template);
    }
    setGenerating(false);
  }

  async function handleInit(template: OrgTemplate) {
    setInitializing(true);
    setError(null);
    try {
      const result = await initFromTemplateAction(template);
      if (!result) {
        setError("初始化失败，请重试");
        setInitializing(false);
      } else if (result.error) {
        setError(result.error);
        setInitializing(false);
        // 保持 preview 不丢失，用户可以查看 AI 生成结果并重试
      } else if (result.ok) {
        router.push("/app/circles/map");
        router.refresh();
      } else {
        setError("未知错误，请重试");
        setInitializing(false);
      }
    } catch (e) {
      setError("网络错误，请检查连接后重试");
      setInitializing(false);
    }
  }

  const typeLabel: Record<string, string> = {
    STRATEGY: "战略", PRODUCTION: "生产", INFRA: "基座", CROSSCUTTING: "横切",
  };

  return (
    <div className="space-y-4">
      {/* AI 输入区 */}
      <div className="rounded-card border border-moss/20 bg-moss-pale/10 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-moss text-lg">✨</span>
          <h3 className="font-serif text-base font-medium">AI 智能生成组织结构</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          输入你的行业方向和团队的关键角色，AI 自动设计适合的回路、角色和接口结构。
        </p>
        <div className="space-y-3">
          <div>
            <Label htmlFor="ai-industry" className="text-xs">行业 / 业务方向</Label>
            <Input
              id="ai-industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="如：AI 大模型研发 / 电商 SaaS / 智能硬件"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="ai-roles" className="text-xs">核心角色和关键活动</Label>
            <Textarea
              id="ai-roles"
              value={keyRoles}
              onChange={(e) => setKeyRoles(e.target.value)}
              placeholder="如：我们有数据工程、模型训练、产品研发、客户运营四个核心方向，团队约 15 人"
              rows={3}
              className="mt-1"
            />
          </div>
          <Button onClick={handleGenerate} disabled={generating || !industry.trim() || !keyRoles.trim()}>
            {generating ? "✨ AI 生成中…" : "✨ AI 生成组织结构"}
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>

      {/* AI 生成结果预览 */}
      {preview && (
        <div className="rounded-card border border-moss/30 bg-card p-5 shadow-soft space-y-4 animate-fade-rise">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-medium">{preview.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{preview.description}</p>
            </div>
            <span className="text-xs bg-muted rounded-full px-3 py-1 shrink-0">
              {preview.circles.length} 回路 · {preview.interfaces?.length ?? 0} 接口
            </span>
          </div>

          {/* 回路预览 */}
          <div className="space-y-2">
            {preview.circles.filter((c) => !c.isRoot).map((c) => (
              <div key={c.key} className="flex items-start gap-3 rounded-input border border-border p-3">
                <span className="text-moss text-sm shrink-0">❋</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{c.name}</p>
                    <span className="text-xs text-muted-foreground">{typeLabel[c.type] ?? c.type}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{c.purpose}</p>
                  {c.roles && c.roles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {c.roles.map((r) => (
                        <span key={r.name} className="text-[10px] bg-muted/50 rounded px-1.5 py-0.5">{r.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 接口预览 */}
          {preview.interfaces && preview.interfaces.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">回路间接口</p>
              <div className="flex flex-wrap gap-1.5">
                {preview.interfaces.map((intf, i) => {
                  const fromC = preview.circles.find((c) => c.key === intf.fromKey);
                  const toC = preview.circles.find((c) => c.key === intf.toKey);
                  return (
                    <span key={i} className="text-[10px] bg-moss-pale/50 text-moss rounded px-2 py-0.5">
                      {fromC?.name} → {toC?.name}: {intf.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={() => handleInit(preview)} disabled={initializing}>
              {initializing ? "创建中…" : "用此结构初始化"}
            </Button>
            <Button variant="outline" onClick={() => setPreview(null)}>重新生成</Button>
          </div>
        </div>
      )}

      {/* 预设模板（折叠） */}
      {!preview && (
        <details className="rounded-card border border-border bg-card">
          <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
            或使用预设模板（{fallbackTemplates.length} 个）
          </summary>
          <div className="border-t border-border p-5 space-y-4">
            {fallbackTemplates.map((template) => (
              <div key={template.id} className="rounded-input border border-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium">{template.name}</p>
                    <p className="text-xs text-muted-foreground">{template.description}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleInit(template)} disabled={initializing}>
                    使用
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {template.circles.filter((c) => !c.isRoot).map((c) => (
                    <span key={c.key} className="text-[10px] bg-muted/50 rounded px-1.5 py-0.5">{c.name}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
