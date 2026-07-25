"use client";

import { useState } from "react";
import { LearnBlock, InfoBox, ModulePage } from "./shared";

export function IntroModule({ onNext }: { onNext: () => void }) {
  const [poll, setPoll] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
      <h2 className="text-3xl font-black tracking-tight text-white">🗺️ 开篇导入</h2>
      <p className="mt-3 text-lg leading-8 text-emerald-100/55">
        AI时代的组织迁徙地图——为什么你的公司不能只把AI当工具？
      </p>

      <div className="mt-8 space-y-6">

        {/* Hook */}
        <InfoBox>
          <strong className="text-emerald-200">晚上7点到清晨，一个人完成了十人团队三个月的工作。</strong><br />
          2003年：10人团队 × 3个月——产品经理、架构师、工程师、会议、排期、协调。<br />
          2025年：1个人 × 1夜——人 + 编程智能体。<br /><br />
          这不是效率提升，这是<strong className="text-amber-300">生产力范式的断裂</strong>。
        </InfoBox>

        {/* The Divide */}
        <LearnBlock title="生成式AI鸿沟：工具进步了，组织没变好">
          <p>MIT 2025年报告发现：绝大多数企业的AI投入，<strong className="text-emerald-200">没有换来损益表的变化</strong>。</p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-rose-300/10 bg-rose-300/[0.03] p-4">
              <div className="text-sm font-bold text-rose-300/70 mb-1">❌ 现实</div>
              <p className="text-base text-rose-100/60">AI生成了更多材料 → 业务结果没有变好 → 工具越来越先进 → 决策越来越慢 → 越会用AI的人越累 → 省下的时间被会议和临时需求吞噬</p>
            </div>
            <div className="rounded-xl border border-amber-300/10 bg-amber-300/[0.03] p-4">
              <div className="text-sm font-bold text-amber-300/70 mb-1">💡 根因</div>
              <p className="text-base text-amber-100/60">这不是某一家企业的问题，这是<strong>一代组织范式的问题</strong>。一个人已经能跑闭环，组织却还让他走三层汇报、等四个部门对齐、填五张表。</p>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-emerald-300/[0.05] border border-emerald-300/10 px-4 py-3 text-base text-emerald-100/70">
            "许多企业以为在做AI转型，其实只是用AI给旧组织续命。"
          </div>
        </LearnBlock>

        {/* 四支柱崩塌 */}
        <LearnBlock title="经典管理的四支柱正在崩塌">
          <div className="grid gap-3">
            {[
              { pillar: "规模不经济", old: "内部交易成本低→规模优势", collapse: "沟通税：30人=435对连接，300人=45000对，100倍" },
              { pillar: "分工不闭环", old: "高层战略→中层拆解→基层执行", collapse: "认知迭代最快的在一线，但没有决策权" },
              { pillar: "审计黑洞", old: "质量靠QA、安全靠审计、合规靠法务", collapse: "AI需要递归式自主进化：清晰规则+可解释验证+可追溯学习" },
              { pillar: "决策中心偏离", old: "精细化部门分工和岗位职责", collapse: "超级个体：一个人带着智能体完成价值闭环" },
            ].map(item => (
              <div key={item.pillar} className="rounded-xl border border-emerald-200/10 bg-white/[0.02] p-4">
                <div className="text-base font-bold text-emerald-300">{item.pillar}</div>
                <div className="mt-1 text-sm text-emerald-100/50">旧逻辑：{item.old}</div>
                <div className="mt-1 text-sm text-rose-200/60">⚠️ 崩塌：{item.collapse}</div>
              </div>
            ))}
          </div>
        </LearnBlock>

        {/* 大陆→海洋 */}
        <LearnBlock title="从大陆文明到海洋文明">
          <p>商业环境已经从<strong className="text-amber-300">大陆</strong>变成了<strong className="text-emerald-300">海洋</strong>。</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.03] p-5">
              <div className="text-base font-bold text-amber-300">大陆文明</div>
              <p className="mt-2 text-base text-amber-100/55">边界清晰、流程固定、权力自塔顶层层下发——适合稳定扩张、大规模复制。管理工具是<strong>城墙</strong>。</p>
            </div>
            <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.04] p-5">
              <div className="text-base font-bold text-emerald-300">海洋文明</div>
              <p className="mt-2 text-base text-emerald-100/65">连接更密、边界重画、信息渗透，机会与风险都来得更快。管理工具是<strong>船队、航线、雷达、港口</strong>。</p>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-emerald-300/[0.05] border border-emerald-300/10 px-4 py-3 text-base text-emerald-100/70">
            你不能靠加固城墙管理风浪。海水已经涨上来了——大多数企业仍在大陆上，这很正常。但迁徙已经开始。
          </div>
        </LearnBlock>

        {/* 三条航线 */}
        <LearnBlock title="三条迁徙航线">
          <div className="grid gap-3">
            {[
              { type: "增强型", desc: "岗位加AI——销售用AI写邮件、HR用AI筛简历", risk: "风险低、见效快、冲击小", fate: "宿命：每个人更忙了，公司没有更强" },
              { type: "重构型", desc: "AI进入核心流程——改变谁定义问题、谁执行、谁验收", risk: "需要回答四个权力问题", fate: "最难的是让人不舒服的权力重新分配" },
              { type: "原生型", desc: "从第一天按人机协作设计——产品、岗位、团队全新构建", risk: "需要三套新能力", fate: "需要长出结构、细胞和治理" },
            ].map(item => (
              <div key={item.type} className="rounded-xl border border-emerald-200/10 bg-white/[0.02] p-4">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-emerald-300">{item.type}</span>
                  <span className="text-xs text-emerald-100/35">{item.risk}</span>
                </div>
                <p className="mt-1 text-base text-emerald-100/60">{item.desc}</p>
                <p className="mt-1 text-sm text-amber-200/50">{item.fate}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-base text-emerald-100/50">三条航线可以并存——主营业务做增强，关键链路做重构，新业务探索原生。</p>
        </LearnBlock>

        {/* 投票墙 */}
        <LearnBlock title="📊 你的组织在哪条航线上？">
          {poll ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">{["🌍","🚢","⚓"][["enhance","reconstruct","native"].indexOf(poll)]}</div>
              <p className="text-lg font-bold text-emerald-200">
                {poll === "enhance" && "增强型——你在大陆上，正在给城墙加装AI"}
                {poll === "reconstruct" && "重构型——你在海上，正在改写航线"}
                {poll === "native" && "原生型——你生在海上，没有城墙的包袱"}
              </p>
              <p className="mt-3 text-base text-emerald-100/40">无论哪条航线，今天的课程都会帮你找到下一步的起点。</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <button onClick={() => setPoll("enhance")} className="rounded-2xl border-2 border-dashed border-amber-300/20 bg-amber-300/[0.02] p-6 text-center transition hover:border-amber-300/40 hover:bg-amber-300/[0.06] hover:scale-[1.02] active:scale-95">
                <span className="text-3xl">🌍</span>
                <div className="mt-2 text-base font-bold text-amber-200">增强型</div>
                <div className="text-sm text-amber-100/40">岗位+AI，个人会用但组织没变</div>
              </button>
              <button onClick={() => setPoll("reconstruct")} className="rounded-2xl border-2 border-dashed border-emerald-300/20 bg-emerald-300/[0.02] p-6 text-center transition hover:border-emerald-300/40 hover:bg-emerald-300/[0.06] hover:scale-[1.02] active:scale-95">
                <span className="text-3xl">🚢</span>
                <div className="mt-2 text-base font-bold text-emerald-200">重构型</div>
                <div className="text-sm text-emerald-100/40">AI进入核心流程，开始改权责</div>
              </button>
              <button onClick={() => setPoll("native")} className="rounded-2xl border-2 border-dashed border-purple-300/20 bg-purple-300/[0.02] p-6 text-center transition hover:border-purple-300/40 hover:bg-purple-300/[0.06] hover:scale-[1.02] active:scale-95">
                <span className="text-3xl">⚓</span>
                <div className="mt-2 text-base font-bold text-purple-200">原生型</div>
                <div className="text-sm text-purple-100/40">从第一天为AI而生</div>
              </button>
            </div>
          )}
        </LearnBlock>

        {/* 案例 */}
        <LearnBlock title="案例：筑龙学社——传统企业接住了AI">
          <p className="mb-4">建筑行业剧烈收缩，筑龙学社三十多个岗位训练营一个接一个停掉。他们做了什么？</p>
          <div className="grid gap-3 text-base">
            <div className="rounded-xl bg-white/[0.03] p-4"><span className="font-bold text-emerald-200">起点：</span><span className="text-emerald-100/60">每周一句"来，说说你用AI做了什么"。没有强制、没有考核——六七个月后才开始改造流程。</span></div>
            <div className="rounded-xl bg-white/[0.03] p-4"><span className="font-bold text-emerald-200">销售侧：</span><span className="text-emerald-100/60">AI自动识别聊天内容、打标签、执行SOP。约20人服务100万企微好友。</span></div>
            <div className="rounded-xl bg-white/[0.03] p-4"><span className="font-bold text-emerald-200">教研侧：</span><span className="text-emerald-100/60">教辅材料生产周期从一个月缩短到一周。老师转为审稿者和判断者。</span></div>
            <div className="rounded-xl bg-white/[0.03] p-4"><span className="font-bold text-emerald-200">真正的秘密：</span><span className="text-emerald-100/60">2018年引入阿米巴经营，项目负责人独立核算利润——AI到来前，闭环负责人已经被"预训练"好了。AI放大的是训练过的闭环负责人。</span></div>
            <div className="rounded-xl bg-emerald-300/[0.04] border border-emerald-300/10 p-4"><span className="font-bold text-emerald-300">结果：</span><span className="text-emerald-100/70">团队从200人缩至30人，AI相关业务贡献约1/3收入。</span></div>
          </div>
        </LearnBlock>

        {/* 90天试航 */}
        <LearnBlock title="90天迁徙试航——你的第一艘船">
          <p className="mb-4">不需要一夜之间推倒重构。你需要的是<strong className="text-emerald-200">一艘能跑、能验、能复制的业务闭环</strong>。</p>
          <div className="grid gap-2 text-base">
            {[
              "① 重新定义问题：选一个真实、具体、反复发生、可衡量的业务问题",
              "② 画出完整业务闭环：看闭环在哪里断，而不是哪个节点提效",
              "③ 任命并保护回路负责人：给智能体、数据、工具和90天保护期",
              "④ 写下人机接口契约：输入、输出、完成标准、升级边界、修正责任",
              "⑤ 把经验沉淀成组织记忆：接口、规则、提示词、验证清单、复盘资产",
            ].map((step, i) => (
              <div key={i} className="rounded-xl bg-white/[0.03] p-3 text-emerald-100/65">{step}</div>
            ))}
          </div>
        </LearnBlock>

        {/* 课程连接 */}
        <InfoBox>
          <strong className="text-emerald-200">这就是今天课程的意义。</strong><br />
          接下来6个模块，你会逐一掌握<strong>提示词→智能体→Skill→知识库→风险边界→回路治理</strong>。最后完成实战项目——打造你的第一个AI自动化工作流。<br /><br />
          <strong className="text-amber-300">不是学会用工具，是学会让组织接住新生产力。</strong>
        </InfoBox>

      </div>

      <div className="mt-10 flex justify-end border-t border-emerald-200/8 pt-6">
        <button onClick={onNext} className="inline-flex items-center gap-2 rounded-full bg-emerald-300 px-8 py-3 text-base font-black text-[#07110f] transition hover:scale-105 active:scale-95">
          开始模块一：提示词 →
        </button>
      </div>
    </div>
  );
}
