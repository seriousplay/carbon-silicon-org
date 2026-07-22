/**
 * 状态映射常量库
 *
 * 集中管理所有枚举的中文标签、图标、颜色映射。
 * 所有列表/看板/详情页都从这里取，避免 magic string 散落。
 * 基于 docs/01 数据模型 + docs/05 冲突升级状态机
 */

// ─── 阻塞点状态（10 个状态，对应 docs/05 状态机）─────────────
export const blockerStatusMap = {
  OPEN: { label: "待萌芽", desc: "已提出，等待指派", badge: "seed", icon: "○" },
  ASSIGNED: { label: "已认领", desc: "已有负责人", badge: "seed", icon: "◔" },
  IN_PROGRESS: { label: "生长中", desc: "处理中", badge: "growing", icon: "◐" },
  BLOCKED: { label: "受阻", desc: "被外部依赖阻塞", badge: "needs-light", icon: "◑" },
  ESCALATED_L0_5: { label: "紧急", desc: "生产故障，30min 响应", badge: "urgent", icon: "⚠" },
  ESCALATED_L2: { label: "接口升级", desc: "回路间接口冲突", badge: "needs-light", icon: "⇄" },
  ESCALATED_L3: { label: "治理升级", desc: "治理流程/决策者介入", badge: "needs-light", icon: "◇" },
  ESCALATED_L4: { label: "战略升级", desc: "战略级冲突", badge: "needs-light", icon: "★" },
  RESOLVED: { label: "已成熟", desc: "已闭环", badge: "mature", icon: "●" },
  REJECTED: { label: "已舍弃", desc: "不成立或重复", badge: "mature", icon: "×" },
} as const;

// ─── 张力类型 ────────────────────────────────────────────
export const tensionTypeMap = {
  PROBLEMATIC: { label: "问题性", desc: "某事卡住了", color: "needs-light" },
  CONSTRUCTIVE: { label: "建设性", desc: "有更好的做法", color: "growing" },
  CLARIFYING: { label: "澄清性", desc: "角色边界不清", color: "seed" },
} as const;

// ─── 冲突等级（L0-L4）──────────────────────────────────
export const conflictLevelMap = {
  L0: { label: "L0 · 人际", desc: "关系层，不可跳过" },
  L0_5: { label: "L0.5 · 紧急", desc: "生产故障 30min" },
  L1: { label: "L1 · 回路内", desc: "战术会当场到人" },
  L2: { label: "L2 · 接口", desc: "回路间接口冲突" },
  L3: { label: "L3 · 治理", desc: "治理流程/决策者" },
  L4: { label: "L4 · 战略", desc: "战略级冲突" },
} as const;

// ─── 回路类型 ────────────────────────────────────────────
export const circleTypeMap = {
  STRATEGY: { label: "战略", desc: "决定做什么", color: "moss" },
  PRODUCTION: { label: "生产", desc: "核心生产回路", color: "growing" },
  INFRA: { label: "基座", desc: "为其他回路提供基础", color: "seed" },
  CROSSCUTTING: { label: "横切", desc: "跨回路服务", color: "mature" },
} as const;

// ─── 回路编号 ────────────────────────────────────────────
export const circleNumberMap = {
  ZERO: { label: "回路零", short: "战略回路" },
  ONE: { label: "回路一", short: "数据与分词" },
  TWO: { label: "回路二", short: "预训练" },
  THREE: { label: "回路三", short: "后训练" },
  FOUR: { label: "回路四", short: "工程基座" },
  CUSTOM: { label: "自定义", short: "自定义" },
} as const;

// ─── 回路状态 ────────────────────────────────────────────
export const circleStatusMap = {
  NORMAL: { label: "正常", badge: "growing", icon: "●" },
  WARNING: { label: "预警", badge: "needs-light", icon: "◑" },
  HALTED: { label: "停摆", badge: "urgent", icon: "■" },
  ARCHIVED: { label: "归档", badge: "mature", icon: "—" },
} as const;

// ─── 归属确认卡状态 ──────────────────────────────────────
export const cardStatusMap = {
  UNSIGNED: { label: "未签", badge: "urgent" },
  SIGNED: { label: "已签", badge: "growing" },
  STRESS_TESTED: { label: "已压力测试", badge: "mature" },
} as const;

// ─── 角色类型 ────────────────────────────────────────────
export const roleCategoryMap = {
  CIRCLE_LEAD: { label: "回路负责人", desc: "为回路目标负全责" },
  EXPERT: { label: "核心专家", desc: "关键技术贡献者" },
  OPERATIONS: { label: "运营", desc: "流程和协调" },
  COACH: { label: "教练", desc: "不碰权力只建系统" },
} as const;

// ─── 角色归属类型 ────────────────────────────────────────
export const roleOwnershipMap = {
  HOME: { label: "主归属", desc: "承担人的主归属回路内" },
  SUPPORT: { label: "跨回路支援", desc: "需契约，防双线守护" },
  CROSSCUTTING: { label: "横切", desc: "360 度评估" },
} as const;
