import type { IndustryLoopTemplate } from "./industry-loop-template-types";
import type { LoopPlan } from "./plan-schema";
import { withMaturityMapping } from "./maturity";
import type { RunSummary } from "./evolution-events-core";

export type BuildLoopStudyIdempotencyKeyInput = {
  sessionId: string;
  sessionVersionId?: string;
  loopVersionId?: string;
};

export function buildLoopStudyIdempotencyKey(input: BuildLoopStudyIdempotencyKeyInput) {
  return `loop-study:${input.sessionId}:${input.loopVersionId || input.sessionVersionId || "initial"}`;
}

export type MatrixStudyErrorInput = {
  code?: string;
  message?: string;
};

export function normalizeMatrixStudyError(error: MatrixStudyErrorInput | undefined, fallback = "Matrix 拒绝接收 Study") {
  const code = error?.code || "";
  const message = error?.message || "";
  const signal = `${code} ${message}`.toLowerCase();
  if (
    code === "staleBaseVersion"
    || signal.includes("stalebaseversion")
    || signal.includes("stale base")
    || (message.includes("基础版本") && (message.includes("变化") || message.includes("过期")))
    || (message.includes("Matrix") && message.includes("新版本"))
    || (signal.includes("baseversion") && signal.includes("stale"))
  ) {
    return "Matrix 已有新版本，请从 Matrix 重新进入";
  }
  return message || fallback;
}

export function buildMethodologyAnalysis(plan: LoopPlan, template?: IndustryLoopTemplate, runSummary?: RunSummary) {
  const enrichedPlan = withMaturityMapping(plan);
  const templateAnalysis = template
    ? {
        industryTemplate: {
          id: template.id,
          title: template.title,
          industry: template.industry,
          pathType: template.pathType,
          marginalEffectRating: template.marginalEffectRating,
        },
      }
    : {};
  return {
    ...templateAnalysis,
    coverage: {
      loopCells: enrichedPlan.toBeLoopCells.map((cell) => ({
        cellId: cell.cellId,
        action: cell.action,
        recommendedMode: cell.recommendedMode,
        actorAssignments: cell.actorAssignments,
        controlProfile: cell.controlProfile,
        timeEstimate: cell.timeEstimate,
        acceptanceSignal: cell.acceptanceSignal,
      })),
    },
    processTransformation: enrichedPlan.processTransformation,
    runSummary,
    alignment: enrichedPlan.maturityMapping?.alignment,
    maturity: enrichedPlan.maturityMapping?.maturity,
    oneLineDiagnosis: enrichedPlan.maturityMapping?.oneLineDiagnosis,
    highlightDimensions: enrichedPlan.maturityMapping?.highlightDimensions,
    bottlenecks: enrichedPlan.maturityMapping?.bottlenecks,
    recommendedAction: enrichedPlan.maturityMapping?.recommendedAction,
    upgradeSuggestions: enrichedPlan.maturityMapping?.upgradeSuggestions,
    note: "Loop Designer 诊断仅作为审阅证据，不绕过 Matrix Origin ChangeSet 审阅机制。",
  };
}
