"use client";

import { CheckCircle2 } from "lucide-react";
import { LearnBlock, StepTable, FlowDiagram, PracticeInput, VoteBar, PeerAnswers, ModulePage, InfoBox } from "./shared";

export function ProjectModule({ completed, onToggleComplete, onNext, onPrev }: {
  completed: boolean; onToggleComplete: () => void; onNext: () => void; onPrev: () => void;
}) {
  return <ModulePage title="🚀 实战项目" subtitle="整合提示词、智能体、Skill、知识库——打造你的第一个AI自动化工作流。">
    <InfoBox>
      <strong className="text-emerald-200">从学到用，一步跨越。</strong>这个实战项目让你把前面6个模块学到的所有能力——提示词、智能体、Skill、知识库——整合成一个<strong className="text-emerald-300">真实可用的AI自动化工作流</strong>。不是模拟练习，是做出一个能解决你实际工作问题的应用。
    </InfoBox>

    <LearnBlock title="第一步：多轮对话，澄清意图">
      <p className="mb-4">选择一个<strong className="text-emerald-200">真实HR痛点</strong>，通过和AI多轮对话，澄清你的想法，最终输出一份<strong className="text-amber-300">产品设计和规范文档</strong>。</p>
      <div className="space-y-3">
        <div className="rounded-xl border border-emerald-200/10 bg-white/[0.02] p-4">
          <div className="text-base font-bold text-emerald-200">📋 操作步骤</div>
          <div className="mt-2 space-y-2 text-base text-emerald-100/70">
            <p><strong>1.1</strong> 打开 DeepSeek 或 Claude，开启一个新对话。先告诉AI你的身份和背景：<em>"我是一名HR，负责[你的具体职责]。我想打造一个AI工具来解决[具体问题]。"</em></p>
            <p><strong>1.2</strong> 进行3-5轮对话，逐步澄清：用户是谁？核心功能是什么？输入什么、输出什么？有哪些边界条件？</p>
            <p><strong>1.3</strong> 每轮对话后，让AI总结当前的共识，你确认或修正。</p>
            <p><strong>1.4</strong> 最后让AI输出一份结构化的<strong>产品设计规范</strong>（PRD）：包含产品目标、目标用户、核心功能、用户流程、技术要求、成功指标。</p>
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-emerald-300/[0.04] border border-emerald-300/10 p-4 text-sm text-emerald-100/60">
        <strong className="text-emerald-300">💡 技巧：</strong>对话过程中，<strong>加载你之前创建的Skill和知识库</strong>——比如加载"绩效反馈Skill"或"员工手册知识库"，让AI在理解你的业务上下文的基础上帮你设计产品。
      </div>
    </LearnBlock>

    <LearnBlock title="第二步：智能体制定开发计划">
      <p className="mb-4">将第一步输出的<strong className="text-emerald-200">PRD文档</strong>作为附件输入给 Workbuddy，让它制定详细的开发计划。</p>
      <div className="rounded-xl border border-emerald-200/10 bg-white/[0.02] p-4">
        <div className="text-base font-bold text-emerald-200 mb-2">📎 操作步骤</div>
        <div className="space-y-2 text-base text-emerald-100/70">
          <p><strong>2.1</strong> 打开 <a href="https://workbuddy.ai" target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline hover:text-emerald-200">Workbuddy ↗</a>，创建新项目。</p>
          <p><strong>2.2</strong> 将第一步AI输出的PRD文档<strong>复制粘贴或作为附件上传</strong>给 Workbuddy。</p>
          <p><strong>2.3</strong> 输入指令：<em>"基于这份PRD，制定一个完整的开发计划。包括：技术栈选择、项目结构、分阶段开发任务、每个任务的输入输出、预估时间。"</em></p>
          <p><strong>2.4</strong> 审核 Workbuddy 返回的开发计划，确认或调整。确保计划中每个步骤都有<strong>明确的交付物</strong>。</p>
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-amber-300/[0.04] border border-amber-300/10 p-4 text-sm text-amber-100/60">
        <strong className="text-amber-300">⚡ 关键：</strong>Workbuddy不只是给你一个计划——它会拆解任务、生成代码骨架、甚至自动执行部分开发步骤。你作为产品经理审核和确认，Workbuddy作为全栈工程师执行。
      </div>
    </LearnBlock>

    <LearnBlock title="第三步：Vibe Coding — AI自动化开发">
      <p className="mb-4">使用 <strong className="text-emerald-200">AI 编程工具</strong>（Zcode / Codex / Kimicode），让AI自动进入"vibe coding"模式，按照开发计划逐任务执行。</p>
      <div className="rounded-xl border border-emerald-200/10 bg-white/[0.02] p-4">
        <div className="text-base font-bold text-emerald-200 mb-2">⌨️ 操作步骤</div>
        <div className="space-y-2 text-base text-emerald-100/70">
          <p><strong>3.1</strong> 打开 <a href="https://zcode.ai" target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline hover:text-emerald-200">Zcode ↗</a> 或 <a href="https://codex.ai" target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline hover:text-emerald-200">Codex ↗</a> 或 <a href="https://kimi.moonshot.cn" target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline hover:text-emerald-200">Kimicode ↗</a>——选择一个你熟悉的AI编程工具。</p>
          <p><strong>3.2</strong> 将第二步 Workbuddy 输出的开发计划<strong>复制粘贴</strong>给 AI 编程工具。</p>
          <p><strong>3.3</strong> 输入指令：<em>"按照这个开发计划，从第一步开始执行。每完成一个任务，先展示成果，等我确认后再继续。"</em></p>
          <p><strong>3.4</strong> AI会自动生成代码、创建文件、搭建项目结构。你在旁边观察，发现问题随时<strong>用自然语言纠正</strong>——就像和一个程序员同事协作。</p>
          <p><strong>3.5</strong> 关键心态：<strong className="text-emerald-200">你是产品经理，AI是你的全栈工程师。</strong>你不需要写代码，但你需要在每一步确认"这符合我的需求吗？"</p>
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-purple-300/[0.04] border border-purple-300/10 p-4 text-sm text-purple-100/60">
        <strong className="text-purple-300">🪄 工具选择建议：</strong>Zcode 适合快速原型和全栈应用；Codex 适合精准控制代码质量；Kimicode（Kimi的编程模式）适合中文场景和简单应用。新手建议从 Zcode 或 Kimicode 开始——它们的自然语言理解更好，不需要写任何代码。
      </div>
    </LearnBlock>

    <LearnBlock title="第四步：测试与部署">
      <p className="mb-4">应用开发完成后，进行必要的<strong className="text-emerald-200">测试验证</strong>和<strong className="text-amber-300">部署上线</strong>。</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-200/10 bg-white/[0.02] p-4">
          <div className="text-base font-bold text-emerald-200 mb-2">🧪 测试</div>
          <div className="space-y-1 text-sm text-emerald-100/60">
            <p>• 在浏览器中预览你的应用</p>
            <p>• 用真实数据测试核心流程</p>
            <p>• 告诉AI："这个按钮点击后没反应，帮我修复"</p>
            <p>• 让AI生成测试用例并自动执行</p>
            <p>• 迭代2-3轮直到功能符合预期</p>
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200/10 bg-white/[0.02] p-4">
          <div className="text-base font-bold text-amber-200 mb-2">🚀 部署</div>
          <div className="space-y-1 text-sm text-amber-100/60">
            <p>• 问AI："怎么把这个应用部署上线？"</p>
            <p>• AI会推荐适合的部署方式（Vercel/Netlify/静态托管）</p>
            <p>• 跟随AI的指引完成一键部署</p>
            <p>• 获取一个公开可访问的URL</p>
            <p>• 把链接分享给同事试用</p>
          </div>
        </div>
      </div>
    </LearnBlock>

    <LearnBlock title="HR应用创意参考">
      <div className="grid gap-2 text-sm">
        {[
          { idea: "智能面试助手", desc: "输入JD和候选人简历 → AI自动生成个性化面试问题 → 面试后生成评估报告" },
          { idea: "员工离职风险预警", desc: "接入考勤/绩效/沟通数据 → AI识别风险员工 → 自动生成干预建议" },
          { idea: "培训需求分析器", desc: "输入部门和岗位 → AI分析能力差距 → 生成个性化培训方案" },
          { idea: "薪酬公平性审计", desc: "上传薪酬数据 → AI分析是否存在性别/年龄/职级差异 → 生成合规报告" },
          { idea: "HR政策问答Bot", desc: "基于公司制度文档 → 员工用自然语言提问 → Bot引用具体条款回答" },
        ].map(item => (
          <div key={item.idea} className="rounded-xl bg-white/[0.03] p-3">
            <span className="font-bold text-emerald-200">{item.idea}：</span>
            <span className="text-emerald-100/50">{item.desc}</span>
          </div>
        ))}
      </div>
    </LearnBlock>

    <VoteBar module="project" />
    <PeerAnswers answers={[
      { author: "林HR", role: "科技公司HRBP", text: "我用这个四步法做了一个「面试问题智能生成器」。先和DeepSeek多轮对话确定了PRD，然后丢给Workbuddy做开发计划，用 /goal 完成了全部代码。从想法到可用的应用，只用了2小时！现在已经是我们招聘团队的标配工具了。", likes: 52 },
      { author: "黄HR", role: "制造业HRM", text: "最让我震撼的是第三步vibe coding——我完全不懂代码，但我就告诉AI'我想要一个页面，左边是员工列表，右边是绩效数据，点击员工自动更新'，它真的就做出来了！以前的我不敢想象自己能'开发'一个应用。", likes: 37 },
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
