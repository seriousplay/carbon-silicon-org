"use client";

import { useState, useActionState } from "react";
import { CalendarPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createGoalCycleAction, type GoalCycleActionState } from "./actions";

const initialState: GoalCycleActionState = {};

function dateValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function CreateCycleForm() {
  const [state, formAction, pending] = useActionState(createGoalCycleAction, initialState);
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + 28);

  // 全部受控（Base UI 不支持 defaultValue）
  const [name, setName] = useState("首个组织目标周期");
  const [startAt, setStartAt] = useState(dateValue(start));
  const [endAt, setEndAt] = useState(dateValue(end));

  return (
    <form action={formAction} className="mt-5 max-w-xl space-y-4 border-t border-border pt-5">
      <div>
        <Label htmlFor="cycle-name">周期名称</Label>
        <Input id="cycle-name" name="name" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1.5" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="cycle-start">开始日期</Label>
          <Input id="cycle-start" name="startAt" type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} required className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="cycle-end">结束日期</Label>
          <Input id="cycle-end" name="endAt" type="date" value={endAt} onChange={(e) => setEndAt(e.target.value)} required className="mt-1.5" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          <CalendarPlus aria-hidden="true" />
          {pending ? "建立中…" : "建立目标周期"}
        </Button>
        {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      </div>
    </form>
  );
}
