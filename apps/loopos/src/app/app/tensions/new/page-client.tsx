"use client";

import { useState, useActionState } from "react";
import { createTensionAction, translateTensionAction, type TensionFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export default function NewTensionPage({
  circles,
  fixedHandlingMode = null,
  meetingId = null,
}: {
  circles: { id: string; name: string }[];
  fixedHandlingMode?: "TACTICAL" | "GOVERNANCE" | null;
  meetingId?: string | null;
}) {
  const [state, formAction, pending] = useActionState<TensionFormState, FormData>(
    createTensionAction,
    undefined
  );

  // AI 翻译状态
  const [aiResult, setAiResult] = useState<{
    translation: string | null;
    suggestedType: string | null;
    summary: string | null;
    warning: string | null;
    suggestedHandlingMode: "TACTICAL" | "GOVERNANCE" | null;
  } | null>(null);
  const [translating, setTranslating] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // 表单字段状态（用于一键填充）
  const [description, setDescription] = useState("");

  async function handleTranslate() {
    if (!description.trim()) return;
    setTranslating(true);
    setAiResult(null);
    const result = await translateTensionAction(description);
    setAiResult(result);
    setTranslating(false);
  }

  function handleAccept() {
    if (!aiResult?.translation) return;
    setDescription(aiResult.translation);
    setAccepted(true);
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-rise">
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-medium mb-1">提一个张力</h1>
        <p className="text-sm text-muted-foreground">
          张力是组织感知到差距的信号。它不是抱怨，是改进的燃料。
        </p>
      </div>

      <form action={formAction} className="space-y-6">
        {/* AI 翻译追踪隐藏字段 */}
        {aiResult?.translation && accepted && (
          <>
            <input type="hidden" name="aiTranslation" value={aiResult.translation} />
            <input type="hidden" name="translationAccepted" value="true" />
          </>
        )}
        {aiResult?.suggestedHandlingMode ? <input type="hidden" name="aiHandlingSuggestion" value={aiResult.suggestedHandlingMode} /> : null}
        {fixedHandlingMode ? <input type="hidden" name="handlingMode" value={fixedHandlingMode} /> : null}
        {fixedHandlingMode && meetingId ? <input type="hidden" name="meetingId" value={meetingId} /> : null}

        <div className="space-y-2">
          <Label htmlFor="title">标题</Label>
          <Input id="title" name="title" placeholder="一句话概括你感知到的差距" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">详细描述</Label>
          <Textarea
            id="description"
            name="description"
            placeholder="当前现实是什么？你期望的可能是什么？"
            required
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            type="button"
            onClick={handleTranslate}
            disabled={translating || !description.trim()}
            className="text-xs text-moss hover:underline disabled:text-muted-foreground"
          >
            {translating ? "✨ AI 翻译中…" : "✨ 让 AI 帮我结构化"}
          </button>

          {/* AI 翻译结果 */}
          {aiResult && (
            <div className="rounded-input border border-moss/30 bg-moss-pale/20 p-3 animate-fade-rise">
              {aiResult.warning ? (
                <p className="text-xs text-muted-foreground">{aiResult.warning}</p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-moss">AI 结构化翻译（草稿）</p>
                    {!accepted && (
                      <button
                        type="button"
                        onClick={handleAccept}
                        className="text-xs text-moss font-medium hover:underline"
                      >
                        ✓ 采纳并填充表单
                      </button>
                    )}
                  </div>
                  {aiResult.summary && (
                    <p className="text-xs text-muted-foreground mb-2 italic">&quot;{aiResult.summary}&quot;</p>
                  )}
                  <p className="text-xs leading-relaxed text-foreground/80">
                    {aiResult.translation}
                  </p>
                  {accepted && (
                    <p className="text-xs text-moss mt-2">✓ 已填充到表单，你可以修改后提交</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {!fixedHandlingMode ? <div className="space-y-2">
          <Label>处理方式</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex gap-3 rounded-input border border-border p-3"><input type="radio" name="handlingMode" value="TACTICAL" required /><span><span className="block text-sm font-medium">战术处理</span><span className="text-xs text-muted-foreground">通过会议形成 Project 或 Action</span></span></label>
            <label className="flex gap-3 rounded-input border border-border p-3"><input type="radio" name="handlingMode" value="GOVERNANCE" required /><span><span className="block text-sm font-medium">治理处理</span><span className="text-xs text-muted-foreground">进入治理议案流程</span></span></label>
          </div>
          {aiResult?.suggestedHandlingMode ? <p className="text-xs text-muted-foreground">AI 建议：{aiResult.suggestedHandlingMode === "TACTICAL" ? "战术处理" : "治理处理"}。请由你确认。</p> : null}
        </div> : <p className="rounded-input border border-moss/30 bg-moss-pale/20 px-3 py-2 text-sm text-moss">本次来自{fixedHandlingMode === "TACTICAL" ? "战术会" : "治理会"}，张力将按{fixedHandlingMode === "TACTICAL" ? "战术" : "治理"}处理回到会议清单。</p>}

        {circles.length > 0 && (
          <div className="space-y-2">
            <Label>涉及回路（可多选）</Label>
            <div className="grid grid-cols-2 gap-2">
              {circles.map((circle) => (
                <label
                  key={circle.id}
                  className="flex items-center gap-2 rounded-input border border-border p-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <Checkbox id={`circle-${circle.id}`} name="circleIds" value={circle.id} />
                  <span className="text-sm">{circle.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {state?.error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-input px-3 py-2">
            {state.error}
          </p>
        )}

        <Button type="submit" disabled={pending} size="lg">
          {pending ? "提交中…" : "提交张力"}
        </Button>
      </form>
    </div>
  );
}
