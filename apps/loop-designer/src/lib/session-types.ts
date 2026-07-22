import type { LoopPlan } from "./plan-schema";
import type { MatrixIntegrationContext } from "@carbon-silicon/types";
import type { IndustryLoopTemplate } from "./industry-loop-template-types";
import type { LegacyWorkflowNode, ProcessTransformation, WorkflowBreakpoint } from "./process-transformation-core";
import type {
  BlueprintOutput,
  DiagnosisResponses,
  DiagnosisSummary,
  QuestionnaireAnswers,
  WorkflowStage,
} from "./workflow";

export type ConversationMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
};

export type SessionContext = {
  currentStep: number;
  workflowStage?: WorkflowStage;
  loopType?: string;
  loopPurpose?: string;
  model?: string;
  lastError?: string;
  templateId?: string;
  templateSnapshot?: IndustryLoopTemplate;
  questionnaire?: QuestionnaireAnswers;
  diagnosisCurrentStep?: number;
  diagnosis?: DiagnosisResponses;
  diagnosisDrafts?: Partial<DiagnosisResponses>;
  entryPoint?: "prework_624";
  legacyFlow?: LegacyWorkflowNode[];
  breakpointScan?: WorkflowBreakpoint[];
  processTransformation?: ProcessTransformation;
};

export type SessionResponses = Record<string, string>;

export type PlanVersion = {
  id: string;
  createdAt: string;
  focus?: string;
  instruction?: string;
  plan: LoopPlan;
};

export type SessionOutputs = {
  messages: ConversationMessage[];
  diagnosisSummary?: DiagnosisSummary;
  blueprint?: BlueprintOutput;
  currentPlan?: LoopPlan;
  versions: PlanVersion[];
  refinementCount: number;
  exports?: Array<{ type: "markdown" | "pdf" | "feishu"; createdAt: string; url?: string }>;
};

export type LoopDesignerSession = {
  id: string;
  status: "in_progress" | "generating" | "submitted" | "failed";
  userId: string;
  enterpriseId: string; // Phase 1: 新增企业ID
  participantSnapshot: Record<string, string | undefined>;
  context: SessionContext;
  responses: SessionResponses;
  outputs: SessionOutputs;
  createdAt: string;
  submittedAt: string | null;
  matrixIntegration: MatrixIntegrationContext | null;
};

export type PlanGenerationJobStatus = "queued" | "running" | "succeeded" | "failed";

export type PlanGenerationJob = {
  id: string;
  sessionId: string;
  enterpriseId: string;
  userId: string;
  status: PlanGenerationJobStatus;
  useOrgMemory: boolean;
  attempts: number;
  maxAttempts: number;
  lockedAt: string | null;
  lockedBy: string | null;
  lastError: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};
