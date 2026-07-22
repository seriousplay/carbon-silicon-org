export const dynamic = "force-dynamic";
import Link from "next/link";
import { AppShell, Container, SectionLabel } from "@/components/ui";

const glossaryData = [
  {
    id: "01",
    name: "异类智能",
    en: "Alien Intelligence",
    chapter: "第一章",
    type: "核心认知",
    badge: "cognition",
    definition: `理解 AI 的核心框架——AI 不是更快的工具，也不是需要防备的对手，而是来自硅基计算的<strong>异类智能</strong>。它不像人类雇员（没有情感经验与价值判断），也不像传统机器（参与的是对话、推理与表达，而不只是执行）。`,
    quote: "如果把它理解为工具，你会关心'怎么用'；如果把它理解为对手，你会关心'怎么防'；如果把它理解为协作者，问题就变成了'怎么分工'。",
    details: [
      { label: "三大特质", value: "规模能力（海量处理）、迁移能力（跨域连接）、表征能力（快速结构化）" },
      { label: "对应分工", value: "AI 做广度探索与生成，人类负责价值裁决与边界守护" }
    ]
  },
  {
    id: "02",
    name: "工具幻觉",
    en: "Tool Illusion",
    chapter: "第一章",
    type: "认知偏差",
    badge: "cognition",
    definition: `最常见的 AI 认知偏差——把 AI 当作"高级搜索引擎"或"有幻觉的写作助手"，允许它在边缘地带输出，却拒绝让它进入任务拆解、验收标准和复盘沉淀等核心过程。结果是<strong>组织被自己的声音淹没</strong>：报告更多了，材料更漂亮了，但目标没有更清晰，协作没有更顺畅。`,
    details: [
      { label: "工具论", value: "把 AI 降格为写作助手，导致\u201C忙而不强\u201D" },
      { label: "威胁论", value: "把 AI 拔高为替代者，导致\u201C快而失控\u201D" }
    ]
  },
  {
    id: "03",
    name: "三重对齐",
    en: "Triple Alignment",
    chapter: "第一章",
    type: "核心框架",
    badge: "cognition",
    definition: `让人和 AI 在同一条工作链路上有效协作的三层对齐框架。AI 进入核心流程之前，需要先完成三个对齐检查：`,
    details: [
      { label: "目标对齐", value: "人和 AI 是否理解同一个\u201C完成\u201D的定义？" },
      { label: "价值对齐", value: "AI 的输出是否按人类的价值标准被验收？" },
      { label: "逻辑对齐", value: "AI 的推理逻辑是否可追溯、可质疑、可修正？", full: true }
    ]
  },
  {
    id: "04",
    name: "智能密度",
    en: "Intelligence Density",
    chapter: "第二章",
    type: "核心概念",
    badge: "cognition",
    definition: `AI 时代组织竞争的新指标——<strong>单位人或单位团队可调用的智能资源总量</strong>。不再只看有多少人，而看每个人和每个团队背后能调用多少 AI 能力、工具链、数据反馈和知识资产。`,
    quote: "工业时代的战斗力公式是组织能力 ≈ 人数 × 人均产出。AI 时代，这个公式正在被改写。人数仍然重要，但更关键的问题是：每个人能调用多少智能？",
    details: [
      { label: "高密度信号", value: "共享工具链、AI 进入核心链路、经验可复用、决策靠近现场" },
      { label: "低密度信号", value: "靠个人账号和零散工具、AI 停留在边缘任务、经验留在个人聊天记录里" }
    ]
  },
  {
    id: "05",
    name: "组织范式迁移",
    en: "Paradigm Shift",
    chapter: "第二章",
    type: "核心框架",
    badge: "cognition",
    definition: `组织从工业时代到 AI 时代的五大底层迁移。不是单点变化，而是价值创造、组织结构、管理控制、人才能力和组织目标的同时迁移。`,
    details: [
      { label: "价值创造", value: "从规模效率 → 智能密度" },
      { label: "组织结构", value: "从金字塔 → 网络化协作" },
      { label: "管理控制", value: "从流程控制 → 感知响应" },
      { label: "人才能力", value: "从岗位分工 → 人机协作单元" },
      { label: "组织目标", value: "从降本增效 → 持续进化", full: true }
    ]
  },
  {
    id: "06",
    name: "大陆文明 × 海洋文明",
    en: "Continental vs Oceanic",
    chapter: "第三章",
    type: "核心隐喻",
    badge: "cognition",
    definition: `描述新旧组织形态的对照隐喻。工业时代的组织更像<strong>大陆文明</strong>：边界清晰、结构稳定、靠层级与流程获得可控性。AI 时代的组织更像<strong>海洋文明</strong>：边界渗透、连接密集、靠系统路由与协作生态获得速度与适应力。`,
    details: [
      { label: "大陆文明", value: "边界清晰、层级分明、流程固定、靠控制获得稳定性" },
      { label: "海洋文明", value: "边界渗透、连接密集、系统路由、靠反馈获得适应力" }
    ]
  },
  {
    id: "07",
    name: "新物种 · 三种海洋文明形态",
    en: "Oceanic Species - Three Forms",
    chapter: "第三章",
    type: "分类框架",
    badge: "cognition",
    definition: `碳硅组织不是传统组织加一点 AI，而是组织<strong>物种正在迁徙</strong>。海洋文明中浮现出三种典型形态：`,
    details: [
      { label: "海豹型（密度优先）", value: "极少数人 + 强 AI 工具链，完成不成比例的产出。典型如 DeepSeek、Anysphere" },
      { label: "珊瑚礁型（平台共生）", value: "核心平台 + 大量外部生态单元，共同创造价值。典型如 Notion、Block/Square" },
      { label: "章鱼型（系统路由）", value: "智能中枢 + 分散执行节点，信息和决策通过系统路由。典型如 Palantir", full: true }
    ]
  },
  {
    id: "08",
    name: "三螺旋架构",
    en: "Triple Helix Architecture",
    chapter: "第四章",
    type: "核心框架",
    badge: "architecture",
    definition: `碳硅组织的整体架构模型。组织由三层螺旋结构共同支撑，三层互相影响，<strong>最短板决定整体效能</strong>。`,
    details: [
      { label: "结构层", value: "任务如何流动——信息、决策、资源在组织中的路径" },
      { label: "细胞层", value: "最小生产单元如何运行——人 + AI 的稳定协作模式" },
      { label: "环境层", value: "意义、权力、信任是否支持涌现——组织试错的土壤", full: true }
    ],
    quote: "它不是组织设计蓝图，而是组织 X 光片——帮你看清卡点在哪一层。"
  },
  {
    id: "09",
    name: "混合智能细胞",
    en: "Hybrid Intelligence Cell",
    chapter: "第四章",
    type: "核心概念",
    badge: "architecture",
    definition: `AI 时代的最小闭环生产单元——<strong>人与智能体组成的固定协作组合</strong>。过去组织的基本单元是"岗位"（一个人承担一类职责），未来是"人 + AI 智能体"组成一个能独立完成价值闭环的细胞。`,
    quote: "一个人，加上一个智能体，就等于一个专业团队。",
    details: [
      { label: "七要素", value: "任务、人、智能体、数据、接口、护栏、资产" },
      { label: "成熟标志", value: "能独立完成\u201C定义→拆解→执行→验证→沉淀\u201D闭环" }
    ]
  },
  {
    id: "10",
    name: "业务本体",
    en: "Business Ontology",
    chapter: "第五章",
    type: "核心概念",
    badge: "architecture",
    definition: `<strong>让 AI 读懂业务对象、关系、状态、规则、动作和权限的语义基建</strong>。知识图谱把关系连起来，业务本体进一步定义这些关系在真实业务中意味着什么、能触发什么动作、受哪些规则约束。它是企业大脑的底层设施，但不等同于企业大脑本身。`,
    quote: "从知识图谱到业务本体，关键变化不是多画几条关系，而是让 AI 知道下一步该做什么、谁能批准、哪些边界不能越过。",
    details: [
      { label: "输入", value: "业务对象、关系、状态、规则、权限、历史实例" },
      { label: "输出", value: "可推理、可验证、可被智能体调用的业务语义底座" }
    ]
  },
  {
    id: "11",
    name: "编排",
    en: "Orchestration",
    chapter: "第四章",
    type: "治理方法论",
    badge: "architecture",
    definition: `碳硅组织的核心治理方法论——在不确定环境中<strong>设计闭环</strong>，而非预设路径。区别于传统"调度"（把已知任务分配给已知角色），编排关注的是：如何让任务在流动中自行找到最优路径，如何在边界模糊时保持方向一致，如何在试错中不断修正规则。`
  },
  {
    id: "12",
    name: "四根显性基建",
    en: "Four Pillars",
    chapter: "第五章",
    type: "核心框架",
    badge: "architecture",
    definition: `液态网络的四根新基建支柱。一个组织要跑得比竞争对手快、比旧时代稳、比昨天更聪明，这四件事必须被装成基础设施，而不是靠个人英雄。`,
    details: [
      { label: "任务单元", value: "让垂直闭环跑起来的最小结构，从问题定义到经验沉淀" },
      { label: "混合人才市场", value: "人和智能体动态匹配的机制，角色可流动而非固化" },
      { label: "业务本体", value: "让 AI 读懂业务对象、状态、规则、动作和权限的语义基建" },
      { label: "组合价值激励", value: "让探索与协作持续发生的激励方式，不只奖励确定性产出" }
    ]
  },
  {
    id: "13",
    name: "三股隐性能量",
    en: "Hidden Energies",
    chapter: "第六章",
    type: "核心框架",
    badge: "architecture",
    definition: `决定液态网络能否真正运行的<strong>三股底层洋流</strong>。结构负责"怎么跑"；往哪跑、谁来拍板、真问题能不能上桌——这三件事，结构管不了。`,
    quote: "结构负责跑起来。能跑多远，看隐性能量。",
    details: [
      { label: "意义", value: "把愿景变成日常的方向感。不是价值观标语，是\u201C什么值得做、什么不值得做\u201D的导航。" },
      { label: "权力", value: "谁能决定什么，谁承担后果。权力不被设计就会自己长出来——而且长在最不该出现的地方。" },
      { label: "信任", value: "如何用契约和验证替代猜测。信任不是情绪高低，而是真信息能否流动、错误能否被修正。", full: true }
    ]
  },
  {
    id: "14",
    name: "超级个体",
    en: "Super Individual",
    chapter: "第七章",
    type: "核心概念",
    badge: "evolution",
    definition: `不是"更强的人"，而是<strong>能独立运行价值闭环的基本生产单元</strong>。能用 AI、工具链和反馈资产独立完成"定义问题 → 拆解任务 → 执行方案 → 现实验证 → 经验沉淀"的完整闭环。`,
    quote: "很多人对'超级个体'的理解仍然停在旧时代的英雄叙事里：更聪明、更努力、更会用工具。这个理解太窄了。它把超级个体看成一个升级版员工，却没有看到它已经变成了一个新的生产单元。",
    details: [
      { label: "三轴能力", value: "AI 驾驭力（调用工具链）、碳硅翻译力（人机分工）、意义创造力（定义问题与判断价值）" },
      { label: "典型信号", value: "不再等排期、不再等完整团队、不再等\u201C上面给资源\u201D——先和 AI 跑出一个闭环" }
    ]
  },
  {
    id: "15",
    name: "团队回路",
    en: "Team Circuit",
    chapter: "第八章",
    type: "核心概念",
    badge: "evolution",
    definition: `AI 时代团队进化的方向——当层级被回路替代。团队的价值不再取决于组织图上框框有多整齐，而是取决于<strong>一群人和一组智能体能不能把"意图→执行→验证→复盘→再执行"这条链路跑稳、跑快、跑得可继承</strong>。`,
    quote: "一种逻辑是：业务变复杂就加岗位，风险变大就加审批。另一种逻辑是：先问这条业务回路能不能自己发现问题、修正问题、留下经验。",
    details: [
      { label: "核心转变", value: "从\u201C岗位堆叠\u201D到\u201C回路设计\u201D，质量在验证回路里长出来，而非靠事后检查" },
      { label: "三个标志", value: "① 质量不靠事后再检查 ② 风险不靠流程来硬压 ③ 经验不靠个人记在脑子里" }
    ]
  },
  {
    id: "16",
    name: "人机链路五步法",
    en: "Human-AI Chain Method",
    chapter: "第八章",
    type: "工具方法",
    badge: "evolution",
    definition: `把一条真实工作流跑成人机协作系统，并沉淀为可复用资产的可操作方法。五步递进：`,
    details: [
      { label: "选链路", value: "找一条真实、可回滚、有明确价值信号的工作流" },
      { label: "写链路卡", value: "写清输入、关键节点、输出、负责人和验收信号" },
      { label: "分工接口", value: "明确人、智能体和自动化分别负责什么" },
      { label: "验收护栏", value: "补上最小验收清单、风险节点和回退机制" },
      { label: "复跑沉淀", value: "至少复跑一轮，沉淀为可复用模板和经验", full: true }
    ]
  },
  {
    id: "17",
    name: "爵士领导力",
    en: "Jazz Leadership",
    chapter: "第九章",
    type: "核心概念",
    badge: "evolution",
    definition: `在不确定中设定框架、倾听信号、激活即兴的领导方式。像爵士指挥家——<strong>不是发号施令，而是调校系统</strong>。领导者不再只是答案的拥有者，而要成为系统的调校者。`,
    quote: "陈彬说，过去 CEO 以为自己在掌握全局，其实掌握的是一套被整理过的局部叙事。AI 让他有机会从'审批者'的位置上退出来，去做更难的事：定义问题、设定边界、培育土壤。"
  },
  {
    id: "18",
    name: "园丁型领导力",
    en: "Gardener Leadership",
    chapter: "第九章",
    type: "核心概念",
    badge: "evolution",
    definition: `在更长的时间尺度上培育信息流动、信任关系、意义共识和组织自主进化能力的领导方式。类比生态园丁——<strong>不控制每棵树怎么长，而是改良土壤、调节光照和水分</strong>，让生命力涌现。`,
    details: [
      { label: "工业时代领导者", value: "建筑师——设计结构、分配任务、监督执行" },
      { label: "AI 时代领导者", value: "园丁——调校土壤、培育生态、让判断力在组织中长出来" }
    ]
  },
  {
    id: "19",
    name: "AI 转型五级阶梯",
    en: "Five-Level Ladder",
    chapter: "第十章",
    type: "核心框架",
    badge: "practice",
    definition: `把 AI 转型从一句"我们都要拥抱 AI"拆成一张可以对照、可以诊断、可以推进的五级地图。不是严格通关题，但大多数企业跳过一课，后面通常会以更贵的方式回来。`,
    quote: "很多企业的 AI 转型失败不是因为模型不够强，而是因为组织还停留在旧操作系统里。",
    details: [
      { label: "L1 工具上手", value: "每个人开始与 AI 协作。必修课：从个人效率到组织习惯" },
      { label: "L2 流程嵌入", value: "AI 进入核心工作流。必修课：选一条真实链路，跑通第一个闭环" },
      { label: "L3 团队重构", value: "出现人机混合团队。必修课：把岗位语言翻成任务语言" },
      { label: "L4 系统重写", value: "治理、激励、权力开始变化。必修课：从\u201C怎么跑\u201D到\u201C怎么治理\u201D" },
      { label: "L5 碳硅共生", value: "AI 协作成为组织第二天性。很少再谈\u201CAI 项目\u201D，因为它已进入日常", full: true }
    ]
  },
  {
    id: "20",
    name: "业务锚点",
    en: "Business Anchor",
    chapter: "第十章",
    type: "工具方法",
    badge: "practice",
    definition: `检验 AI 项目是否从技术自嗨拉回业务结果的关键判断工具。一个 AI 项目值得投入，必须回答三个问题：<br><br><strong>① 它连接哪个业务指标？</strong>问题不是"模型准确率多少"，而是"这个项目完成后，哪个业务数字会变"；<br><strong>② 谁为结果负责？</strong>项目必须有明确的业务负责人背书，而不是由 AI 团队单方面推动；<br><strong>③ 失败信号是什么？</strong>事先写清"什么情况下应该停掉这个项目"，比写成功计划更重要。`
  },
  {
    id: "21",
    name: "行业 AI 路径三型",
    en: "Industry Path Models",
    chapter: "第十一章",
    type: "分类框架",
    badge: "practice",
    definition: `不同行业 AI 转型的三种路径选择。不是所有行业都适合同一种节奏，判断路径比追赶潮流更重要。`,
    details: [
      { label: "增强型路径", value: "在现有业务上叠加 AI 能力，不改变核心价值创造方式。适合监管严、变更成本高的行业（如金融、医疗）" },
      { label: "重构型路径", value: "用 AI 重构核心流程和交付方式，但行业本质不变。适合竞争剧烈、数字原生程度较高的行业（如教育、零售）" },
      { label: "原生型路径", value: "从第一天起就是 AI 原生的组织形态。适合新进入者或在原有市场中开辟新赛道的企业", full: true }
    ]
  },
  {
    id: "22",
    name: "组织 AI 宪章",
    en: "AI Charter",
    chapter: "第十二章",
    type: "核心框架",
    badge: "practice",
    definition: `把 AI 使用边界、责任和价值原则写成<strong>可执行的组织契约</strong>。当 AI 影响招聘、绩效、薪酬、人才盘点时，它影响的不只是流程效率，也影响人的机会、评价和尊严。AI 宪章回答五个核心问题：`,
    details: [
      { label: "使用范围", value: "哪些场景可以使用 AI，哪些场景禁止使用" },
      { label: "人工复核", value: "哪些结果必须人工确认" },
      { label: "责任归属", value: "AI 犯错后谁负责，追溯机制是什么" },
      { label: "数据边界", value: "哪些数据不能进入模型" },
      { label: "申诉机制", value: "员工如何质疑或申诉 AI 做出的决策", full: true }
    ]
  },
  {
    id: "23",
    name: "线粒体时刻",
    en: "Mitochondrial Moment",
    chapter: "序章 / 第十二章",
    type: "核心隐喻",
    badge: "practice",
    definition: `贯穿全书的元隐喻。几十亿年前，一个单细胞吞噬了另一个擅长产生能量的细菌——它们没有互相毁灭，那个细菌变成了<strong>线粒体</strong>，生命从此走向更复杂的形态。今天，硅基智能体正在以类似的方式进入组织系统——人 + AI 不是替代关系，而是一种<strong>共生进化</strong>。碳硅组织不是传统组织加一点 AI，而是组织正在经历一次"线粒体时刻"式的物种升级。`,
    quote: "AI 正在成为这个时代商业文明的'硅基线粒体'。它拉平了普通人与顶尖专家之间的信息与认知差距，把人类推向人性独有的价值高地：定义问题的勇气、判断价值的责任、做出艰难抉择的担当。"
  },
  {
    id: "24",
    name: "碳硅组织",
    en: "Carbon-Silicon Organization",
    chapter: "全书",
    type: "核心概念",
    badge: "practice",
    definition: `全书的统摄性概念。既不代表人类战胜 AI，也不代表 AI 取代人类。它描述的是一种<strong>新的组织形态</strong>——碳基智能（人类的直觉、判断、责任和创造力）与硅基智能（AI 的规模、速度、记忆和推理）形成共生协作，构成一种前所未有的生产力和生产关系组合。碳（C）代表人：温度、经验、直觉、判断、承担责任；硅（Si）代表 AI：精确、理性、扩展、规模、永不疲倦。当两者融合，出来的新物种不是"人加机器"，而是一种新的组织生命形态。`,
    quote: "《碳硅组织》不是一本教你'怎么使用 AI 工具'的书，而是一本写给管理者的组织升级手册：当 AI 进入知识工作、判断流程和协作系统之后，企业竞争不再只看人头规模，而要看每个组织单元能调用多少智能、沉淀多少判断、跑通多少反馈闭环。"
  }
];

const badgeColors = {
  cognition: "bg-emerald-300/10 text-emerald-200 border-emerald-200/20",
  architecture: "bg-sky-300/10 text-sky-200 border-sky-200/20",
  evolution: "bg-amber-300/10 text-amber-200 border-amber-200/20",
  practice: "bg-violet-300/10 text-violet-200 border-violet-200/20"
};

const badgeLabels = {
  cognition: "认知篇",
  architecture: "架构篇",
  evolution: "进化篇",
  practice: "实践篇"
};

export default function GlossaryPage() {
  const stats = {
    total: glossaryData.length,
    sections: 4,
    chapters: 12
  };

  return (
    <AppShell>
      <div className="relative">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-emerald-200/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(45,212,191,0.22),transparent_28%),linear-gradient(135deg,rgba(3,16,15,0.98),rgba(5,35,30,0.9)_48%,rgba(5,10,9,0.98))]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(116,242,202,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(116,242,202,0.05)_1px,transparent_1px)] bg-[size:64px_64px] opacity-40" />

          <Container className="relative py-16 sm:py-20 lg:py-24">
            <div className="max-w-4xl">
              <SectionLabel>Glossary · 术语表</SectionLabel>
              <h1 className="flex flex-wrap items-baseline gap-x-4 text-4xl font-black leading-[1.1] tracking-tight text-white sm:gap-x-6 sm:text-5xl lg:text-6xl">
                《碳硅组织》关键概念术语表
                <span className="text-2xl leading-tight text-emerald-100/70 sm:text-3xl lg:text-4xl">
                  AI 时代的商业进化论 · 核心概念体系
                </span>
              </h1>

              <div className="mt-10 grid max-w-3xl grid-cols-3 gap-px overflow-hidden rounded-3xl border border-emerald-200/15 bg-emerald-200/15">
                <div className="bg-[#06110f]/72 px-4 py-5 backdrop-blur">
                  <div className="text-3xl font-black text-white">{stats.total}</div>
                  <div className="mt-1 text-xs font-semibold text-emerald-100/62">核心术语</div>
                </div>
                <div className="bg-[#06110f]/72 px-4 py-5 backdrop-blur">
                  <div className="text-3xl font-black text-white">{stats.sections}</div>
                  <div className="mt-1 text-xs font-semibold text-emerald-100/62">概念层级</div>
                </div>
                <div className="bg-[#06110f]/72 px-4 py-5 backdrop-blur">
                  <div className="text-3xl font-black text-white">{stats.chapters}</div>
                  <div className="mt-1 text-xs font-semibold text-emerald-100/62">章节覆盖</div>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* Table of Contents */}
        <Container className="py-8">
          <nav className="flex flex-wrap gap-2 justify-center">
            {Object.entries(badgeLabels).map(([key, label]) => (
              <a
                key={key}
                href={`#section-${key}`}
                className="inline-flex items-center rounded-full border border-emerald-200/20 bg-emerald-300/10 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-300/20 transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>
        </Container>

        {/* Glossary Sections */}
        <Container className="py-8 space-y-16">
          {Object.entries(badgeLabels).map(([badgeKey, badgeLabel]) => {
            const sectionTerms = glossaryData.filter(term => term.badge === badgeKey);
            if (sectionTerms.length === 0) return null;

            return (
              <section key={badgeKey} id={`section-${badgeKey}`} className="scroll-mt-8">
                <div className="mb-8 flex items-center gap-4 border-b border-emerald-200/15 pb-4">
                  <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] ${badgeColors[badgeKey as keyof typeof badgeColors]}`}>
                    {badgeLabel}
                  </span>
                  <h2 className="text-2xl font-black text-white">
                    {badgeKey === 'cognition' && '异类智能 · 范式迁移 · 新物种'}
                    {badgeKey === 'architecture' && '三螺旋 · 四支柱 · 隐性能量'}
                    {badgeKey === 'evolution' && '超级个体 · 团队回路 · 爵士领导力'}
                    {badgeKey === 'practice' && '五级阶梯 · 行业路径 · AI 宪章'}
                  </h2>
                </div>
                <p className="mb-8 text-emerald-50/64">
                  {badgeKey === 'cognition' && '对应第 1–3 章。回答"AI 到底是什么"、"组织在发生什么变化"、"会进化成什么形态"三个认知问题。'}
                  {badgeKey === 'architecture' && '对应第 4–6 章。回答"组织应该长什么样"、"新基建是什么"、"为什么结构搭好了却跑不动"三个架构问题。'}
                  {badgeKey === 'evolution' && '对应第 7–9 章。回答"个人如何进化"、"团队如何重组"、"领导者如何转变角色"三个能力问题。'}
                  {badgeKey === 'practice' && '对应第 10–12 章。回答"企业如何一步步落地"、"行业怎么选路"、"治理边界如何设定"三个实践问题。'}
                </p>

                <div className="space-y-4">
                  {sectionTerms.map((term) => (
                    <div
                      key={term.id}
                      className="rounded-[28px] border border-emerald-200/15 bg-[#0c201c]/75 shadow-2xl shadow-black/20 backdrop-blur overflow-hidden"
                    >
                      <div className="border-b border-emerald-200/10 p-6">
                        <div className="flex items-start gap-4">
                          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-emerald-200/20 bg-emerald-300/10 text-sm font-black text-emerald-200">
                            {term.id}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-baseline gap-3">
                              <h3 className="text-xl font-bold text-white">{term.name}</h3>
                              <span className="text-sm text-emerald-100/55">{term.en}</span>
                            </div>
                            <div className="mt-2 flex gap-2">
                              <span className="inline-flex rounded-full bg-emerald-300/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-200">
                                {term.chapter}
                              </span>
                              <span className="inline-flex rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-emerald-50/70">
                                {term.type}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-6">
                        <p
                          className="mb-4 leading-relaxed text-emerald-50/80 [&>strong]:text-emerald-200 [&>strong]:font-semibold"
                          dangerouslySetInnerHTML={{ __html: term.definition }}
                        />

                        {term.quote && (
                          <blockquote className="mb-4 border-l-[3px] border-emerald-300/30 bg-emerald-300/5 p-4 text-sm italic leading-relaxed text-emerald-50/70">
                            &ldquo;{term.quote}&rdquo;
                          </blockquote>
                        )}

                        {term.details && term.details.length > 0 && (
                          <div className="flex flex-col gap-3">
                            {term.details.map((detail, idx) => (
                              <div
                                key={idx}
                                className="rounded-2xl bg-emerald-300/5 p-4"
                              >
                                <div className="mb-1.5 text-xs font-bold uppercase tracking-[0.12em] text-emerald-100/45">
                                  {detail.label}
                                </div>
                                <div className="text-sm leading-relaxed text-emerald-50/70">
                                  {detail.value}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </Container>

        {/* Footer */}
        <footer className="relative z-10 mt-16 border-t border-emerald-200/10 py-8">
          <Container>
            <div className="text-center text-sm text-emerald-50/50">
              <p>《碳硅组织：AI时代的商业进化论》· 关键概念术语表</p>
              <p className="mt-2">
                用于工作坊参与者参考 · 如需了解更多，请参阅全书十二章节 ·{" "}
                <Link href="/" className="text-emerald-200 hover:underline">
                  返回首页
                </Link>
              </p>
            </div>
          </Container>
        </footer>
      </div>
    </AppShell>
  );
}
