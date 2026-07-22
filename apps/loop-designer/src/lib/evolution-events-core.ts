export type LoopEvolutionEventType =
  | "run_round"
  | "version_released"
  | "validation_result"
  | "guardrail_update"
  | "memory_lesson"
  | "interface_change";

export type LoopRunMode = "trial" | "production";
export type TrueLoopSignal = "strong" | "partial" | "missing";
export type ReleaseRecommendation = "continue_trial" | "release_production" | "keep_production" | "pause";
export type LoopReleaseStage = "trial" | "production";

export type RunRoundPayload = {
  runSequence: number;
  runMode: LoopRunMode;
  loopVersionId: string;
  goal: string;
  metricSnapshot: Array<{
    name: string;
    before?: string;
    current: string;
    target?: string;
  }>;
  incidents: string[];
  validatedLearning: string;
  nextChange: string;
  workflowChanged: boolean;
  acceptanceScriptChanged: boolean;
  guardrailChanged: boolean;
  interfaceChanged: boolean;
  trueLoopSignal: TrueLoopSignal;
  releaseRecommendation: ReleaseRecommendation;
};

export type LoopRunReleasePayload = {
  loopVersionId: string;
  releaseStage: LoopReleaseStage;
  releaseReason: string;
  readinessEvidence: string[];
  ownerRole: string;
  releaseAt: string;
};

export type LoopEvolutionEvent = {
  id: string;
  enterpriseId: string;
  assetId: string;
  versionId?: string | null;
  eventType: LoopEvolutionEventType;
  runSequence?: number | null;
  runMode?: LoopRunMode | null;
  payload: RunRoundPayload | LoopRunReleasePayload | Record<string, unknown>;
  createdBy: string;
  createdAt: string;
};

export type RunSummary = {
  completedRuns: number;
  latestRunMode?: LoopRunMode;
  trueLoopSignal?: TrueLoopSignal;
  validatedLearnings: string[];
  latestRecommendation?: ReleaseRecommendation;
  releaseStage?: LoopReleaseStage;
  latestReleaseAt?: string;
};

export function validateRunRoundPayload(payload: RunRoundPayload) {
  if (!Number.isInteger(payload.runSequence) || payload.runSequence <= 0) {
    throw new Error("运行轮次必须是大于 0 的整数");
  }
  if (payload.runMode !== "trial" && payload.runMode !== "production") throw new Error("运行模式无效");
  if (!payload.loopVersionId?.trim()) throw new Error("运行记录必须关联回路版本");
  if (!payload.goal?.trim()) throw new Error("运行记录必须包含本轮目标");
  if (!payload.validatedLearning?.trim()) throw new Error("运行记录必须包含验证结论");
  if (!payload.nextChange?.trim()) throw new Error("运行记录必须包含下一轮改动");
  if (!["strong", "partial", "missing"].includes(payload.trueLoopSignal)) throw new Error("真回路信号无效");
  if (!["continue_trial", "release_production", "keep_production", "pause"].includes(payload.releaseRecommendation)) {
    throw new Error("发布建议无效");
  }
  for (const metric of payload.metricSnapshot) {
    if (!metric.name?.trim() || !metric.current?.trim()) throw new Error("指标记录必须包含名称和当前值");
  }
  return payload;
}

export function validateReleasePayload(payload: LoopRunReleasePayload) {
  if (!payload.loopVersionId?.trim()) throw new Error("版本发布必须关联回路版本");
  if (payload.releaseStage !== "trial" && payload.releaseStage !== "production") throw new Error("发布阶段无效");
  if (!payload.releaseReason?.trim()) throw new Error("版本发布必须包含发布理由");
  if (!payload.ownerRole?.trim()) throw new Error("版本发布必须记录负责人角色");
  if (!payload.releaseAt?.trim()) throw new Error("版本发布必须包含发布时间");
  if (!payload.readinessEvidence.length || payload.readinessEvidence.some((item) => !item.trim())) {
    throw new Error("版本发布必须包含有效证据");
  }
  return payload;
}

export function buildRunSummary(events: LoopEvolutionEvent[]): RunSummary {
  const sorted = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const runs = sorted.filter((event) => event.eventType === "run_round" && isRunRoundPayload(event.payload));
  const releases = sorted.filter((event) => event.eventType === "version_released" && isReleasePayload(event.payload));
  const latestRun = runs.at(-1);
  const latestRelease = releases.at(-1);
  const latestRunPayload = latestRun?.payload as RunRoundPayload | undefined;
  const latestReleasePayload = latestRelease?.payload as LoopRunReleasePayload | undefined;
  return {
    completedRuns: runs.length,
    latestRunMode: latestRunPayload?.runMode,
    trueLoopSignal: latestRunPayload?.trueLoopSignal,
    validatedLearnings: runs
      .map((event) => (event.payload as RunRoundPayload).validatedLearning)
      .filter(Boolean)
      .slice(-5),
    latestRecommendation: latestRunPayload?.releaseRecommendation,
    releaseStage: latestReleasePayload?.releaseStage,
    latestReleaseAt: latestReleasePayload?.releaseAt,
  };
}

export function nextRunSequence(events: LoopEvolutionEvent[]) {
  const maxSequence = events
    .filter((event) => event.eventType === "run_round")
    .map((event) => event.runSequence ?? (isRunRoundPayload(event.payload) ? event.payload.runSequence : 0))
    .reduce((max, value) => Math.max(max, value || 0), 0);
  return maxSequence + 1;
}

function isRunRoundPayload(payload: unknown): payload is RunRoundPayload {
  return Boolean(payload && typeof payload === "object" && "runSequence" in payload && "trueLoopSignal" in payload);
}

function isReleasePayload(payload: unknown): payload is LoopRunReleasePayload {
  return Boolean(payload && typeof payload === "object" && "releaseStage" in payload && "releaseAt" in payload);
}
