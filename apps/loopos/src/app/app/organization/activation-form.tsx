"use client";

import { useActionState } from "react";
import { Rocket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { activateOrganizationAction, type ActivationState } from "../setup/actions";

export function ActivationForm({ disabled }: { disabled: boolean }) {
  const [state, formAction, pending] = useActionState<ActivationState, FormData>(
    activateOrganizationAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-3">
      <Button type="submit" disabled={disabled || pending} className="gap-2">
        <Rocket className="size-4" aria-hidden="true" />
        {pending ? "正在启用..." : "确认启用组织"}
      </Button>
      {state?.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded-md bg-moss-pale/50 px-3 py-2 text-sm text-moss">
          组织已启用。现在可以发起战术会和治理会。
        </p>
      )}
    </form>
  );
}
