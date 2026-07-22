import type { AssessmentRun } from "./types";

export const fallbackRuns: AssessmentRun[] = [
  {
    slug: "20260517-hr-od-workshop",
    title: "碳硅共生：AI时代的组织进化工作坊",
    runType: "workshop",
    status: "active",
    dateLabel: "2026年5月17日（周日）",
    audience: "HR 一号位与组织发展负责人",
    description:
      "基于《碳硅组织》的实践框架，围绕真实组织问题完成一次诊断、方法共创和人机协作实验设计。",
    showOnHome: true,
    participantCount: 0,
    completedCount: 0,
  },
];

export const defaultRun = fallbackRuns[0];

export const runTypeLabels: Record<AssessmentRun["runType"], string> = {
  workshop: "工作坊",
  organization_diagnosis: "企业诊断",
  cohort: "内部班级",
  public: "公开测评",
};

export const runStatusLabels: Record<AssessmentRun["status"], string> = {
  draft: "草稿",
  active: "启用",
  closed: "关闭",
  archived: "归档",
};
