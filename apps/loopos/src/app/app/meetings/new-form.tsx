"use client";

import { useState, useActionState } from "react";
import { createMeetingAction, type MeetingFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function NewMeetingForm({
  circles,
  people,
  currentPersonId,
}: {
  circles: { id: string; name: string }[];
  people: { id: string; name: string; email: string | null }[];
  currentPersonId: string | null;
}) {
  const [state, formAction, pending] = useActionState<MeetingFormState, FormData>(
    createMeetingAction,
    undefined
  );

  const today = new Date().toISOString().slice(0, 16);

  // 受控组件（Base UI 不支持 defaultValue）
  const [meetingType, setMeetingType] = useState("TACTICAL");
  const [circleId, setCircleId] = useState("");
  const [durationMin, setDurationMin] = useState("30");
  const [startedAt, setStartedAt] = useState(today);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">会议主题</Label>
        <Input id="title" name="title" placeholder="如：预训练回路本周战术会" required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>会议类型</Label>
          <Select name="type" value={meetingType} onValueChange={(v) => setMeetingType(v ?? "")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TACTICAL">战术会（≤30min）</SelectItem>
              <SelectItem value="GOVERNANCE">治理会（≤90min）</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="durationMin">时长（分钟）</Label>
          <Input id="durationMin" name="durationMin" type="number" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} min={5} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startedAt">开始时间</Label>
          <Input id="startedAt" name="startedAt" type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label>所属回路</Label>
          <Select name="circleId" value={circleId} onValueChange={(v) => setCircleId(v ?? "")}>
            <SelectTrigger><SelectValue placeholder="不选" /></SelectTrigger>
            <SelectContent>
              {circles.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="agenda">议程（可选）</Label>
        <Textarea
          id="agenda"
          name="agenda"
          placeholder="治理会议程模板：&#10;1. 追踪核对(15min)&#10;2. 未闭环解释(15min)&#10;3. 回路间张力(30min)&#10;4. 本周冲刺(20min)&#10;5. 追踪更新(10min)"
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label>参与人</Label>
        <div className="grid gap-2 rounded-input border border-border p-3">
          {people.map((person) => (
            <label key={person.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="participantIds"
                value={person.id}
                defaultChecked={person.id === currentPersonId}
                className="h-4 w-4"
              />
              <span>{person.name}</span>
              {person.email && <span className="text-xs text-muted-foreground">{person.email}</span>}
            </label>
          ))}
        </div>
      </div>

      {state?.error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-input px-3 py-2">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "创建中…" : "发起会议"}
      </Button>
    </form>
  );
}
