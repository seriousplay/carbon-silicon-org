/**
 * 冲突升级状态机
 *
 * 基于 docs/05-冲突升级状态机.md
 * - 完整状态枚举（10 状态）
 * - 转移条件量化
 * - 降级路径
 * - 自动化诚实边界：自动检测信号 + 半自动推荐升级
 */
import type { BlockerStatus, ConflictLevel } from "@/generated/prisma/client";

// ─── 状态枚举 ──────────────────────────────────────────────
export const BLOCKER_STATUSES = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "BLOCKED",
  "ESCALATED_L0_5",
  "ESCALATED_L2",
  "ESCALATED_L3",
  "ESCALATED_L4",
  "RESOLVED",
  "REJECTED",
] as const;

// ─── 转移表（哪些状态可以转到哪些状态）─────────────────────
const TRANSITIONS: Record<BlockerStatus, BlockerStatus[]> = {
  OPEN: ["ASSIGNED", "REJECTED"],
  ASSIGNED: ["IN_PROGRESS", "BLOCKED", "RESOLVED", "OPEN"],
  IN_PROGRESS: ["BLOCKED", "RESOLVED"],
  BLOCKED: ["IN_PROGRESS", "ESCALATED_L0_5", "ESCALATED_L2", "ESCALATED_L3"],
  ESCALATED_L0_5: ["IN_PROGRESS", "ESCALATED_L3", "RESOLVED"],
  ESCALATED_L2: ["IN_PROGRESS", "ESCALATED_L3", "RESOLVED"],
  ESCALATED_L3: ["IN_PROGRESS", "RESOLVED", "ESCALATED_L4"],
  ESCALATED_L4: ["RESOLVED", "ESCALATED_L3"],
  RESOLVED: [],
  REJECTED: [],
};

/** 校验状态转移是否合法 */
export function canTransition(from: BlockerStatus, to: BlockerStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** 执行状态转移，非法时抛错 */
export function transition(from: BlockerStatus, to: BlockerStatus): BlockerStatus {
  if (!canTransition(from, to)) {
    throw new Error(`非法状态转移: ${from} → ${to}`);
  }
  return to;
}

/** 判断是否为活跃状态（未闭环）*/
export function isActive(status: BlockerStatus): boolean {
  return !["RESOLVED", "REJECTED"].includes(status);
}

/** 判断是否为升级状态 */
export function isEscalated(status: BlockerStatus): boolean {
  return status.startsWith("ESCALATED");
}

// ─── 升级信号检测（自动）──────────────────────────────────
export type EscalationInput = {
  status: BlockerStatus;
  slaOverdueHours?: number; // 超过 SLA 多少小时
  escalatedAt?: Date; // 当前升级开始时间
  hoursSinceUpdate?: number; // 距上次更新小时数
  similarCountThisMonth?: number; // 本月同类出现次数
  isProduction?: boolean; // 是否生产故障
};

export type EscalationSignal = {
  toStatus: BlockerStatus;
  level: ConflictLevel;
  reason: string;
  auto: boolean; // true=自动触发, false=需人类确认
};

/**
 * 检测升级信号
 *
 * 自动化的部分（返回 auto:true）：定时器、计数器
 * 半自动的部分（返回 auto:false）：语义判断需人类确认
 */
export function detectEscalation(input: EscalationInput): EscalationSignal | null {
  const {
    status,
    slaOverdueHours = 0,
    escalatedAt,
    hoursSinceUpdate = 0,
    similarCountThisMonth = 0,
    isProduction = false,
  } = input;

  // L0.5 紧急路径：生产故障 + 当前已 BLOCKED
  if (isProduction && status === "BLOCKED") {
    return {
      toStatus: "ESCALATED_L0_5",
      level: "L0_5",
      reason: "生产故障，启动 30min 紧急响应",
      auto: true,
    };
  }

  // L2：BLOCKED 状态 + 接口超 SLA 24h
  if (status === "BLOCKED" && slaOverdueHours > 24) {
    return {
      toStatus: "ESCALATED_L2",
      level: "L2",
      reason: `回路间接口超 SLA ${slaOverdueHours}h`,
      auto: true,
    };
  }

  // L3：L2 升级后 48h 未解决
  if (status === "ESCALATED_L2" && escalatedAt) {
    const hoursSinceEscalation = (Date.now() - escalatedAt.getTime()) / 3600000;
    if (hoursSinceEscalation > 48) {
      return {
        toStatus: "ESCALATED_L3",
        level: "L3",
        reason: "L2 升级后 48h 未解决，进入治理流程",
        auto: true,
      };
    }
  }

  // L3（系统性）：同类张力月内 ≥3 次
  if (similarCountThisMonth >= 3 && !isEscalated(status) && isActive(status)) {
    return {
      toStatus: "ESCALATED_L3",
      level: "L3",
      reason: `同类问题本月出现 ${similarCountThisMonth} 次，标记为系统性`,
      auto: false, // 系统性判断需人类确认
    };
  }

  // 48h 无动静（仅标记，不自动升级状态）
  if (hoursSinceUpdate > 48 && isActive(status) && status !== "BLOCKED") {
    // 返回标记信号但不强制升级——由通知子系统提醒
    return null;
  }

  return null;
}

// ─── SLA 超时检测 ──────────────────────────────────────────
/** 判断阻塞点是否超过 SLA（默认 48h）无更新 */
export function isOverdue(
  lastUpdatedAt: Date,
  status: BlockerStatus,
  thresholdHours = 48
): boolean {
  if (!isActive(status)) return false;
  const hoursSince = (Date.now() - lastUpdatedAt.getTime()) / 3600000;
  return hoursSince > thresholdHours;
}

// ─── 连续未闭环计数 ────────────────────────────────────────
/** 连续未闭环次数 ≥2 → 建议升级到治理会 */
export function shouldEscalateToGovernance(consecutiveMissed: number): boolean {
  return consecutiveMissed >= 2;
}
