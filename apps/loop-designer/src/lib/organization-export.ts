import type { AgentRole, OrganizationInterface, OrganizationMap, SystemRole } from "./plan-schema";

type EnhancedOrganizationMap = OrganizationMap & Required<Pick<
  OrganizationMap,
  "humanRoles" | "agentRoles" | "systemRoles" | "interfaces" | "assignmentChecklist" | "launchReadiness"
>>;
export type OrganizationRelationKind = "interface" | "supervision" | "service" | "system";
export type OrganizationRelation = {
  id: string;
  sourceId: string;
  targetId: string;
  kind: OrganizationRelationKind;
  label: string;
  detail: string;
  interface?: OrganizationInterface;
};

export function hasEnhancedOrganization(organization: OrganizationMap): organization is EnhancedOrganizationMap {
  return Boolean(
    organization.humanRoles?.length &&
    organization.agentRoles?.length &&
    organization.systemRoles?.length &&
    organization.interfaces?.length &&
    organization.assignmentChecklist?.length &&
    organization.launchReadiness,
  );
}

export function organizationRelationKindLabel(kind: OrganizationRelationKind) {
  if (kind === "interface") return "接口";
  if (kind === "supervision") return "人工";
  if (kind === "service") return "服务";
  return "系统支持";
}

export function getOrganizationRelations(organization: OrganizationMap): OrganizationRelation[] {
  if (!hasEnhancedOrganization(organization)) return [];
  return [
    ...organization.interfaces.map((item) => ({
      id: item.id,
      sourceId: item.sourceId,
      targetId: item.targetId,
      kind: "interface" as const,
      label: item.name,
      detail: `${item.interfaceType} / ${item.riskLevel}`,
      interface: item,
    })),
    ...organization.agentRoles.flatMap((agent) => [
      {
        id: `supervision-${agent.id}-${agent.supervisorRoleId}`,
        sourceId: agent.supervisorRoleId,
        targetId: agent.id,
        kind: "supervision" as const,
        label: "人工监督",
        detail: "监督授权边界、异常接管和停用条件",
      },
      ...agent.serves.map((roleId) => ({
        id: `service-${agent.id}-${roleId}`,
        sourceId: agent.id,
        targetId: roleId,
        kind: "service" as const,
        label: "服务对象",
        detail: "智能体为该角色提供任务执行、建议生成或信息整理支持",
      })),
    ]),
    ...buildAgentSystemRelations(organization.agentRoles, organization.systemRoles, organization.interfaces),
  ];
}

export function renderOrganizationSvg(organization: OrganizationMap) {
  if (!hasEnhancedOrganization(organization)) return "";
  const groups = [
    { type: "human", label: "人类角色", color: "#168f86", items: organization.humanRoles ?? [] },
    { type: "agent", label: "智能体角色", color: "#6a9f12", items: organization.agentRoles ?? [] },
    { type: "system", label: "系统角色", color: "#d95f36", items: organization.systemRoles ?? [] },
  ];
  const columnX = [30, 300, 570];
  const positions = new Map<string, { x: number; y: number }>();
  groups.forEach((group, groupIndex) =>
    group.items.forEach((item, index) => positions.set(item.id, { x: columnX[groupIndex], y: 70 + index * 86 })),
  );
  const height = Math.max(360, ...groups.map((group) => 115 + group.items.length * 86));
  const relations = getOrganizationRelations(organization);
  const edges = relations.map((item, index) => {
    const source = positions.get(item.sourceId);
    const target = positions.get(item.targetId);
    if (!source || !target) return "";
    const geometry = edgeGeometry(source, target, index);
    const color = relationColor(item);
    const dash = relationDash(item);
    const label = truncate(item.label, 10);
    const labelWidth = Math.max(54, Math.min(120, Array.from(label).length * 10 + 18));
    return `<g>
      <path d="${geometry.path}" fill="none" stroke="${color}" stroke-width="2" ${dash} marker-end="url(#org-arrow)"/>
      <rect x="${geometry.labelX - labelWidth / 2}" y="${geometry.labelY - 9}" width="${labelWidth}" height="18" rx="3" fill="#ffffff" stroke="${color}" stroke-opacity=".75"/>
      <text x="${geometry.labelX}" y="${geometry.labelY + 3}" text-anchor="middle" font-size="8" font-weight="700" fill="#17211e">${escapeXml(label)}</text>
    </g>`;
  }).join("");
  const nodes = groups.flatMap((group, groupIndex) =>
    group.items.map((item, index) => {
      const x = columnX[groupIndex];
      const y = 70 + index * 86;
      return `<g transform="translate(${x} ${y})">
        <rect width="210" height="56" rx="2" fill="#f7faf8" stroke="${group.color}" stroke-width="1.5"/>
        <rect width="5" height="56" fill="${group.color}"/>
        <text x="16" y="23" font-size="13" font-weight="700" fill="#17211e">${escapeXml(truncate(item.name, 16))}</text>
        <text x="16" y="42" font-size="9" fill="#64716b">${escapeXml(truncate(item.mission, 30))}</text>
      </g>`;
    }),
  ).join("");
  const headers = groups.map((group, index) =>
    `<text x="${columnX[index]}" y="30" font-size="10" font-weight="700" fill="${group.color}" letter-spacing="1.5">${group.label}</text>
     <line x1="${columnX[index]}" y1="42" x2="${columnX[index] + 210}" y2="42" stroke="${group.color}" stroke-opacity=".35"/>`,
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 810 ${height}" width="100%" role="img" aria-label="人机协作拓扑图">
    <defs><marker id="org-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#89958f"/></marker></defs>
    <rect width="810" height="${height}" fill="#ffffff"/>
    ${headers}${edges}${nodes}
  </svg>`;
}

export function renderOrganizationPdfHtml(organization: OrganizationMap) {
  if (!hasEnhancedOrganization(organization)) return "";
  const names = new Map([
    ...(organization.humanRoles ?? []).map((role) => [role.id, role.name] as const),
    ...(organization.agentRoles ?? []).map((role) => [role.id, role.name] as const),
    ...(organization.systemRoles ?? []).map((role) => [role.id, role.name] as const),
  ]);
  const name = (id: string) => names.get(id) ?? id;
  const relations = getOrganizationRelations(organization);
  const relationRows = relations.map((item) => `
    <tr>
      <td>${escapeXml(organizationRelationKindLabel(item.kind))}</td>
      <td>${escapeXml(`${name(item.sourceId)} → ${name(item.targetId)}`)}</td>
      <td>${escapeXml(item.label)}</td>
      <td>${escapeXml(item.detail)}</td>
    </tr>`).join("");
  const cards = [
    ...(organization.humanRoles ?? []).map((role) => card("人类角色", "#168f86", role.name, role.status, role.mission, [
      ["职责", role.responsibilities.join("；")],
      ["决策权", role.decisionRights.join("；")],
      ["SLA", role.serviceLevel],
      ["异常接管", role.exceptionOwnership],
    ])),
    ...(organization.agentRoles ?? []).map((role) => card("智能体角色", "#6a9f12", role.name, role.status, role.mission, [
      ["自主等级", role.autonomyLevel],
      ["任务", role.tasks.join("；")],
      ["监督角色", name(role.supervisorRoleId)],
      ["失败降级", role.fallback],
    ])),
    ...(organization.systemRoles ?? []).map((role) => card("系统角色", "#d95f36", role.name, role.status, role.mission, [
      ["业务对象", role.businessObjects.join("；")],
      ["事实记录", role.records.join("；")],
      ["集成", role.integrationMode],
      ["人工替代", role.manualFallback],
    ])),
  ].join("");
  const interfaces = (organization.interfaces ?? []).map((item) => `
    <tr>
      <td>${escapeXml(item.name)}</td>
      <td>${escapeXml(`${name(item.sourceId)} → ${name(item.targetId)}`)}</td>
      <td>${escapeXml(`${item.interfaceType} / ${item.riskLevel}`)}</td>
      <td>${escapeXml(item.handoffObject)}</td>
      <td>${escapeXml(item.serviceLevel)}</td>
      <td>${escapeXml(`${item.protocol}；${item.dataObject}；${item.authorization}`)}</td>
      <td>${escapeXml(item.humanFallback)}</td>
    </tr>`).join("");
  const assignments = (organization.assignmentChecklist ?? []).map((item) => `
    <tr><td>${escapeXml(name(item.roleId))}</td><td>${escapeXml(item.suggestedCount)}</td><td>${escapeXml(item.requiredPermissions.join("；"))}</td><td>${escapeXml(item.dueBy)}</td><td>${escapeXml(item.status)}</td></tr>`).join("");
  return `
    <section class="org-detail">
      <h2>角色拓扑明细</h2><div class="role-grid">${cards}</div>
      <h2>关系属性矩阵</h2>
      <table><thead><tr><th>属性</th><th>来源 → 目标</th><th>标签</th><th>说明</th></tr></thead><tbody>${relationRows}</tbody></table>
      <h2>接口矩阵</h2>
      <table><thead><tr><th>接口</th><th>来源 → 目标</th><th>类型 / 风险</th><th>交接对象</th><th>SLA</th><th>技术契约</th><th>人工兜底</th></tr></thead><tbody>${interfaces}</tbody></table>
      <h2>待指派清单</h2>
      <table><thead><tr><th>角色</th><th>人数</th><th>权限</th><th>截止</th><th>状态</th></tr></thead><tbody>${assignments}</tbody></table>
    </section>`;
}

function card(type: string, color: string, name: string, status: string, mission: string, rows: Array<[string, string]>) {
  return `<article class="role-card" style="border-top-color:${color}">
    <small style="color:${color}">${escapeXml(type)} · ${escapeXml(status)}</small>
    <h3>${escapeXml(name)}</h3><p>${escapeXml(mission)}</p>
    ${rows.map(([label, value]) => `<div><b>${escapeXml(label)}</b>${escapeXml(value)}</div>`).join("")}
  </article>`;
}

function buildAgentSystemRelations(
  agents: AgentRole[],
  systems: SystemRole[],
  interfaces: OrganizationInterface[],
): OrganizationRelation[] {
  const interfacePairs = new Set(interfaces.map((item) => pairKey(item.sourceId, item.targetId)));
  return agents.flatMap((agent) =>
    systems.flatMap((system) => {
      if (interfacePairs.has(pairKey(agent.id, system.id))) return [];
      if (!agentUsesSystem(agent, system)) return [];
      return [{
        id: `system-${agent.id}-${system.id}`,
        sourceId: agent.id,
        targetId: system.id,
        kind: "system" as const,
        label: "系统支持",
        detail: "智能体需要该系统提供工具、上下文、事实记录或数据流转支撑",
      }];
    }),
  );
}

function agentUsesSystem(agent: AgentRole, system: SystemRole) {
  const agentTerms = [
    ...agent.tools,
    ...agent.contextSources,
    ...agent.readableData,
    ...agent.outputs,
  ];
  const systemTerms = [
    system.name,
    ...system.businessObjects,
    ...system.records,
    ...system.capabilities,
    ...system.inputs,
    ...system.outputs,
  ];
  return agentTerms.some((agentTerm) =>
    systemTerms.some((systemTerm) => hasMeaningfulOverlap(agentTerm, systemTerm)),
  );
}

function pairKey(sourceId: string, targetId: string) {
  return `${sourceId}->${targetId}`;
}

function hasMeaningfulOverlap(left: string, right: string) {
  const leftTerm = normalizeRelationTerm(left);
  const rightTerm = normalizeRelationTerm(right);
  if (!isUsefulRelationTerm(leftTerm) || !isUsefulRelationTerm(rightTerm)) return false;
  if (leftTerm.includes(rightTerm) || rightTerm.includes(leftTerm)) {
    return Math.min(leftTerm.length, rightTerm.length) >= 3;
  }
  return longestCommonSubstringLength(leftTerm, rightTerm) >= 3;
}

function normalizeRelationTerm(value: string) {
  return value
    .toLowerCase()
    .replace(/待技术确认/g, "")
    .replace(/[\s,，.。:：;；/\\|()[\]{}（）《》“”"'`·-]/g, "");
}

function isUsefulRelationTerm(value: string) {
  if (value.length < 3) return false;
  return !["待确认", "数据", "系统", "记录", "输出", "输入", "保存", "检索", "审计", "同步", "建议"].includes(value);
}

function longestCommonSubstringLength(left: string, right: string) {
  let longest = 0;
  const previous = Array(right.length + 1).fill(0) as number[];
  const current = Array(right.length + 1).fill(0) as number[];
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      if (left[leftIndex - 1] === right[rightIndex - 1]) {
        current[rightIndex] = previous[rightIndex - 1] + 1;
        longest = Math.max(longest, current[rightIndex]);
      } else {
        current[rightIndex] = 0;
      }
    }
    for (let index = 1; index < current.length; index += 1) {
      previous[index] = current[index];
      current[index] = 0;
    }
  }
  return longest;
}

function edgeGeometry(source: { x: number; y: number }, target: { x: number; y: number }, index: number) {
  const nodeWidth = 210;
  const midpointOffset = (index % 4) * 8;
  const sy = source.y + 28;
  const ty = target.y + 28;
  if (source.x === target.x) {
    const sx = source.x + nodeWidth;
    const tx = target.x + nodeWidth;
    const laneX = Math.min(source.x + nodeWidth + 34 + midpointOffset, 800);
    return {
      path: `M${sx} ${sy} C${laneX} ${sy},${laneX} ${ty},${tx} ${ty}`,
      labelX: laneX,
      labelY: (sy + ty) / 2,
    };
  }
  if (source.x < target.x) {
    const sx = source.x + nodeWidth;
    const tx = target.x;
    const control = 48 + midpointOffset;
    return {
      path: `M${sx} ${sy} C${sx + control} ${sy},${tx - control} ${ty},${tx} ${ty}`,
      labelX: (sx + tx) / 2,
      labelY: (sy + ty) / 2 - 7 + midpointOffset / 4,
    };
  }
  const sx = source.x;
  const tx = target.x + nodeWidth;
  const control = 48 + midpointOffset;
  return {
    path: `M${sx} ${sy} C${sx - control} ${sy},${tx + control} ${ty},${tx} ${ty}`,
    labelX: (sx + tx) / 2,
    labelY: (sy + ty) / 2 + 7 + midpointOffset / 4,
  };
}

function relationColor(relation: OrganizationRelation) {
  if (relation.kind === "supervision") return "#168f86";
  if (relation.kind === "service") return "#6a9f12";
  if (relation.kind === "system") return "#d95f36";
  if (relation.interface?.riskLevel === "高风险") return "#d94f2b";
  if (relation.interface?.riskLevel === "HITL") return "#b37a00";
  return "#89958f";
}

function relationDash(relation: OrganizationRelation) {
  if (relation.kind === "supervision") return `stroke-dasharray="3 4"`;
  if (relation.kind === "service") return `stroke-dasharray="2 5"`;
  if (relation.kind === "system") return `stroke-dasharray="6 4"`;
  return relation.interface && ["API", "事件", "批处理", "智能体调用"].includes(relation.interface.interfaceType) ? `stroke-dasharray="6 4"` : "";
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] ?? char);
}

function truncate(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}
