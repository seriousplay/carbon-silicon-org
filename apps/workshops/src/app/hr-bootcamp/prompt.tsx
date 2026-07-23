"use client";

import { CheckCircle2 } from "lucide-react";
import { LearnBlock, StepTable, InfoBox, CompareCard, PracticeInput, VoteBar, PeerAnswers, ModulePage } from "./shared";

export function PromptModule({ completed, onToggleComplete, onNext, onPrev }: {
  completed: boolean; onToggleComplete: () => void; onNext: () => void; onPrev: () => void;
}) {
  return <ModulePage title="💬 提示词 Prompt" subtitle="给AI下一份清晰任务书——掌握对齐公式，一次输出可用结果。">
    <LearnBlock title="概念理解">
      <p>提示词是你和AI沟通的<strong className="text-emerald-200">任务说明书</strong>。好的提示词让AI一次性输出可用结果，差的提示词让你改十遍。核心是——不说清楚需求，AI 只能猜。</p>
      <div className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.05] px-5 py-4 text-base font-bold text-emerald-200">
        对齐公式 = 角色 + 目标 + 对象画像 + 逻辑步骤 + 输出限制
      </div>
    </LearnBlock>

    <LearnBlock title="HR场景对比">
      <CompareCard
        bad={{ label: "散装提问", text: "帮我写一个产品经理的 JD。" }}
        good={{ label: "对齐提问", text: "你是一位资深招聘HR（角色）。为200人SaaS公司写高级产品经理JD（目标）。候选人需3年以上B端经验（画像）。输出：职责5条、要求、加分项、面试关注点（步骤+限制）。" }}
      />
    </LearnBlock>

    <LearnBlock title="实践练习">
      <p className="mb-4">用对齐公式改写以下提示词：</p>
      <div className="rounded-xl border border-amber-300/10 bg-amber-300/[0.03] p-4 text-base text-amber-100/60">
        原始："帮我写一封绩效反馈。"
      </div>
      <PracticeInput placeholder="你是一位___（角色）。请为___（目标）写一封绩效反馈。该员工的特点是___（画像）。请按___顺序写（步骤），字数___，语气___（限制）。" />
    </LearnBlock>

    <LearnBlock title="HR模板速查">
      <div className="grid gap-2 text-base">
        {[
          ["招聘JD", "角色+岗位名+公司规模+经验要求+输出格式（职责/要求/加分项/面试问题）"],
          ["绩效反馈", "角色+员工画像+具体事件+反馈要点（肯定/改进/行动）+语气要求+字数"],
          ["培训方案", "角色+学员画像+培训主题+时长+输出（大纲/活动/评估）"],
          ["员工沟通", "角色+事件背景+沟通目标+对方情绪状态+语气要求+禁止用语"],
        ].map(([label, formula]) => (
          <div key={label} className="rounded-xl bg-white/[0.03] p-4"><span className="font-bold text-emerald-300">{label}：</span><span className="text-emerald-100/60">{formula}</span></div>
        ))}
      </div>
    </LearnBlock>

    <LearnBlock title="工具推荐">
      <StepTable headers={["工具", "特点", "适合场景"]} rows={[
        ["豆包", <a key="d" href="https://doubao.com" target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline hover:text-emerald-200">doubao.com ↗</a>, "免费、中文优化、响应快", "日常提示词练习、HR文案"],
        ["DeepSeek", <a key="ds" href="https://chat.deepseek.com" target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline hover:text-emerald-200">chat.deepseek.com ↗</a>, "免费、推理能力强", "分析类任务、复杂提示词"],
        ["Kimi", <a key="km" href="https://kimi.moonshot.cn" target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline hover:text-emerald-200">kimi.moonshot.cn ↗</a>, "超长上下文、可上传文件", "读简历/制度后提问"],
      ]} />
    </LearnBlock>

    <VoteBar module="prompt" />
    <PeerAnswers answers={[
      { author: "张HR", role: "某互联网公司招聘负责人", text: "我的对齐公式版本：你是一位有10年经验的HRBP（角色）。请为市场部高级经理张伟写一封年终绩效反馈（目标）。他今年主导了3次大型活动，但团队管理出现过两次沟通事故（画像）。请先肯定贡献，再指出改进点，最后给3条行动建议（步骤）。字数500-600，语气温暖专业（限制）。", likes: 23 },
      { author: "李HR", role: "制造业HR主管", text: "对齐公式真的很实用！我用它写了一份车间主管的JD，直接发给了招聘平台，收到的简历匹配度明显提高了。关键是习惯性地补全五个要素。", likes: 17 },
    ]} />

    <div className="mt-10 flex items-center justify-between border-t border-emerald-200/8 pt-6">
      <button onClick={onPrev} className="rounded-full border border-emerald-200/15 px-5 py-2.5 text-sm font-bold text-emerald-100/60 transition hover:bg-white/5">← 上一模块</button>
      <button onClick={onToggleComplete} className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-black transition ${completed ? "bg-emerald-300/15 text-emerald-300" : "bg-emerald-300 text-[#07110f] hover:scale-105 active:scale-95"}`}>
        {completed ? <><CheckCircle2 className="h-4 w-4" /> 已完成</> : "标记完成 +20分"}
      </button>
      <button onClick={onNext} className="rounded-full border border-emerald-200/15 px-5 py-2.5 text-sm font-bold text-emerald-100/60 transition hover:bg-white/5">下一模块 →</button>
    </div>
  </ModulePage>;
}
