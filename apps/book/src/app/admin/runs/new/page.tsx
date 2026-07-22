"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, Container, GlassCard, SectionLabel } from "@/components/ui";
import { runTypeLabels, runStatusLabels } from "@/lib/runs/default-runs";
import type { CreateRunInput, RunStatus, RunType } from "@/lib/runs/types";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default function NewRunPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<CreateRunInput>({
    slug: "",
    title: "",
    runType: "workshop",
    status: "active",
    audience: "HR 一号位与组织发展负责人",
    description: "",
    date: "",
    accessCode: "",
    showOnHome: false,
  });

  const linkPreview = useMemo(() => (values.slug ? `/e/${values.slug}` : "/e/your-run-slug"), [values.slug]);
  const slugValid = !values.slug || slugPattern.test(values.slug);

  function update<K extends keyof CreateRunInput>(key: K, value: CreateRunInput[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!values.title.trim() || !values.slug.trim() || !slugValid) {
      setError("请填写有效标题和 slug。slug 只能使用小写字母、数字和连字符。");
      return;
    }

    setSubmitting(true);
    const response = await fetch("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...values,
        title: values.title.trim(),
        slug: values.slug.trim(),
        audience: values.audience?.trim() || undefined,
        description: values.description?.trim() || undefined,
        date: values.date || undefined,
        accessCode: values.accessCode?.trim() || undefined,
      }),
    });
    const payload = (await response.json().catch(() => null)) as { ok?: boolean; reason?: string; run?: { slug: string } } | null;
    setSubmitting(false);

    if (!response.ok || !payload?.ok || !payload.run?.slug) {
      setError(payload?.reason ?? "创建失败，请稍后重试或联系站点管理员。");
      return;
    }

    router.push(`/admin/runs/${payload.run.slug}`);
  }

  return (
    <AppShell>
      <Container className="max-w-5xl py-10">
        <SectionLabel>New Assessment Run</SectionLabel>
        <h1 className="text-4xl font-black text-white">创建测评入口</h1>
        <p className="mt-3 max-w-2xl text-emerald-50/60">
          为新的工作坊、企业诊断、内部班级或公开自测创建独立入口。创建后即可获得前台链接和汇总后台。
        </p>

        <GlassCard className="mt-8 p-6">
          <form onSubmit={submit} className="grid gap-5">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="入口标题">
                <input className="input" value={values.title} onChange={(event) => update("title", event.target.value)} placeholder="例如：某企业 AI 组织诊断第一期" />
              </Field>
              <Field label="访问 slug" help={slugValid ? linkPreview : "只能使用小写字母、数字和连字符"}>
                <input
                  className="input"
                  value={values.slug}
                  onChange={(event) => update("slug", event.target.value.toLowerCase())}
                  placeholder="例如：acme-ai-diagnosis-01"
                />
              </Field>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <Field label="入口类型">
                <select className="input" value={values.runType} onChange={(event) => update("runType", event.target.value as RunType)}>
                  {Object.entries(runTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="状态">
                <select className="input" value={values.status} onChange={(event) => update("status", event.target.value as RunStatus)}>
                  {Object.entries(runStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="日期（可选）">
                <input className="input" type="date" value={values.date} onChange={(event) => update("date", event.target.value)} />
              </Field>
            </div>

            <Field label="对象">
              <input className="input" value={values.audience} onChange={(event) => update("audience", event.target.value)} placeholder="例如：管理团队 / HR 与 OD / 业务负责人" />
            </Field>

            <Field label="入口说明">
              <textarea
                className="input min-h-32"
                value={values.description}
                onChange={(event) => update("description", event.target.value)}
                placeholder="说明本入口的使用场景、参与对象和测评目的。"
              />
            </Field>

            <Field label="访问码（可选）" help="V0.2 先保存访问码字段，前台校验可在运营能力阶段增强。">
              <input className="input" value={values.accessCode} onChange={(event) => update("accessCode", event.target.value)} placeholder="可留空" />
            </Field>

            <label className="flex items-start gap-3 rounded-2xl border border-emerald-200/10 bg-white/[0.035] p-4">
              <input
                type="checkbox"
                checked={Boolean(values.showOnHome)}
                onChange={(event) => update("showOnHome", event.target.checked)}
                className="mt-1 h-4 w-4 accent-emerald-300"
              />
              <span>
                <span className="block text-sm font-black text-emerald-50">在首页公开展示这个入口</span>
                <span className="mt-1 block text-xs leading-5 text-emerald-50/52">
                  默认不公开。未公开入口仍可通过唯一链接访问，适合直接发送给企业、班级或工作坊参与者。
                </span>
              </span>
            </label>

            {error ? <div className="rounded-2xl border border-red-300/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-emerald-300 px-6 py-3 font-black text-[#06110f] transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "创建中..." : "创建入口"}
            </button>
          </form>
        </GlassCard>
      </Container>
    </AppShell>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold text-emerald-100/80">{label}</span>
      {children}
      {help ? <span className="text-xs leading-5 text-emerald-50/45">{help}</span> : null}
    </label>
  );
}
