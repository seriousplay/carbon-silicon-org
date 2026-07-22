import assert from "node:assert/strict";
import test from "node:test";
import {
  applyProtocolStatusTransition,
  nextProtocolVersion,
  protocolRiskLabel,
  validateInterfaceProtocolPayload,
  type InterfaceProtocol,
  type InterfaceProtocolPayload,
} from "./interface-protocols-core";

const payload: InterfaceProtocolPayload = {
  couplingType: "feedback",
  semanticProtocol: {
    meaning: "客户承诺版本及验收结果",
    consumptionRule: "下游只能消费已确认版本，发现字段缺失必须回传上游。",
  },
  structuralProtocol: {
    dataObject: "commitment_record",
    requiredFields: ["customerId", "promiseVersion", "acceptanceSignal"],
    optionalFields: ["riskNote"],
    version: "1.0.0",
    sourceOfTruth: "事实记录系统",
  },
  governanceProtocol: {
    ownerRole: "销售负责人",
    acceptanceRole: "交付负责人",
    failureReturnPath: "字段缺失回传销售负责人",
    changeNotice: "协议变更提前 1 个运行周期通知下游",
    emergencyRule: "高风险承诺进入人工裁决",
  },
};

test("validateInterfaceProtocolPayload accepts complete protocol", () => {
  assert.equal(validateInterfaceProtocolPayload(payload).couplingType, "feedback");
});

test("validateInterfaceProtocolPayload rejects missing required fields", () => {
  assert.throws(
    () => validateInterfaceProtocolPayload({ ...payload, structuralProtocol: { ...payload.structuralProtocol, requiredFields: [] } }),
    /必填字段/,
  );
});

test("nextProtocolVersion increments relationship version", () => {
  assert.equal(nextProtocolVersion([{ versionNumber: 1 }, { versionNumber: 3 }]), 4);
});

test("activating one protocol deprecates previous active protocol on same relationship", () => {
  const protocols = [
    protocol("protocol-1", "relationship-1", 1, "active"),
    protocol("protocol-2", "relationship-1", 2, "draft"),
    protocol("protocol-3", "relationship-2", 1, "active"),
  ];
  const next = applyProtocolStatusTransition(protocols, "protocol-2", "active");
  assert.equal(next.find((item) => item.id === "protocol-1")?.status, "deprecated");
  assert.equal(next.find((item) => item.id === "protocol-2")?.status, "active");
  assert.equal(next.find((item) => item.id === "protocol-3")?.status, "active");
});

test("protocolRiskLabel distinguishes coupling types", () => {
  assert.match(protocolRiskLabel(protocol("protocol-1", "relationship-1", 1, "active", "hard")), /硬咬合/);
  assert.equal(protocolRiskLabel(protocol("protocol-2", "relationship-1", 2, "draft", "soft")), "未生效");
});

function protocol(
  id: string,
  relationshipId: string,
  versionNumber: number,
  status: InterfaceProtocol["status"],
  couplingType: InterfaceProtocol["couplingType"] = "feedback",
): InterfaceProtocol {
  return {
    id,
    enterpriseId: "enterprise-1",
    relationshipId,
    versionNumber,
    status,
    couplingType,
    semanticProtocol: payload.semanticProtocol,
    structuralProtocol: payload.structuralProtocol,
    governanceProtocol: payload.governanceProtocol,
    createdBy: "user-1",
    createdAt: "2026-07-01T00:00:00.000Z",
  };
}
