"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { saveGovernanceRulesAction, type GovernanceRulesState } from "./governance-rules-actions";

type Rules = Record<string, unknown>;

export function GovernanceRulesForm({ rules, version, canEdit }: { rules: Rules; version: number; canEdit: boolean }) {
  const [state, action, pending] = useActionState<GovernanceRulesState, FormData>(saveGovernanceRulesAction, undefined);
  return <form action={action} className="rounded-card border border-border bg-card p-5 shadow-soft">
    <div className="mb-4"><h2 className="font-serif text-lg font-medium">治理规则</h2><p className="mt-1 text-sm text-muted-foreground">规则以版本保存，Brain 只使用当前生效版本。当前版本：{version || "默认"}。</p></div>
    <fieldset disabled={pending || !canEdit} className="grid gap-3 text-sm">
      <div className="flex items-start gap-3 rounded-input border border-border bg-muted/30 p-3"><span className="mt-0.5 text-moss">✓</span><span><strong className="font-medium">任职必须通过治理流程确认</strong><small className="mt-0.5 block text-xs text-muted-foreground">这是 LoopOS 的核心治理不变量，申请或提名不会直接改变任职关系。</small></span></div>
      <label className="flex items-start gap-3"><input type="checkbox" name="meetingParticipantScope" defaultChecked={rules.meetingParticipantScope !== "OPEN_INVITE"} className="mt-1" /><span><strong className="font-medium">会议参与遵循回路范围</strong><small className="mt-0.5 block text-xs text-muted-foreground">参与规则由会议和回路边界共同约束。</small></span></label>
      <label className="flex items-start gap-3"><input type="checkbox" name="proposerConfirmationAfterProcess" defaultChecked={rules.proposerConfirmationAfterProcess === true} className="mt-1" /><span><strong className="font-medium">流程通过后允许提出者确认</strong><small className="mt-0.5 block text-xs text-muted-foreground">这是流程授予的确认权，不代表提出者拥有单方面治理权。</small></span></label>
      <div className="flex items-center gap-3 pt-2"><Button type="submit">{pending ? "保存中…" : "保存治理规则"}</Button>{!canEdit ? <span className="text-xs text-muted-foreground">只有组织管理员可以修改。</span> : null}{state?.error ? <span className="text-xs text-destructive">{state.error}</span> : null}{state?.ok ? <span className="text-xs text-moss">已生成新规则版本。</span> : null}</div>
    </fieldset>
  </form>;
}
