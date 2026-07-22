import type { BeforeAfterMetrics, LegacyWorkflowNode, LoopTransformationMove, WorkflowBreakpoint } from "./process-transformation-core";

export type IndustryLoopStageMapping = {
  stage: string;
  ai: string;
  human: string;
};

export type IndustryBeforeAfterTemplate = {
  legacyFlow: LegacyWorkflowNode[];
  expectedBreakpoints: WorkflowBreakpoint[];
  transformationMoves: LoopTransformationMove[];
  beforeAfter: BeforeAfterMetrics;
  facilitatorNotes: string[];
  ownerTransition: Array<{
    day: "Day 0" | "Day 7" | "Day 30" | "Day 90";
    focus: string;
    ownerShift: string;
    evidence: string;
  }>;
};

export type IndustryLoopTemplate = {
  id: string;
  order: number;
  title: string;
  industry: string;
  pathType: string;
  marginalEffectRating: string;
  date: string;
  source: string;
  definition: string;
  stageMappings: IndustryLoopStageMapping[];
  marginalEffectAnalysis: string;
  applicableScenarios: string;
  unsuitableScenarios: string;
  tools: string;
  tradeoffs: string;
  cases: string;
  beforeAfterTemplate?: IndustryBeforeAfterTemplate;
};

export type IndustryLoopTemplateSummary = Pick<
  IndustryLoopTemplate,
  "id" | "order" | "title" | "industry" | "pathType" | "marginalEffectRating" | "definition" | "applicableScenarios" | "tradeoffs"
>;
