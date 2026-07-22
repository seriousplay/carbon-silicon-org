import type { BrainQueryResource } from "./query-plan";
import type {
  MemoryCandidateActor,
  MemoryCandidateAuthorityRoute,
  MemoryCandidateSourceRef,
} from "./memory-candidate-types";
import type { SharedMemoryEntry } from "./shared-memory-types";

const MAX_MODEL_OUTPUT_BYTES = 16 * 1024;
const MAX_MODEL_ITEMS = 24;
const MAX_FACT_ITEMS = 20;
const MAX_NARRATIVE_ITEMS = 6;
const MAX_NARRATIVE_BYTES = 600;
const MAX_CITATIONS = 5;

export const ORGANIZATION_BRAIN_SECTION_LABELS = Object.freeze({
  confirmedMemory: "已确认组织记忆",
  fact: "事实",
  inference: "推断",
  recommendation: "建议",
  missingEvidence: "缺失证据",
  source: "来源",
} as const);

export const ORGANIZATION_BRAIN_CAPABILITY_HELP_MESSAGE =
  "我可以回答 LoopOS 已授权组织数据范围内的问题：当前组织目标、目标周期和进展；组织结构、圈子和角色；我的角色、可申请角色和角色任命；未解决张力、战术产出、治理决策和治理日志；项目、行动、会议草稿等运营记录。我也可以起草提交张力、目标提案或检查、角色申请、战术处理建议和治理提案；涉及写入组织记录的动作会先生成预览，确认后才执行。我不能回答未授权、跨组织、外部系统、个人隐私或当前查询目录尚不支持的问题。";

export const ORGANIZATION_BRAIN_RESOURCE_LABELS: Readonly<
  Record<BrainQueryResource, string>
> = Object.freeze({
  currentActor: "当前成员",
  organizationIdentity: "组织",
  organizationBrainProfile: "组织大脑",
  currentActorRoleAssignments: "当前角色任职",
  currentActorRoleApplications: "当前角色申请",
  currentActorRoleAssignmentHistory: "任职历史",
  privateConversations: "私人对话",
  privateMessages: "私人消息",
  circles: "圈子",
  roleDefinitions: "角色",
  projects: "项目",
  actions: "行动",
  unresolvedTensions: "未解决张力",
  meetingDrafts: "会议草稿",
  approvedTacticalOutcomes: "已批准战术产出",
  adoptedGovernanceDecisions: "已采纳治理决策",
  publishedGovernanceLogs: "已发布治理日志",
  goalCycles: "目标周期",
  goals: "目标",
  goalTargets: "目标靶点",
  goalEffectiveCheckIns: "目标有效检查",
  goalActiveWorkLinks: "目标工作关联",
});

export const ORGANIZATION_BRAIN_FIELD_LABELS: Readonly<
  Record<string, string>
> = Object.freeze({
  name: "名称",
  entityType: "实体类型",
  homeCircleName: "主圈子",
  membershipRole: "成员角色",
  slug: "标识",
  enabledCapabilities: "已启用能力",
  roleDefinitionName: "角色名称",
  roleName: "角色名称",
  eventType: "事件类型",
  effectiveAt: "生效时间",
  circleName: "圈子名称",
  ownershipType: "所有权类型",
  category: "类别",
  title: "标题",
  updatedAt: "更新时间",
  role: "消息角色",
  content: "内容",
  createdAt: "创建时间",
  type: "类型",
  purpose: "目的",
  status: "状态",
  accountabilities: "职责",
  goal: "目标",
  expectedResult: "预期结果",
  description: "描述",
  acceptanceCriteria: "验收标准",
  deadline: "截止时间",
  agenda: "议程",
  notes: "纪要",
  kind: "产出类型",
  decisionTitle: "决策标题",
  decisionContent: "决策内容",
  decisionRationale: "决策理由",
  resultNote: "结果说明",
  period: "周期",
  risks: "风险",
  startAt: "开始时间",
  endAt: "结束时间",
  checkInCadenceDays: "检查节奏（天）",
  intendedOutcome: "预期成果",
  adoptedAt: "采纳时间",
  terminalOutcome: "终态结果",
  terminalAt: "终止时间",
  position: "顺序",
  label: "指标",
  baselineValue: "基线值",
  desiredValue: "目标值",
  unit: "单位",
  fact: "事实",
  evidenceSummary: "证据摘要",
  currentValue: "当前值",
  milestoneState: "里程碑状态",
  acceptanceEvidence: "验收证据",
  assessment: "评估",
  recordedAt: "记录时间",
  objectLabel: "工作对象",
  objectStatus: "工作对象状态",
});

export type OrganizationBrainStatus =
  | "ANSWERED"
  | "EVIDENCE_ONLY"
  | "INSUFFICIENT_EVIDENCE"
  | "DENIED"
  | "REJECTED";

export type OrganizationBrainResponseCode =
  | "ANSWERED"
  | "CAPABILITY_HELP"
  | "INVALID_QUESTION"
  | "QUESTION_LIMIT_EXCEEDED"
  | "INVALID_EVIDENCE"
  | "EVIDENCE_LIMIT_EXCEEDED"
  | "PROMPT_LIMIT_EXCEEDED"
  | "ACCESS_DENIED"
  | "NO_AUTHORIZED_EVIDENCE"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_FAILURE"
  | "OUTPUT_LIMIT_EXCEEDED"
  | "OUTPUT_SCHEMA_INVALID"
  | "CITATION_INVALID"
  | "UNSUPPORTED_FACT";

export type OrganizationBrainFact = Readonly<{
  label: typeof ORGANIZATION_BRAIN_SECTION_LABELS.fact;
  evidenceId: string;
  resource: BrainQueryResource;
  resourceLabel: string;
  sourceVersion: string;
  recordId: string;
  applicationUrl: string | null;
  fields: readonly Readonly<{
    name: string;
    label: string;
    value: string;
    truncated: boolean;
  }>[];
}>;

export type OrganizationBrainNarrative = Readonly<{
  label:
    | typeof ORGANIZATION_BRAIN_SECTION_LABELS.inference
    | typeof ORGANIZATION_BRAIN_SECTION_LABELS.recommendation;
  text: string;
  citations: readonly string[];
}>;

export type OrganizationBrainMissingEvidence = Readonly<{
  label: typeof ORGANIZATION_BRAIN_SECTION_LABELS.missingEvidence;
  text: string;
}>;

export type OrganizationBrainSource = Readonly<{
  label: typeof ORGANIZATION_BRAIN_SECTION_LABELS.source;
  evidenceId: string;
  resource: BrainQueryResource;
  resourceLabel: string;
  recordId: string;
  version: string;
  applicationUrl: string | null;
}>;

export type OrganizationBrainConfirmedMemory = Readonly<{
  label: typeof ORGANIZATION_BRAIN_SECTION_LABELS.confirmedMemory;
  candidateId: string;
  claim: string;
  rationale: string;
  authorityRoute: MemoryCandidateAuthorityRoute;
  sourceRefs: readonly MemoryCandidateSourceRef[];
  confirmedBy: MemoryCandidateActor;
  validFrom: string;
  validUntil: string | null;
  applicationUrl: string;
  correctionUrl: string;
}>;

export type OrganizationBrainResponse = Readonly<{
  schemaVersion: 1;
  status: OrganizationBrainStatus;
  code: OrganizationBrainResponseCode;
  message: string;
  confirmedMemory?: readonly OrganizationBrainConfirmedMemory[];
  facts: readonly OrganizationBrainFact[];
  inferences: readonly OrganizationBrainNarrative[];
  recommendations: readonly OrganizationBrainNarrative[];
  missingEvidence: readonly OrganizationBrainMissingEvidence[];
  sources: readonly OrganizationBrainSource[];
}>;

export function confirmedMemoryFromSharedEntry(
  entry: SharedMemoryEntry,
): OrganizationBrainConfirmedMemory {
  return Object.freeze({
    label: ORGANIZATION_BRAIN_SECTION_LABELS.confirmedMemory,
    candidateId: entry.candidateId,
    claim: entry.claim,
    rationale: entry.rationale,
    authorityRoute: Object.freeze({ ...entry.authorityRoute }),
    sourceRefs: Object.freeze(entry.sourceRefs.map((sourceRef) =>
      Object.freeze({ ...sourceRef }),
    )),
    confirmedBy: Object.freeze({ ...entry.confirmedBy }),
    validFrom: entry.validFrom,
    validUntil: entry.validUntil,
    applicationUrl: entry.applicationUrl,
    correctionUrl: `/app/tensions/new?memoryCandidateId=${encodeURIComponent(entry.candidateId)}`,
  });
}

export type OrganizationBrainModelEvidence = Readonly<{
  evidenceId: string;
  fields: readonly string[];
}>;

export type ParsedOrganizationBrainModelItem =
  | Readonly<{
      type: "FACT";
      citation: string;
      fields: readonly string[];
    }>
  | Readonly<{
      type: "INFERENCE" | "RECOMMENDATION";
      text: string;
      citations: readonly string[];
    }>
  | Readonly<{
      type: "MISSING_EVIDENCE";
      text: string;
    }>;

export type OrganizationBrainModelOutputErrorCode =
  | "OUTPUT_LIMIT_EXCEEDED"
  | "OUTPUT_SCHEMA_INVALID"
  | "CITATION_INVALID"
  | "UNSUPPORTED_FACT";

export class OrganizationBrainModelOutputError extends Error {
  constructor(public readonly code: OrganizationBrainModelOutputErrorCode) {
    super(`Organization Brain model output rejected: ${code}`);
    this.name = "OrganizationBrainModelOutputError";
  }
}

function fail(code: OrganizationBrainModelOutputErrorCode): never {
  throw new OrganizationBrainModelOutputError(code);
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isWellFormed(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && codePoint >= 0xd800 && codePoint <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function isExactObject(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return false;
  }
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function parseNarrativeText(value: unknown): string {
  if (typeof value !== "string" || !isWellFormed(value)) {
    fail("OUTPUT_SCHEMA_INVALID");
  }
  const text = value.trim();
  if (!text || utf8Bytes(value) > MAX_NARRATIVE_BYTES) {
    fail("OUTPUT_SCHEMA_INVALID");
  }
  return text;
}

function parseCitations(
  value: unknown,
  evidenceOrder: ReadonlyMap<string, number>,
): readonly string[] {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > MAX_CITATIONS ||
    value.some((citation) => typeof citation !== "string")
  ) {
    fail("CITATION_INVALID");
  }
  const citations = value as string[];
  if (
    new Set(citations).size !== citations.length ||
    citations.some((citation) => !evidenceOrder.has(citation))
  ) {
    fail("CITATION_INVALID");
  }
  return [...citations].sort(
    (left, right) => evidenceOrder.get(left)! - evidenceOrder.get(right)!,
  );
}

export function parseOrganizationBrainModelOutput(
  raw: string,
  evidence: readonly OrganizationBrainModelEvidence[],
): readonly ParsedOrganizationBrainModelItem[] {
  if (typeof raw !== "string") fail("OUTPUT_SCHEMA_INVALID");
  if (utf8Bytes(raw) > MAX_MODEL_OUTPUT_BYTES) fail("OUTPUT_LIMIT_EXCEEDED");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail("OUTPUT_SCHEMA_INVALID");
  }
  if (!isExactObject(parsed, ["schemaVersion", "items"])) {
    fail("OUTPUT_SCHEMA_INVALID");
  }
  if (
    parsed.schemaVersion !== 1 ||
    !Array.isArray(parsed.items) ||
    parsed.items.length > MAX_MODEL_ITEMS
  ) {
    fail("OUTPUT_SCHEMA_INVALID");
  }

  const evidenceOrder = new Map(
    evidence.map((entry, index) => [entry.evidenceId, index]),
  );
  const allowedFields = new Map(
    evidence.map((entry) => [entry.evidenceId, entry.fields]),
  );
  const counts = {
    FACT: 0,
    INFERENCE: 0,
    RECOMMENDATION: 0,
    MISSING_EVIDENCE: 0,
  };
  const canonicalItems = new Set<string>();
  const items: ParsedOrganizationBrainModelItem[] = [];

  for (const value of parsed.items) {
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      fail("OUTPUT_SCHEMA_INVALID");
    }
    const type = value.type;
    let item: ParsedOrganizationBrainModelItem;

    if (type === "FACT") {
      if (!isExactObject(value, ["type", "citation", "fields"])) {
        fail("OUTPUT_SCHEMA_INVALID");
      }
      if (
        typeof value.citation !== "string" ||
        !evidenceOrder.has(value.citation)
      ) {
        fail("CITATION_INVALID");
      }
      const catalogFields = allowedFields.get(value.citation)!;
      if (
        !Array.isArray(value.fields) ||
        value.fields.length < 1 ||
        value.fields.length > catalogFields.length ||
        value.fields.some((field) => typeof field !== "string")
      ) {
        fail("UNSUPPORTED_FACT");
      }
      const requestedFields = value.fields as string[];
      if (
        new Set(requestedFields).size !== requestedFields.length ||
        requestedFields.some((field) => !catalogFields.includes(field))
      ) {
        fail("UNSUPPORTED_FACT");
      }
      item = {
        type,
        citation: value.citation,
        fields: catalogFields.filter((field) => requestedFields.includes(field)),
      };
    } else if (type === "INFERENCE" || type === "RECOMMENDATION") {
      if (!isExactObject(value, ["type", "text", "citations"])) {
        fail("OUTPUT_SCHEMA_INVALID");
      }
      item = {
        type,
        text: parseNarrativeText(value.text),
        citations: parseCitations(value.citations, evidenceOrder),
      };
    } else if (type === "MISSING_EVIDENCE") {
      if (!isExactObject(value, ["type", "text"])) {
        fail("OUTPUT_SCHEMA_INVALID");
      }
      item = { type, text: parseNarrativeText(value.text) };
    } else {
      fail("OUTPUT_SCHEMA_INVALID");
    }

    counts[item.type] += 1;
    if (
      counts.FACT > MAX_FACT_ITEMS ||
      counts.INFERENCE > MAX_NARRATIVE_ITEMS ||
      counts.RECOMMENDATION > MAX_NARRATIVE_ITEMS ||
      counts.MISSING_EVIDENCE > MAX_NARRATIVE_ITEMS
    ) {
      fail("OUTPUT_SCHEMA_INVALID");
    }
    const canonical = JSON.stringify(item);
    if (canonicalItems.has(canonical)) fail("OUTPUT_SCHEMA_INVALID");
    canonicalItems.add(canonical);
    items.push(Object.freeze(item));
  }

  return Object.freeze(items);
}
