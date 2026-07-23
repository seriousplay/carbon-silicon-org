"use client";

import { CheckCircle2 } from "lucide-react";
import { LearnBlock, StepTable, FlowDiagram, PracticeInput, VoteBar, ModulePage } from "./shared";

export function AgentModule({ completed, onToggleComplete, onNext, onPrev }: {
  completed: boolean; onToggleComplete: () => void; onNext: () => void; onPrev: () => void;
}) {
  return <ModulePage title="🤖 智能体 Agent" subtitle="不只是问答，而是连续办事——交给AI一个目标，它自己拆步骤、调工具、交付完整结果。">
    <LearnBlock title="概念理解">
      <p>提示词是单轮对话——你问一句，AI答一句。Agent是<strong className="text-emerald-200">多轮连续执行</strong>——你交给它一个目标，它自己拆步骤、调用工具、交付完整结果。区别就像"让助理帮你查个电话"vs"让助理组织一场招聘会"。</p>
    </LearnBlock>

    <LearnBlock title="HR场景：招聘助手Agent">
      <p className="mb-4">不是你在驱动每一步——而是你给一个目标<strong className="text-emerald-200">"完成这个岗位的招聘准备"</strong>，Agent自己走完：</p>
      <FlowDiagram steps={[
        { icon: "📥", label: "输入岗位需求" },
        { icon: "🤖", label: "自动生成JD" },
        { icon: "🔍", label: "筛选简历打分" },
        { icon: "📋", label: "生成面试问题" },
        { icon: "📊", label: "输出评估表" },
      ]} />
    </LearnBlock>

    <LearnBlock title="实践练习">
      <p className="mb-4">选一个HR高频任务，设计它的Agent流程：</p>
      <PracticeInput placeholder="1. 任务名称：________\n2. 输入信号（什么触发这个Agent？）：________\n3. Agent需要完成的步骤（3-5步）：________\n4. 最终交付物是什么？：________" lines={5} />
    </LearnBlock>

    <LearnBlock title="单Agent vs 多Agent">
      <StepTable headers={["层级", "能做什么", "HR例子", "上手难度"]} rows={[
        ["单Agent", "一个助手完成一个流程", "招聘助手从JD到面试题一条龙", "⭐ 入门"],
        ["多Agent", "多个助手分工协作", "调研+分析+创作+审核Agent协同", "⭐⭐⭐ 进阶"],
      ]} />
    </LearnBlock>

    <LearnBlock title="工具推荐">
      <StepTable headers={["优先级", "工具", "特点", "适合场景"]} rows={[
        ["🥇 首选", "Workbuddy", "原生Agent支持、全流程自动化编排、零代码", "HR Agent创建首选——搭一个招聘助手只需15分钟"],
        ["🥈 次选", "扣子 Coze (coze.cn)", "免费创建Bot、可视化编排、支持知识库", "快速上手、HR入门练手"],
        ["🥉 第三", "Codex / Trae", "AI编程工具，精准控制Agent行为", "需要代码能力定制高级Agent"],
        ["4", "Claude", "强大的推理和长上下文能力", "复杂HR分析任务、多轮深度对话Agent"],
      ]} />
    </LearnBlock>

    <VoteBar module="agent" />

    <div className="mt-10 flex items-center justify-between border-t border-emerald-200/8 pt-6">
      <button onClick={onPrev} className="rounded-full border border-emerald-200/15 px-5 py-2.5 text-sm font-bold text-emerald-100/60 transition hover:bg-white/5">← 上一模块</button>
      <button onClick={onToggleComplete} className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-black transition ${completed ? "bg-emerald-300/15 text-emerald-300" : "bg-emerald-300 text-[#07110f] hover:scale-105 active:scale-95"}`}>
        {completed ? <><CheckCircle2 className="h-4 w-4" /> 已完成</> : "标记完成 +20分"}
      </button>
      <button onClick={onNext} className="rounded-full border border-emerald-200/15 px-5 py-2.5 text-sm font-bold text-emerald-100/60 transition hover:bg-white/5">下一模块 →</button>
    </div>
  </ModulePage>;
}
