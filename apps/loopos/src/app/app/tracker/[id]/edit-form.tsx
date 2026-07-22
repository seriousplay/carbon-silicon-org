"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { editTensionAction, type EditTensionState } from "./edit-action";

export function EditTensionForm({
  tensionId,
  initial,
}: {
  tensionId: string;
  initial: {
    title: string;
    description: string;
    acceptanceCriteria: string;
    deadline: Date | null;
    rootCause: string | null;
  };
}) {
  const action = editTensionAction.bind(null, tensionId) as (
    _prev: EditTensionState,
    formData: FormData
  ) => Promise<EditTensionState>;

  const [state, formAction, pending] = useActionState<EditTensionState, FormData>(
    action,
    undefined
  );

  const deadlineStr = initial.deadline
    ? new Date(initial.deadline).toISOString().slice(0, 10)
    : "";

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">标题</Label>
        <Input id="title" name="title" defaultValue={initial.title} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">描述</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={initial.description}
          required
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="acceptanceCriteria">
          验收标准 <span className="text-muted-foreground font-normal">（禁止 可能/大概/争取）</span>
        </Label>
        <Input
          id="acceptanceCriteria"
          name="acceptanceCriteria"
          defaultValue={initial.acceptanceCriteria}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="deadline">截止时间</Label>
        <Input
          id="deadline"
          name="deadline"
          type="date"
          defaultValue={deadlineStr}
        />
        <p className="text-xs text-muted-foreground">留空：No time commitment</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rootCause">
          根因 <span className="text-muted-foreground font-normal">（可选）</span>
        </Label>
        <Textarea
          id="rootCause"
          name="rootCause"
          defaultValue={initial.rootCause ?? ""}
          rows={2}
        />
      </div>

      {state?.error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-input px-3 py-2">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "保存中…" : "保存修改"}
      </Button>
    </form>
  );
}
