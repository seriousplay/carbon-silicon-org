"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { confirmWeeklyReviewAction, generateWeeklyReviewAction, type WeeklyReviewState } from "./actions";

export function WeeklyReviewDraft({ period, aiOn }: { period: string; aiOn: boolean }) {
  const [generation, setGeneration] = useState<WeeklyReviewState>();
  const [generating, setGenerating] = useState(false);
  const [state, confirmAction, confirming] = useActionState(confirmWeeklyReviewAction, undefined);

  async function generate() {
    setGenerating(true);
    setGeneration(await generateWeeklyReviewAction());
    setGenerating(false);
  }

  const draft = generation?.draft;
  if (!draft) {
    return (
      <div className="space-y-2">
        <Button type="button" onClick={generate} disabled={generating || !aiOn}>
          {generating ? "AI 起草中…" : "生成本周回顾草稿"}
        </Button>
        {!aiOn && <p className="text-xs text-muted-foreground">AI 未配置；事实数据仍可直接查看。</p>}
        {generation?.error && <p className="text-sm text-destructive">{generation.error}</p>}
      </div>
    );
  }

  return (
    <form action={confirmAction} className="space-y-4">
      <input type="hidden" name="period" value={period} />
      <input type="hidden" name="credibilityScore" value={draft.credibilityScore} />
      <div className="space-y-1.5">
        <label htmlFor="weekly-review-title" className="text-sm font-medium">标题</label>
        <Input id="weekly-review-title" name="title" defaultValue={draft.title} maxLength={120} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="weekly-review-content" className="text-sm font-medium">事实回顾</label>
        <Textarea id="weekly-review-content" name="content" defaultValue={draft.content} rows={9} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="weekly-review-focus" className="text-sm font-medium">下周关注建议（每行一项）</label>
        <Textarea id="weekly-review-focus" name="nextWeekFocus" defaultValue={draft.nextWeekFocus.join("\n")} rows={4} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="weekly-review-risks" className="text-sm font-medium">风险</label>
        <Textarea id="weekly-review-risks" name="risks" defaultValue={draft.risks} rows={3} />
      </div>
      <p className="text-xs text-muted-foreground">AI 只起草。检查并编辑后，确认操作才会保存为本周组织回顾。</p>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.ok && <p className="text-sm text-moss">本周回顾已确认保存。</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={confirming}>{confirming ? "保存中…" : "确认并保存"}</Button>
        <Button type="button" variant="outline" onClick={generate} disabled={generating}>重新生成</Button>
      </div>
    </form>
  );
}
