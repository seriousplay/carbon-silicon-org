"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createMetricAction, type MetricFormState } from "./actions";

export function MetricSection({
  circleId,
  existing,
}: {
  circleId: string;
  existing: { id: string; name: string; targetValue: string; actualValue: string | null; type: string; status: string }[];
}) {
  const router = useRouter();
  const action = createMetricAction.bind(null, circleId) as (
    _prev: MetricFormState,
    formData: FormData
  ) => Promise<MetricFormState>;

  const [state, formAction, pending] = useActionState<MetricFormState, FormData>(action, undefined);

  const metricTypeLabel: Record<string, string> = {
    LEADING: "领先",
    LAGGING: "滞后",
  };
  const statusColor: Record<string, string> = {
    ON_TRACK: "text-growing",
    AT_RISK: "text-needs-light",
    OFF_TRACK: "text-urgent",
  };

  return (
    <div className="rounded-card border border-border bg-card p-6 shadow-soft">
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
        健康度指标
      </h2>

      {existing.length > 0 && (
        <div className="space-y-2 mb-5">
          {existing.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-input border border-border p-3">
              <div>
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-xs text-muted-foreground">
                  {metricTypeLabel[m.type]} · 目标 {m.targetValue}
                  {m.actualValue && ` · 实际 ${m.actualValue}`}
                </p>
              </div>
              <span className={`text-xs ${statusColor[m.status] ?? "text-muted-foreground"}`}>
                {m.status === "ON_TRACK" ? "达标" : m.status === "AT_RISK" ? "有风险" : "未达标"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 内联新建 */}
      <form
        action={formAction}
        className="grid grid-cols-2 md:grid-cols-3 gap-3 items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-xs">指标名称</Label>
          <Input id="name" name="name" placeholder="如 GPU利用率" required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">类型</Label>
          <Select name="type" value="LEADING">
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="LEADING">领先</SelectItem>
              <SelectItem value="LAGGING">滞后</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">阶段</Label>
          <Select name="phase" value="PHASE_1">
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PHASE_1">Phase 1</SelectItem>
              <SelectItem value="PHASE_2">Phase 2</SelectItem>
              <SelectItem value="PHASE_3">Phase 3</SelectItem>
              <SelectItem value="FINAL">最终</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="targetValue" className="text-xs">目标值</Label>
          <Input id="targetValue" name="targetValue" placeholder="如 ≥80%" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="actualValue" className="text-xs">实际值（可选）</Label>
          <Input id="actualValue" name="actualValue" placeholder="如 76%" />
        </div>
        <Button type="submit" disabled={pending} size="sm">添加</Button>
      </form>

      {state?.error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-input px-3 py-2 mt-3">
          {state.error}
        </p>
      )}
    </div>
  );
}
