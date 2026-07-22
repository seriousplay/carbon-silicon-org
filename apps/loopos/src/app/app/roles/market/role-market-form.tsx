"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { applyForRoleAction, type RoleMarketState } from "./actions";

export function RoleMarketForm({ roleId }: { roleId: string }) {
  const [state, formAction, pending] = useActionState<RoleMarketState, FormData>(applyForRoleAction, {});

  return (
    <form action={formAction} className="mt-4 grid gap-3">
      <input type="hidden" name="roleId" value={roleId} />
      <label className="grid gap-1 text-xs"><span>申请动机</span><textarea name="motivation" required className="min-h-16 rounded-input border border-input bg-background px-3 py-2" /></label>
      <label className="grid gap-1 text-xs"><span>相关能力</span><textarea name="capabilitySummary" required className="min-h-16 rounded-input border border-input bg-background px-3 py-2" /></label>
      <label className="grid gap-1 text-xs"><span>投入承诺</span><textarea name="commitment" required className="min-h-16 rounded-input border border-input bg-background px-3 py-2" /></label>
      {state.error ? <p role="alert" className="text-xs text-destructive">{state.error}</p> : null}
      {state.success ? <p role="status" className="text-xs text-moss">{state.success}</p> : null}
      <Button type="submit" size="sm" disabled={pending}>{pending ? "提交中..." : "提交申请"}</Button>
    </form>
  );
}
