"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { GlassCard } from "@/components/ui";
import type { ParticipantProfile } from "@/lib/assessment/types";

const profileSchema = z.object({
  displayName: z.string().min(1, "请填写姓名或昵称"),
  role: z.string().min(1, "请选择角色"),
  industry: z.string().min(1, "请填写行业"),
  orgSize: z.string().min(1, "请选择组织规模"),
  companyName: z.string().optional(),
  contact: z.string().optional(),
  contactConsent: z.boolean().optional(),
  accessCode: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

export function StartForm({
  eventSlug,
  requiresAccessCode,
  initialProfile,
}: {
  eventSlug: string;
  requiresAccessCode: boolean;
  initialProfile?: Partial<Pick<ProfileForm, "displayName" | "role" | "companyName" | "contact">>;
}) {
  const router = useRouter();
  const [accessError, setAccessError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: initialProfile?.displayName ?? "",
      role: initialProfile?.role ?? "HR 一号位",
      orgSize: "500-2000 人",
      companyName: initialProfile?.companyName ?? "",
      contact: initialProfile?.contact ?? "",
      contactConsent: false,
    },
  });

  async function onSubmit(values: ProfileForm) {
    setAccessError(null);
    setSubmitting(true);

    if (requiresAccessCode) {
      const response = await fetch(`/api/runs/${eventSlug}/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessCode: values.accessCode }),
      });

      if (!response.ok) {
        setSubmitting(false);
        setAccessError("访问码不正确，请确认后再进入测评。");
        return;
      }

      sessionStorage.setItem(`access:${eventSlug}`, values.accessCode ?? "");
    }

    const profile: ParticipantProfile = {
      displayName: values.displayName,
      role: values.role,
      industry: values.industry,
      orgSize: values.orgSize,
      companyName: values.companyName,
      contact: values.contact,
      contactConsent: values.contactConsent,
    };
    sessionStorage.setItem(`profile:${eventSlug}`, JSON.stringify(profile));
    router.push(`/e/${eventSlug}/assessment`);
  }

  return (
    <GlassCard className="mt-8 p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5">
        {requiresAccessCode ? (
          <Field label="访问码" error={accessError ?? undefined}>
            <input className="input" {...register("accessCode")} placeholder="请输入入口访问码" />
          </Field>
        ) : null}

        <Field label="姓名 / 昵称" error={errors.displayName?.message}>
          <input className="input" {...register("displayName")} placeholder="例如：李明" />
        </Field>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="角色" error={errors.role?.message}>
            <select className="input" {...register("role")}>
              <option>HR 一号位</option>
              <option>组织发展负责人</option>
              <option>学习发展负责人</option>
              <option>HRBP</option>
              <option>业务管理者</option>
              <option>其他</option>
            </select>
          </Field>
          <Field label="组织规模" error={errors.orgSize?.message}>
            <select className="input" {...register("orgSize")}>
              <option>100 人以内</option>
              <option>100-500 人</option>
              <option>500-2000 人</option>
              <option>2000-10000 人</option>
              <option>10000 人以上</option>
            </select>
          </Field>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="行业" error={errors.industry?.message}>
            <input className="input" {...register("industry")} placeholder="例如：制造 / 科技 / 金融 / 教育" />
          </Field>
          <Field label="公司名（可选）">
            <input className="input" {...register("companyName")} placeholder="可留空" />
          </Field>
        </div>

        <Field label="联系方式（可选）">
          <input className="input" {...register("contact")} placeholder="邮箱或手机号，用于接收后续同行者计划" />
        </Field>

        <label className="flex items-start gap-3 rounded-2xl bg-white/[0.045] p-4 text-sm leading-6 text-emerald-50/70">
          <input type="checkbox" className="mt-1" {...register("contactConsent")} />
          <span>我同意在自愿留下联系方式的情况下，接收本次工作坊后续资料和同行者计划邀请。</span>
        </label>

        <button
          disabled={submitting}
          className="rounded-full bg-emerald-300 px-6 py-3 font-black text-[#06110f] transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "校验中..." : "进入测评"}
        </button>
      </form>
    </GlassCard>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold text-emerald-100/80">{label}</span>
      {children}
      {error ? <span className="text-sm text-red-300">{error}</span> : null}
    </label>
  );
}
