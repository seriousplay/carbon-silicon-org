/**
 * 冲突升级状态机单元测试
 * 基于 docs/05-冲突升级状态机.md
 *
 * 运行: node --test src/lib/__tests__/statemachine.test.ts
 * （或 pnpm test）
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  canTransition,
  transition,
  isActive,
  isEscalated,
  detectEscalation,
  isOverdue,
  shouldEscalateToGovernance,
} from "../statemachine";

describe("状态转移合法性", () => {
  test("OPEN → ASSIGNED 合法", () => {
    assert.equal(canTransition("OPEN", "ASSIGNED"), true);
    assert.equal(transition("OPEN", "ASSIGNED"), "ASSIGNED");
  });

  test("OPEN → RESOLVED 非法（需先指派）", () => {
    assert.equal(canTransition("OPEN", "RESOLVED"), false);
    assert.throws(() => transition("OPEN", "RESOLVED"));
  });

  test("BLOCKED → ESCALATED_L2 合法", () => {
    assert.equal(canTransition("BLOCKED", "ESCALATED_L2"), true);
  });

  test("降级路径: ESCALATED_L3 → IN_PROGRESS 合法", () => {
    assert.equal(canTransition("ESCALATED_L3", "IN_PROGRESS"), true);
  });

  test("RESOLVED 是终态，不能再转移", () => {
    assert.equal(canTransition("RESOLVED", "IN_PROGRESS"), false);
    assert.equal(canTransition("RESOLVED", "OPEN"), false);
  });
});

describe("状态判断", () => {
  test("isActive: 活跃状态", () => {
    assert.equal(isActive("OPEN"), true);
    assert.equal(isActive("IN_PROGRESS"), true);
    assert.equal(isActive("BLOCKED"), true);
    assert.equal(isActive("ESCALATED_L3"), true);
  });

  test("isActive: 终态", () => {
    assert.equal(isActive("RESOLVED"), false);
    assert.equal(isActive("REJECTED"), false);
  });

  test("isEscalated", () => {
    assert.equal(isEscalated("ESCALATED_L2"), true);
    assert.equal(isEscalated("ESCALATED_L4"), true);
    assert.equal(isEscalated("BLOCKED"), false);
  });
});

describe("升级信号检测", () => {
  test("L0.5 紧急路径: 生产故障 + BLOCKED → 自动升级", () => {
    const signal = detectEscalation({
      status: "BLOCKED",
      isProduction: true,
    });
    assert.equal(signal?.toStatus, "ESCALATED_L0_5");
    assert.equal(signal?.level, "L0_5");
    assert.equal(signal?.auto, true);
  });

  test("L2: BLOCKED + 超 SLA 24h → 自动升级", () => {
    const signal = detectEscalation({
      status: "BLOCKED",
      slaOverdueHours: 36,
    });
    assert.equal(signal?.toStatus, "ESCALATED_L2");
    assert.equal(signal?.auto, true);
  });

  test("L2: BLOCKED 但未超 SLA → 不升级", () => {
    const signal = detectEscalation({
      status: "BLOCKED",
      slaOverdueHours: 10,
    });
    assert.equal(signal, null);
  });

  test("L3: L2 升级后 48h 未解决 → 自动升级", () => {
    const signal = detectEscalation({
      status: "ESCALATED_L2",
      escalatedAt: new Date(Date.now() - 50 * 3600000), // 50h 前
    });
    assert.equal(signal?.toStatus, "ESCALATED_L3");
    assert.equal(signal?.auto, true);
  });

  test("L3 系统性: 同类月内≥3次 → 半自动（需人类确认）", () => {
    const signal = detectEscalation({
      status: "IN_PROGRESS",
      similarCountThisMonth: 3,
    });
    assert.equal(signal?.toStatus, "ESCALATED_L3");
    assert.equal(signal?.auto, false);
  });

  test("同类仅2次 → 不升级", () => {
    const signal = detectEscalation({
      status: "IN_PROGRESS",
      similarCountThisMonth: 2,
    });
    assert.equal(signal, null);
  });

  test("已 RESOLVED 的不再检测升级", () => {
    const signal = detectEscalation({
      status: "RESOLVED",
      slaOverdueHours: 100,
      similarCountThisMonth: 5,
    });
    assert.equal(signal, null);
  });
});

describe("SLA 超时检测", () => {
  test("48h 前更新 + 活跃 → 超时", () => {
    const oldDate = new Date(Date.now() - 50 * 3600000);
    assert.equal(isOverdue(oldDate, "IN_PROGRESS"), true);
  });

  test("已闭环 → 不超时", () => {
    const oldDate = new Date(Date.now() - 100 * 3600000);
    assert.equal(isOverdue(oldDate, "RESOLVED"), false);
  });
});

describe("连续未闭环", () => {
  test("≥2 次 → 建议升级治理会", () => {
    assert.equal(shouldEscalateToGovernance(2), true);
    assert.equal(shouldEscalateToGovernance(3), true);
  });

  test("<2 次 → 不升级", () => {
    assert.equal(shouldEscalateToGovernance(0), false);
    assert.equal(shouldEscalateToGovernance(1), false);
  });
});
