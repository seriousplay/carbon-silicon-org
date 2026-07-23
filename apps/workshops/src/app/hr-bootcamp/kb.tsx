"use client";

import { CheckCircle2 } from "lucide-react";
import { LearnBlock, StepTable, CompareCard, PracticeInput, VoteBar, PeerAnswers, ModulePage } from "./shared";

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
      <p className="mb-4">列出3份你可以立刻上传到知识库的HR文档：</p>
      <PracticeInput placeholder="1. __________（制度类：手册/规范/流程）\n2. __________（案例类：优秀JD/方案/反馈）\n3. __________（数据类：历史记录/分析报告）" lines={4} />
    </LearnBlock>

    <LearnBlock title="工具推荐">
      <StepTable headers={["工具", "特点", "适合场景"]} rows={[
        ["Kimi kimi.moonshot.cn", "免费、超长上下文、拖拽上传", "快速体验知识库效果"],
        ["扣子 Coze 知识库", "可挂载到Bot、支持自动更新", "HR自助问答Bot"],
        ["ima (ima.qq.com)", "腾讯知识库、微信集成", "企业内部知识管理"],
      ]} />
    </LearnBlock>

    <VoteBar module="kb" />
    <PeerAnswers answers={[
      { author: "刘HR", role: "跨国公司HRM", text: "我们公司有6个国家的员工手册，以前HR每天回答几十个重复的制度问题。我把所有制度文档上传到扣子知识库，做了个员工自助Bot。上线一个月，HR的制度问答时间从每天2小时降到20分钟。", likes: 38 },
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
