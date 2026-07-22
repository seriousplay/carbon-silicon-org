"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { blockerStatusMap } from "@/lib/constants";
import { transitionTensionAction } from "../actions";

export function TransitionButton({
  tensionId,
  toStatus,
}: {
  tensionId: string;
  toStatus: string;
}) {
  const info = blockerStatusMap[toStatus as keyof typeof blockerStatusMap];

  const [state, formAction, pending] = useActionState(
    (_prev: unknown, _formData: FormData) => {
      void _prev;
      void _formData;
      return transitionTensionAction(tensionId, toStatus, undefined);
    },
    undefined
  );

  return (
    <form action={formAction} className="space-y-1">
      <Button
        type="submit"
        disabled={pending}
        variant="outline"
        size="sm"
        className={toStatus === "RESOLVED" ? "border-moss text-moss" : ""}
      >
        {info?.icon} {info?.label}
      </Button>
      {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
