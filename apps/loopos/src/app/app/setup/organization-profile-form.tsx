"use client";

import { useState, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveOrganizationProfileAction, type OrganizationProfileState } from "./organization-profile-actions";
import type { OrganizationProfile } from "@/lib/organization-governance-config";

const typeOptions = [["FOUNDATION_MODEL", "基础模型团队"], ["LEAN", "精益团队"], ["PROFESSIONAL_SERVICES", "专业服务 / 项目型"], ["FUNCTIONAL", "传统职能型"], ["CUSTOM", "自定义"]] as const;
const cadenceOptions = [["WEEKLY", "每周"], ["BIWEEKLY", "每两周"], ["MONTHLY", "每月"], ["CUSTOM", "自定义"]] as const;

export function OrganizationProfileForm({
  name,
  purpose,
  profile,
  canEdit,
}: {
  name: string;
  purpose: string;
  profile: OrganizationProfile;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<OrganizationProfileState, FormData>(saveOrganizationProfileAction, undefined);

  // 全部受控（Base UI 不支持 defaultValue）
  const [orgName, setOrgName] = useState(name);
  const [orgPurpose, setOrgPurpose] = useState(purpose);
  const [orgType, setOrgType] = useState<string>(profile.organizationType);
  const [meetingCadence, setMeetingCadence] = useState<string>(profile.meetingCadence);
  const [roleCategories, setRoleCategories] = useState(profile.roleCategories.join(", "));

  return <form action={action} className="rounded-card border border-border bg-card p-5 shadow-soft">
    <div className="mb-4"><h2 className="font-serif text-lg font-medium">组织基本配置</h2><p className="mt-1 text-sm text-muted-foreground">模板只是起点。这里的配置会成为组织大脑理解组织时的当前上下文。</p></div>
    <fieldset disabled={pending || !canEdit} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="organization-name">组织名称</Label><Input id="organization-name" name="organizationName" value={orgName} onChange={(e) => setOrgName(e.target.value)} maxLength={120} /></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="organization-purpose">组织目的</Label><Input id="organization-purpose" name="organizationPurpose" value={orgPurpose} onChange={(e) => setOrgPurpose(e.target.value)} maxLength={240} placeholder="这个组织存在是为了创造什么可验证的价值" /></div>
      <div className="space-y-2"><Label htmlFor="organization-type">组织类型</Label><select id="organization-type" name="organizationType" value={orgType} onChange={(e) => setOrgType(e.target.value)} className="h-10 w-full rounded-input border border-border bg-background px-3 text-sm">{typeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="meeting-cadence">建议会议节奏</Label><select id="meeting-cadence" name="meetingCadence" value={meetingCadence} onChange={(e) => setMeetingCadence(e.target.value)} className="h-10 w-full rounded-input border border-border bg-background px-3 text-sm">{cadenceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="role-categories">角色分类</Label><Input id="role-categories" name="roleCategories" value={roleCategories} onChange={(e) => setRoleCategories(e.target.value)} maxLength={500} /><p className="text-xs text-muted-foreground">用逗号分隔；只是分类建议，不限制后续治理结构。</p></div>
      <div className="flex items-center gap-3 sm:col-span-2"><Button type="submit">{pending ? "保存中…" : "保存组织配置"}</Button>{!canEdit ? <span className="text-xs text-muted-foreground">只有组织管理员可以修改。</span> : null}{state?.error ? <span className="text-xs text-destructive">{state.error}</span> : null}{state?.ok ? <span className="text-xs text-moss">已生成新配置版本。</span> : null}</div>
    </fieldset>
  </form>;
}
