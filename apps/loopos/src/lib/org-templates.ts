/**
 * 组织初始化模板
 *
 * 基于某大模型团队的真实生产链路设计（脱敏）
 * 用于一键初始化回路制组织结构：回路 + 角色 + 接口
 *
 * 基于 docs/01 数据模型 + docs/00 回路制设计
 */

export type TemplateCircle = {
  key: string; // 内部标识，用于建立接口关系
  name: string;
  number: "ZERO" | "ONE" | "TWO" | "THREE" | "FOUR" | "CUSTOM";
  type: "STRATEGY" | "PRODUCTION" | "INFRA" | "CROSSCUTTING";
  purpose: string;
  domain?: string;
  isRoot?: boolean; // 是否为组织根回路
  parentKey?: string; // 父回路的 key
  roles: TemplateRole[];
};

export type TemplateRole = {
  name: string;
  purpose: string;
  domain?: string;
  accountabilities: string; // 多行用 \n 分隔
  category: "CIRCLE_LEAD" | "EXPERT" | "OPERATIONS" | "COACH";
};

export type TemplateInterface = {
  name: string;
  fromKey: string;
  toKey: string;
  contractContent: string;
  sla: string;
  acceptanceCriteria: string;
};

export type OrgTemplate = {
  id: string;
  name: string;
  description: string;
  circles: TemplateCircle[];
  interfaces: TemplateInterface[];
};

// ─── 大模型团队模板（基于阶跃星辰真实结构，脱敏）──────────────
export const llmTeamTemplate: OrgTemplate = {
  id: "llm-team",
  name: "大模型团队",
  description:
    "按大模型生产链路编组的回路制结构：数据→预训练→后训练，工程基座服务全局，战略回路定方向。适合 50-200 人的基模团队。",
  circles: [
    {
      key: "root",
      name: "主回路",
      number: "CUSTOM",
      type: "PRODUCTION",
      purpose: "组织的根回路，承载整体协调和归属",
      isRoot: true,
      roles: [{ name: "组织目标负责人", purpose: "维护组织当前周期的主目标", accountabilities: "提出组织主目标议案\n组织目标检查\n公开目标进展", category: "CIRCLE_LEAD" }],
    },
    {
      key: "strategy",
      name: "战略决策回路",
      number: "ZERO",
      type: "STRATEGY",
      purpose: "决定做什么样的模型——架构选型、开源闭源、差异化方向",
      domain: "技术路线与资源分配的最终决策",
      parentKey: "root",
      roles: [
        {
          name: "战略回路负责人",
          purpose: "确保技术路线决策及时且充分讨论",
          accountabilities: "主持双周战略会议\n维护《技术路线决策备忘录》\n在路线分歧时推动收敛",
          category: "CIRCLE_LEAD",
        },
      ],
    },
    {
      key: "data",
      name: "数据回路",
      number: "ONE",
      type: "PRODUCTION",
      purpose: "为预训练和后训练提供不同规格的就绪数据",
      domain: "数据采集、清洗去重、质量筛选、分词器",
      parentKey: "root",
      roles: [
        {
          name: "数据回路负责人",
          purpose: "确保数据按时按质交付",
          accountabilities: "管理数据管线优先级\n对数据质量负全责\n协调跨回路数据需求",
          category: "CIRCLE_LEAD",
        },
        {
          name: "数据工程师",
          purpose: "让数据管线高效运转",
          domain: "清洗去重管线、数据存储",
          accountabilities: "维护数据清洗管线\n优化数据吞吐效率\n保障数据安全合规",
          category: "EXPERT",
        },
        {
          name: "质量筛选专家",
          purpose: "确保进入训练的数据是高质量的",
          domain: "数据质量评估与配比",
          accountabilities: "制定质量标准\n执行 D3 质量筛选\n优化数据配比策略",
          category: "EXPERT",
        },
      ],
    },
    {
      key: "pretrain",
      name: "预训练回路",
      number: "TWO",
      type: "PRODUCTION",
      purpose: "产出有竞争力的 Base Model",
      domain: "模型架构设计、预训练、Mid-Training",
      parentKey: "root",
      roles: [
        {
          name: "预训练回路负责人",
          purpose: "产出有竞争力的 Base Model",
          accountabilities: "制定预训练方案\n对 Base Model 质量负全责\n管理训练资源分配",
          category: "CIRCLE_LEAD",
        },
        {
          name: "分布式训练工程师",
          purpose: "让训练最快跑起来",
          domain: "千卡级分布式训练策略",
          accountabilities: "维护预训练 MFU≥50%\n优化通信效率\n故障续训",
          category: "EXPERT",
        },
        {
          name: "架构研究员",
          purpose: "探索更有竞争力的模型架构",
          domain: "模型架构设计",
          accountabilities: "评估 MoE/Dense 架构\n设计 Scaling 策略\nMid-Training 方案",
          category: "EXPERT",
        },
      ],
    },
    {
      key: "posttrain",
      name: "后训练回路",
      number: "THREE",
      type: "PRODUCTION",
      purpose: "把 Base Model 变成有竞争力的 Assistant",
      domain: "SFT、RL、评测、能力对齐",
      parentKey: "root",
      roles: [
        {
          name: "后训练回路负责人",
          purpose: "让每轮后训练有可见提升",
          accountabilities: "制定 SFT/RL 方案\n对 Assistant 能力负全责\n管理后训练资源",
          category: "CIRCLE_LEAD",
        },
        {
          name: "SFT 工程师",
          purpose: "用高质量数据让模型学会遵循指令",
          domain: "SFT 数据与训练",
          accountabilities: "构建 SFT 数据集\n执行 SFT 训练\n评估 SFT 效果",
          category: "EXPERT",
        },
        {
          name: "RL 研究员",
          purpose: "通过强化学习提升模型能力上限",
          domain: "RL 策略与奖励建模",
          accountabilities: "设计 RL 训练策略\n构建奖励模型\n调优 RLHF/DPO 流程",
          category: "EXPERT",
        },
      ],
    },
    {
      key: "evaluation",
      name: "评测回路",
      number: "CUSTOM",
      type: "PRODUCTION",
      purpose: "独立验证 Base Model 和 Assistant 的能力、风险与上线准入",
      domain: "评测集、回归基准、风险测试、上线准入报告",
      parentKey: "root",
      roles: [
        {
          name: "评测回路负责人",
          purpose: "确保模型交付先通过可复现的评测准入",
          accountabilities: "维护核心评测基准\n组织交付验收评测\n输出上线准入结论",
          category: "CIRCLE_LEAD",
        },
        {
          name: "评测工程师",
          purpose: "让每次模型交付都有稳定、可复现的评测结果",
          domain: "自动化评测、回归测试、报告生成",
          accountabilities: "维护评测流水线\n执行回归评测\n定位评测异常",
          category: "EXPERT",
        },
      ],
    },
    {
      key: "infra",
      name: "工程基座回路",
      number: "FOUR",
      type: "INFRA",
      purpose: "提供不让算法操心的基建——让算法研究员 1 小时内跑起实验",
      domain: "GPU 集群、训练框架、推理工程、数据平台、评测平台",
      parentKey: "root",
      roles: [
        {
          name: "工程基座回路负责人",
          purpose: "把基座做到行业头部",
          accountabilities: "管理工程团队优先级\n对基础设施稳定性负全责\n保障 Time-to-Experiment<1h",
          category: "CIRCLE_LEAD",
        },
        {
          name: "训练框架工程师",
          purpose: "让分布式训练框架稳定高效",
          domain: "训练框架与性能调优",
          accountabilities: "维护训练框架\n优化 MFU 和通信\n保障容错续训",
          category: "EXPERT",
        },
        {
          name: "平台工程师",
          purpose: "让算法研究员聚焦算法而非工程",
          domain: "实验平台、模型管理、评测平台",
          accountabilities: "维护实验平台\n管理模型版本\n保障评测平台可用",
          category: "EXPERT",
        },
        {
          name: "GPU 运维工程师",
          purpose: "让 GPU 集群不成为瓶颈",
          domain: "GPU 集群运维与调度",
          accountabilities: "维护 GPU 集群稳定\n优化调度策略\n保障 GPU 饥饿率<5%",
          category: "EXPERT",
        },
      ],
    },
  ],
  interfaces: [
    {
      name: "数据就绪 D3",
      fromKey: "data",
      toKey: "pretrain",
      contractContent: "D3 质量筛选数据，按约定规格和量级交付",
      sla: "约定时间后 24h 内确认",
      acceptanceCriteria: "数据规格和量级符合约定",
    },
    {
      name: "数据就绪 D3（后训练用）",
      fromKey: "data",
      toKey: "posttrain",
      contractContent: "SFT 用高质量数据，按需交付",
      sla: "需求确认后 48h 交付",
      acceptanceCriteria: "数据质量通过审核",
    },
    {
      name: "Base Model 交付",
      fromKey: "pretrain",
      toKey: "posttrain",
      contractContent: "Base Model checkpoint + 评测报告",
      sla: "训练完成后 24h 内交付",
      acceptanceCriteria: "Base Model 评测达标",
    },
    {
      name: "Base Model 评测准入",
      fromKey: "pretrain",
      toKey: "evaluation",
      contractContent: "Base Model checkpoint、训练说明和候选评测报告，提交评测回路做准入验证",
      sla: "训练完成后 24h 内提交评测",
      acceptanceCriteria: "核心能力、回归与风险评测通过准入阈值",
    },
    {
      name: "GPU 算力供给",
      fromKey: "infra",
      toKey: "pretrain",
      contractContent: "预训练所需 GPU 集群与容错续训保障",
      sla: "需求确认后 48h 分配",
      acceptanceCriteria: "GPU 饥饿率<5%",
    },
    {
      name: "训练框架支持",
      fromKey: "infra",
      toKey: "pretrain",
      contractContent: "分布式训练框架、性能调优、故障恢复",
      sla: "故障 2h 内响应",
      acceptanceCriteria: "MFU>50%",
    },
    {
      name: "实验平台支持",
      fromKey: "infra",
      toKey: "posttrain",
      contractContent: "实验平台、模型管理、评测平台",
      sla: "平台可用性>99%",
      acceptanceCriteria: "Time-to-Experiment<1h",
    },
    {
      name: "数据管线基建",
      fromKey: "infra",
      toKey: "data",
      contractContent: "数据清洗去重管线、存储、监控",
      sla: "按需响应",
      acceptanceCriteria: "管线稳定运行",
    },
  ],
};

// ─── 所有可用模板 ──────────────────────────────────────────
export const leanTeamTemplate: OrgTemplate = {
  id: "lean-team",
  name: "精益团队",
  description: "从一个清晰目的、一个主回路和三个互补角色开始，适合 3-5 人团队，后续通过治理会议逐步演化。",
  circles: [
    {
      key: "root",
      name: "主回路",
      number: "CUSTOM",
      type: "PRODUCTION",
      purpose: "承载团队当前最重要的结果和协作节奏",
      isRoot: true,
      roles: [
        { name: "结果负责人", purpose: "让团队持续取得当前主目标的结果", accountabilities: "维护本周期主目标\n组织每周战术会\n公开当前阻塞", category: "CIRCLE_LEAD" },
        { name: "交付角色", purpose: "把团队承诺转化为可验证产出", accountabilities: "承担项目和行动\n报告事实进展\n提出工作张力", category: "EXPERT" },
        { name: "流程教练", purpose: "帮助团队按治理流程持续学习", accountabilities: "引导战术和治理会议\n保护提案者的决策权\n协助验证有效反对", category: "COACH" },
      ],
    },
  ],
  interfaces: [],
};

export const professionalServicesTemplate: OrgTemplate = {
  id: "professional-services",
  name: "专业服务 / 项目型组织",
  description: "围绕客户承诺、项目交付和能力复用组织协作，适合咨询、设计、实施和专业服务团队。",
  circles: [
    {
      key: "root",
      name: "主回路",
      number: "CUSTOM",
      type: "PRODUCTION",
      purpose: "持续交付客户价值并维护组织的服务能力",
      isRoot: true,
      roles: [{ name: "客户价值负责人", purpose: "确保组织持续交付客户价值", accountabilities: "维护组织主目标\n确认客户价值结果\n公开目标风险", category: "CIRCLE_LEAD" }],
    },
    {
      key: "delivery",
      name: "项目交付回路",
      number: "ONE",
      type: "PRODUCTION",
      purpose: "把客户承诺转化为按期、可验收的项目结果",
      parentKey: "root",
      roles: [
        { name: "项目负责人", purpose: "对项目结果和客户承诺负责", accountabilities: "维护项目目标和范围\n协调交付资源\n提出交付张力", category: "CIRCLE_LEAD" },
        { name: "交付顾问", purpose: "完成项目中的专业工作并沉淀方法", accountabilities: "承担项目任务\n交付专业产出\n记录客户反馈", category: "EXPERT" },
      ],
    },
    {
      key: "capability",
      name: "能力与方法回路",
      number: "TWO",
      type: "CROSSCUTTING",
      purpose: "维护可复用的方法、人才和质量标准",
      parentKey: "root",
      roles: [
        { name: "方法负责人", purpose: "提升组织持续交付复杂问题的能力", accountabilities: "维护服务方法\n组织案例复盘\n识别能力缺口", category: "EXPERT" },
      ],
    },
  ],
  interfaces: [],
};

export const functionalTeamTemplate: OrgTemplate = {
  id: "functional-team",
  name: "传统职能型组织",
  description: "以稳定运营、职能责任和跨部门服务为基础，适合财务、人力、运营和行政等团队。",
  circles: [
    {
      key: "root",
      name: "主回路",
      number: "CUSTOM",
      type: "PRODUCTION",
      purpose: "保障组织稳定运行并持续改善关键服务",
      isRoot: true,
      roles: [{ name: "组织运营负责人", purpose: "确保组织稳定运行并持续改善", accountabilities: "维护组织主目标\n组织目标检查\n公开运营风险", category: "CIRCLE_LEAD" }],
    },
    {
      key: "operations",
      name: "运营回路",
      number: "ONE",
      type: "PRODUCTION",
      purpose: "让日常业务和内部服务可靠运行",
      parentKey: "root",
      roles: [
        { name: "运营负责人", purpose: "对职能服务的稳定性和改进负责", accountabilities: "维护职能目标\n组织每周运营复盘\n提出服务改进提案", category: "CIRCLE_LEAD" },
        { name: "运营专员", purpose: "完成可追踪的日常服务和改进工作", accountabilities: "处理服务请求\n维护运行记录\n报告异常张力", category: "OPERATIONS" },
      ],
    },
    {
      key: "improvement",
      name: "持续改进回路",
      number: "TWO",
      type: "CROSSCUTTING",
      purpose: "将重复问题转化为流程、规则和能力改进",
      parentKey: "root",
      roles: [
        { name: "改进负责人", purpose: "推动问题闭环和流程演化", accountabilities: "维护改进清单\n主持问题复盘\n跟踪改进结果", category: "EXPERT" },
      ],
    },
  ],
  interfaces: [],
};

export const allTemplates: OrgTemplate[] = [
  leanTeamTemplate,
  professionalServicesTemplate,
  functionalTeamTemplate,
  llmTeamTemplate,
];
