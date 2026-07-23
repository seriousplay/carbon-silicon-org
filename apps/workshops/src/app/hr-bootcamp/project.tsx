"use client";

import { CheckCircle2 } from "lucide-react";
import { LearnBlock, ModulePage, InfoBox } from "./shared";

type Project = { id: string; authorName: string; title: string; avgScore: number; voteCount: number; };

export function ProjectModule({ completed, onToggleComplete, onNext, onPrev }: {
  completed: boolean; onToggleComplete: () => void; onNext: () => void; onPrev: () => void;
}) {
  return <ModulePage title="🚀 实战项目" subtitle="整合提示词、智能体、Skill、知识库——打造你的第一个AI自动化工作流。">
    <InfoBox>
      <strong className="text-emerald-200">从学到用，一步跨越。</strong>这个实战项目让你把前面6个模块学到的所有能力整合成一个<strong className="text-emerald-300">真实可用的AI自动化工作流</strong>。完成后提交你的项目，让其他同学打分。排行榜前三名将获得加权积分。
    </InfoBox>

    <LearnBlock title="第一步：多轮对话，澄清意图">
      <p className="mb-4">选择一个<strong className="text-emerald-200">真实HR痛点</strong>，通过和AI多轮对话，澄清你的想法，最终输出一份<strong className="text-amber-300">产品设计和规范文档</strong>。</p>
      <div className="space-y-3">
        <div className="rounded-xl border border-emerald-200/10 bg-white/[0.02] p-4">
          <div className="text-base font-bold text-emerald-200 mb-2">📋 操作步骤</div>
          <div className="space-y-2 text-base text-emerald-100/70">
            <p><strong>1.1</strong> 打开 DeepSeek 或 Claude，开启一个新对话。先告诉AI你的身份和背景。</p>
            <p><strong>1.2</strong> 进行3-5轮对话，逐步澄清：用户是谁？核心功能是什么？输入输出？边界条件？</p>
            <p><strong>1.3</strong> 最后让AI输出一份结构化的<strong>产品设计规范</strong>（PRD），包含产品目标、目标用户、核心功能、用户流程、技术要求。</p>
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-emerald-300/[0.04] border border-emerald-300/10 p-4 text-sm text-emerald-100/60">
        <strong className="text-emerald-300">💡 整合Skill和知识库：</strong>对话过程中加载你之前创建的Skill和知识库，让AI在理解你业务上下文的基础上帮你设计。
      </div>
    </LearnBlock>

    <LearnBlock title="第二步：AI制定开发计划">
      <p className="mb-4">将PRD文档输入给 AI 编程工具（Zcode / Codex），制定详细的开发计划。</p>
      <div className="rounded-xl border border-emerald-200/10 bg-white/[0.02] p-4">
        <div className="space-y-2 text-base text-emerald-100/70">
          <p><strong>2.1</strong> 打开 <a href="https://zcode.ai" target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline hover:text-emerald-200">Zcode ↗</a> 或 <a href="https://codex.ai" target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline hover:text-emerald-200">Codex ↗</a></p>
          <p><strong>2.2</strong> 将PRD文档复制粘贴或上传</p>
          <p><strong>2.3</strong> 输入指令让AI制定完整开发计划，审核确认</p>
        </div>
      </div>
    </LearnBlock>

    <LearnBlock title="第三步：Vibe Coding">
      <p className="mb-4">使用 Zcode/Codex/Kimicode 按开发计划逐任务执行，AI自动生成代码。</p>
      <div className="rounded-xl bg-purple-300/[0.04] border border-purple-300/10 p-4 text-sm text-purple-100/60">
        <strong className="text-purple-300">🪄 关键心态：</strong>你是产品经理，AI是你的全栈工程师。描述你想要的效果，AI自己实现。
      </div>
    </LearnBlock>

    <LearnBlock title="第四步：测试与部署">
      <div className="grid gap-4 sm:grid-cols-2 text-sm">
        <div className="rounded-xl border border-emerald-200/10 bg-white/[0.02] p-3">
          <div className="font-bold text-emerald-200 mb-1">🧪 测试</div>
          <p className="text-emerald-100/50">预览→用真实数据测试→告诉AI修复→迭代2-3轮</p>
        </div>
        <div className="rounded-xl border border-emerald-200/10 bg-white/[0.02] p-3">
          <div className="font-bold text-amber-200 mb-1">🚀 部署</div>
          <p className="text-amber-100/50">问AI如何部署→跟随指引→获取公开URL</p>
        </div>
      </div>
    </LearnBlock>

    {/* ─── Submit CTA ─── */}
    <div className="mt-6 rounded-2xl border-2 border-dashed border-amber-300/30 bg-amber-300/[0.04] p-8 text-center">
      <span className="text-4xl">📤</span>
      <h3 className="mt-4 text-xl font-black text-amber-100">准备好提交你的作品？</h3>
      <p className="mt-2 text-base leading-8 text-amber-100/60">
        完成上述四步后，去 <strong className="text-amber-300">🏆 项目展示厅</strong> 提交你的项目。
        其他学员会为你的项目打分，排行榜前三名获得 <strong className="text-amber-300">120/100/80</strong> 阶梯积分。
      </p>
      <button onClick={() => {
        // Navigate to gallery - set the active to gallery
        const event = new CustomEvent("hrbc-nav", { detail: "gallery" });
        window.dispatchEvent(event);
      }}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-amber-300 px-8 py-3 text-base font-black text-[#07110f] transition hover:scale-105 active:scale-95">
        🏆 去项目展示厅提交 <span className="text-sm opacity-70">+120分</span>
      </button>
    </div>

    <div className="mt-10 flex items-center justify-between border-t border-emerald-200/8 pt-6">
      <button onClick={onPrev} className="rounded-full border border-emerald-200/15 px-5 py-2.5 text-sm font-bold text-emerald-100/60 transition hover:bg-white/5">← 上一模块</button>
      <button onClick={onToggleComplete} className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-black transition ${completed ? "bg-emerald-300/15 text-emerald-300" : "bg-emerald-300 text-[#07110f] hover:scale-105 active:scale-95"}`}>
        {completed ? <><CheckCircle2 className="h-4 w-4" /> 已完成</> : "学完了，去提交项目"}
      </button>
      <button onClick={onNext} className="rounded-full border border-emerald-200/15 px-5 py-2.5 text-sm font-bold text-emerald-100/60 transition hover:bg-white/5">回到首页 →</button>
    </div>
  </ModulePage>;
}
