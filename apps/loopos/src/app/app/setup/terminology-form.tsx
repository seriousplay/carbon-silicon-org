"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveTerminologyAction, type TerminologyState } from "./terminology-actions";
import type { OrganizationTerminology } from "@/lib/organization-governance-config";

const fields: Array<[keyof OrganizationTerminology, string]> = [["circle", "回路"], ["role", "角色"], ["tension", "张力"], ["tacticalMeeting", "战术会"], ["governanceMeeting", "治理会"], ["coach", "教练"]];

export function TerminologyForm({ terminology, version, canEdit }: { terminology: OrganizationTerminology; version: number; canEdit: boolean }) {
  const [state, action, pending] = useActionState<TerminologyState, FormData>(saveTerminologyAction, undefined);
  const [values, setValues] = useState(terminology);
  useEffect(() => setValues(terminology), [terminology]);
  return <form action={action} className="rounded-card border border-border bg-card p-5 shadow-soft">
    <div className="mb-4"><h2 className="font-serif text-lg font-medium">组织语言</h2><p className="mt-1 text-sm text-muted-foreground">用于让组织大脑和界面使用你们自己的称呼。当前配置版本：{version || "默认"}。</p></div>
    <fieldset disabled={pending || !canEdit} className="grid gap-4 sm:grid-cols-2">
      {fields.map(([key, label]) => <div key={key} className="space-y-2"><Label htmlFor={`terminology-${key}`}>{label}</Label><Input id={`terminology-${key}`} name={key} value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} maxLength={80} /></div>)}
      <div className="sm:col-span-2 flex items-center gap-3"><Button type="submit">{pending ? "保存中…" : "保存组织语言"}</Button>{!canEdit ? <span className="text-xs text-muted-foreground">只有组织管理员可以修改。</span> : null}{state?.error ? <span className="text-xs text-destructive">{state.error}</span> : null}{state?.ok ? <span className="text-xs text-moss">已生成新配置版本。</span> : null}</div>
    </fieldset>
  </form>;
}
