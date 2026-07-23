"use client";

import { CheckCircle2, Shield } from "lucide-react";
import { LearnBlock, InfoBox, VoteBar, ModulePage } from "./shared";

export function SafetyModule({ completed, onToggleComplete, onNext, onPrev }: {
  completed: boolean; onToggleComplete: () => void; onNext: () => void; onPrev: () => void;
}) {
  const checks = [
    { dim: "合规性", check: "JD、评估和建议是否违反劳动法或公司制度？", fix: "请检查是否存在合规风险，并列出依据。" },
    { dim: "公平性", check: "是否存在性别、年龄、地域、婚育等偏见表述？", fix: "请检查筛选标准中的潜在歧视性表述。" },
    { dim: "准确性", check: "AI有没有编造事实、岗位信息或制度条款？", fix: "请标注哪些结论来自输入材料，哪些是推断。" },
    { dim: "温度感", check: "反馈和沟通是否太冷、太机械？", fix: "请调整语气，保持专业但有尊重和同理心。" },
    { dim: "保密性", check: "是否包含员工隐私或薪酬等敏感信息？", fix: "请移除或脱敏处理涉及个人隐私的内容。" },
    { dim: "责任归属", check: "最终决策是否保留给人类HR？", fix: "请明确标注'AI建议，需HR审核确认'。" },
  ];
  const rules = [
    "不得用AI做雇佣/解雇的最终决定",
    "不得用AI独立处理员工投诉和纪律处分",
    "不得用AI生成未经HR审核的薪酬调整方案",
    "不得用AI访问或分析未经授权的员工隐私数据",
    "不得用AI替代法定的劳动合规审查",
    "不得用AI独立撰写具有法律效力的HR文件",
    "不得将AI建议作为绩效评估的唯一依据",
    "不得向AI透露员工身份证号、银行账号等敏感信息",
  ];

  return <ModulePage title="🛡️ 风险边界" subtitle="什么判断不能交给AI？HR合规的红线在哪里？">
    <InfoBox variant="amber">
      <strong className="text-amber-300">HR 使用 AI 的核心原则：</strong>AI 可以加速整理、生成和分析，但<strong>不能替代</strong>最终录用、绩效、薪酬、处分、解除劳动关系等责任判断。工具赋能不等于责任外包。
    </InfoBox>

    <LearnBlock title="AI初稿审核法（HR六维度）">
      <div className="space-y-3">
        {checks.map(c => (
          <div key={c.dim} className="rounded-xl border border-emerald-200/10 bg-white/[0.02] p-4">
            <div className="text-base font-bold text-emerald-200">{c.dim}</div>
            <div className="mt-1 text-emerald-100/60">{c.check}</div>
            <div className="mt-1.5 rounded-lg bg-amber-300/[0.06] border border-amber-300/8 px-3 py-1.5 text-sm text-amber-200/60">🔧 {c.fix}</div>
          </div>
        ))}
      </div>
    </LearnBlock>

    <LearnBlock title="八条红线">
      <div className="flex items-start gap-3 mb-4">
        <Shield className="h-6 w-6 shrink-0 text-rose-400 mt-0.5" />
        <p className="text-emerald-100/70">这些判断<strong className="text-rose-300">必须</strong>由人类HR做出，AI只能提供参考信息。</p>
      </div>
      <div className="space-y-2">
        {rules.map((rule, i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl border border-rose-300/8 bg-rose-300/[0.02] p-3.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-300/10 text-sm font-black text-rose-300">{i + 1}</div>
            <p className="pt-0.5 text-base leading-7 text-rose-100/75">{rule}</p>
          </div>
        ))}
      </div>
    </LearnBlock>

    <VoteBar module="safety" />

    <div className="mt-10 flex items-center justify-between border-t border-emerald-200/8 pt-6">
      <button onClick={onPrev} className="rounded-full border border-emerald-200/15 px-5 py-2.5 text-sm font-bold text-emerald-100/60 transition hover:bg-white/5">← 上一模块</button>
      <button onClick={onToggleComplete} className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-black transition ${completed ? "bg-emerald-300/15 text-emerald-300" : "bg-emerald-300 text-[#07110f] hover:scale-105 active:scale-95"}`}>
        {completed ? <><CheckCircle2 className="h-4 w-4" /> 已完成</> : "标记完成 +20分"}
      </button>
      <button onClick={onNext} className="rounded-full border border-emerald-200/15 px-5 py-2.5 text-sm font-bold text-emerald-100/60 transition hover:bg-white/5">下一模块 →</button>
    </div>
  </ModulePage>;
}
