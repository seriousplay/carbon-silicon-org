"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, HelpCircle } from "lucide-react";
import type { ToolProduct, ToolTemplatePrompt } from "@/lib/tools/tool-library";
import type { ToolSessionReport } from "@/lib/tools/session-types";

type ToolUseFormProps = {
  tool: ToolProduct;
  runSlug?: string;
  requiresAccessCode: boolean;
  initialProfile?: Partial<Pick<FormState, "displayName" | "role" | "companyName" | "teamName" | "contact">>;
};

type FormState = {
  displayName: string;
  role: string;
  companyName: string;
  teamName: string;
  contact: string;
  accessCode: string;
  useCase: string;
  dataScope: string;
  currentSituation: string;
  evidenceSignal: string;
  expectedOutput: string;
  nextAction: string;
  responses: Record<string, string>;
};

export function ToolUseForm({ tool, runSlug, requiresAccessCode, initialProfile }: ToolUseFormProps) {
  const guidance = tool.formGuidance ?? {};
  const prompts = useMemo(
    () =>
      tool.templateSections.flatMap((section) =>
        section.prompts.map((prompt, index) => ({
          id: `${section.title}-${index}`,
          section: section.title,
          prompt: normalizeTemplatePrompt(prompt),
        })),
      ),
    [tool.templateSections],
  );

  const [values, setValues] = useState<FormState>({
    displayName: initialProfile?.displayName ?? "",
    role: initialProfile?.role ?? "",
    companyName: initialProfile?.companyName ?? "",
    teamName: initialProfile?.teamName ?? "",
    contact: initialProfile?.contact ?? "",
    accessCode: "",
    useCase: "",
    dataScope: "",
    currentSituation: "",
    evidenceSignal: "",
    expectedOutput: "",
    nextAction: "",
    responses: {},
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [report, setReport] = useState<ToolSessionReport | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function updateResponse(id: string, value: string) {
    setValues((current) => ({
      ...current,
      responses: { ...current.responses, [id]: value },
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!values.displayName.trim() || !values.useCase.trim()) {
      setError("请至少填写姓名/称呼和本次使用场景。");
      return;
    }

    if (requiresAccessCode && !values.accessCode.trim()) {
      setError("这个企业/班级入口需要访问码。");
      return;
    }

    setSubmitting(true);
    const response = await fetch(`/api/tools/${tool.id}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runSlug,
        accessCode: values.accessCode.trim() || undefined,
        profile: {
          displayName: values.displayName.trim(),
          role: values.role.trim() || undefined,
          companyName: values.companyName.trim() || undefined,
          teamName: values.teamName.trim() || undefined,
          contact: values.contact.trim() || undefined,
        },
        context: {
          useCase: values.useCase.trim(),
          dataScope: values.dataScope.trim() || undefined,
          currentSituation: values.currentSituation.trim() || undefined,
          evidenceSignal: values.evidenceSignal.trim() || undefined,
          expectedOutput: values.expectedOutput.trim() || undefined,
        },
        responses: values.responses,
        nextAction: values.nextAction.trim() || undefined,
      }),
    });
    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      id?: string;
      outputs?: { report?: ToolSessionReport };
      reason?: string;
    } | null;
    setSubmitting(false);

    if (!response.ok || !payload?.ok || !payload.id) {
      setError(payload?.reason ?? "提交失败，请稍后重试。");
      return;
    }

    setSessionId(payload.id);
    setReport(payload.outputs?.report ?? null);
  }

  if (sessionId) {
    return (
      <div className="rounded-[28px] border border-emerald-200/15 bg-[#0c201c]/75 p-8 shadow-2xl shadow-black/20">
        <CheckCircle2 className="h-10 w-10 text-emerald-300" />
        <h2 className="mt-5 text-3xl font-black text-white">已沉淀到工具数据池</h2>
        <p className="mt-3 text-base leading-8 text-emerald-50/68">
          这次 {tool.name} 使用记录已经提交。{runSlug ? "引导师可在对应入口后台查看工具使用汇总，并导出企业数据。" : "单独使用记录已保存为独立工具会话。"}
        </p>
        <div className="mt-6 rounded-2xl border border-emerald-200/10 bg-black/20 p-4 text-xs text-emerald-100/70">
          Session ID：{sessionId}
        </div>
        {report ? (
          <div className="mt-6 grid gap-4 rounded-[22px] border border-emerald-200/10 bg-white/[0.035] p-5">
            <div className="flex items-center gap-2 text-sm font-black text-emerald-200">
              <FileText className="h-4 w-4" />
              即时洞察
            </div>
            <p className="text-sm leading-7 text-emerald-50/70">{report.summary}</p>
            {report.weakestSignal ? (
              <div className="rounded-2xl border border-emerald-200/10 bg-black/20 p-4 text-sm text-emerald-50/68">
                优先处理：<span className="font-black text-white">{report.weakestSignal}</span>
              </div>
            ) : null}
            <InsightList title="关键发现" items={report.keyFindings} />
            <InsightList title="建议动作" items={report.recommendedActions} />
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/tools/sessions/${sessionId}`} className="rounded-full bg-emerald-300 px-5 py-3 text-sm font-black text-[#06110f]">
            查看完整记录与洞察
          </Link>
          <Link href={`/tools/${tool.id}`} className="rounded-full border border-emerald-200/20 px-5 py-3 text-sm font-black text-emerald-50">
            返回工具说明
          </Link>
          {runSlug ? (
            <Link href={`/e/${runSlug}`} className="rounded-full bg-emerald-300 px-5 py-3 text-sm font-black text-[#06110f]">
              返回企业入口
            </Link>
          ) : (
            <Link href="/tools" className="rounded-full bg-emerald-300 px-5 py-3 text-sm font-black text-[#06110f]">
              查看更多工具
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-6 rounded-[28px] border border-emerald-200/15 bg-[#0c201c]/75 p-6 shadow-2xl shadow-black/20">
      <div>
        <h2 className="text-2xl font-black text-white">在线使用记录</h2>
        <p className="mt-2 text-sm leading-7 text-emerald-50/62">
          填写一次真实使用记录。单独使用会形成个人工具会话；从企业/班级入口进入，会自动归入该入口的数据池。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="姓名/称呼">
          <input className="input" value={values.displayName} onChange={(event) => update("displayName", event.target.value)} />
        </Field>
        <Field label="角色">
          <input className="input" value={values.role} onChange={(event) => update("role", event.target.value)} placeholder="例如：HRD / OD / 业务负责人" />
        </Field>
        <Field label="企业/组织">
          <input className="input" value={values.companyName} onChange={(event) => update("companyName", event.target.value)} />
        </Field>
        <Field label="团队/部门">
          <input className="input" value={values.teamName} onChange={(event) => update("teamName", event.target.value)} placeholder="例如：组织发展部 / 销售一线 / 产品增长团队" />
        </Field>
        <Field label="联系方式（可选）">
          <input className="input" value={values.contact} onChange={(event) => update("contact", event.target.value)} />
        </Field>
      </div>

      {requiresAccessCode ? (
        <Field label="访问码">
          <input className="input" value={values.accessCode} onChange={(event) => update("accessCode", event.target.value)} />
        </Field>
      ) : null}

      <div className="grid gap-4">
        <Field label="本次使用场景">
          <textarea
            className="input min-h-28"
            value={values.useCase}
            onChange={(event) => update("useCase", event.target.value)}
            placeholder="请写清你准备用这个工具处理哪一个真实组织问题。"
          />
          {guidance.useCase ? <TemplatePromptGuidance prompt={guidance.useCase} /> : null}
        </Field>
        <Field label="数据沉淀对象">
          <textarea
            className="input min-h-24"
            value={values.dataScope}
            onChange={(event) => update("dataScope", event.target.value)}
            placeholder="请写清这条记录归属哪个团队、业务单元、流程、项目或组织议题。"
          />
          {guidance.dataScope ? <TemplatePromptGuidance prompt={guidance.dataScope} /> : null}
        </Field>
        <Field label="当前现场">
          <textarea
            className="input min-h-28"
            value={values.currentSituation}
            onChange={(event) => update("currentSituation", event.target.value)}
            placeholder="目前卡在哪里？有哪些事实或证据？"
          />
          {guidance.currentSituation ? <TemplatePromptGuidance prompt={guidance.currentSituation} /> : null}
        </Field>
        <Field label="复盘观察信号">
          <textarea
            className="input min-h-24"
            value={values.evidenceSignal}
            onChange={(event) => update("evidenceSignal", event.target.value)}
            placeholder="下一次复盘时，用什么信号判断这个团队或组织问题有进展？"
          />
          {guidance.evidenceSignal ? <TemplatePromptGuidance prompt={guidance.evidenceSignal} /> : null}
        </Field>
        <Field label="期待产出">
          <textarea
            className="input min-h-24"
            value={values.expectedOutput}
            onChange={(event) => update("expectedOutput", event.target.value)}
            placeholder={`例如：${tool.output}`}
          />
          {guidance.expectedOutput ? <TemplatePromptGuidance prompt={guidance.expectedOutput} /> : null}
        </Field>
      </div>

      <div className="rounded-[24px] border border-emerald-200/10 bg-black/18 p-5">
        <h3 className="text-lg font-black text-white">工具输出模板</h3>
        <div className="mt-4 grid gap-4">
          {prompts.map((item) => (
            <Field
              key={item.id}
              label={item.prompt.label}
              help={item.section}
              guidance={
                item.prompt.standard || item.prompt.example || item.prompt.avoid ? (
                  <TemplatePromptGuidance prompt={item.prompt} />
                ) : undefined
              }
            >
              <textarea
                className="input min-h-24"
                value={values.responses[item.id] ?? ""}
                onChange={(event) => updateResponse(item.id, event.target.value)}
              />
            </Field>
          ))}
        </div>
      </div>

      <Field label="下一步行动">
        <textarea
          className="input min-h-24"
          value={values.nextAction}
          onChange={(event) => update("nextAction", event.target.value)}
          placeholder={tool.followUpActions[0]}
        />
        {guidance.nextAction ? <TemplatePromptGuidance prompt={guidance.nextAction} /> : null}
      </Field>

      {error ? <div className="rounded-2xl border border-red-300/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-full bg-emerald-300 px-6 py-3 text-sm font-black text-[#06110f] transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "提交中..." : "提交并沉淀数据"}
        <ArrowRight className="ml-2 h-4 w-4" />
      </button>
    </form>
  );
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-sm font-black text-white">{title}</div>
      <ul className="mt-2 grid gap-2">
        {items.map((item) => (
          <li key={item} className="text-sm leading-7 text-emerald-50/62">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function normalizeTemplatePrompt(prompt: string | ToolTemplatePrompt): ToolTemplatePrompt {
  if (typeof prompt === "string") return { label: prompt };
  return prompt;
}

function TemplatePromptGuidance({ prompt }: { prompt: ToolTemplatePrompt }) {
  return (
    <details className="group rounded-2xl border border-emerald-200/10 bg-white/[0.025]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-black text-emerald-100/78 transition hover:text-emerald-50">
        <span className="inline-flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-emerald-200/80" />
          填写提示
        </span>
        <span className="text-emerald-50/40 transition group-open:rotate-45">+</span>
      </summary>
      <div className="grid gap-3 border-t border-emerald-200/10 px-4 pb-4 pt-3">
        {prompt.standard ? <GuidanceItem label="填写标准" value={prompt.standard} /> : null}
        {prompt.example ? <GuidanceItem label="示例" value={prompt.example} strong /> : null}
        {prompt.avoid ? <GuidanceItem label="避免写法" value={prompt.avoid} muted /> : null}
      </div>
    </details>
  );
}

function GuidanceItem({ label, value, strong = false, muted = false }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-black text-emerald-200/80">{label}</span>
      <p className={strong ? "text-sm leading-7 text-white" : muted ? "text-sm leading-7 text-emerald-50/48" : "text-sm leading-7 text-emerald-50/66"}>
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  help,
  guidance,
  children,
}: {
  label: string;
  help?: string;
  guidance?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold text-emerald-100/80">{label}</span>
      {guidance}
      {children}
      {help ? <span className="text-xs leading-5 text-emerald-50/45">{help}</span> : null}
    </label>
  );
}
