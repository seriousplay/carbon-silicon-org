"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { endMeetingAction, type CollaborationState } from "./collaboration-actions";

export function MeetingEndButton({ meetingId, endedAt, isParticipant }: { meetingId: string; endedAt: Date | null; isParticipant: boolean }) {
  const [state, action, pending] = useActionState<CollaborationState, FormData>(endMeetingAction.bind(null, meetingId), undefined);
  if (endedAt || !isParticipant) return null;
  return <form action={action} className="ml-auto">{state?.error ? <span className="mr-3 text-xs text-destructive">{state.error}</span> : null}<Button type="submit" variant="destructive" size="sm" disabled={pending}>{pending ? "生成纪要并结束…" : "结束会议"}</Button></form>;
}
