export type InterfaceCouplingType = "hard" | "soft" | "feedback";
export type InterfaceProtocolStatus = "draft" | "active" | "deprecated";

export type InterfaceProtocolPayload = {
  couplingType: InterfaceCouplingType;
  semanticProtocol: {
    meaning: string;
    consumptionRule: string;
    confidenceRule?: string;
  };
  structuralProtocol: {
    dataObject: string;
    requiredFields: string[];
    optionalFields: string[];
    version: string;
    sourceOfTruth: string;
  };
  governanceProtocol: {
    ownerRole: string;
    acceptanceRole: string;
    failureReturnPath: string;
    changeNotice: string;
    emergencyRule: string;
  };
};

export type InterfaceProtocol = InterfaceProtocolPayload & {
  id: string;
  enterpriseId: string;
  relationshipId: string;
  versionNumber: number;
  status: InterfaceProtocolStatus;
  changeReason?: string | null;
  createdBy: string;
  createdAt: string;
};

export function validateInterfaceProtocolPayload(payload: InterfaceProtocolPayload) {
  if (!["hard", "soft", "feedback"].includes(payload.couplingType)) throw new Error("咬合类型无效");
  if (!payload.semanticProtocol.meaning.trim()) throw new Error("语义协议必须说明对象含义");
  if (!payload.semanticProtocol.consumptionRule.trim()) throw new Error("语义协议必须说明消费规则");
  if (!payload.structuralProtocol.dataObject.trim()) throw new Error("结构协议必须说明数据对象");
  if (!payload.structuralProtocol.requiredFields.length || payload.structuralProtocol.requiredFields.some((item) => !item.trim())) {
    throw new Error("结构协议必须包含必填字段");
  }
  if (!payload.structuralProtocol.version.trim()) throw new Error("结构协议必须包含版本");
  if (!payload.structuralProtocol.sourceOfTruth.trim()) throw new Error("结构协议必须说明事实源");
  if (!payload.governanceProtocol.ownerRole.trim()) throw new Error("治理协议必须包含负责角色");
  if (!payload.governanceProtocol.acceptanceRole.trim()) throw new Error("治理协议必须包含验收角色");
  if (!payload.governanceProtocol.failureReturnPath.trim()) throw new Error("治理协议必须包含异常回传路径");
  if (!payload.governanceProtocol.changeNotice.trim()) throw new Error("治理协议必须包含变更通知规则");
  if (!payload.governanceProtocol.emergencyRule.trim()) throw new Error("治理协议必须包含紧急处理规则");
  return payload;
}

export function nextProtocolVersion(protocols: Array<Pick<InterfaceProtocol, "versionNumber">>) {
  return protocols.reduce((max, protocol) => Math.max(max, protocol.versionNumber), 0) + 1;
}

export function applyProtocolStatusTransition(
  protocols: InterfaceProtocol[],
  protocolId: string,
  nextStatus: InterfaceProtocolStatus,
): InterfaceProtocol[] {
  const protocol = protocols.find((item) => item.id === protocolId);
  if (!protocol) throw new Error("接口协议不存在");
  if (!["draft", "active", "deprecated"].includes(nextStatus)) throw new Error("接口协议状态无效");
  return protocols.map((item) => {
    if (item.id === protocolId) return { ...item, status: nextStatus };
    if (nextStatus === "active" && item.relationshipId === protocol.relationshipId && item.status === "active") {
      return { ...item, status: "deprecated" };
    }
    return item;
  });
}

export function protocolRiskLabel(protocol: Pick<InterfaceProtocol, "couplingType" | "status">) {
  if (protocol.status !== "active") return "未生效";
  if (protocol.couplingType === "hard") return "硬咬合：版本冲突会阻断下游";
  if (protocol.couplingType === "feedback") return "回灌咬合：缺反馈会削弱学习";
  return "软咬合：需关注字段缺失和人工兜底";
}
