"use client";

import { useActionState } from "react";
import {
  updateMeetingParticipantsAction,
  type CollaborationState,
} from "./collaboration-actions";
import { Button } from "@/components/ui/button";

export function MeetingCollaborationPanel({
  meeting,
  people,
  isParticipant,
}: {
  meeting: {
    id: string;
    notes: string | null;
    notesRevision: number;
    endedAt: Date | null;
    endedBy: { name: string } | null;
    participants: { id: string; name: string }[];
  };
  people: { id: string; name: string; email: string | null }[];
  isParticipant: boolean;
}) {
  const updateParticipants = updateMeetingParticipantsAction.bind(null, meeting.id);
  const [participantState, participantAction, participantPending] = useActionState<CollaborationState, FormData>(updateParticipants, undefined);
  const participantIds = new Set(meeting.participants.map((participant) => participant.id));

  return (
    <div className="rounded-card border border-border bg-card p-6 shadow-soft mb-6 space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">会议协作</h2>
          {meeting.endedAt && (
            <span className="text-xs text-muted-foreground">
              已结束{meeting.endedBy ? ` · ${meeting.endedBy.name}` : ""}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {meeting.participants.map((participant) => (
            <span key={participant.id} className="text-xs bg-muted rounded-full px-3 py-1">{participant.name}</span>
          ))}
        </div>
      </div>

      {isParticipant && !meeting.endedAt && (
        <form action={participantAction} className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">维护参与人</p>
          <div className="grid gap-2 md:grid-cols-2">
            {people.map((person) => (
              <label key={person.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="participantIds"
                  value={person.id}
                  defaultChecked={participantIds.has(person.id)}
                  className="h-4 w-4"
                />
                <span>{person.name}</span>
                {person.email && <span className="text-xs text-muted-foreground">{person.email}</span>}
              </label>
            ))}
          </div>
          {participantState?.error && <p className="text-sm text-destructive">{participantState.error}</p>}
          <Button type="submit" disabled={participantPending} variant="outline">{participantPending ? "保存中…" : "保存参与人"}</Button>
        </form>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">共享纪要</p>
          <span className="text-xs text-muted-foreground">rev {meeting.notesRevision}</span>
        </div>
        <div className="min-h-28 rounded-input border border-dashed border-border bg-muted/20 p-3 text-sm leading-relaxed whitespace-pre-line">
          {meeting.notes || "会议结束后，系统会根据张力、项目和行动结果自动生成纪要。"}
        </div>
      </div>

    </div>
  );
}
