"use client";

import { useState } from "react";
import { BrainCircuit, CheckCircle2, Database, Layers3, MessageSquareText, RotateCcw, Sparkles, Workflow, XCircle } from "lucide-react";

type QuizQuestion = {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
};

type ConceptCard = {
  id: string;
  title: string;
  subtitle: string;
  icon: typeof MessageSquareText;
  official: string;
  plain: string;
  useWhen: string[];
  value: string[];
  trap: string;
  quiz: QuizQuestion[];
};

const conceptCards: ConceptCard[] = [
  {
    id: "ai-nesting",
    title: "智能的套娃",
    subtitle: "AI、ML、NN、DL：先看英文全称，再看谁包含谁",
    icon: Layers3,
    official: "人工智能（Artificial Intelligence，AI）是最大概念；机器学习（Machine Learning，ML）是 AI 的一种实现路径；神经网络（Neural Network，NN）是机器学习中的一种方法；深度学习（Deep Learning，DL）是使用多层神经网络学习复杂模式的方法。",
    plain: "先别急着记公式，把它想成套娃：AI 最大，里面装着机器学习，机器学习里面有神经网络，神经网络层数加深后，就到了深度学习。",
    useWhen: ["第一次听到 AI、机器学习、深度学习混在一起时", "判断一个工具到底是在讲大概念还是具体方法时", "和同事讨论 AI 项目边界，需要先统一语言时"],
    value: ["快速建立 AI 概念地图", "避免把所有 AI 都叫成大模型", "为后面理解 LLM 和 Agent 打底"],
    trap: "把 AI、机器学习、深度学习当成并列词，或者以为只要用了 AI 就一定用了大语言模型。",
    quiz: [
      {
        question: "下面哪组包含关系是正确的？",
        options: ["AI > ML > NN > DL", "DL > AI > ML > NN", "NN > AI > DL > ML"],
        answer: "AI > ML > NN > DL",
        explanation: "AI 是总概念，机器学习是实现 AI 的路径之一，神经网络是机器学习方法，深度学习是多层神经网络。",
      },
      {
        question: "机器学习最关键的变化是什么？",
        options: ["完全依赖人手写规则", "让系统从数据中学习模式", "只能处理文字"],
        answer: "让系统从数据中学习模式",
        explanation: "机器学习的关键不是把规则写死，而是让系统从数据里学规律。",
      },
      {
        question: "大语言模型 LLM 更接近哪一层的成果？",
        options: ["深度学习在语言领域的重要成果", "传统表格软件", "只靠人工规则写出来的系统"],
        answer: "深度学习在语言领域的重要成果",
        explanation: "LLM 是深度学习在自然语言理解和生成方向上的代表性产物。",
      },
    ],
  },
  {
    id: "ai-kitchen",
    title: "AI 的厨房",
    subtitle: "数据、算法、模型怎么配合",
    icon: Database,
    official: "数据是 AI 的食材，标注是给数据配答案，算法是处理数据的菜谱，模型是算法通过训练数据学到的能力表示。",
    plain: "如果把 AI 当成厨房，数据就是食材，标签就是食材上的小纸条，算法是菜谱，训练后的模型就是厨师练出来的手感。",
    useWhen: ["听到数据、标签、算法、模型这些词混在一起时", "判断一个 AI 项目缺的是数据、方法还是成品能力时", "准备把自己的材料交给 AI 处理之前"],
    value: ["知道 AI 为什么需要高质量材料", "理解模型不是软件界面，而是训练后的能力", "能区分结构化数据和非结构化数据"],
    trap: "以为模型就是 App，或者以为只要有算法，不需要数据和标注也能稳定产出好结果。",
    quiz: [
      {
        question: "训练一个识别猫图的 AI 时，图片通常是什么？",
        options: ["数据", "算法", "模型"],
        answer: "数据",
        explanation: "图片是训练材料；“这是猫”的答案才是标签。",
      },
      {
        question: "算法更像厨房里的什么？",
        options: ["菜谱", "餐桌", "客人"],
        answer: "菜谱",
        explanation: "算法是一套明确规则和步骤，用来处理数据并完成计算或推理。",
      },
      {
        question: "模型最接近下面哪种说法？",
        options: ["训练后学到的能力", "原始数据本身", "人工贴上的答案"],
        answer: "训练后学到的能力",
        explanation: "模型是算法从训练数据中学到的抽象表示，之后用它处理新输入。",
      },
    ],
  },
  {
    id: "learning-modes",
    title: "不同的学徒模式",
    subtitle: "监督、无监督、强化与基于人类反馈的强化学习（RLHF）",
    icon: BrainCircuit,
    official: "监督学习用带标签数据训练模型；无监督学习从无标签数据里发现结构；强化学习通过奖励和惩罚学习策略；基于人类反馈的强化学习（Reinforcement Learning from Human Feedback，RLHF）用人类偏好反馈帮助模型调整输出。",
    plain: "有老师给答案，是监督学习；没人给答案，自己找规律，是无监督学习；做对有奖励、做错有惩罚，是强化学习；人类评委不断告诉模型哪个回答更好，就是 RLHF。",
    useWhen: ["判断一个 AI 能力是怎么训练出来的", "理解分类、聚类、推荐、对话优化这些场景差异时", "听到 RLHF、奖励模型、人类反馈这些词时"],
    value: ["知道不同任务需要不同学习方式", "能解释为什么标签数据很贵", "理解大模型为什么需要人类反馈来变得更好用"],
    trap: "以为所有 AI 都是靠同一种训练方式学会的，或者以为无监督学习也需要人工给每条数据标答案。",
    quiz: [
      {
        question: "用带正确答案的数据训练垃圾邮件分类器，属于哪种学习？",
        options: ["监督学习", "无监督学习", "强化学习"],
        answer: "监督学习",
        explanation: "有标签、有正确答案，目标是预测新数据标签，这就是监督学习。",
      },
      {
        question: "把客户自动分成几类，但没有提前给答案，属于哪种学习？",
        options: ["无监督学习", "监督学习", "人工填表"],
        answer: "无监督学习",
        explanation: "无监督学习常用于发现隐藏结构，例如聚类和分群。",
      },
      {
        question: "RLHF（Reinforcement Learning from Human Feedback）中的 H 指什么？",
        options: ["人类反馈", "硬件", "隐藏层"],
        answer: "人类反馈",
        explanation: "RLHF 是基于人类反馈的强化学习，用人类偏好帮助模型调整输出。",
      },
    ],
  },
  {
    id: "llm-basics",
    title: "大厨的进化",
    subtitle: "大语言模型（LLM）、Transformer、Prompt、Token",
    icon: MessageSquareText,
    official: "大语言模型（Large Language Model，LLM）是基于海量数据预训练的深度学习模型；Transformer（变换器）是现代 LLM 的关键架构；Prompt（提示词）是用户输入的任务指令；Token（词元）是模型处理文本的基本单位。",
    plain: "LLM 像读过海量文字的大厨。Transformer 是它的炉灶结构，自注意力让它知道一句话里哪些词彼此相关。Prompt 是你点菜，Token 是厨房把文字切成的小块。",
    useWhen: ["使用豆包、DeepSeek、ChatGPT 等聊天助手时", "想让 AI 写作、总结、改稿、翻译或生成代码时", "遇到上下文长度、Token 计费、提示词优化这些问题时"],
    value: ["知道提示词为什么影响输出", "理解模型为什么会受上下文长度限制", "能把日常聊天助手和底层大模型联系起来"],
    trap: "把 Prompt 当成神秘咒语，或者以为 Token 就一定等于一个完整汉字或一个完整单词。",
    quiz: [
      {
        question: "Prompt 是什么？",
        options: ["用户给 AI 的任务指令", "模型的训练成本", "服务器硬盘"],
        answer: "用户给 AI 的任务指令",
        explanation: "Prompt 决定你把什么目标、材料、限制和输出要求交给模型。",
      },
      {
        question: "Token 更接近哪种说法？",
        options: ["模型处理文本的基本单位", "人工智能公司名称", "一份固定格式的报告"],
        answer: "模型处理文本的基本单位",
        explanation: "模型不是直接按人的阅读习惯处理整段文字，而是把文本切成 Token 来计算。",
      },
      {
        question: "Transformer 的关键能力常用哪个词解释？",
        options: ["自注意力机制", "手工编号", "纸质归档"],
        answer: "自注意力机制",
        explanation: "自注意力让模型判断上下文里哪些词更相关，帮助理解长距离关系。",
      },
    ],
  },
  {
    id: "agent-system",
    title: "从聊天到做事",
    subtitle: "Agent、Skills、Harness：从智能体到运行控制层",
    icon: Workflow,
    official: "Agent（智能体）是能感知环境、推理并采取行动的系统；Skills（技能）是可复用能力包；Harness（运行控制层）位于模型外部，负责工具、记忆、权限、执行环境、日志和失败处理。",
    plain: "模型负责想和说，Agent 开始能做事。Skills 像它的拿手菜谱包，Harness 像厨房的操作台、燃气阀、监控和安全制度，决定它能不能稳定、可控地做完任务。",
    useWhen: ["任务需要跨步骤、跨工具执行，而不是只要一句回答", "想把常用工作流封装成可复用 Skill 时", "需要控制 AI 能访问什么、能执行什么、出错后怎么处理时"],
    value: ["把 AI 从问答工具升级为工作流伙伴", "让个人经验沉淀成可复用能力", "给自动化任务加上权限、日志和验收边界"],
    trap: "只盯着模型有多聪明，却忽略 Skills 和 Harness。很多 Agent 好不好用，差别不只在模型，也在外面的运行系统。",
    quiz: [
      {
        question: "Agent 和普通聊天模型的关键区别是什么？",
        options: ["Agent 能围绕目标调用工具并执行步骤", "Agent 一定没有风险", "Agent 只能写诗"],
        answer: "Agent 能围绕目标调用工具并执行步骤",
        explanation: "Agent 的关键是行动链路：拆任务、用工具、看反馈、继续执行。",
      },
      {
        question: "Skills 最像什么？",
        options: ["可复用能力包", "一次性闲聊", "随机灵感"],
        answer: "可复用能力包",
        explanation: "Skill 把角色、输入、步骤、输出格式和质量标准封装起来，方便重复使用。",
      },
      {
        question: "Harness 主要负责什么？",
        options: ["模型外部的工具、状态、权限和执行控制", "给 AI 起一个好听名字", "替代所有人工判断"],
        answer: "模型外部的工具、状态、权限和执行控制",
        explanation: "Harness 是模型外面的工作环境和控制层，让模型能安全、稳定地做事。",
      },
    ],
  },
  {
    id: "product-map",
    title: "现实产品地图",
    subtitle: "豆包、DeepSeek、OpenClaw 各做什么",
    icon: Sparkles,
    official: "豆包更接近日常 AI 助手入口；DeepSeek 同时提供聊天应用、模型和应用程序编程接口（Application Programming Interface，API）；OpenClaw 更接近可自托管的 Agent 平台，可以连接消息渠道并通过 Skills 扩展能力。",
    plain: "豆包像随手可用的 AI 同事，适合问答、写作、语音和创作。DeepSeek 像模型引擎，也能给开发者接入。OpenClaw 更像个人 AI 管家系统，重点不只是回答，而是连接工具、渠道和 Skills 去做事。",
    useWhen: ["想知道自己应该先体验哪类 AI 产品时", "区分聊天助手、模型 API 和 Agent 平台时", "准备把 AI 从个人试用推进到工作流试用时"],
    value: ["知道产品背后的概念位置", "避免把所有 AI 产品都当聊天框", "能按任务选择工具，而不是按热度选择工具"],
    trap: "看到产品都会聊天，就以为它们都一样。真正的差别在模型能力、工具连接、执行权限、工作流和数据边界。",
    quiz: [
      {
        question: "想做日常问答、写作辅助、语音交流和创作，哪类工具最容易上手？",
        options: ["豆包这类 AI 助手", "数据库内核", "传统压缩软件"],
        answer: "豆包这类 AI 助手",
        explanation: "豆包的典型入口是面向普通用户的 AI 助手体验。",
      },
      {
        question: "想把模型能力接入自己的系统或开发工具，DeepSeek 更接近哪种角色？",
        options: ["模型与 API 提供方", "纯线下课程", "纸质手册"],
        answer: "模型与 API 提供方",
        explanation: "DeepSeek 既有聊天入口，也提供模型和 API，适合开发者或企业系统接入。",
      },
      {
        question: "OpenClaw 更适合帮助学员理解哪个概念？",
        options: ["Agent、Skills 和 Harness", "只会单句翻译的工具", "电子表格求和"],
        answer: "Agent、Skills 和 Harness",
        explanation: "OpenClaw 的重点是自托管 Agent、渠道连接、Skills 扩展和真实工具执行。",
      },
    ],
  },
  {
    id: "ai-safety",
    title: "厨房安全准则",
    subtitle: "幻觉、可解释性、窄域人工智能（ANI）与通用人工智能（AGI）",
    icon: CheckCircle2,
    official: "幻觉是 AI 生成看似合理但实际错误的信息；可解释性关注模型为什么给出某个结果；窄域人工智能（Artificial Narrow Intelligence，ANI）是当前主流形态；通用人工智能（Artificial General Intelligence，AGI）是仍未实现的目标。",
    plain: "AI 端出来的菜看起来很漂亮，也可能不能吃。初学者最重要的习惯不是崇拜答案，而是验证答案：哪里来的，能不能查，适不适合你的场景。",
    useWhen: ["AI 给出事实、数据、法律、医疗或财务建议时", "准备把 AI 结果发给客户、老板或团队之前", "判断一个工具宣传是否过度承诺时"],
    value: ["减少把错误内容当真", "知道高风险场景必须人工复核", "理解现在的 AI 仍主要是窄域能力组合"],
    trap: "AI 回答得越流畅，越容易让人放松警惕。流畅不等于真实，自信不等于可用。",
    quiz: [
      {
        question: "AI 幻觉指什么？",
        options: ["看似合理但实际错误或不存在的信息", "模型运行速度很快", "用户输入太短"],
        answer: "看似合理但实际错误或不存在的信息",
        explanation: "幻觉最危险的地方是它常常说得很像真的，所以必须验证。",
      },
      {
        question: "在医疗、法律、财务等关键场景，为什么要关注可解释性？",
        options: ["需要知道 AI 为什么给出建议", "因为界面要更好看", "因为 Token 越多越好"],
        answer: "需要知道 AI 为什么给出建议",
        explanation: "高风险决策不能只看答案，还要看依据、边界和责任。",
      },
      {
        question: "当前主流 AI 更接近哪一类？",
        options: ["ANI 窄域 AI", "已经实现的 AGI", "完全没有学习能力的计算器"],
        answer: "ANI 窄域 AI",
        explanation: "今天的 AI 已经很强，但仍主要是在具体任务中发挥能力，AGI 还不是现实产品。",
      },
    ],
  },
];

export function ConceptLearningCards() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedConceptId, setSelectedConceptId] = useState(conceptCards[0].id);

  const choose = (conceptId: string, questionIndex: number, option: string) => {
    setAnswers((current) => ({
      ...current,
      [`${conceptId}-${questionIndex}`]: option,
    }));
  };

  const resetConcept = (conceptId: string) => {
    setAnswers((current) => {
      const next = { ...current };
      Object.keys(next).forEach((key) => {
        if (key.startsWith(`${conceptId}-`)) {
          delete next[key];
        }
      });
      return next;
    });
  };

  const selectedConcept = conceptCards.find((concept) => concept.id === selectedConceptId) ?? conceptCards[0];
  const selectedIndex = conceptCards.findIndex((concept) => concept.id === selectedConcept.id);
  const selectedStats = getConceptStats(selectedConcept, answers);
  const SelectedIcon = selectedConcept.icon;

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {conceptCards.map((concept, index) => {
          const Icon = concept.icon;
          const stats = getConceptStats(concept, answers);
          const selected = concept.id === selectedConcept.id;

          return (
            <button
              key={concept.id}
              type="button"
              onClick={() => setSelectedConceptId(concept.id)}
              className={`group min-h-[150px] rounded-[26px] border p-4 text-left shadow-xl shadow-black/10 transition hover:-translate-y-0.5 ${
                selected
                  ? "border-emerald-200/55 bg-emerald-300/12"
                  : "border-emerald-200/14 bg-[#0c201c]/75 hover:border-emerald-200/32 hover:bg-[#102b25]"
              }`}
              aria-pressed={selected}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200/70">
                  Concept {String(index + 1).padStart(2, "0")}
                </div>
                <div className={`grid h-10 w-10 flex-none place-items-center rounded-2xl border ${selected ? "border-emerald-200/35 bg-emerald-300/18 text-emerald-100" : "border-emerald-200/16 bg-black/20 text-emerald-200/78"}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <h3 className="mt-4 text-xl font-black text-white">{concept.title}</h3>
              <p className="mt-2 text-sm font-bold text-emerald-100/62">{concept.subtitle}</p>
              <div className="mt-4">
                <StatusPill completed={stats.completed} passed={stats.passed} score={stats.score} total={concept.quiz.length} compact />
              </div>
            </button>
          );
        })}
      </div>

      <section className="overflow-hidden rounded-[34px] border border-emerald-200/16 bg-[#071512]/92 shadow-2xl shadow-black/20">
        <div className="grid min-h-[620px] gap-0 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="border-b border-emerald-200/10 p-5 sm:p-6 lg:border-b-0 lg:border-r lg:border-r-emerald-200/10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200/70">
                  Concept {String(selectedIndex + 1).padStart(2, "0")}
                </div>
                <h2 className="mt-4 text-3xl font-black text-white">{selectedConcept.title}</h2>
                <p className="mt-2 text-sm font-bold text-emerald-100/68">{selectedConcept.subtitle}</p>
              </div>
              <div className="grid h-12 w-12 flex-none place-items-center rounded-2xl border border-emerald-200/16 bg-emerald-300/10 text-emerald-200">
                <SelectedIcon className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <LearningBlock label="官方定义" text={selectedConcept.official} />
              <LearningBlock label="大白话解释" text={selectedConcept.plain} emphasis />
              <div className="rounded-3xl border border-amber-200/14 bg-amber-300/8 p-4 text-sm leading-7 text-amber-50/74">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-100/75">常见误区</div>
                <p className="mt-2">{selectedConcept.trap}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <BulletPanel title="什么时候使用" items={selectedConcept.useWhen} />
              <BulletPanel title="有什么作用" items={selectedConcept.value} />
            </div>
          </div>

          <div className="flex min-h-[620px] flex-col p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200/70">Self Check</div>
                <h3 className="mt-1 text-2xl font-black text-white">掌握度小测</h3>
              </div>
              <StatusPill completed={selectedStats.completed} passed={selectedStats.passed} score={selectedStats.score} total={selectedConcept.quiz.length} />
            </div>

            <div className="mt-5 grid gap-3">
              {selectedConcept.quiz.map((question, questionIndex) => (
                <QuizBlock
                  key={question.question}
                  conceptId={selectedConcept.id}
                  question={question}
                  questionIndex={questionIndex}
                  selected={answers[`${selectedConcept.id}-${questionIndex}`]}
                  onChoose={choose}
                />
              ))}
            </div>

            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
              <p className="text-sm leading-6 text-emerald-50/56">
                通过标准：3 题全部答对。切换模块不会丢失已完成的答案。
              </p>
              <button
                type="button"
                onClick={() => resetConcept(selectedConcept.id)}
                className="inline-flex items-center rounded-full border border-emerald-200/20 px-4 py-2 text-sm font-bold text-emerald-50/72 transition hover:bg-white/10 hover:text-white"
              >
                <RotateCcw className="mr-1.5 h-4 w-4" />
                重做当前模块
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function getConceptStats(concept: ConceptCard, answers: Record<string, string>) {
  const score = concept.quiz.reduce((total, question, questionIndex) => {
    return total + (answers[`${concept.id}-${questionIndex}`] === question.answer ? 1 : 0);
  }, 0);
  const completed = concept.quiz.every((_, questionIndex) => answers[`${concept.id}-${questionIndex}`]);
  return {
    completed,
    passed: completed && score === concept.quiz.length,
    score,
  };
}

function StatusPill({
  completed,
  passed,
  score,
  total,
  compact = false,
}: {
  completed: boolean;
  passed: boolean;
  score: number;
  total: number;
  compact?: boolean;
}) {
  if (passed) {
    return (
      <div className={`inline-flex items-center rounded-full bg-emerald-300 px-3 py-1 text-xs font-black text-[#06110f] ${compact ? "text-[11px]" : ""}`}>
        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
        已通过
      </div>
    );
  }

  return (
    <div className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${compact ? "text-[11px]" : ""} ${completed ? "border border-rose-200/35 text-rose-100/78" : "border border-emerald-200/20 text-emerald-100/70"}`}>
      {completed ? `${score}/${total} 正确 · 待重做` : "未完成自测"}
    </div>
  );
}

function QuizBlock({
  conceptId,
  question,
  questionIndex,
  selected,
  onChoose,
}: {
  conceptId: string;
  question: QuizQuestion;
  questionIndex: number;
  selected?: string;
  onChoose: (conceptId: string, questionIndex: number, option: string) => void;
}) {
  const answered = Boolean(selected);
  const correct = selected === question.answer;

  return (
    <div className="rounded-3xl border border-emerald-200/10 bg-white/[0.035] p-4">
      <div className="flex gap-3">
        <div className="grid h-7 w-7 flex-none place-items-center rounded-full border border-emerald-200/18 bg-emerald-300/10 text-xs font-black text-emerald-200">
          {questionIndex + 1}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black leading-6 text-white">{question.question}</p>
          <div className="mt-3 grid gap-2">
            {question.options.map((option) => {
              const isSelected = selected === option;
              const isAnswer = option === question.answer;
              const showCorrect = answered && isAnswer;
              const showWrong = answered && isSelected && !isAnswer;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onChoose(conceptId, questionIndex, option)}
                  className={`flex items-start gap-2 rounded-2xl border px-3 py-2 text-left text-sm leading-6 transition ${
                    showCorrect
                      ? "border-emerald-300/70 bg-emerald-300/12 text-white"
                      : showWrong
                        ? "border-rose-300/50 bg-rose-400/10 text-rose-50"
                        : isSelected
                          ? "border-emerald-200/35 bg-white/[0.07] text-white"
                          : "border-emerald-200/10 bg-black/15 text-emerald-50/70 hover:border-emerald-200/28 hover:text-white"
                  }`}
                >
                  {showCorrect ? <CheckCircle2 className="mt-1 h-4 w-4 flex-none text-emerald-200" /> : null}
                  {showWrong ? <XCircle className="mt-1 h-4 w-4 flex-none text-rose-200" /> : null}
                  {!showCorrect && !showWrong ? <span className="mt-2 h-2 w-2 flex-none rounded-full bg-emerald-200/45" /> : null}
                  <span>{option}</span>
                </button>
              );
            })}
          </div>
          {answered ? (
            <p className={`mt-3 text-xs font-semibold leading-6 ${correct ? "text-emerald-100/78" : "text-rose-100/78"}`}>
              {question.explanation}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LearningBlock({ label, text, emphasis = false }: { label: string; text: string; emphasis?: boolean }) {
  return (
    <div className={`rounded-3xl border p-4 text-sm leading-7 ${emphasis ? "border-emerald-200/18 bg-emerald-300/8 text-emerald-50/82" : "border-emerald-200/12 bg-black/18 text-emerald-50/68"}`}>
      <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200/70">{label}</div>
      <p className="mt-2">{text}</p>
    </div>
  );
}

function BulletPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-3xl border border-emerald-200/12 bg-white/[0.035] p-4">
      <h4 className="text-sm font-black text-white">{title}</h4>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <div key={item} className="flex gap-2 text-sm leading-6 text-emerald-50/68">
            <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-emerald-300" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
