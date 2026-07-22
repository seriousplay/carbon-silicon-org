import "server-only";

import type { QuestionnaireAnswers } from "./workflow";
import { getAdminClient } from "./supabase";

export type PreworkSubmission = {
  id: string;
  enterpriseId: string;
  enterpriseName: string;
  tenantKey: string;
  submitterName: string;
  isTestAccount: boolean;
  participantName: string;
  company: string;
  role: string;
  scale: string;
  industry: string;
  business: string;
  aiStageLabel: string;
  aiConcern: string;
  submittedAt: string;
  questionnaire: QuestionnaireAnswers;
};

export type CountItem = {
  label: string;
  count: number;
  ratio: number;
};

export type PreworkReport = {
  scope: "enterprise" | "platform";
  hideTestAccounts: boolean;
  hiddenTestAccountCount: number;
  total: number;
  latestSubmittedAt: string | null;
  enterpriseCount: number;
  companyCount: number;
  industryCount: number;
  distributions: {
    aiStage: CountItem[];
    roles: CountItem[];
    scales: CountItem[];
    industries: CountItem[];
    aiScenarios: CountItem[];
    aiBlockers: CountItem[];
    expectations: CountItem[];
    ninetyDayPriorities: CountItem[];
    aiAttitudes: CountItem[];
    orgManagement: CountItem[];
    humanAiDivision: CountItem[];
    evolutionPaths: CountItem[];
  };
  highlights: {
    stageSignal: string;
    topBlocker: string;
    topExpectation: string;
    ninetyDaySignal: string;
  };
  submissions: PreworkSubmission[];
};

type SessionReportRow = {
  id: string;
  userId: string;
  enterpriseId: string | null;
  context: PrismaJson | null;
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date | null;
};

type PrismaJson = Record<string, unknown> | null;

type EnterpriseRow = {
  id: string;
  tenantKey: string;
  companyName: string;
};

type UserRow = {
  id: string;
  displayName: string;
};

type PreworkReportInput =
  | { scope: "enterprise"; enterpriseId: string; hideTestAccounts?: boolean }
  | { scope: "platform"; hideTestAccounts?: boolean };

const aiStageLabels: Record<QuestionnaireAnswers["aiStageChoice"], string> = {
  A: "刚开始试 AI 工具",
  B: "部分岗位或部门提效",
  C: "已改造一两个业务流程",
  D: "正在重设组织分工",
  E: "AI 已进入多个核心流程",
};

const ninetyDayPriorityLabels: Record<NonNullable<QuestionnaireAnswers["ninetyDayPriorityChoice"]>, string> = {
  A: "一条业务流程",
  B: "一个部门的工作方式",
  C: "一个跨部门协同场景",
  D: "一个岗位的人机分工",
  E: "一个管理机制",
  F: "希望课堂上帮我判断",
};

const aiAttitudeLabels: Record<QuestionnaireAnswers["aiAttitudeChoice"], string> = {
  A: "AI 是工具且目前不可控",
  B: "AI 将替代大部分人",
  C: "人和 AI 一起进化",
};

const orgManagementLabels: Record<NonNullable<QuestionnaireAnswers["orgManagementChoice"]>, string> = {
  A: "靠老板/管理者/会议盯",
  B: "靠制度、审批、报表和层级",
  C: "有数据看板但多为事后复盘",
  D: "部分业务实时看数并调整",
  E: "AI 参与预警、分析和触发动作",
};

const humanAiDivisionLabels: Record<NonNullable<QuestionnaireAnswers["humanAiDivisionChoice"]>, string> = {
  A: "不清楚，个人摸索工具",
  B: "岗位在用但原则不清",
  C: "部分岗位明确 AI 辅助事项",
  D: "部分团队已重设人机分工",
  E: "围绕人+AI+业务回路重设协作",
};

const evolutionPathLabels: Record<NonNullable<QuestionnaireAnswers["evolutionPathChoice"]>, string> = {
  A: "增强：成熟业务嵌入 AI",
  B: "重构：重写低效流程/协作",
  C: "原生：新业务直接 AI 原生",
  D: "还不确定，先判断路径",
};

export async function getPrework624Report(input: PreworkReportInput): Promise<PreworkReport> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");

  const where: Record<string, unknown> = {};
  if (input.scope === "enterprise") {
    where.enterpriseId = input.enterpriseId;
  }

  const data = await admin.loopDesignerSession.findMany({
    where: where as any,
    select: {
      id: true,
      userId: true,
      enterpriseId: true,
      context: true,
      createdAt: true,
      updatedAt: true,
      submittedAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const rows = data as unknown as SessionReportRow[];
  const [enterpriseById, userById] = await Promise.all([
    getEnterpriseMap(rows.map((row) => row.enterpriseId ?? "")),
    getUserMap(rows.map((row) => row.userId)),
  ]);
  const allSubmissions = rows
    .filter((row) => {
      const context = row.context as Record<string, unknown> | null;
      return context?.entryPoint === "prework_624" && context?.questionnaire;
    })
    .map((row) => normalizeSubmission(row, enterpriseById, userById))
    .sort((a, b) => timestamp(b.submittedAt) - timestamp(a.submittedAt));
  const hideTestAccounts = Boolean(input.hideTestAccounts);
  const hiddenTestAccountCount = allSubmissions.filter((item) => item.isTestAccount).length;
  const submissions = hideTestAccounts
    ? allSubmissions.filter((item) => !item.isTestAccount)
    : allSubmissions;

  const total = submissions.length;
  const enterprises = new Set(submissions.map((item) => item.enterpriseId).filter(Boolean));
  const companies = new Set(submissions.map((item) => item.company).filter(Boolean));
  const industries = new Set(submissions.map((item) => item.industry).filter(Boolean));
  const distributions = {
    aiStage: countValues(total, submissions.map((item) => aiStageLabels[item.questionnaire.aiStageChoice])),
    roles: countValues(total, submissions.map((item) => item.role)),
    scales: countValues(total, submissions.map((item) => item.scale)),
    industries: countValues(total, submissions.map((item) => item.industry)),
    aiScenarios: countValues(total, submissions.flatMap((item) => item.questionnaire.aiScenarios ?? [])),
    aiBlockers: countValues(total, submissions.flatMap((item) => item.questionnaire.aiBlockers ?? [])),
    expectations: countValues(total, submissions.flatMap((item) => item.questionnaire.expectations ?? [])),
    ninetyDayPriorities: countValues(total, submissions.map((item) => labelChoice(item.questionnaire.ninetyDayPriorityChoice, ninetyDayPriorityLabels))),
    aiAttitudes: countValues(total, submissions.map((item) => aiAttitudeLabels[item.questionnaire.aiAttitudeChoice])),
    orgManagement: countValues(total, submissions.map((item) => labelChoice(item.questionnaire.orgManagementChoice, orgManagementLabels))),
    humanAiDivision: countValues(total, submissions.map((item) => labelChoice(item.questionnaire.humanAiDivisionChoice, humanAiDivisionLabels))),
    evolutionPaths: countValues(total, submissions.map((item) => labelChoice(item.questionnaire.evolutionPathChoice, evolutionPathLabels))),
  };

  return {
    scope: input.scope,
    hideTestAccounts,
    hiddenTestAccountCount: hideTestAccounts ? hiddenTestAccountCount : 0,
    total,
    latestSubmittedAt: submissions[0]?.submittedAt ?? null,
    enterpriseCount: enterprises.size,
    companyCount: companies.size,
    industryCount: industries.size,
    distributions,
    highlights: {
      stageSignal: topLabel(distributions.aiStage),
      topBlocker: topLabel(distributions.aiBlockers),
      topExpectation: topLabel(distributions.expectations),
      ninetyDaySignal: topLabel(distributions.ninetyDayPriorities),
    },
    submissions,
  };
}

async function getUserMap(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (!uniqueIds.length) return new Map<string, UserRow>();
  const admin = getAdminClient();
  if (!admin) return new Map<string, UserRow>();

  const data = await admin.loopDesignerUser.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, displayName: true },
  });

  return new Map(data.map((row) => [row.id, row]));
}

async function getEnterpriseMap(enterpriseIds: string[]) {
  const uniqueIds = Array.from(new Set(enterpriseIds.filter(Boolean)));
  if (!uniqueIds.length) return new Map<string, EnterpriseRow>();
  const admin = getAdminClient();
  if (!admin) return new Map<string, EnterpriseRow>();

  const data = await admin.loopDesignerEnterprise.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, tenantKey: true, companyName: true },
  });

  return new Map(data.map((row) => [row.id, row]));
}

function normalizeSubmission(
  row: SessionReportRow,
  enterpriseById: Map<string, EnterpriseRow>,
  userById: Map<string, UserRow>,
): PreworkSubmission {
  const context = row.context as Record<string, unknown> | null;
  const questionnaire = context?.questionnaire as QuestionnaireAnswers;
  const enterprise = enterpriseById.get(row.enterpriseId ?? "");
  const submitterName = userById.get(row.userId)?.displayName ?? "";
  return {
    id: row.id,
    enterpriseId: row.enterpriseId ?? "",
    enterpriseName: enterprise?.companyName ?? questionnaire.company,
    tenantKey: enterprise?.tenantKey ?? "",
    submitterName,
    isTestAccount: isLikelyTestSubmission(submitterName, questionnaire),
    participantName: questionnaire.name,
    company: questionnaire.company,
    role: questionnaire.role,
    scale: questionnaire.scale,
    industry: questionnaire.industry,
    business: questionnaire.business,
    aiStageLabel: aiStageLabels[questionnaire.aiStageChoice],
    aiConcern: questionnaire.aiConcern,
    submittedAt: row.submittedAt?.toISOString() ?? row.updatedAt.toISOString(),
    questionnaire,
  };
}

function isLikelyTestSubmission(submitterName: string, questionnaire: QuestionnaireAnswers) {
  const maskedPhoneLooksLikeTest = /^(138\*{4}800\d|139\*{4}62[45]\d|139\*{4}0001)$/.test(submitterName);
  const freeText = [
    questionnaire.name,
    questionnaire.company,
    questionnaire.business,
    questionnaire.aiConcern,
    questionnaire.openQuestion,
  ].join("\n");
  const containsTestText = /测试|test/i.test(freeText);
  const blankCompanyPhoneName = Boolean(submitterName) && submitterName === questionnaire.name && !questionnaire.company.trim();
  return maskedPhoneLooksLikeTest || containsTestText || blankCompanyPhoneName;
}

function countValues(total: number, values: Array<string | undefined>) {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    const label = value?.trim();
    if (!label) return;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count, ratio: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "zh-CN"));
}

function labelChoice<T extends string>(value: T | undefined, labels: Record<T, string>) {
  return value ? labels[value] : undefined;
}

function topLabel(items: CountItem[]) {
  return items[0]?.label ?? "暂无数据";
}

function timestamp(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}
