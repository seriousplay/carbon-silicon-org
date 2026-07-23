"use client";

import { CheckCircle2 } from "lucide-react";
import { LearnBlock, StepTable, CompareCard, VoteBar, ModulePage } from "./shared";

export function KBModule({ completed, onToggleComplete, onNext, onPrev }: {
  completed: boolean; onToggleComplete: () => void; onNext: () => void; onPrev: () => void;
}) {
  return <ModulePage title="📚 知识库 RAG" subtitle="让AI基于你的资料回答——不再泛泛而谈，而是有据可查。">
    <LearnBlock title="概念理解">
      <p>没有知识库的AI，回答基于<strong className="text-amber-300">全网通用知识</strong>——泛泛而谈，不知道你公司的具体情况。有了知识库，AI先<strong className="text-emerald-300">读你的资料</strong>，再基于资料回答。回答能引用来源，不靠猜测。这不是"上传文件"，这是给AI装上你的组织大脑。</p>
    </LearnBlock>

    <LearnBlock title="有/无知识库对比">
      <CompareCard
        bad={{ label: "没有知识库", text: "问：「我们公司年假制度？」\nAI：「一般公司年假是5-15天，具体视公司规定……」——猜的，不是你的公司。" }}
        good={{ label: "有知识库", text: "上传《员工手册》后问同样问题。\nAI：「根据手册第3.2条，入职满1年享有10天年假，每增加1年服务年限新增1天，上限20天。」——有据可查。" }}
      />
    </LearnBlock>

    <LearnBlock title="HR知识库三个层次">
      <div className="space-y-2">
        {[
          ["L1 制度问答", "上传员工手册、考勤制度、报销规范。员工自助查询——HR从重复问答中解放。"],
          ["L2 案例参考", "上传优秀JD、培训方案、绩效反馈范例。AI生成新内容时参考你的最佳实践。"],
          ["L3 组织大脑", "沉淀每次招聘决策、培训效果、离职原因。AI基于历史数据给出预测和建议。"],
        ].map(([title, desc]) => (
          <div key={title} className="rounded-xl bg-white/[0.03] p-4">
            <div className="font-bold text-emerald-300">{title}</div>
            <div className="mt-1 text-emerald-100/60">{desc}</div>
          </div>
        ))}
      </div>
    </LearnBlock>

    <LearnBlock title="实践练习">
      <p className="mb-4">在 <strong className="text-emerald-200">ima 平台</strong> 上完成以下操作：</p>
      <div className="space-y-3">
        {[
          { n: "1", title: "新建知识库", desc: "打开 ima → 点击「新建知识库」→ 命名为「HR工作知识库」或你的专属名称" },
          { n: "2", title: "添加3篇笔记（三种来源）", desc: "📱 公众号文章：在微信中打开一篇HR相关公众号文章 → 点击右上角「…」→ 选择「在ima中打开」→ 保存到你的知识库" },
          { n: "3", title: "", desc: "🤖 AI辅助创作：让AI帮你写一篇笔记（如'2025年HR趋势分析'或'我司绩效面谈话术'）→ 保存到知识库" },
          { n: "4", title: "", desc: "✍️ 自己手写：手动写一篇笔记——可以是你工作中遇到的一个真实HR案例、一个你常用的面试问题模板、或一个你想记录的工作心得" },
          { n: "5", title: "与AI对话，提炼新笔记", desc: "在知识库中点击「AI对话」→ 基于你的知识库向AI提问（如'基于我的笔记，总结出3条适合我公司的HR改进建议'）→ 将对话中AI的回答和你的补充，整理成一篇新的笔记保存" },
        ].map(item => (
          <div key={item.n} className="flex items-start gap-3 rounded-xl bg-white/[0.03] p-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-300/10 text-sm font-black text-emerald-300">{item.n}</span>
            <div>
              {item.title && <div className="font-bold text-emerald-100">{item.title}</div>}
              <div className="text-emerald-100/60">{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </LearnBlock>

    <LearnBlock title="知识库平台推荐">
      <StepTable headers={["优先级", "平台", "一键访问", "特点"]} rows={[
        ["🥇 首选", "ima (腾讯)", <a key="i" href="https://ima.qq.com" target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline hover:text-emerald-200">ima.qq.com ↗</a>, "微信生态深度集成、公众号一键保存、AI对话基于个人知识库"],
        ["🥈 次选", "Obsidian", <a key="o" href="https://obsidian.md" target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline hover:text-emerald-200">obsidian.md ↗</a>, "本地优先、Markdown格式、插件生态强大、支持AI插件"],
        ["🥉 第三", "Gemini Notebook (原NotebookLM)", <a key="g" href="https://notebooklm.google.com" target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline hover:text-emerald-200">notebooklm.google.com ↗</a>, "谷歌出品、深度分析文档、自动生成摘要和问答"],
      ]} />
      <p className="mt-3 text-sm text-emerald-100/40">💡 建议从 ima 开始——它能直接从微信保存公众号文章，最符合HR的日常工作流。</p>
    </LearnBlock>

    <VoteBar module="kb" />

    <div className="mt-10 flex items-center justify-between border-t border-emerald-200/8 pt-6">
      <button onClick={onPrev} className="rounded-full border border-emerald-200/15 px-5 py-2.5 text-sm font-bold text-emerald-100/60 transition hover:bg-white/5">← 上一模块</button>
      <button onClick={onToggleComplete} className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-black transition ${completed ? "bg-emerald-300/15 text-emerald-300" : "bg-emerald-300 text-[#07110f] hover:scale-105 active:scale-95"}`}>
        {completed ? <><CheckCircle2 className="h-4 w-4" /> 已完成</> : "标记完成 +20分"}
      </button>
      <button onClick={onNext} className="rounded-full border border-emerald-200/15 px-5 py-2.5 text-sm font-bold text-emerald-100/60 transition hover:bg-white/5">下一模块 →</button>
    </div>
  </ModulePage>;
}
