"use client";

import { CheckCircle2 } from "lucide-react";
import { LearnBlock, InfoBox, FlowDiagram, VoteBar, PeerAnswers, ModulePage } from "./shared";

export function LoopModule({ completed, onToggleComplete, onNext, onPrev }: {
  completed: boolean; onToggleComplete: () => void; onNext: () => void; onPrev: () => void;
}) {
  const dimensions = [
    { dim: "核心隐喻", old: "金字塔：划界而治，权力来自控制边界", new: "液态网络：因连接而生，力量来自信号流动密度", hr: "招聘：不是'发出JD等简历'——而是'每一次面试结果校准下一次筛选'" },
    { dim: "设计对象", old: "谁做什么？谁向谁汇报？", new: "AI做什么？人判断什么？反馈从哪来？", hr: "绩效：不是设计流程——而是定义每个决策点的人机角色" },
    { dim: "协调机制", old: "晨会、周报、审批流", new: "信号自动流动，AI直接从数据感知", hr: "培训：不是培训完发问卷——而是行为数据自动回流" },
    { dim: "能力归属", old: "能力在人身上，人走能力走", new: "能力在回路里，新员工也能用老员工的判断力", hr: "招聘：老王每次筛选的理由被记录，AI学会王式判断" },
    { dim: "规模化", old: "业务翻倍→人头翻倍", new: "业务翻倍→AI更聪明→人效更高", hr: "员工服务：AI自助80%常规问题，HR处理20%" },
    { dim: "变革方式", old: "几年一次组织架构调整", new: "持续校准回路，日常操作即进化", hr: "不需要宣布AI转型。从招聘筛选开始，跑通第一条回路" },
    { dim: "衡量标准", old: "KPI达标？SOP合规？", new: "AI采纳率上升？推翻率下降？冷启动周期缩短？", hr: "不仅看招到几个人，还看AI筛选准确率从60%到85%" },
  ];

  return <ModulePage title="🔄 回路治理" subtitle="从金字塔到液态网络——锁定一个业务，跑通你的第一条回路。">
    <InfoBox>
      <strong className="text-emerald-200">从大陆文明到海洋文明：</strong>传统组织是一座<strong className="text-amber-300">金字塔</strong>——层层分工、自上而下审批、信息层层衰减。权力来自控制边界，上限是塔顶那人的认知天花板。回路组织是一片<strong className="text-emerald-300">液态网络</strong>——信号自由流动、节点自动协作、每次交互让网络更密。这不是工具升级，是<strong>从大陆文明的划界统治到海洋文明的连接涌现</strong>的范式跃迁。
    </InfoBox>

    <LearnBlock title="七个维度的根本差异">
      <div className="space-y-3">
        {dimensions.map(item => (
          <div key={item.dim} className="rounded-xl border border-emerald-200/10 bg-white/[0.02] p-4">
            <div className="text-base font-bold text-emerald-300">{item.dim}</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-rose-300/8 bg-rose-300/[0.02] px-3 py-2 text-sm"><span className="text-rose-300/60">旧：</span><span className="text-rose-100/60">{item.old}</span></div>
              <div className="rounded-lg border border-emerald-300/8 bg-emerald-300/[0.02] px-3 py-2 text-sm"><span className="text-emerald-300/60">新：</span><span className="text-emerald-100/75">{item.new}</span></div>
            </div>
            <div className="mt-2 text-sm text-emerald-200/50">🎯 HR场景：{item.hr}</div>
          </div>
        ))}
      </div>
    </LearnBlock>

    <LearnBlock title="案例：一家生鲜供应链公司的智能补货回路">
      <p className="mb-4">他们做了什么？不是上一个AI系统——而是重新设计了<strong className="text-emerald-200">采购决策这个回路</strong>：</p>
      <FlowDiagram steps={[
        { icon: "📊", label: "历史销售+天气+库存" },
        { icon: "🤖", label: "AI生成采购建议" },
        { icon: "👤", label: "采购员5分钟确认" },
        { icon: "📦", label: "执行采购" },
        { icon: "🔄", label: "消耗数据回流" },
        { icon: "🤖", label: "AI自动校准预测" },
      ]} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
        <div className="rounded-xl bg-emerald-300/[0.04] p-4"><span className="font-bold text-emerald-200">回路的学习在哪？</span><p className="mt-1 text-emerald-100/60">采购员推翻AI建议并记录原因时，回路吸收这个判断力。下次同样条件，AI不再犯错。</p></div>
        <div className="rounded-xl bg-emerald-300/[0.04] p-4"><span className="font-bold text-emerald-200">回路的进化在哪？</span><p className="mt-1 text-emerald-100/60">AI采纳率从55%到85%。新采购员2周独立操作。不需要开会培训——能力自动传递。</p></div>
      </div>
    </LearnBlock>

    <LearnBlock title="四步设计你的第一个回路">
      <div className="space-y-4">
        {[
          { n: "1", title: "选一个痛点业务", desc: "不要全面铺开。选一个高频、有数据、结果可衡量的HR业务。关键：这个业务有没有每次都需要老员工经验判断的环节？", tip: "反面教材：全面升级招聘体系。正确做法：先让AI帮我筛选简历，每次推翻都记录原因。" },
          { n: "2", title: "画出回路地图", desc: "信号从哪来→AI做什么→人判断什么→决策怎么执行→反馈怎么回到起点。在A4纸上画出来。画不出来 = 还在人治模式。", tip: "四节点：📥输入→🤖AI处理→👤人确认→🔄反馈回流" },
          { n: "3", title: "定义人机角色", desc: "AI负责模式识别和生成建议。人负责审核、修正、处理情境信息。核心原则：AI建议，人确认。推翻时必须结构化记录原因。", tip: "推翻时说'我感觉不对'——回路学不到任何东西。说'虽然经验不匹配但行业背景和业务方向一致'——回路学到了新规则。" },
          { n: "4", title: "定义反馈信号", desc: "采纳率在上升吗？推翻率在下降吗？新人上手周期在缩短吗？这些指标必须是自动采集的——不需要任何人做额外报告。", tip: "三个月后回看：AI筛选的简历接受比例从60%升到80%了吗？HR花在筛选上的时间从2小时降到30分钟了吗？" },
        ].map(s => (
          <div key={s.n} className="rounded-xl border border-emerald-200/10 bg-white/[0.02] p-4">
            <div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-300/10 text-sm font-black text-emerald-300">{s.n}</span><div><div className="font-bold text-emerald-100">{s.title}</div><div className="mt-1 text-emerald-100/60">{s.desc}</div><div className="mt-2 rounded-lg bg-amber-300/[0.06] border border-amber-300/10 px-3 py-1.5 text-sm text-amber-200/70">💡 {s.tip}</div></div></div>
          </div>
        ))}
      </div>
    </LearnBlock>

    <LearnBlock title="三个HR回路速查">
      <div className="space-y-2 text-sm">
        {[
          ["招聘筛选回路", "简历流入 → AI初筛打分 → HR审核确认(记录推翻) → 入职后6个月绩效回流校准"],
          ["培训效果回路", "课前评估 → AI推荐路径 → 学习 → 30天行为数据自动采集 → AI校准下次推荐"],
          ["离职预警回路", "多源信号(考勤/绩效/沟通) → AI识别风险 → HR核实干预 → 干预结果回流校准"],
        ].map(([name, flow]) => (
          <div key={name} className="rounded-xl bg-white/[0.03] p-3"><span className="font-bold text-emerald-200">{name}：</span><span className="text-emerald-100/50">{flow}</span></div>
        ))}
      </div>
    </LearnBlock>

    <LearnBlock title="我的行动承诺">
      <p className="mb-4">带回公司的不是一个概念，是一个可执行的<strong className="text-emerald-200">最小回路方案</strong>：</p>
      <div className="space-y-3">
        {["你要锁定的关键业务是什么？", "AI可以帮你做什么？", "什么判断必须保留给人？", "什么数据可以作为反馈信号？", "下周一要做的第一件事是什么？"].map((q, i) => (
          <div key={i} className="rounded-xl border border-emerald-200/10 bg-white/[0.02] p-4">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-emerald-300 font-black text-sm">{i + 1}.</span>
              <div className="flex-1">
                <div className="font-bold text-emerald-100">{q}</div>
                <div className="mt-2 border-b border-dashed border-emerald-200/20 pt-2 pb-3 text-emerald-100/40 min-h-[2rem]"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </LearnBlock>

    <VoteBar module="loop" />

    <div className="mt-10 flex items-center justify-between border-t border-emerald-200/8 pt-6">
      <button onClick={onPrev} className="rounded-full border border-emerald-200/15 px-5 py-2.5 text-sm font-bold text-emerald-100/60 transition hover:bg-white/5">← 上一模块</button>
      <button onClick={onToggleComplete} className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-black transition ${completed ? "bg-emerald-300/15 text-emerald-300" : "bg-emerald-300 text-[#07110f] hover:scale-105 active:scale-95"}`}>
        {completed ? <><CheckCircle2 className="h-4 w-4" /> 已完成</> : "标记完成 +20分"}
      </button>
      <button onClick={onNext} className="rounded-full border border-emerald-200/15 px-5 py-2.5 text-sm font-bold text-emerald-100/60 transition hover:bg-white/5">下一模块 →</button>
    </div>
  </ModulePage>;
}
