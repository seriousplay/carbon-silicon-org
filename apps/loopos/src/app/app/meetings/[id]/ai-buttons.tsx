"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { confirmGuardReportAction, generateAgendaAction, generateGuardReportAction } from "./ai-actions";
import { Textarea } from "@/components/ui/textarea";

export function AgendaAIButton({ meetingId }: { meetingId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handle() {
    setPending(true);
    setError(null);
    const result = await generateAgendaAction(meetingId);
    if (result?.error) {
      setError(result.error);
      setPending(false);
    } else if (result?.ok) {
      router.refresh();
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={handle} disabled={pending} variant="outline" size="sm">
        {pending ? "✨ AI 生成中…" : "✨ AI 生成议程"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

export function GuardReportButton({ meetingId, isParticipant }: { meetingId: string; isParticipant: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [notesRevision, setNotesRevision] = useState<number | null>(null);
  const router = useRouter();

  async function handle() {
    setPending(true);
    setError(null);
    const result = await generateGuardReportAction(meetingId);
    if (result?.error) {
      setError(result.error);
      setPending(false);
    } else if (result?.draft && typeof result.notesRevision === "number") {
      setDraft(result.draft);
      setNotesRevision(result.notesRevision);
      setPending(false);
    }
  }

  async function confirm() {
    if (!draft || notesRevision === null) return;
    setPending(true);
    setError(null);
    const result = await confirmGuardReportAction(meetingId, draft, notesRevision);
    if (result?.error) setError(result.error);
    if (result?.ok) {
      setDraft(null);
      router.refresh();
    }
    setPending(false);
  }

  return (
    <div className="space-y-3">
      <Button type="button" onClick={handle} disabled={pending || !isParticipant} variant="outline" size="sm">
        {pending ? "AI 分析中…" : draft ? "重新生成" : "生成报告草稿"}
      </Button>
      {!isParticipant && <span className="ml-2 text-xs text-muted-foreground">仅会议参与人可生成</span>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {draft && (
        <div className="space-y-2">
          <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={8} aria-label="守护者报告草稿" />
          <p className="text-xs text-muted-foreground">AI 只起草；确认后才会写入会议记录。</p>
          <Button type="button" onClick={confirm} disabled={pending} size="sm">确认保存报告</Button>
        </div>
      )}
    </div>
  );
}
