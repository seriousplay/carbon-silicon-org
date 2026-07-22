import "server-only";

import { getTool, toolLibrary } from "./tool-library";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { verifyRunAccessCode } from "@/lib/runs/server";
import { getUserMemberships, isOrganizationAdmin } from "@/lib/auth/server";
import type { ToolSessionDetail, ToolSessionProfile, ToolSessionReport } from "./session-types";

export type { ToolSessionDetail, ToolSessionProfile, ToolSessionReport };

export type ToolSessionSubmission = {
  userId: string;
  defaultOrganizationId?: string | null;
  runSlug?: string;
  accessCode?: string;
  profile: ToolSessionProfile;
  context: {
    useCase: string;
    dataScope?: string;
    currentSituation?: string;
    evidenceSignal?: string;
    expectedOutput?: string;
  };
  responses: Record<string, string>;
  nextAction?: string;
};

export type ToolSessionSummary = {
  total: number;
  byTool: { toolId: string; toolName: string; count: number }[];
  latest: {
    id: string;
    toolId: string;
    toolName: string;
    displayName: string;
    companyName?: string;
    teamName?: string;
    useCase?: string;
    dataScope?: string;
    nextAction?: string;
    submittedAt: string;
  }[];
};

export type PreworkReport = {
  total: number;
  lastSubmittedAt?: string;
  distributions: Record<"aiFrequency" | "stepclaw" | "ima" | "obsidian" | "bringMaterial", { label: string; count: number }[]>;
  multiChoice: Record<"aiUses" | "goals", { label: string; count: number }[]>;
  readiness: { tool: string; ready: number; issue: number; notReady: number; unknown: number }[];
  highlights: {
    targetTasks: string[];
    biggestQuestions: string[];
    toolIssues: string[];
    materialTypes: string[];
  };
  records: {
    id: string;
    displayName: string;
    role?: string;
    submittedAt: string;
    aiFrequency?: string;
    aiUses?: string;
    stepclaw?: string;
    ima?: string;
    obsidian?: string;
    targetTask?: string;
    goals?: string;
    bringMaterial?: string;
    materialType?: string;
    biggestQuestion?: string;
    toolIssue?: string;
  }[];
};

type ToolSessionRow = {
  id: string;
  tool_id: string;
  mode?: string;
  user_id?: string | null;
  organization_id?: string | null;
  participant_snapshot: Record<string, string | undefined> | null;
  context: Record<string, string | undefined> | null;
  responses?: Record<string, string> | null;
  outputs: Record<string, unknown> | null;
  submitted_at: string;
};

function getToolDisplayName(toolId: string) {
  if (toolId === "super-individual-prework") return "超级个体课前问卷";
  if (toolId === "workshop-final-feedback") return "工作坊最终反馈";
  return getTool(toolId)?.name ?? toolId;
}

export function buildToolOutputs(toolId: string, input: ToolSessionSubmission) {
  const tool = getTool(toolId);
  if (!tool) return {};
  const report = buildToolReport(toolId, input);

  return {
    toolName: tool.name,
    expectedProduct: tool.output,
    primaryUseCase: input.context.useCase,
    dataScope: input.context.dataScope,
    evidenceSignal: input.context.evidenceSignal,
    templatePrompts: tool.templateSections.flatMap((section) => section.prompts.map((prompt) => typeof prompt === "string" ? prompt : prompt.label)),
    nextAction: input.nextAction || tool.followUpActions[0],
    followUpActions: tool.followUpActions,
    recommendedTools: tool.relatedTools,
    report,
  };
}

export function buildToolReport(toolId: string, input: ToolSessionSubmission): ToolSessionReport {
  const tool = getTool(toolId);
  const responses = input.responses;
  const responseCount = Object.values(responses).filter((value) => value.trim()).length;
  const scores = inferScores(responses);
  const weakestSignal = inferWeakestSignal(responses, scores);
  const expected = input.context.expectedOutput || tool?.output || "一次可复盘的工具输出";
  const nextAction = input.nextAction || chooseActionByWeakestSignal(weakestSignal) || tool?.followUpActions[0] || "把本次记录带回团队，约定一次复盘时间。";

  const keyFindings = [
    `本次工具围绕「${input.context.useCase}」展开，数据沉淀对象是「${input.context.dataScope || input.profile.teamName || input.profile.companyName || "暂未指定"}」。`,
    input.context.currentSituation
      ? `当前现场的主要约束是：${input.context.currentSituation}`
      : "当前现场描述还不够完整，后续复盘时需要补充真实业务背景。",
    weakestSignal
      ? `最需要优先处理的信号是「${weakestSignal}」。这决定了下一步不宜直接扩大试点，而应先补齐这一层证据。`
      : `本次共完成 ${responseCount} 项模板输入，可作为下一轮团队讨论的初始记录。`,
  ];

  const riskSignals = [
    !input.context.evidenceSignal ? "缺少可观察的复盘信号，后续容易停留在主观判断。" : "",
    !input.nextAction ? "下一步动作尚未明确到责任人、时间和验收口径。" : "",
    responseCount < 4 ? "模板输入较少，洞察更适合作为初稿，不宜直接作为组织决策依据。" : "",
  ].filter(Boolean);

  if (!riskSignals.length) {
    riskSignals.push(`已经写下复盘信号「${input.context.evidenceSignal}」，下一步要确保它能被真实业务数据验证。`);
  }

  return {
    title: `${tool?.name ?? toolId} 使用洞察`,
    summary: `这份记录的核心不是完成表单，而是把「${input.context.useCase}」从一个想法压实为可验证的组织动作。预期产出是「${expected}」。`,
    scores: Object.keys(scores).length ? scores : undefined,
    weakestSignal,
    keyFindings,
    riskSignals,
    recommendedActions: [
      nextAction,
      input.context.evidenceSignal
        ? `把「${input.context.evidenceSignal}」设为下一次复盘的第一验收信号。`
        : "补一条可被第三方观察的验收信号，例如业务数据、交付物质量、流程时长或用户反馈。",
      "把本次输入中的关键分歧同步给相关责任人，避免它只停留在个人记录里。",
    ],
    recommendedTools: tool?.relatedTools ?? [],
  };
}

export async function createToolSession(toolId: string, input: ToolSessionSubmission) {
  const tool = getTool(toolId);
  if (!tool) return { ok: false as const, reason: "Tool not found" };

  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false as const, reason: "Supabase service role is not configured" };

  let event: { id: string; organization_id: string | null } | null = null;
  let participantId: string | null = null;

  if (input.runSlug) {
    const access = await verifyRunAccessCode(input.runSlug, input.accessCode);
    if (!access.ok) return { ok: false as const, reason: access.reason ?? "Run access denied" };

    const eventResult = await supabase
      .from("events")
      .select("id,organization_id")
      .eq("slug", input.runSlug)
      .maybeSingle();

    if (eventResult.error || !eventResult.data) {
      return { ok: false as const, reason: eventResult.error?.message ?? "Run not found" };
    }

    event = eventResult.data as { id: string; organization_id: string | null };

    const participantResult = await supabase
      .from("participants")
      .insert({
        event_id: event.id,
        user_id: input.userId,
        organization_id: event.organization_id ?? input.defaultOrganizationId ?? null,
        display_name: input.profile.displayName,
        role: input.profile.role || null,
        industry: null,
        org_size: null,
        company_name: input.profile.companyName || null,
        contact: input.profile.contact || null,
        contact_consent: Boolean(input.profile.contact),
      })
      .select("id")
      .single();

    if (participantResult.error || !participantResult.data) {
      return { ok: false as const, reason: participantResult.error?.message ?? "Participant insert failed" };
    }

    participantId = (participantResult.data as { id: string }).id;
  }

  const result = await supabase
    .from("tool_sessions")
    .insert({
      tool_id: toolId,
      event_id: event?.id ?? null,
      organization_id: event?.organization_id ?? input.defaultOrganizationId ?? null,
      user_id: input.userId,
      participant_id: participantId,
      mode: input.runSlug ? "run" : "standalone",
      status: "submitted",
      participant_snapshot: input.profile,
      context: {
        ...input.context,
        runSlug: input.runSlug,
      },
      responses: input.responses,
      outputs: buildToolOutputs(toolId, input),
    })
    .select("id,outputs")
    .single();

  if (result.error || !result.data) {
    return { ok: false as const, reason: result.error?.message ?? "Tool session insert failed" };
  }

  return { ok: true as const, id: (result.data as { id: string }).id, outputs: (result.data as { outputs: Record<string, unknown> }).outputs };
}

export async function getToolSessionDetail(userId: string, sessionId: string): Promise<ToolSessionDetail | null> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("tool_sessions")
    .select("id,tool_id,mode,user_id,organization_id,participant_snapshot,context,responses,outputs,submitted_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as ToolSessionRow;

  if (row.user_id !== userId) {
    const memberships = await getUserMemberships(userId);
    const canReadAsAdmin = memberships.some(
      (membership) => membership.organizationId === row.organization_id && isOrganizationAdmin(membership),
    );
    if (!canReadAsAdmin) return null;
  }

  const tool = getTool(row.tool_id);
  const report = (row.outputs?.report as ToolSessionReport | undefined) ??
    buildToolReport(row.tool_id, {
      userId,
      defaultOrganizationId: row.organization_id,
      profile: {
        displayName: row.participant_snapshot?.displayName ?? "",
        role: row.participant_snapshot?.role,
        companyName: row.participant_snapshot?.companyName,
        teamName: row.participant_snapshot?.teamName,
        contact: row.participant_snapshot?.contact,
      },
      context: {
        useCase: row.context?.useCase ?? "",
        dataScope: row.context?.dataScope,
        currentSituation: row.context?.currentSituation,
        evidenceSignal: row.context?.evidenceSignal,
        expectedOutput: row.context?.expectedOutput,
      },
      responses: row.responses ?? {},
      nextAction: typeof row.outputs?.nextAction === "string" ? row.outputs.nextAction : undefined,
    });

  return {
    id: row.id,
    toolId: row.tool_id,
    toolName: tool?.name ?? row.tool_id,
    submittedAt: row.submitted_at,
    mode: row.mode ?? "standalone",
    participantSnapshot: row.participant_snapshot ?? {},
    context: row.context ?? {},
    responses: row.responses ?? {},
    outputs: row.outputs ?? {},
    report,
  };
}

export async function getRunToolSessionSummary(runSlug: string): Promise<ToolSessionSummary> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return emptyToolSessionSummary();

  const { data: event } = await supabase.from("events").select("id").eq("slug", runSlug).maybeSingle();
  if (!event?.id) return emptyToolSessionSummary();

  const { data, error } = await supabase
    .from("tool_sessions")
    .select("id,tool_id,participant_snapshot,context,responses,outputs,submitted_at")
    .eq("event_id", event.id)
    .order("submitted_at", { ascending: false });

  if (error) return emptyToolSessionSummary();

  return summarizeToolSessions((data ?? []) as ToolSessionRow[]);
}

export async function getRunPreworkReport(runSlug: string): Promise<PreworkReport> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return emptyPreworkReport();

  const { data: event } = await supabase.from("events").select("id").eq("slug", runSlug).maybeSingle();
  if (!event?.id) return emptyPreworkReport();

  const { data, error } = await supabase
    .from("tool_sessions")
    .select("id,tool_id,participant_snapshot,responses,submitted_at")
    .eq("event_id", event.id)
    .eq("tool_id", "super-individual-prework")
    .order("submitted_at", { ascending: false });

  if (error) return emptyPreworkReport();

  return summarizePreworkRows((data ?? []) as ToolSessionRow[]);
}

export async function exportRunToolSessionsCsv(runSlug: string) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false as const, reason: "Supabase service role is not configured" };

  const { data: event, error: eventError } = await supabase.from("events").select("id,title").eq("slug", runSlug).maybeSingle();
  if (eventError || !event?.id) return { ok: false as const, reason: eventError?.message ?? "Run not found" };

  const { data, error } = await supabase
    .from("tool_sessions")
    .select("id,tool_id,participant_snapshot,context,responses,outputs,submitted_at")
    .eq("event_id", event.id)
    .order("submitted_at", { ascending: false });

  if (error) {
    if (isMissingToolSessionsTable(error.message)) {
      return {
        ok: true as const,
        filename: `${runSlug}-tool-sessions-export.csv`,
        csv: toolSessionCsv([toolSessionCsvHeader()]),
      };
    }
    return { ok: false as const, reason: error.message };
  }

  const rows = ((data ?? []) as ToolSessionRow[]).map((row) => {
    return [
      row.submitted_at,
      row.tool_id,
      getToolDisplayName(row.tool_id),
      row.participant_snapshot?.displayName ?? "",
      row.participant_snapshot?.role ?? "",
      row.participant_snapshot?.companyName ?? "",
      row.participant_snapshot?.teamName ?? "",
      row.participant_snapshot?.contact ?? "",
      row.context?.useCase ?? "",
      row.context?.dataScope ?? "",
      row.context?.currentSituation ?? "",
      row.context?.evidenceSignal ?? "",
      row.context?.expectedOutput ?? "",
      formatJson(row.responses ?? {}),
      row.outputs?.nextAction ?? "",
      row.outputs?.report ? formatJson(row.outputs.report) : "",
    ];
  });

  return {
    ok: true as const,
    filename: `${runSlug}-tool-sessions-export.csv`,
    csv: toolSessionCsv([toolSessionCsvHeader(), ...rows]),
  };
}

function summarizeToolSessions(rows: ToolSessionRow[]): ToolSessionSummary {
  const counts = new Map<string, number>();
  rows.forEach((row) => counts.set(row.tool_id, (counts.get(row.tool_id) ?? 0) + 1));

  const byTool = Array.from(counts.entries())
    .map(([toolId, count]) => ({
      toolId,
      toolName: getToolDisplayName(toolId),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    total: rows.length,
    byTool,
    latest: rows.slice(0, 8).map((row) => ({
      id: row.id,
      toolId: row.tool_id,
      toolName: getToolDisplayName(row.tool_id),
      displayName: row.participant_snapshot?.displayName ?? "匿名参与者",
      companyName: row.participant_snapshot?.companyName,
      teamName: row.participant_snapshot?.teamName,
      useCase: row.context?.useCase,
      dataScope: row.context?.dataScope,
      nextAction: typeof row.outputs?.nextAction === "string" ? row.outputs.nextAction : undefined,
      submittedAt: row.submitted_at,
    })),
  };
}

function emptyToolSessionSummary(): ToolSessionSummary {
  return { total: 0, byTool: [], latest: [] };
}

function emptyPreworkReport(): PreworkReport {
  return {
    total: 0,
    distributions: {
      aiFrequency: [],
      stepclaw: [],
      ima: [],
      obsidian: [],
      bringMaterial: [],
    },
    multiChoice: {
      aiUses: [],
      goals: [],
    },
    readiness: [
      { tool: "StepClaw", ready: 0, issue: 0, notReady: 0, unknown: 0 },
      { tool: "ima", ready: 0, issue: 0, notReady: 0, unknown: 0 },
      { tool: "Obsidian", ready: 0, issue: 0, notReady: 0, unknown: 0 },
    ],
    highlights: {
      targetTasks: [],
      biggestQuestions: [],
      toolIssues: [],
      materialTypes: [],
    },
    records: [],
  };
}

function summarizePreworkRows(rows: ToolSessionRow[]): PreworkReport {
  const report = emptyPreworkReport();
  report.total = rows.length;
  report.lastSubmittedAt = rows[0]?.submitted_at;

  const singleKeys = ["aiFrequency", "stepclaw", "ima", "obsidian", "bringMaterial"] as const;
  for (const key of singleKeys) {
    report.distributions[key] = countValues(rows.map((row) => responseValue(row, key)));
  }

  report.multiChoice.aiUses = countChoices(rows.flatMap((row) => splitChoices(responseValue(row, "aiUses"))));
  report.multiChoice.goals = countChoices(rows.flatMap((row) => splitChoices(responseValue(row, "goals"))));

  report.readiness = [
    buildReadiness("StepClaw", rows.map((row) => responseValue(row, "stepclaw"))),
    buildReadiness("ima", rows.map((row) => responseValue(row, "ima"))),
    buildReadiness("Obsidian", rows.map((row) => responseValue(row, "obsidian"))),
  ];

  report.highlights = {
    targetTasks: takeNonEmpty(rows.map((row) => responseValue(row, "targetTask")), 12),
    biggestQuestions: takeNonEmpty(rows.map((row) => responseValue(row, "biggestQuestion")), 12),
    toolIssues: takeNonEmpty(rows.map((row) => responseValue(row, "toolIssue")), 8),
    materialTypes: takeNonEmpty(rows.map((row) => responseValue(row, "materialType")), 12),
  };

  report.records = rows.map((row) => ({
    id: row.id,
    displayName: row.participant_snapshot?.displayName ?? "匿名参与者",
    role: row.participant_snapshot?.role,
    submittedAt: row.submitted_at,
    aiFrequency: responseValue(row, "aiFrequency"),
    aiUses: responseValue(row, "aiUses"),
    stepclaw: responseValue(row, "stepclaw"),
    ima: responseValue(row, "ima"),
    obsidian: responseValue(row, "obsidian"),
    targetTask: responseValue(row, "targetTask"),
    goals: responseValue(row, "goals"),
    bringMaterial: responseValue(row, "bringMaterial"),
    materialType: responseValue(row, "materialType"),
    biggestQuestion: responseValue(row, "biggestQuestion"),
    toolIssue: responseValue(row, "toolIssue"),
  }));

  return report;
}

function responseValue(row: ToolSessionRow, key: string) {
  return String(row.responses?.[key] ?? "").trim();
}

function countValues(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const label = value || "未填写";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return sortCounts(counts);
}

function countChoices(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return sortCounts(counts);
}

function sortCounts(counts: Map<string, number>) {
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "zh-CN"));
}

function splitChoices(value: string) {
  return value
    .split(/[；;、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildReadiness(tool: string, values: string[]) {
  const result = { tool, ready: 0, issue: 0, notReady: 0, unknown: 0 };
  for (const value of values) {
    if (/已安装|已创建|已登录/.test(value)) result.ready += 1;
    else if (/问题|失败|无法|不会/.test(value)) result.issue += 1;
    else if (/没安装|未安装|还没/.test(value)) result.notReady += 1;
    else result.unknown += 1;
  }
  return result;
}

function takeNonEmpty(values: string[], limit: number) {
  return values.map((value) => value.trim()).filter(Boolean).slice(0, limit);
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function isMissingToolSessionsTable(message: string) {
  return /tool_sessions|relation .* does not exist|schema cache/i.test(message);
}

function toolSessionCsvHeader() {
  return [
    "submitted_at",
    "tool_id",
    "tool_name",
    "display_name",
    "role",
    "company_name",
    "team_name",
    "contact",
    "use_case",
    "data_scope",
    "current_situation",
    "evidence_signal",
    "expected_output",
    "responses_json",
    "next_action",
    "insight_report_json",
  ];
}

function toolSessionCsv(rows: unknown[][]) {
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {});
}

function inferScores(responses: Record<string, string>) {
  const labels = ["目标对齐", "价值对齐", "逻辑对齐"];
  return Object.fromEntries(
    labels.flatMap((label) => {
      const entry = Object.entries(responses).find(([key, value]) => key.includes(label) || value.includes(label));
      const score = entry ? Number(entry[1].match(/([1-5])\s*分?/)?.[1]) : NaN;
      return Number.isFinite(score) ? [[label, score]] : [];
    }),
  ) as Record<string, number>;
}

function inferWeakestSignal(responses: Record<string, string>, scores: Record<string, number>) {
  const explicit = Object.entries(responses).find(([key]) => key.includes("最低分项"))?.[1];
  const explicitMatch = explicit?.match(/(目标对齐|价值对齐|逻辑对齐)/)?.[1];
  if (explicitMatch) return explicitMatch;

  const sorted = Object.entries(scores).sort((a, b) => a[1] - b[1]);
  return sorted[0]?.[0];
}

function chooseActionByWeakestSignal(signal?: string) {
  if (signal === "目标对齐") return "先补业务锚点：把项目目标改写为一条可被业务负责人验收的结果指标。";
  if (signal === "价值对齐") return "先补边界承诺：写清哪些判断不能交给 AI，哪些风险必须人工复核。";
  if (signal === "逻辑对齐") return "先补验证链路：用一个小样本闭环验证 AI 输出、人工复核和真实反馈之间是否能跑通。";
  return undefined;
}

export function recommendedToolSuite() {
  const ids = [
    "ai-transformation-ladder",
    "spiral-diagnosis",
    "human-ai-chain",
    "ai-charter",
    "business-anchor-check",
    "interface-contract",
  ];

  return ids.map((id) => getTool(id)).filter((tool): tool is (typeof toolLibrary)[number] => Boolean(tool));
}
