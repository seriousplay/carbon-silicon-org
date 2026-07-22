"use client";

import { useActionState } from "react";
import { acceptInvitationAction, type InviteAcceptState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InviteAcceptForm({
  token,
  isSignedIn,
}: {
  token: string;
  isSignedIn: boolean;
}) {
  const [state, formAction, pending] = useActionState<InviteAcceptState, FormData>(
    acceptInvitationAction,
    undefined
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {!isSignedIn && (
        <>
          <div className="space-y-2">
            <Label htmlFor="name">姓名</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">设置密码</Label>
            <Input id="password" name="password" type="password" minLength={8} required />
          </div>
        </>
      )}
      {state?.error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-input px-3 py-2">{state.error}</p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "加入中…" : "接受邀请"}
      </Button>
    </form>
  );
}
