"use client";

import { useActionState } from "react";
import { createInvitationAction, type InviteState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function InviteMemberForm({
  circles,
}: {
  circles: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<InviteState, FormData>(
    createInvitationAction,
    undefined
  );

  return (
    <form action={formAction} className="rounded-card border border-border bg-card p-4 shadow-soft mb-6 space-y-3">
      <div className="grid gap-3 md:grid-cols-[1fr_220px_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="invite-email">邀请邮箱</Label>
          <Input id="invite-email" name="email" type="email" placeholder="teammate@org.com" required />
        </div>
        <div className="space-y-2">
          <Label>默认归属回路</Label>
          <Select name="homeCircleId">
            <SelectTrigger><SelectValue placeholder="自动选择" /></SelectTrigger>
            <SelectContent>
              {circles.map((circle) => (
                <SelectItem key={circle.id} value={circle.id}>{circle.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={pending}>{pending ? "邀请中…" : "生成邀请"}</Button>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.link && (
        <p className="text-sm text-muted-foreground">
          邀请链接：<span className="font-mono text-foreground">{state.link}</span>
        </p>
      )}
    </form>
  );
}
