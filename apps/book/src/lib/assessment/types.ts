export type StageAnswer = "not_yet" | "occasional" | "stable";

export type QuestionType = "stage" | "scale" | "text";

export type AssessmentModule =
  | "stage"
  | "spiral"
  | "energy"
  | "chain"
  | "charter"
  | "open";

export type Question = {
  id: string;
  module: AssessmentModule;
  dimension?: string;
  title: string;
  description?: string;
  type: QuestionType;
  sortOrder: number;
};

export type ParticipantProfile = {
  displayName: string;
  role: string;
  industry: string;
  orgSize: string;
  companyName?: string;
  contact?: string;
  contactConsent?: boolean;
};

export type AnswerValue = number | StageAnswer | string;

export type AssessmentAnswers = Record<string, AnswerValue>;

export type DimensionScore = {
  key: string;
  label: string;
  score: number;
};

export type Report = {
  id: string;
  eventSlug: string;
  participant: ParticipantProfile;
  createdAt: string;
  stageLevel: string;
  nextLevel: string;
  stageSummary: string;
  spiralScores: DimensionScore[];
  energyScores: DimensionScore[];
  chainScore: number;
  charterScore: number;
  primaryBottleneck: {
    key: string;
    label: string;
    score: number;
    category: string;
  };
  actionRecommendation: {
    title: string;
    rationale: string;
    steps: string[];
  };
  recommendedTools: string[];
  openAnswers: {
    scenario?: string;
    workflow?: string;
    blocker?: string;
  };
};

export type EventSummary = {
  eventSlug: string;
  title: string;
  participantCount: number;
  completedCount: number;
  stageDistribution: Record<string, number>;
  spiralBottlenecks: Record<string, number>;
  energyBottlenecks: Record<string, number>;
  averageChainScore: number;
  averageCharterScore: number;
  openAnswerHighlights: string[];
};

// Enhanced types for workshop facilitation

export type RunResponse = {
  assessmentId: string;
  participantId: string;
  participantName: string;
  role?: string;
  industry?: string;
  orgSize?: string;
  companyName?: string;
  submittedAt: string;
  stageLevel: string;
  nextLevel: string;
  spiralScores: DimensionScore[];
  energyScores: DimensionScore[];
  chainScore: number;
  charterScore: number;
  primaryBottleneck: string;
  answers: Record<string, number | string | null>;
};

export type QuestionDistribution = {
  questionId: string;
  questionText: string;
  module: AssessmentModule;
  dimension?: string;
  moduleTitle: string;
  sortOrder: number;
  responseCount: number;
  distribution: Record<string, number>;
  averageScore: number;
  outliers: string[];
};

export type InsightType = "finding" | "progression" | "gap" | "theme" | "action";

export type InsightPriority = "high" | "medium" | "low";

export type Insight = {
  type: InsightType;
  priority: InsightPriority;
  title: string;
  description: string;
  supportingData: string[];
  discussionQuestions: string[];
};

export type PaginatedResponses = {
  responses: RunResponse[];
  pagination: {
    page: number;
    total: number;
    pageSize: number;
    totalPages: number;
  };
};
