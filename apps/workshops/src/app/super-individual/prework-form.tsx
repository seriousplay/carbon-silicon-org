"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Check, Clipboard, Download, RotateCcw, Send } from "lucide-react";

type FormState = {
  name: string;
  workContext: string;
  aiFrequency: string;
  aiUses: string[];
  stepclaw: string;
  ima: string;
  obsidian: string;
  toolIssue: string;
  targetTask: string;
  goals: string[];
  bringMaterial: string;
  materialType: string;
  biggestQuestion: string;
};

const initialState: FormState = {
  name: "",
  workContext: "",
  aiFrequency: "",
  aiUses: [],
  stepclaw: "",
  ima: "",
  obsidian: "",
  toolIssue: "",
  targetTask: "",
  goals: [],
  bringMaterial: "",
  materialType: "",
  biggestQuestion: "",
};

const labels: Record<keyof FormState, string> = {
  name: "姓名",
  workContext: "主要工作场景",
  aiFrequency: "AI 使用频率",
  aiUses: "主要用 AI 做过什么",
  stepclaw: "StepClaw 准备情况",
  ima: "ima 准备情况",
  obsidian: "Obsidian 准备情况",
  toolIssue: "工具安装问题",
  targetTask: "希望现场完成的任务",
  goals: "希望达成的结果",
  bringMaterial: "是否带真实材料",
  materialType: "材料类型",
  biggestQuestion: "最想现场解决的问题",
};

const aiUseOptions = ["写作 / 改写", "总结资料", "搜集信息", "做方案", "做 PPT / 课程大纲", "分析数据或材料", "编程 / 自动化", "还没有实际使用"];
const goalOptions = ["更会写提示词", "更会用大龙虾", "能做出一份可用内容初稿", "能把一个重复任务做成 Skill", "更有信心把 AI 用到真实工作中"];
const preworkRunSlug = "20260517-hr-od-workshop";

function toMarkdown(data: FormState) {
  return Object.entries(labels)
    .map(([key, label]) => {
      const value = data[key as keyof FormState];
      const text = Array.isArray(value) ? value.join("、") : value;
      return `## ${label}\n${text || "未填写"}`;
    })
    .join("\n\n");
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function PreworkForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const markdown = useMemo(() => `# 超级个体赋能工作坊课前问卷\n\n${toMarkdown(form)}`, [form]);
  const completed = [form.name, form.workContext, form.aiFrequency, form.targetTask, form.bringMaterial].filter(Boolean).length + (form.goals.length ? 1 : 0);
  const progress = Math.round((completed / 6) * 100);
  const canSubmit = completed === 6;

  const update = (key: keyof FormState, value: string | string[]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setCopied(false);
    setSubmitError(null);
    setSubmittedId(null);
  };

  const download = (type: "md" | "json") => {
    const content = type === "md" ? markdown : JSON.stringify(form, null, 2);
    const blob = new Blob([content], { type: type === "md" ? "text/markdown;charset=utf-8" : "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const name = form.name || "未命名";
    link.href = url;
    link.download = `超级个体赋能工作坊课前问卷-${name}.${type}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const submit = async () => {
    setSubmitError(null);
    setSubmittedId(null);

    if (!canSubmit) {
      setSubmitError("请先补全姓名、工作场景、AI 使用频率、现场任务、预期结果和材料准备。");
      return;
    }

    setSubmitting(true);
    const response = await fetch(`/api/runs/${preworkRunSlug}/prework`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = (await response.json().catch(() => null)) as { ok?: boolean; id?: string; reason?: string } | null;
    setSubmitting(false);

    if (!response.ok || !payload?.ok) {
      setSubmitError(payload?.reason ?? "提交失败，请稍后再试。");
      return;
    }

    setSubmittedId(payload.id ?? "submitted");
  };

  return (
    <div className="rounded-[28px] border border-emerald-200/15 bg-[#0b1d19]/88 p-5 shadow-2xl shadow-black/20 sm:p-6 lg:p-8">
      <div className="grid gap-6 lg:grid-cols-[0.82fr_0.18fr] lg:items-start">
        <div>
          <h2 className="text-3xl font-black text-white">课前问卷</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50/62">
            建议 5 分钟内完成。提交后会进入工作坊数据池，主办方会根据你的任务类型和工具准备情况安排现场辅导。
          </p>
        </div>
        <div className="rounded-3xl border border-emerald-200/15 bg-white/[0.04] p-4">
          <div className="flex items-end justify-between gap-3">
            <span className="text-xs font-bold text-emerald-100/62">完成度</span>
            <span className="text-2xl font-black text-white">{progress}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-950">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-sky-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-7 grid gap-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="姓名">
            <input className="input" value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="请输入姓名" />
          </Field>
          <Field label="主要工作场景">
            <input className="input" value={form.workContext} onChange={(event) => update("workContext", event.target.value)} placeholder="例如：招聘、培训、组织发展、咨询交付" />
          </Field>
        </div>

        <ChoiceGroup
          title="你现在使用 AI 的频率是？"
          type="radio"
          name="aiFrequency"
          options={["几乎每天用", "每周几次", "偶尔用", "基本没用过"]}
          value={form.aiFrequency}
          onChange={(value) => update("aiFrequency", value)}
        />

        <ChoiceGroup
          title="你主要用 AI 做过什么？"
          type="checkbox"
          name="aiUses"
          options={aiUseOptions}
          value={form.aiUses}
          onChange={(value) => update("aiUses", toggleValue(form.aiUses, value))}
        />

        <div className="grid gap-4 lg:grid-cols-3">
          <ChoiceGroup
            title="StepClaw"
            type="radio"
            name="stepclaw"
            options={["已安装并登录", "安装中遇到问题", "还没安装"]}
            value={form.stepclaw}
            onChange={(value) => update("stepclaw", value)}
            compact
          />
          <ChoiceGroup
            title="ima"
            type="radio"
            name="ima"
            options={["已安装并创建知识库", "已安装但还没使用", "安装中遇到问题", "还没安装"]}
            value={form.ima}
            onChange={(value) => update("ima", value)}
            compact
          />
          <ChoiceGroup
            title="Obsidian"
            type="radio"
            name="obsidian"
            options={["已安装并创建本地库", "已安装但还没使用", "安装中遇到问题", "还没安装"]}
            value={form.obsidian}
            onChange={(value) => update("obsidian", value)}
            compact
          />
        </div>

        <Field label="如果工具安装遇到问题，请简单写一下">
          <textarea className="input min-h-24" value={form.toolIssue} onChange={(event) => update("toolIssue", event.target.value)} placeholder="例如：无法登录、下载失败、不会创建知识库等" />
        </Field>

        <Field label="你希望现场完成什么任务？">
          <textarea className="input min-h-28" value={form.targetTask} onChange={(event) => update("targetTask", event.target.value)} placeholder="我希望用 AI 帮我完成……最终得到……" />
        </Field>

        <ChoiceGroup
          title="你希望这次工作坊结束后达到什么结果？"
          type="checkbox"
          name="goals"
          options={goalOptions}
          value={form.goals}
          onChange={(value) => update("goals", toggleValue(form.goals, value))}
        />

        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <ChoiceGroup
            title="你愿意带一份非敏感真实材料到现场吗？"
            type="radio"
            name="bringMaterial"
            options={["愿意", "不确定", "不方便，希望使用现场案例"]}
            value={form.bringMaterial}
            onChange={(value) => update("bringMaterial", value)}
            compact
          />
          <Field label="材料类型大概是">
            <input className="input" value={form.materialType} onChange={(event) => update("materialType", event.target.value)} placeholder="例如：JD、制度文档、培训材料、会议纪要、文章草稿" />
          </Field>
        </div>

        <Field label="你最想在现场解决的一个问题是什么？">
          <textarea className="input min-h-24" value={form.biggestQuestion} onChange={(event) => update("biggestQuestion", event.target.value)} placeholder="例如：AI 写出来太空泛；我不知道怎么给上下文；不知道怎么把任务做成 Skill" />
        </Field>

        <div className="flex flex-wrap gap-3 border-t border-emerald-200/10 pt-5">
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || submitting}
            className="inline-flex items-center justify-center rounded-full bg-emerald-300 px-5 py-3 text-sm font-black text-[#06110f] transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {submittedId ? <Check className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
            {submitting ? "提交中..." : submittedId ? "已提交到主办方" : "提交课前问卷"}
          </button>
          <button type="button" onClick={copy} className="inline-flex items-center justify-center rounded-full border border-emerald-200/25 px-5 py-3 text-sm font-bold text-emerald-50 transition hover:bg-white/10">
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Clipboard className="mr-2 h-4 w-4" />}
            {copied ? "已复制" : "复制提交内容"}
          </button>
          <button type="button" onClick={() => download("md")} className="inline-flex items-center justify-center rounded-full border border-emerald-200/25 px-5 py-3 text-sm font-bold text-emerald-50 transition hover:bg-white/10">
            <Download className="mr-2 h-4 w-4" />
            下载 Markdown
          </button>
          <button type="button" onClick={() => download("json")} className="inline-flex items-center justify-center rounded-full border border-emerald-200/25 px-5 py-3 text-sm font-bold text-emerald-50 transition hover:bg-white/10">
            <Download className="mr-2 h-4 w-4" />
            下载 JSON
          </button>
          <button
            type="button"
            onClick={() => {
              setForm(initialState);
              setSubmitError(null);
              setSubmittedId(null);
            }}
            className="inline-flex items-center justify-center rounded-full border border-emerald-200/25 px-5 py-3 text-sm font-bold text-emerald-50/75 transition hover:bg-white/10 hover:text-white"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            清空
          </button>
        </div>
        {submitError ? (
          <div className="rounded-2xl border border-red-300/25 bg-red-500/10 p-4 text-sm leading-7 text-red-100">
            {submitError}
          </div>
        ) : null}
        {submittedId ? (
          <div className="rounded-2xl border border-emerald-200/18 bg-emerald-300/10 p-4 text-sm leading-7 text-emerald-50/76">
            已提交。你也可以保留一份 Markdown 或 JSON 作为个人备份。
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-emerald-50">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ChoiceGroup({
  title,
  type,
  name,
  options,
  value,
  onChange,
  compact = false,
}: {
  title: string;
  type: "radio" | "checkbox";
  name: string;
  options: string[];
  value: string | string[];
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <fieldset className="rounded-[24px] border border-emerald-200/12 bg-white/[0.035] p-4">
      <legend className="px-1 text-sm font-black text-white">{title}</legend>
      <div className={`mt-3 grid gap-2 ${compact ? "grid-cols-1" : "md:grid-cols-2"}`}>
        {options.map((option) => {
          const checked = Array.isArray(value) ? value.includes(option) : value === option;
          return (
            <label
              key={option}
              className={`flex min-h-12 cursor-pointer items-start gap-2 rounded-2xl border px-3 py-3 text-sm leading-6 transition ${
                checked
                  ? "border-emerald-300/70 bg-emerald-300/12 text-white"
                  : "border-emerald-200/10 bg-black/15 text-emerald-50/70 hover:border-emerald-200/30"
              }`}
            >
              <input
                className="mt-1 accent-emerald-300"
                type={type}
                name={name}
                checked={checked}
                onChange={() => onChange(option)}
              />
              <span>{option}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
