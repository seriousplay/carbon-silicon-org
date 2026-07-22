"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { readApiResponse } from "@/lib/api-response";
import { cleanOrganizationName } from "@/lib/identity-labels";
import type { LoopDesignerSession } from "@/lib/session-types";

const industries = [
  "科技 / 软件 / AI",
  "先进制造",
  "消费品 / 零售",
  "电商 / 直播电商",
  "跨境电商",
  "教育培训",
  "医疗健康",
  "金融 / 保险",
  "企业服务 / 咨询",
  "专业服务（法律 / 财税 / 设计）",
  "房地产 / 建筑 / 园区",
  "物流 / 供应链",
  "餐饮 / 酒店 / 本地生活",
  "文化传媒 / 内容 / IP",
  "能源 / 环保 / 新材料",
  "农业 / 食品",
  "政府 / 公共服务 / 社会组织",
  "集团多元化经营",
  "其他",
];
const roleOptions = [
  "创始人 / CEO",
  "业务负责人",
  "HR / 组织发展负责人",
  "数字化 / IT / AI 负责人",
  "产品 / 研发负责人",
  "其他",
];
const scaleOptions = ["50 人以内", "50-100 人", "100-300 人", "300-1000 人", "1000 人以上"];
const aiStageOptions: Array<[string, string]> = [
  ["A", "刚开始试 AI 工具，主要是个人零散使用"],
  ["B", "已经在部分岗位或部门使用 AI 提效"],
  ["C", "已经改造了一两个业务流程"],
  ["D", "正在思考组织结构、岗位分工、管理方式要怎么重设"],
  ["E", "AI 已进入多个核心业务流程，组织运转方式开始变化"],
];
const aiScenarioOptions = [
  "内容生产 / 营销获客",
  "销售跟进 / 客户经营",
  "客服 / 售后 / 用户反馈",
  "产品研发 / 用户洞察",
  "供应链 / 交付 / 运营",
  "财务 / 数据 / 经营分析",
  "招聘 / 培训 / 组织管理",
  "会议纪要 / 知识库 / 内部协同",
  "还没有明确应用场景",
];
const aiBlockerOptions = [
  "大家都在试工具，但没有进入真实业务流程",
  "部门墙明显，跨部门协同慢",
  "审批链条长，决策和响应太慢",
  "中层或员工不愿改变，担心被替代或被削弱",
  "老板 / 高管们还没有形成统一判断",
  "没有明确负责人，AI 推进容易变成一阵风",
  "数据基础弱，AI 很难接进业务",
  "不知道怎么判断 AI 项目有没有效果",
  "目前没有太多阻碍，按计划进行",
  "其他",
];
const aiAttitudeOptions: Array<[string, string]> = [
  ["A", "AI 实际上就是一个工具，并且目前不可控"],
  ["B", "AI 无所不能，组织里大部分人都将被替代"],
  ["C", "人和 AI 一起进化，组织形态需要重写"],
];
const orgManagementOptions: Array<[string, string]> = [
  ["A", "主要靠老板盯、管理者盯、会议盯"],
  ["B", "主要靠制度、审批、报表和层级管理"],
  ["C", "有一些数据看板，但多数还是事后复盘"],
  ["D", "部分业务能实时看到数据，并据此调整动作"],
  ["E", "AI 已经开始参与预警、提醒、分析和触发下一步动作"],
];
const humanAiDivisionOptions: Array<[string, string]> = [
  ["A", "不清楚，大家主要是自己摸索工具"],
  ["B", "有些岗位在用 AI，但没有明确分工原则"],
  ["C", "部分岗位已经明确哪些事交给 AI 辅助"],
  ["D", "部分团队已经重新设计“人做什么、AI 做什么”"],
  ["E", "已经开始围绕“人 + AI + 业务回路”重新设计岗位和协作方式"],
];
const ninetyDayPriorityOptions: Array<[string, string]> = [
  ["A", "一条业务流程"],
  ["B", "一个部门的工作方式"],
  ["C", "一个跨部门协同场景"],
  ["D", "一个岗位的人机分工"],
  ["E", "一个管理机制，例如会议、汇报、审批、复盘"],
  ["F", "还没想清楚，希望课堂上帮我判断"],
];
const evolutionPathOptions: Array<[string, string]> = [
  ["A", "增强：在现有成熟业务上嵌入 AI，提高效率和产出"],
  ["B", "重构：重写某个低效流程或部门协作方式"],
  ["C", "原生：围绕新业务、新团队，直接设计 AI 原生工作方式"],
  ["D", "还不确定，想先判断企业应该走哪条路"],
];
const expectationOptions = [
  "判断自己的组织现在处在哪个阶段",
  "看懂 AI 时代组织会怎么变化",
  "找到公司未来 90 天最该改的一件事",
  "设计一条 AI 业务回路",
  "判断人做什么、AI 做什么",
  "找到降低组织阻力的方法",
  "参考其他企业的真实案例",
  "和同行交流，校准自己的判断",
];

export function QuestionnaireWorkspace({ session }: { session: LoopDesignerSession }) {
  const router = useRouter();
  const saved = session.context.questionnaire;
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialRole = normalizeRole(saved?.role);
  const initialBlockers = normalizeBlockers(saved?.aiBlockers);
  const [form, setForm] = useState({
    name: saved?.name ?? "",
    company: cleanOrganizationName(saved?.company),
    role: initialRole.role,
    roleOther: initialRole.roleOther,
    scale: normalizeScale(saved?.scale),
    industry: saved?.industry ?? "",
    business: saved?.business ?? "",
    aiConcern: saved?.aiConcern ?? "",
    aiCurrentWork: saved?.aiCurrentWork ?? "",
    aiStageChoice: saved?.aiStageChoice ?? "",
    aiScenarios: saved?.aiScenarios ?? [],
    aiBlockers: initialBlockers.aiBlockers,
    aiBlockerOther: initialBlockers.aiBlockerOther,
    ninetyDayPriorityChoice: saved?.ninetyDayPriorityChoice ?? "",
    aiAttitudeChoice: saved?.aiAttitudeChoice ?? "",
    orgManagementChoice: saved?.orgManagementChoice ?? "",
    humanAiDivisionChoice: saved?.humanAiDivisionChoice ?? "",
    evolutionPathChoice: saved?.evolutionPathChoice ?? "",
    expectations: saved?.expectations ?? [],
    takeaway: saved?.takeaway ?? "",
    openQuestion: saved?.openQuestion ?? "",
  });
  const total = 8;
  const progress = Math.round(((page + 1) / total) * 100);

  function update(key: keyof typeof form, value: string | string[]) {
    setError(null);
    setForm((current) => ({ ...current, [key]: value }));
  }

  function nextPage() {
    const invalid = validatePage(page, form);
    if (invalid) return setError(invalid.message);
    setError(null);
    setPage((current) => Math.min(total - 1, current + 1));
  }

  async function submit() {
    const invalid = validateAll(form);
    if (invalid) {
      setPage(invalid.page);
      setError(invalid.message);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/loop-designer/api/sessions/${session.id}/questionnaire`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildQuestionnairePayload(form)),
      });
      const payload = await readApiResponse<{ nextUrl?: string }>(response, "问卷提交失败");
      if (!response.ok || !payload.nextUrl) return setError(payload.error || "问卷提交失败");
      router.push(payload.nextUrl);
    } catch {
      setError("网络连接中断，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-5 py-8 md:px-10">
      <div className="mx-auto max-w-3xl">
        <div className="mono text-[10px] tracking-[.22em] text-[var(--acid)]">PREWORK / SESSION {session.id.slice(0, 8)}</div>
        <h1 className="mt-4 text-4xl font-black">课前问卷</h1>
        <div className="mt-6 h-1 bg-white/10"><div className="h-full bg-[var(--acid)]" style={{ width: `${progress}%` }} /></div>
        <section className="panel mt-8 p-6 md:p-8">
          {page === 0 ? (
            <div className="space-y-6">
              <Choice label="你的企业现在的 AI 应用状态，更接近哪一种？" value={form.aiStageChoice} onChange={(value) => update("aiStageChoice", value)} options={aiStageOptions} />
              <MultiChoice label="企业目前 AI 应用最多的场景是？（最多选 3 项）" value={form.aiScenarios} onChange={(value) => update("aiScenarios", value)} options={aiScenarioOptions} max={3} />
            </div>
          ) : null}
          {page === 1 ? (
            <div className="space-y-4">
              <MultiChoice label="目前阻碍 AI 真正给业务助力的最大问题是什么？（最多选 3 项）" value={form.aiBlockers} onChange={(value) => update("aiBlockers", value)} options={aiBlockerOptions} max={3} />
              {form.aiBlockers.includes("其他") ? (
                <Field label="其他阻碍" value={form.aiBlockerOther} onChange={(value) => update("aiBlockerOther", value)} />
              ) : null}
            </div>
          ) : null}
          {page === 2 ? (
            <div className="space-y-6">
              <Choice label="您对于 AI 进入组织的态度，更接近哪一种？" value={form.aiAttitudeChoice} onChange={(value) => update("aiAttitudeChoice", value)} options={aiAttitudeOptions} />
              <Choice label="企业现在的组织管理方式，更接近哪一种？" value={form.orgManagementChoice} onChange={(value) => update("orgManagementChoice", value)} options={orgManagementOptions} />
            </div>
          ) : null}
          {page === 3 ? (
            <div className="space-y-6">
              <Choice label="企业现在“人和 AI 的分工”清楚吗？" value={form.humanAiDivisionChoice} onChange={(value) => update("humanAiDivisionChoice", value)} options={humanAiDivisionOptions} />
              <Choice label="如果未来 90 天只推动一件 AI 组织变化，您最想先改哪里？" value={form.ninetyDayPriorityChoice} onChange={(value) => update("ninetyDayPriorityChoice", value)} options={ninetyDayPriorityOptions} />
            </div>
          ) : null}
          {page === 4 ? (
            <div className="space-y-6">
              <Choice label="您觉得企业更适合先走哪条 AI 组织进化路径？" value={form.evolutionPathChoice} onChange={(value) => update("evolutionPathChoice", value)} options={evolutionPathOptions} />
              <MultiChoice label="您对这门课期待有哪些？（最多选 3 项）" value={form.expectations} onChange={(value) => update("expectations", value)} options={expectationOptions} max={3} />
            </div>
          ) : null}
          {page === 5 ? (
            <Field
              label="面对 AI 的冲击，最让您感到焦虑的 / 我现在最担心的是："
              value={form.aiConcern}
              onChange={(value) => update("aiConcern", value)}
              textarea
              required
              placeholder="请写下您现在最真实的一个问题。"
            />
          ) : null}
          {page === 6 ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="姓名" value={form.name} onChange={(value) => update("name", value)} required />
                <Field label="企业" value={form.company} onChange={(value) => update("company", value)} required />
              </div>
              <label className="block">
                <span className="mono text-[10px] tracking-[.16em] text-white/38">角色</span>
                <select value={form.role} onChange={(event) => update("role", event.target.value)} className="field mt-2" required>
                  <option value="">请选择</option>
                  {roleOptions.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              {form.role === "其他" ? <Field label="其他角色" value={form.roleOther} onChange={(value) => update("roleOther", value)} required /> : null}
              <label className="block">
                <span className="mono text-[10px] tracking-[.16em] text-white/38">员工规模</span>
                <select value={form.scale} onChange={(event) => update("scale", event.target.value)} className="field mt-2" required>
                  <option value="">请选择</option>
                  {scaleOptions.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
            </div>
          ) : null}
          {page === 7 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mono text-[10px] tracking-[.16em] text-white/38">行业</span>
                <select value={form.industry} onChange={(event) => update("industry", event.target.value)} className="field mt-2" required>
                  <option value="">请选择</option>
                  {industries.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <Field label="主营业务" value={form.business} onChange={(value) => update("business", value)} placeholder="例如：跨境选品与供应链协同" required />
            </div>
          ) : null}
          {error ? <p className="mt-5 text-sm text-orange-200">{error}</p> : null}
          <div className="mt-7 flex justify-between">
            <button disabled={page === 0 || busy} onClick={() => setPage((current) => Math.max(0, current - 1))} className="border border-white/15 px-5 py-3 text-sm disabled:opacity-30">上一步</button>
            {page < total - 1 ? (
              <button onClick={nextPage} className="inline-flex items-center gap-2 bg-[var(--acid)] px-5 py-3 font-bold text-black">下一步 <ArrowRight size={16} /></button>
            ) : (
              <button disabled={busy} onClick={submit} className="inline-flex items-center gap-2 bg-[var(--acid)] px-5 py-3 font-bold text-black disabled:opacity-40">{busy ? <LoaderCircle className="animate-spin" size={16} /> : null}{busy ? "提交中..." : "提交问卷"}</button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, placeholder = "", textarea = false, required = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; textarea?: boolean; required?: boolean }) {
  return (
    <label className="block">
      <span className="mono text-[10px] tracking-[.16em] text-white/38">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="field mt-2 min-h-28" required={required} />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="field mt-2" required={required} />
      )}
    </label>
  );
}

type QuestionnaireForm = {
  name: string;
  company: string;
  role: string;
  roleOther: string;
  scale: string;
  industry: string;
  business: string;
  aiConcern: string;
  aiStageChoice: string;
  aiScenarios: string[];
  aiBlockers: string[];
  aiBlockerOther: string;
  ninetyDayPriorityChoice: string;
  aiAttitudeChoice: string;
  orgManagementChoice: string;
  humanAiDivisionChoice: string;
  evolutionPathChoice: string;
  expectations: string[];
};

function validateAll(form: QuestionnaireForm) {
  for (let page = 0; page < 8; page++) {
    const invalid = validatePage(page, form);
    if (invalid) return invalid;
  }
  return null;
}

function validatePage(page: number, form: QuestionnaireForm): { page: number; message: string } | null {
  if (page === 0 && (!form.aiStageChoice || form.aiScenarios.length === 0)) return { page, message: "请先完成本页必填问题。" };
  if (page === 1 && (form.aiBlockers.length === 0 || (form.aiBlockers.includes("其他") && !hasText(form.aiBlockerOther)))) return { page, message: "请先完成本页必填问题。" };
  if (page === 2 && (!form.aiAttitudeChoice || !form.orgManagementChoice)) return { page, message: "请先完成本页必填问题。" };
  if (page === 3 && (!form.humanAiDivisionChoice || !form.ninetyDayPriorityChoice)) return { page, message: "请先完成本页必填问题。" };
  if (page === 4 && (!form.evolutionPathChoice || form.expectations.length === 0)) return { page, message: "请先完成本页必填问题。" };
  if (page === 5 && !hasText(form.aiConcern)) return { page, message: "请填写面对 AI 的真实问题。" };
  if (page === 6 && (!hasText(form.name) || !hasText(form.company) || !form.role || (form.role === "其他" && !hasText(form.roleOther)) || !form.scale)) return { page, message: "请补全姓名、企业、角色和规模。" };
  if (page === 7 && (!form.industry || !hasText(form.business))) return { page, message: "请补全行业和主营业务。" };
  return null;
}

function hasText(value: string) {
  return value.trim().length > 0;
}

function normalizeScale(value: string | undefined) {
  if (!value) return "";
  const normalized = value.replace(/\s*人$/, "");
  const legacyMap: Record<string, string> = {
    "1-10": "50 人以内",
    "10-50": "50 人以内",
    "50-100": "50-100 人",
    "100-500": "100-300 人",
    "500-3000": "300-1000 人",
    "3000以上": "1000 人以上",
  };
  return scaleOptions.includes(value) ? value : legacyMap[normalized] || value;
}

function normalizeRole(value: string | undefined) {
  if (!value) return { role: "", roleOther: "" };
  return roleOptions.includes(value) ? { role: value, roleOther: "" } : { role: "其他", roleOther: value };
}

function normalizeBlockers(value: string[] | undefined) {
  if (!value) return { aiBlockers: [], aiBlockerOther: "" };
  const other = value.find((item) => item.startsWith("其他："));
  return {
    aiBlockers: other ? value.map((item) => item.startsWith("其他：") ? "其他" : item) : value,
    aiBlockerOther: other?.replace(/^其他：/, "") ?? "",
  };
}

function buildQuestionnairePayload(form: {
  role: string;
  roleOther: string;
  aiBlockers: string[];
  aiBlockerOther: string;
  [key: string]: string | string[];
}) {
  const role = form.role === "其他" && form.roleOther.trim() ? form.roleOther.trim() : form.role;
  const aiBlockers = form.aiBlockers.includes("其他") && form.aiBlockerOther.trim()
    ? form.aiBlockers.map((item) => item === "其他" ? `其他：${form.aiBlockerOther.trim()}` : item)
    : form.aiBlockers;
  const { roleOther, aiBlockerOther, ...payload } = form;
  void roleOther;
  void aiBlockerOther;
  return { ...payload, role, aiBlockers };
}

function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <fieldset>
      <legend className="mono text-[10px] tracking-[.16em] text-white/38">{label}</legend>
      <div className="mt-3 grid gap-2">
        {options.map(([id, text]) => (
          <label key={id} className={`flex cursor-pointer gap-3 border p-3 text-sm leading-6 ${value === id ? "border-[var(--acid)] bg-[var(--acid)]/10" : "border-white/10"}`}>
            <input type="radio" checked={value === id} onChange={() => onChange(id)} className="mt-1" />
            <span>{text}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function MultiChoice({ label, value, onChange, options, max }: { label: string; value: string[]; onChange: (value: string[]) => void; options: string[]; max: number }) {
  function toggle(option: string) {
    if (value.includes(option)) return onChange(value.filter((item) => item !== option));
    if (value.length >= max) return;
    onChange([...value, option]);
  }

  return (
    <fieldset>
      <legend className="mono text-[10px] tracking-[.16em] text-white/38">{label}</legend>
      <div className="mt-3 grid gap-2">
        {options.map((option) => {
          const checked = value.includes(option);
          const disabled = !checked && value.length >= max;
          return (
            <label key={option} className={`flex cursor-pointer gap-3 border p-3 text-sm leading-6 ${checked ? "border-[var(--acid)] bg-[var(--acid)]/10" : "border-white/10"} ${disabled ? "opacity-45" : ""}`}>
              <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(option)} className="mt-1" />
              <span>{option}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
