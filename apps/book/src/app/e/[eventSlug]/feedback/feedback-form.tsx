"use client";

import { useState } from "react";
import { Send } from "lucide-react";

const frameworks = [
  "AI 转型五级阶梯",
  "三螺旋架构",
  "意义 / 权力 / 信任",
  "人机链路五步法",
  "组织 AI 宪章",
  "其他",
];

const concepts = [
  "三螺旋架构",
  "隐性能量",
  "混合智能细胞",
  "业务本体",
  "人机链路",
  "组织 AI 宪章",
  "暂时没有",
  "其他",
];

const clarityOptions = ["非常清楚", "基本清楚", "有些模糊", "还没听懂"];

type FormState = {
  displayName: string;
  mostUsefulFrameworks: string[];
  mostUsefulReason: string;
  hardestFrameworks: string[];
  hardestReason: string;
  conceptsNeedRename: string[];
  renameSuggestion: string;
  cohortExperiment: string;
  claritySignal: string;
  extraFeedback: string;
};

const initialState: FormState = {
  displayName: "",
  mostUsefulFrameworks: [],
  mostUsefulReason: "",
  hardestFrameworks: [],
  hardestReason: "",
  conceptsNeedRename: [],
  renameSuggestion: "",
  cohortExperiment: "",
  claritySignal: "",
  extraFeedback: "",
};

export function FeedbackForm({ eventSlug }: { eventSlug: string }) {
  const [values, setValues] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function toggleList(key: "mostUsefulFrameworks" | "hardestFrameworks" | "conceptsNeedRename", option: string) {
    setValues((current) => {
      const selected = current[key];
      return {
        ...current,
        [key]: selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option],
      };
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!values.mostUsefulFrameworks.length || !values.hardestFrameworks.length || !values.conceptsNeedRename.length) {
      setError("请至少完成前三个核心选择题。");
      return;
    }

    setSubmitting(true);
    const response = await fetch(`/api/runs/${eventSlug}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json().catch(() => null)) as { ok?: boolean; reason?: string } | null;
    setSubmitting(false);

    if (!response.ok || !payload?.ok) {
      setError(payload?.reason ?? "提交失败，请稍后再试。");
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="grid min-h-[620px] place-items-center p-8 text-center">
        <div>
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-300 text-[#06110f]">
            <Send className="h-7 w-7" />
          </div>
          <h2 className="mt-6 text-3xl font-black text-white">已收到，谢谢你的现场反馈</h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-8 text-emerald-50/65">
            这份反馈会进入本次工作坊的数据池，用于课程复盘、概念命名调整和后续同行者小组设计。
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-6 p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="姓名 / 昵称（可选）">
          <input className="input" value={values.displayName} onChange={(event) => update("displayName", event.target.value)} placeholder="可匿名" />
        </Field>
      </div>

      <MultiChoiceGroup
        title="1. 哪些框架最有用？"
        values={values.mostUsefulFrameworks}
        options={frameworks}
        onToggle={(value) => toggleList("mostUsefulFrameworks", value)}
      />
      <Field label="为什么它最有用？（可选）">
        <textarea className="input min-h-24" value={values.mostUsefulReason} onChange={(event) => update("mostUsefulReason", event.target.value)} placeholder="一句话说明它帮你看见了什么。" />
      </Field>

      <MultiChoiceGroup
        title="2. 哪些框架听懂了，但不知道怎么用？"
        values={values.hardestFrameworks}
        options={frameworks}
        onToggle={(value) => toggleList("hardestFrameworks", value)}
      />
      <Field label="它卡在哪里？（可选）">
        <textarea className="input min-h-24" value={values.hardestReason} onChange={(event) => update("hardestReason", event.target.value)} placeholder="例如：场景不好选、权力不够、概念太抽象、缺少模板。" />
      </Field>

      <MultiChoiceGroup
        title="3. 哪些词或模型最需要改名？"
        values={values.conceptsNeedRename}
        options={concepts}
        onToggle={(value) => toggleList("conceptsNeedRename", value)}
      />
      <Field label="你建议怎么叫？或者为什么不好传播？（可选）">
        <textarea className="input min-h-24" value={values.renameSuggestion} onChange={(event) => update("renameSuggestion", event.target.value)} placeholder="请写听起来更像人话、更容易带回组织的叫法。" />
      </Field>

      <Field label="4. 如果做 4 周同行者小组，你愿意带什么实验加入？">
        <textarea className="input min-h-28" value={values.cohortExperiment} onChange={(event) => update("cohortExperiment", event.target.value)} placeholder="例如：用人机链路卡重写招聘面试流程；用三螺旋诊断一个 AI 试点。" />
      </Field>

      <ChoiceGroup
        title="5. 今天整体理解程度"
        value={values.claritySignal}
        options={clarityOptions}
        onChange={(value) => update("claritySignal", value)}
        optional
      />

      <Field label="其他建议（可选）">
        <textarea className="input min-h-28" value={values.extraFeedback} onChange={(event) => update("extraFeedback", event.target.value)} placeholder="任何对课程、案例、图示、节奏或术语的建议。" />
      </Field>

      {error ? <div className="rounded-2xl border border-red-300/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-300 px-6 py-4 font-black text-[#06110f] transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send className="h-5 w-5" />
        {submitting ? "提交中..." : "提交现场反馈"}
      </button>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold text-emerald-100/80">{label}</span>
      {children}
    </label>
  );
}

function ChoiceGroup({
  title,
  value,
  options,
  optional,
  onChange,
}: {
  title: string;
  value: string;
  options: string[];
  optional?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="rounded-3xl border border-emerald-200/12 bg-white/[0.035] p-4">
      <legend className="px-2 text-sm font-black text-emerald-100">
        {title}
        {optional ? <span className="ml-2 font-normal text-emerald-50/40">可选</span> : null}
      </legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option}
            className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold transition ${
              value === option
                ? "border-emerald-300 bg-emerald-300/16 text-white"
                : "border-emerald-200/10 bg-black/16 text-emerald-50/68 hover:border-emerald-200/30"
            }`}
          >
            <input
              type="radio"
              name={title}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="h-4 w-4 accent-emerald-300"
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function MultiChoiceGroup({
  title,
  values,
  options,
  onToggle,
}: {
  title: string;
  values: string[];
  options: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset className="rounded-3xl border border-emerald-200/12 bg-white/[0.035] p-4">
      <legend className="px-2 text-sm font-black text-emerald-100">
        {title}
        <span className="ml-2 font-normal text-emerald-50/40">可多选</span>
      </legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const checked = values.includes(option);
          return (
            <label
              key={option}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                checked
                  ? "border-emerald-300 bg-emerald-300/16 text-white"
                  : "border-emerald-200/10 bg-black/16 text-emerald-50/68 hover:border-emerald-200/30"
              }`}
            >
              <input
                type="checkbox"
                value={option}
                checked={checked}
                onChange={() => onToggle(option)}
                className="h-4 w-4 accent-emerald-300"
              />
              {option}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
