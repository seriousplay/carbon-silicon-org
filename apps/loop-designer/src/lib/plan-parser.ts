import { loopPlanSchema } from "./plan-schema";
import { withMaturityMapping } from "./maturity";

type ParsePlanOptions = {
  repairOrganizationReferences?: boolean;
};

function normalizeRoutedModelOutput(value: unknown, options: ParsePlanOptions) {
  if (!value || typeof value !== "object") return value;
  const plan = value as Record<string, unknown>;
  delete plan.maturityMapping;
  if (options.repairOrganizationReferences) repairOrganizationReferences(plan);
  const governance = plan.governance;
  if (!governance || typeof governance !== "object") return value;
  const normalizedGovernance = governance as Record<string, unknown>;
  if (!Array.isArray(normalizedGovernance.kpis)) return value;

  normalizedGovernance.kpis = normalizedGovernance.kpis.map((kpi) =>
    typeof kpi === "string"
      ? {
          name: kpi,
          current: "待建立基线",
          target: kpi,
          cadence: "每周复盘",
        }
      : kpi,
  );
  return value;
}

function repairOrganizationReferences(plan: Record<string, unknown>) {
  const organization = asRecord(plan.organizationMap);
  if (!organization) return;
  const humanRoles = asRecordArray(organization.humanRoles);
  const agentRoles = asRecordArray(organization.agentRoles);
  const systemRoles = asRecordArray(organization.systemRoles);
  const humanIds = roleIds(humanRoles);
  const agentIds = roleIds(agentRoles);
  const systemIds = roleIds(systemRoles);
  const humanIdSet = new Set(humanIds);
  const roleIdSet = new Set([...humanIds, ...agentIds]);
  const nodeIdSet = new Set([...humanIds, ...agentIds, ...systemIds]);
  if (!humanIds.length || !nodeIdSet.size) return;

  const firstHuman = humanIds[0];
  const firstAgent = agentIds[0] ?? firstHuman;
  const firstSystem = systemIds[0] ?? firstHuman;

  fillRequiredArrays(humanRoles, ["responsibilityScope", "responsibilities", "exclusions", "decisionRights", "approvalRights", "vetoRights", "inputs", "outputs", "capabilities"]);
  fillRequiredArrays(agentRoles, ["serves", "responsibilityScope", "tasks", "readableData", "tools", "outputs", "allowedActions", "approvalRequiredActions", "prohibitedActions", "hitlTriggers", "contextSources", "auditRequirements"]);
  fillRequiredArrays(systemRoles, ["responsibilityScope", "businessObjects", "records", "capabilities", "inputs", "outputs", "constraints"]);

  for (const role of agentRoles) {
    role.supervisorRoleId = validOrFallback(role.supervisorRoleId, humanIdSet, firstHuman, humanRoles);
    if (Array.isArray(role.serves)) {
      role.serves = uniqueStrings(role.serves.map((item) => validOrFallback(item, humanIdSet, firstHuman, humanRoles)));
    }
  }

  for (const item of asRecordArray(organization.interfaces)) {
    fillRequiredArrays([item], ["requiredInputs", "expectedOutputs", "acceptanceCriteria", "failureModes", "minimumFields"]);
    const source = stringValue(item.sourceId);
    const target = stringValue(item.targetId);
    const responsible = stringValue(item.responsibleRoleId);
    const acceptance = stringValue(item.acceptanceRoleId);

    if (!nodeIdSet.has(source)) {
      const resolvedResponsible = resolveAllowedId(responsible, roleIdSet, [...agentRoles, ...humanRoles]);
      item.sourceId = resolvedResponsible || findRoleId(source, [...agentRoles, ...humanRoles, ...systemRoles], firstAgent);
    }
    if (!nodeIdSet.has(target)) {
      item.targetId = resolveAllowedId(target, nodeIdSet, [...systemRoles, ...humanRoles, ...agentRoles]) || firstSystem;
    }
    if (item.sourceId === item.targetId && systemIds.length) item.targetId = firstSystem;
    if (!roleIdSet.has(responsible)) {
      const sourceId = stringValue(item.sourceId);
      item.responsibleRoleId = resolveAllowedId(responsible, roleIdSet, [...agentRoles, ...humanRoles])
        || (roleIdSet.has(sourceId) ? sourceId : firstAgent);
    }
    if (!humanIdSet.has(acceptance)) {
      item.acceptanceRoleId = validOrFallback(acceptance, humanIdSet, firstHuman, humanRoles);
    }
  }

  for (const item of asRecordArray(organization.assignmentChecklist)) {
    fillRequiredArrays([item], ["requiredPermissions", "readinessConditions"]);
    item.roleId = validOrFallback(item.roleId, roleIdSet, firstHuman, [...humanRoles, ...agentRoles]);
  }

  const launchReadiness = asRecord(organization.launchReadiness);
  for (const item of asRecordArray(launchReadiness?.checklist)) {
    item.ownerRoleId = validOrFallback(item.ownerRoleId, roleIdSet, firstHuman, [...humanRoles, ...agentRoles]);
  }
  for (const item of asRecordArray(launchReadiness?.firstWeekCadence)) {
    item.ownerRoleId = validOrFallback(item.ownerRoleId, roleIdSet, firstHuman, [...humanRoles, ...agentRoles]);
  }
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function asRecordArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
}

function roleIds(roles: Array<Record<string, unknown>>) {
  return roles.map((role) => stringValue(role.id)).filter(Boolean);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function fillRequiredArrays(records: Array<Record<string, unknown>>, fields: string[]) {
  for (const record of records) {
    for (const field of fields) {
      if (!Array.isArray(record[field]) || !(record[field] as unknown[]).some((item) => stringValue(item))) {
        record[field] = ["待确认"];
      }
    }
  }
}

function validOrFallback(value: unknown, allowed: Set<string>, fallback: string, roles: Array<Record<string, unknown>>) {
  const id = stringValue(value);
  return resolveAllowedId(id, allowed, roles) || fallback;
}

function resolveAllowedId(value: unknown, allowed: Set<string>, roles: Array<Record<string, unknown>>) {
  const id = stringValue(value);
  if (allowed.has(id)) return id;
  for (const candidate of splitReferenceCandidates(id)) {
    if (allowed.has(candidate)) return candidate;
  }
  const matched = findRoleId(id, roles, "");
  return allowed.has(matched) ? matched : "";
}

function splitReferenceCandidates(value: string) {
  return uniqueStrings(
    value
      .split(/(?:或|和|[,，、/|;；\s]+)/g)
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function findRoleId(value: string, roles: Array<Record<string, unknown>>, fallback: string) {
  const raw = value.toLowerCase();
  const tokens = raw
    .split(/[^a-z0-9\u4e00-\u9fff]+/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 1 && !["human", "agent", "system", "role", "owner", "cell"].includes(item));
  const matched = roles.find((role) => {
    const id = stringValue(role.id).toLowerCase();
    const name = stringValue(role.name).toLowerCase();
    return tokens.some((token) => id.includes(token) || name.includes(token));
  });
  return stringValue(matched?.id) || fallback;
}

export function parsePlan(content: string, options: ParsePlanOptions = {}) {
  try {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start < 0 || end <= start) return { success: false as const, error: "未找到 JSON 对象" };
    const json = normalizeRoutedModelOutput(JSON.parse(content.slice(start, end + 1)), options);
    const result = loopPlanSchema.safeParse(json);
    if (!result.success) return { success: false as const, error: result.error.message };
    return { success: true as const, data: withMaturityMapping(result.data) };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "JSON 解析失败" };
  }
}
