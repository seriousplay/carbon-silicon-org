"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { transitionProjectAction, type ProjectLifecycleState } from "./actions";

export function ProjectLifecycleControls({ projectId, status }: { projectId: string; status: string }) {
  const targets = status === "ACTIVE" ? [["PAUSED", "暂停"], ["COMPLETED", "完成"]] : status === "PAUSED" ? [["ACTIVE", "恢复"], ["COMPLETED", "完成"]] : [];
  return <div className="flex flex-wrap gap-2">{targets.map(([target, label]) => <ProjectTransition key={target} projectId={projectId} expectedStatus={status} targetStatus={target} label={label} />)}</div>;
}

function ProjectTransition({ projectId, expectedStatus, targetStatus, label }: { projectId: string; expectedStatus: string; targetStatus: string; label: string }) {
  const action = transitionProjectAction.bind(null, projectId, expectedStatus, targetStatus);
  const [state, formAction, pending] = useActionState<ProjectLifecycleState, FormData>(async () => action(), undefined);
  return <form action={formAction}><Button type="submit" variant="outline" disabled={pending}>{pending ? "处理中" : label}</Button>{state?.error ? <p className="mt-1 text-xs text-destructive">{state.error}</p> : null}</form>;
}
