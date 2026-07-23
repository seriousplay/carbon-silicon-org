"use client";

import { CheckCircle2 } from "lucide-react";
import { LearnBlock, StepTable, PracticeInput, VoteBar, PeerAnswers, ModulePage } from "./shared";

export function SkillModule({ completed, onToggleComplete, onNext, onPrev }: {
  completed: boolean; onToggleComplete: () => void; onNext: () => void; onPrev: () => void;
}) {
  return <ModulePage title="⚡ 技能 Skill" subtitle="把经验变成可调用外挂——让AI稳定产出专业级交付物，不再每次从零输入。">
    <LearnBlock title="概念理解">
      <p>Skill不是一段"长文本咒语"——它是把你的<strong className="text-emerald-200">默会经验刻录成随时调用的外挂操作手册</strong>。三个特点：按需加载、极其稳定、团队可复用。老员工离职不再意味着判断力清零——Skill 就是他的数字分身。</p>
    </LearnBlock>

    <LearnBlock title="同一任务的三级对比">
      <div className="grid gap-2 text-base">
        <div className="rounded-xl border border-rose-300/10 bg-rose-300/[0.03] p-4"><span className="font-bold text-rose-300/60">L1 浅层触达：</span><span className="text-rose-100/50">"帮我写绩效反馈" → 空泛模板化，需要改很多轮</span></div>
        <div className="rounded-xl border border-amber-300/10 bg-amber-300/[0.03] p-4"><span className="font-bold text-amber-300/60">L2 精准校准：</span><span className="text-amber-100/50">完整提示词全部要素 → 很好，但每次都要重写</span></div>
        <div className="rounded-xl border border-emerald-300/10 bg-emerald-300/[0.04] p-4"><span className="font-bold text-emerald-300/60">L3 深度共生（Skill）：</span><span className="text-emerald-100/60">打开Skill包 → SOP/语气/格式已内置。每次只需输入变量。老员工的判断力已刻在包里。</span></div>
      </div>
    </LearnBlock>

    <LearnBlock title="Skill四层结构">
      <StepTable headers={["层", "名称", "存放内容", "比喻"]} rows={[
        ["1", "使用说明书 SKILL.md", "用途、触发条件、SOP", "操作手册"],
        ["2", "参考文档 references/", "评分标准、制度文件、优秀范例", "专业依据"],
        ["3", "资源模板 assets/", "输出格式模板、排版要求", "输出标准"],
        ["4", "可执行脚本 scripts/", "数据计算、图表生成（进阶）", "自动化工具"],
      ]} />
    </LearnBlock>

    <LearnBlock title="创建Skill五步法">
      <div className="space-y-3">
        {[
          "梳理经验：锁定一个重复做了10次以上的HR任务（如筛选简历）",
          "准备资料：收集评分标准、优秀JD、面试问题库 → 放入 references",
          "挂载模板：提供期望的输出格式（评估表模板） → 放入 assets",
          "编写说明：在SKILL.md中写清楚触发条件、语气、SOP步骤",
          "部署测试：挂载到AI平台，用真实材料跑一遍，人工校验后发布",
        ].map((step, i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl bg-white/[0.03] p-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-300/10 text-sm font-black text-emerald-300">{i + 1}</span>
            <span className="text-base text-emerald-100/70">{step}</span>
          </div>
        ))}
      </div>
    </LearnBlock>

    <LearnBlock title="SKILL.md 骨架（可直接复制）">
      <pre className="overflow-x-auto rounded-xl border border-emerald-200/10 bg-black/30 p-5 text-sm text-emerald-100/60 leading-relaxed whitespace-pre-wrap">{`# 绩效反馈生成器

## 触发条件
当HR输入"员工绩效反馈"时激活

## 角色
你是一位有10年经验的HRBP

## SOP
1. 共情：先肯定员工贡献（20%）
2. 事实：客观描述具体行为和数据（20%）
3. 改进：给出2-3条可执行建议（40%）
4. 行动：约定下次review时间和标准（20%）

## 输出格式
总字数400-600字 | 语气温暖专业不制造恐慌 | 每段不超3句

## 参考文档
references/绩效评估标准.md
references/优秀反馈范例.md`}</pre>
    </LearnBlock>

    <LearnBlock title="技能市场 — 搜索现成的Skill">
      <p className="mb-4">现在几乎所有智能体平台都支持Skill——你不需要从零搭建。去这些技能市场搜索HR相关的现成Skill，直接使用或修改即可：</p>
      <StepTable headers={["技能市场", "链接", "特点"]} rows={[
        ["Workbuddy SkillHub", "workbuddy.ai/skills", "原生Skill生态，一键安装使用"],
        ["扣子技能商店", "coze.cn/store", "海量中文Skill，覆盖HR/办公/教育场景"],
        ["SkillsMp", "skillsmp.com", "Skill集合平台，跨工具搜索和分享"],
        ["Claude Projects", "claude.ai/projects", "上传知识库+自定义指令，相当于轻量Skill"],
      ]} />
      <p className="mt-4 text-sm text-emerald-100/40">💡 建议先搜索"HR"、"招聘"、"绩效"等关键词，找到现成的Skill后先试用，再根据自己的业务修改SOP和参考文档。</p>
    </LearnBlock>

    <VoteBar module="skill" />
    <PeerAnswers answers={[
      { author: "赵HR", role: "金融行业HRVP", text: "我在Workbuddy SkillHub上找到了一个'薪酬review'的现成Skill，直接安装后把自己的薪酬带宽数据、往年调薪记录挂上去。现在调薪季从2周缩短到3天。Skill的威力在于——它不是每次从零输入，而是把老员工的经验固化成了可一键调用的能力包。", likes: 45 },
      { author: "周HR", role: "互联网公司HRD", text: "skillsmp.com 上搜'HR'能找到几十个现成的Skill模板，从招聘到离职面谈都有。我现在养成了习惯：接到新任务先搜有没有现成的Skill，没有再根据五步法自己建。", likes: 28 },
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
