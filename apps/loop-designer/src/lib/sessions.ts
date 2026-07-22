import "server-only";

import { randomUUID } from "node:crypto";
import { CONVERSATION_STEPS, getNextStepIndex } from "./conversation";
import { normalizeLoopCells, parseBusinessGoalAnchor, parseWorkflowInput, serializeBusinessGoalAnchor } from "./design-brief";
import { cleanOrganizationName } from "./identity-labels";
import { getIndustryLoopTemplate } from "./industry-loop-templates";
import { generateBlueprintStrategicInsightsWithModel } from "./model";
import {
  buildProcessTransformation,
  legacyNodesFromLoopCells,
  scanWorkflowBreakpoints,
  type LegacyWorkflowNode,
  type WorkflowBreakpoint,
} from "./process-transformation-core";
import { getAdminClient } from "./supabase";
import {
  DIAGNOSIS_STEPS,
  applyPreferredCandidate,
  buildBlueprint,
  buildLoopSeed,
  getPreferredCandidate,
  normalizeDiagnosisAnswer,
  parseQuestionnaire,
  type DiagnosisResponses,
  type QuestionnaireAnswers,
} from "./workflow";
import type { AppUser } from "./app-session";
import {
  type ConversationMessage,
  type LoopDesignerSession,
  type SessionContext,
  type SessionOutputs,
  type SessionResponses,
} from "./session-types";
import type { MatrixIntegrationContext } from "@carbon-silicon/types";
import { loopPlanSchema, type LoopPlan } from "./plan-schema";

type SessionRow = {
  id: string;
  status: LoopDesignerSession["status"];
  user_id: string;
  enterprise_id: string; // Phase 1: 新增企业ID
  participant_snapshot: Record<string, string | undefined> | null;
  context: SessionContext | null;
  responses: SessionResponses | null;
  outputs: SessionOutputs | null;
  created_at: string;
  submitted_at: string | null;
  matrix_integration: MatrixIntegrationContext | null;
};

function normalize(row: SessionRow): LoopDesignerSession {
  return {
    id: row.id,
    status: row.status,
    userId: row.user_id,
    enterpriseId: row.enterprise_id, // Phase 1: 返回企业ID
    participantSnapshot: row.participant_snapshot ?? {},
    context: row.context ?? { currentStep: 0 },
    responses: row.responses ?? {},
    outputs: row.outputs ?? { messages: [], versions: [], refinementCount: 0 },
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
    matrixIntegration: row.matrix_integration ?? null,
  };
}

export async function createIntegratedSession(
  user: AppUser,
  integration: MatrixIntegrationContext,
  circuit: { name: string; purpose: string },
) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const now = new Date().toISOString();
  const welcome: ConversationMessage = {
    id: randomUUID(),
    role: "assistant",
    content: `你正在深化 Matrix Origin 中的“${circuit.name}”。当前目的：${circuit.purpose}。我会先校准业务目标，再把真实工作过程拆成可审阅的回路单元。`,
    createdAt: now,
  };
  const { data, error } = await admin.from("loop_designer_sessions").insert({
    user_id: user.id,
    enterprise_id: user.enterpriseId,
    status: "in_progress",
    participant_snapshot: { displayName: user.displayName, openId: user.openId, tenantKey: user.tenantKey },
    context: { currentStep: 0, workflowStage: "loop_design", loopType: circuit.name, loopPurpose: circuit.purpose },
    responses: {},
    outputs: { messages: [welcome], versions: [], refinementCount: 0 },
    matrix_integration: integration,
  }).select("*").single();
  if (error || !data) throw new Error(error?.message || "Unable to create integrated session");
  return normalize(data as SessionRow);
}

type SessionWorkflowInput = "questionnaire" | "diagnosis" | "loop_design" | "blueprint";

export async function createSession(user: AppUser, input: { templateId?: string; workflow?: SessionWorkflowInput; sourceSessionId?: string } = {}) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const now = new Date().toISOString();
  const template = getIndustryLoopTemplate(input.templateId);
  const requestedWorkflow = input.workflow === "blueprint" ? "questionnaire" : input.workflow || "loop_design";
  const latestQuestionnaire = requestedWorkflow === "questionnaire" || requestedWorkflow === "diagnosis"
    ? (await getLatestQuestionnaire(user)) ?? (await fallbackQuestionnaire(user))
    : null;
  const sourceBlueprint = requestedWorkflow === "loop_design" && input.sourceSessionId
    ? await getPreferredBlueprintFromSession(user, input.sourceSessionId)
    : null;
  if (input.sourceSessionId && !sourceBlueprint) throw new Error("Blueprint source not found");
  const preferredCandidate = sourceBlueprint ? getPreferredCandidate(sourceBlueprint) : null;
  const welcome: ConversationMessage = {
    id: randomUUID(),
    role: "assistant",
    content: preferredCandidate
      ? `已从回路 inbox 带入蓝图锁定回路“${preferredCandidate.title}”。请先校准业务目标锚点，蓝图内容只是建议草稿。${CONVERSATION_STEPS[0].prompt}`
      : template
      ? `你选择了行业参考模板“${template.title}”。它会作为高价值回路参考，但不会替代你的真实组织输入。${CONVERSATION_STEPS[0].prompt}`
      : CONVERSATION_STEPS[0].prompt,
    createdAt: now,
  };
  const outputs: SessionOutputs = requestedWorkflow === "questionnaire" || requestedWorkflow === "diagnosis"
    ? { messages: [], versions: [], refinementCount: 0 }
    : { messages: [welcome], versions: [], refinementCount: 0, ...(sourceBlueprint ? { blueprint: sourceBlueprint } : {}) };
  const context: SessionContext = {
    currentStep: 0,
    workflowStage: requestedWorkflow,
    loopType: preferredCandidate?.title || template?.title,
    templateId: template?.id,
    templateSnapshot: template ?? undefined,
    questionnaire: latestQuestionnaire ?? undefined,
    diagnosisCurrentStep: requestedWorkflow === "diagnosis" ? 0 : undefined,
    diagnosis: requestedWorkflow === "diagnosis" ? {} : undefined,
  };
  const responses: SessionResponses = preferredCandidate && sourceBlueprint
    ? {
        business_goal: serializeBusinessGoalAnchor({
          intent: buildLoopSeed(preferredCandidate, sourceBlueprint),
          goal: sourceBlueprint.battlefield?.strategicGoal || preferredCandidate.valueDescription,
          output: preferredCandidate.title,
          successSignal: preferredCandidate.successCriteria,
          cycle: "由本次设计确认",
          constraints: "高风险承诺必须由人确认，不能绕过治理审阅。",
        }),
      }
    : {};
  const { data, error } = await admin
    .from("loop_designer_sessions")
    .insert({
      user_id: user.id,
      enterprise_id: user.enterpriseId, // Phase 1: 写入企业ID
      status: "in_progress",
      participant_snapshot: {
        displayName: user.displayName,
        openId: user.openId,
        tenantKey: user.tenantKey,
      },
      context,
      responses,
      outputs,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Unable to create session");
  return normalize(data as SessionRow);
}

export async function getOrCreatePreworkQuestionnaireSession(user: AppUser) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const { data } = await admin
    .from("loop_designer_sessions")
    .select("*")
    .eq("enterprise_id", user.enterpriseId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const existing = ((data ?? []) as SessionRow[])
    .map(normalize)
    .find((session) => session.context.workflowStage === "questionnaire");
  if (existing) {
    const context = asPreworkContext(existing.context);
    if (existing.context.entryPoint === "prework_624" && context === existing.context) return existing;
    await updateSession(user, existing.id, { context, status: "in_progress" });
    return { ...existing, context, status: "in_progress" as const };
  }

  const session = await createSession(user, { workflow: "questionnaire" });
  const context = asPreworkContext(session.context);
  await updateSession(user, session.id, { context, status: "in_progress" });
  return { ...session, context, status: "in_progress" as const };
}

export async function getOrCreateBlueprintSession(user: AppUser) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const { data } = await admin
    .from("loop_designer_sessions")
    .select("*")
    .eq("enterprise_id", user.enterpriseId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  const sessions = ((data ?? []) as SessionRow[]).map(normalize);
  const resumable = sessions.find((session) =>
    (session.context.workflowStage === "diagnosis" && hasBlueprintDiagnosisWork(session.context))
    || (session.context.workflowStage === "blueprint" && Boolean(session.outputs.blueprint)),
  );
  if (resumable) return resumable;
  const emptyDiagnosis = sessions.find((session) => session.context.workflowStage === "diagnosis");
  if (emptyDiagnosis) return emptyDiagnosis;
  return createSession(user, { workflow: "diagnosis" });
}

function hasBlueprintDiagnosisWork(context: SessionContext) {
  return (context.diagnosisCurrentStep ?? 0) > 0
    || Object.keys(context.diagnosis ?? {}).length > 0
    || Object.keys(context.diagnosisDrafts ?? {}).length > 0;
}

function asPreworkContext(context: SessionContext): SessionContext {
  if (!isPlaceholderQuestionnaire(context.questionnaire)) {
    return context.entryPoint === "prework_624" ? context : { ...context, entryPoint: "prework_624" };
  }
  const { questionnaire, ...rest } = context;
  void questionnaire;
  return { ...rest, entryPoint: "prework_624" };
}

function isPlaceholderQuestionnaire(questionnaire: QuestionnaireAnswers | undefined) {
  if (!questionnaire) return false;
  return questionnaire.aiConcern === "待通过诊断确认"
    || questionnaire.business === "待通过诊断确认"
    || questionnaire.role === "待补充"
    || questionnaire.scale === "待补充";
}

export async function saveQuestionnaire(user: AppUser, sessionId: string, input: unknown) {
  const session = await getAuthorizedSession(user, sessionId);
  if (!session || session.userId !== user.id) throw new Error("Session not found");
  const questionnaire = parseQuestionnaire(input);
  const context: SessionContext = {
    ...session.context,
    workflowStage: "questionnaire",
    questionnaire,
    lastError: undefined,
  };
  await updateSession(user, sessionId, { context, status: "in_progress" });
  return { ...session, context, status: "in_progress" as const };
}

export async function saveDiagnosisResponse(user: AppUser, sessionId: string, input: { answer: string }) {
  const session = await getAuthorizedSession(user, sessionId);
  if (!session || session.userId !== user.id) throw new Error("Session not found");
  if (!session.context.questionnaire) throw new Error("Questionnaire is required before diagnosis");
  const currentStep = Math.min(session.context.diagnosisCurrentStep ?? 0, DIAGNOSIS_STEPS.length - 1);
  const step = DIAGNOSIS_STEPS[currentStep];
  const normalized = normalizeDiagnosisAnswer(step, input.answer);
  const nextStep = currentStep + 1;
  const diagnosis = {
    ...(session.context.diagnosis ?? {}),
    [step.id]: normalized,
  } as DiagnosisResponses;
  const complete = nextStep >= DIAGNOSIS_STEPS.length;
  const blueprint = complete
    ? await generateBlueprintWithInsights(buildBlueprint(session.context.questionnaire, diagnosis))
    : null;
  const context: SessionContext = {
    ...session.context,
    workflowStage: complete ? "blueprint" : "diagnosis",
    diagnosisCurrentStep: nextStep,
    diagnosis,
    lastError: undefined,
  };
  const diagnosisDrafts = { ...(session.context.diagnosisDrafts ?? {}) };
  delete diagnosisDrafts[step.id];
  if (Object.keys(diagnosisDrafts).length > 0) {
    context.diagnosisDrafts = diagnosisDrafts;
  } else {
    delete context.diagnosisDrafts;
  }
  const outputs: SessionOutputs = blueprint
    ? { ...session.outputs, diagnosisSummary: blueprint.diagnosis, blueprint }
    : { ...session.outputs };
  if (!blueprint) {
    delete outputs.blueprint;
    delete outputs.diagnosisSummary;
  }
  await updateSession(user, sessionId, { context, outputs, status: "in_progress" });
  return { ...session, context, outputs, status: "in_progress" as const };
}

export async function saveDiagnosisDraft(user: AppUser, sessionId: string, input: { stepId: string; answer: string }) {
  const session = await getAuthorizedSession(user, sessionId);
  if (!session || session.userId !== user.id) throw new Error("Session not found");
  if (!session.context.questionnaire) throw new Error("Questionnaire is required before diagnosis");
  const step = DIAGNOSIS_STEPS.find((item) => item.id === input.stepId);
  if (!step) throw new Error("Diagnosis step is invalid");
  if (typeof input.answer !== "string" || input.answer.length > 6000) {
    throw new Error("Draft must contain 0-6000 characters");
  }
  const diagnosisDrafts = {
    ...(session.context.diagnosisDrafts ?? {}),
    [step.id]: input.answer,
  };
  const context: SessionContext = {
    ...session.context,
    workflowStage: "diagnosis",
    diagnosisDrafts,
    lastError: undefined,
  };
  await updateSession(user, sessionId, { context, status: "in_progress" });
  return { ...session, context, status: "in_progress" as const };
}

export async function setDiagnosisStep(user: AppUser, sessionId: string, stepIndex: number) {
  const session = await getAuthorizedSession(user, sessionId);
  if (!session || session.userId !== user.id) throw new Error("Session not found");
  if (!session.context.questionnaire) throw new Error("Questionnaire is required before diagnosis");
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= DIAGNOSIS_STEPS.length) {
    throw new Error("Diagnosis step is invalid");
  }
  const context: SessionContext = {
    ...session.context,
    workflowStage: "diagnosis",
    diagnosisCurrentStep: stepIndex,
    lastError: undefined,
  };
  await updateSession(user, sessionId, { context, status: "in_progress" });
  return { ...session, context, status: "in_progress" as const };
}

export async function generateBlueprint(user: AppUser, sessionId: string) {
  const session = await getAuthorizedSession(user, sessionId);
  if (!session || session.userId !== user.id) throw new Error("Session not found");
  if (!session.context.questionnaire) throw new Error("Questionnaire is required before blueprint generation");
  const blueprint = await generateBlueprintWithInsights(buildBlueprint(session.context.questionnaire, session.context.diagnosis ?? {}));
  const outputs: SessionOutputs = {
    ...session.outputs,
    diagnosisSummary: blueprint.diagnosis,
    blueprint,
  };
  const context: SessionContext = { ...session.context, workflowStage: "blueprint", lastError: undefined };
  await updateSession(user, sessionId, { context, outputs, status: "in_progress" });
  return { ...session, context, outputs, status: "in_progress" as const };
}

async function generateBlueprintWithInsights(blueprint: ReturnType<typeof buildBlueprint>) {
  const strategicInsights = await generateBlueprintStrategicInsightsWithModel(blueprint);
  return { ...blueprint, strategicInsights };
}

export async function selectBlueprintCandidate(user: AppUser, sessionId: string, candidateId: string) {
  const session = await getAuthorizedSession(user, sessionId);
  if (!session || session.userId !== user.id) throw new Error("Session not found");
  if (!session.outputs.blueprint) throw new Error("Blueprint is required before selecting a candidate");
  const blueprint = applyPreferredCandidate(session.outputs.blueprint, candidateId);
  const candidate = getPreferredCandidate(blueprint);
  if (!candidate) throw new Error("Candidate not found");
  const context: SessionContext = {
    ...session.context,
    workflowStage: "blueprint",
    lastError: undefined,
  };
  const outputs: SessionOutputs = {
    ...session.outputs,
    blueprint,
  };
  await updateSession(user, sessionId, { context, outputs, status: "in_progress" });
  return { ...session, context, outputs, status: "in_progress" as const };
}

async function getLatestQuestionnaire(user: AppUser): Promise<QuestionnaireAnswers | null> {
  const admin = getAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("loop_designer_sessions")
    .select("context")
    .eq("enterprise_id", user.enterpriseId)
    .eq("user_id", user.id)
    .not("context->questionnaire", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.context as SessionContext | undefined)?.questionnaire ?? null;
}

async function fallbackQuestionnaire(user: AppUser): Promise<QuestionnaireAnswers> {
  const companyName = await getEnterpriseCompanyName(user);
  return {
    name: user.displayName,
    company: companyName,
    role: "待补充",
    scale: "待补充",
    industry: "其他",
    business: "待通过诊断确认",
    aiConcern: "待通过诊断确认",
    aiStageChoice: "E",
    aiAttitudeChoice: "C",
  };
}

async function getEnterpriseCompanyName(user: AppUser) {
  const admin = getAdminClient();
  if (!admin) return "";
  const { data } = await admin
    .from("loop_designer_enterprises")
    .select("company_name")
    .eq("id", user.enterpriseId)
    .maybeSingle();
  return cleanOrganizationName(data?.company_name);
}

async function getPreferredBlueprintFromSession(user: AppUser, sessionId: string) {
  const admin = getAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("loop_designer_sessions")
    .select("outputs")
    .eq("enterprise_id", user.enterpriseId)
    .eq("user_id", user.id)
    .eq("id", sessionId)
    .not("outputs->blueprint->preferredCandidateId", "is", null)
    .maybeSingle();
  return (data?.outputs as SessionOutputs | undefined)?.blueprint ?? null;
}

export async function listLoopInboxSessions(user: AppUser) {
  const admin = getAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("loop_designer_sessions")
    .select("*")
    .eq("enterprise_id", user.enterpriseId)
    .eq("user_id", user.id)
    .not("outputs->blueprint->preferredCandidateId", "is", null)
    .order("created_at", { ascending: false })
    .limit(12);
  const deduped: LoopDesignerSession[] = [];
  const seen = new Set<string>();
  for (const session of ((data ?? []) as SessionRow[])
    .map(normalize)
    .filter((session) => !session.outputs.currentPlan)) {
    const candidate = session.outputs.blueprint ? getPreferredCandidate(session.outputs.blueprint) : null;
    const key = normalizeInboxLoopKey(candidate?.title || session.context.loopType || session.id);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(session);
    if (deduped.length >= 6) break;
  }
  return deduped;
}

export async function listRecentSessions(user: AppUser) {
  const admin = getAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("loop_designer_sessions")
    .select("*")
    .eq("enterprise_id", user.enterpriseId) // Phase 1: 强制企业隔离
    .eq("user_id", user.id) // 再过滤用户（双重保障）
    .order("created_at", { ascending: false })
    .limit(8);
  return ((data ?? []) as SessionRow[]).map(normalize);
}

export async function listCompletedLoopDesignSessions(user: AppUser) {
  const admin = getAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("loop_designer_sessions")
    .select("*")
    .eq("enterprise_id", user.enterpriseId)
    .eq("user_id", user.id)
    .eq("status", "submitted")
    .not("outputs->currentPlan", "is", null)
    .order("created_at", { ascending: false })
    .limit(6);
  return ((data ?? []) as SessionRow[]).map(normalize);
}

function normalizeInboxLoopKey(value: string) {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

export async function getAuthorizedSession(user: AppUser, sessionId: string) {
  const admin = getAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("loop_designer_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("enterprise_id", user.enterpriseId) // Phase 1: 强制企业隔离
    .eq("user_id", user.id) // 双重保障
    .maybeSingle();
  if (error || !data) return null;
  return normalize(data as SessionRow);
}

export async function saveAnswer(
  user: AppUser,
  sessionId: string,
  input: { answer: string; loopType?: string },
) {
  const session = await getAuthorizedSession(user, sessionId);
  if (!session || session.userId !== user.id) throw new Error("Session not found");
  if (session.context.currentStep >= CONVERSATION_STEPS.length) throw new Error("Collection is already complete");

  const answer = input.answer.trim();
  if (!answer || answer.length > 6000) throw new Error("Answer must contain 1-6000 characters");
  const current = CONVERSATION_STEPS[session.context.currentStep];
  const now = new Date().toISOString();
  const nextStep = getNextStepIndex(session.context.currentStep);
  const messages: ConversationMessage[] = [
    ...session.outputs.messages,
    { id: randomUUID(), role: "user", content: summarizeAnswerForChat(current.id, answer), createdAt: now },
  ];
  if (nextStep < CONVERSATION_STEPS.length) {
    messages.push({
      id: randomUUID(),
      role: "assistant",
      content: CONVERSATION_STEPS[nextStep].prompt,
      createdAt: now,
    });
  } else {
    messages.push({
      id: randomUUID(),
      role: "assistant",
      content: "信息已经完整。右侧摘要保留了完整输入，现在可以生成一份可执行的回路设计。",
      createdAt: now,
    });
  }

  const nextContextPatch = current.id === "workflow"
    ? buildWorkflowBreakpointContext(answer)
    : {};
  const context = {
    ...session.context,
    currentStep: nextStep,
    loopType: input.loopType || session.context.loopType,
    ...nextContextPatch,
    lastError: undefined,
  };
  const responses = { ...session.responses, [current.id]: answer };
  const outputs = { ...session.outputs, messages };
  await updateSession(user, sessionId, { context, responses, outputs, status: "in_progress" });
  return { ...session, context, responses, outputs, status: "in_progress" as const };
}

function buildWorkflowBreakpointContext(answer: string): Partial<SessionContext> {
  const workflow = parseWorkflowInput(answer);
  if (!workflow) return {};
  const legacyFlow = legacyNodesFromLoopCells(normalizeLoopCells(workflow));
  return legacyFlow.length
    ? { legacyFlow, breakpointScan: scanWorkflowBreakpoints(legacyFlow), processTransformation: undefined }
    : {};
}

export async function saveLegacyFlow(user: AppUser, sessionId: string, nodes: LegacyWorkflowNode[]) {
  const session = await getAuthorizedSession(user, sessionId);
  if (!session || session.userId !== user.id) throw new Error("Session not found");
  const legacyFlow = normalizeLegacyNodes(nodes);
  if (!legacyFlow.length) throw new Error("请至少填写一个旧流程节点");
  const context: SessionContext = {
    ...session.context,
    legacyFlow,
    breakpointScan: undefined,
    processTransformation: undefined,
    lastError: undefined,
  };
  await updateSession(user, sessionId, { context, status: "in_progress" });
  return { ...session, context, status: "in_progress" as const };
}

export async function scanSessionBreakpoints(user: AppUser, sessionId: string) {
  const session = await getAuthorizedSession(user, sessionId);
  if (!session || session.userId !== user.id) throw new Error("Session not found");
  const legacyFlow = session.context.legacyFlow?.length ? session.context.legacyFlow : legacyFlowFromWorkflowResponse(session);
  if (!legacyFlow.length) throw new Error("请先保存旧流程节点，再运行断点扫描");
  const goal = parseBusinessGoalAnchor(session.responses.business_goal);
  const breakpointScan = scanWorkflowBreakpoints(legacyFlow, goal?.successSignal);
  const context: SessionContext = {
    ...session.context,
    legacyFlow,
    breakpointScan,
    processTransformation: undefined,
    lastError: undefined,
  };
  await updateSession(user, sessionId, { context, status: "in_progress" });
  return { ...session, context, status: "in_progress" as const };
}

export async function updateSessionBreakpoint(
  user: AppUser,
  sessionId: string,
  breakpointId: string,
  patch: Partial<Pick<WorkflowBreakpoint, "severity" | "diagnosis" | "evidence" | "suggestedIntervention" | "confidence" | "userConfirmed">>,
) {
  const session = await getAuthorizedSession(user, sessionId);
  if (!session || session.userId !== user.id) throw new Error("Session not found");
  const breakpointScan = session.context.breakpointScan ?? [];
  const index = breakpointScan.findIndex((breakpoint) => breakpoint.id === breakpointId);
  if (index < 0) throw new Error("Breakpoint not found");
  const nextBreakpoints = breakpointScan.map((breakpoint) =>
    breakpoint.id === breakpointId ? { ...breakpoint, ...patch } : breakpoint,
  );
  const context: SessionContext = {
    ...session.context,
    breakpointScan: nextBreakpoints,
    processTransformation: undefined,
    lastError: undefined,
  };
  await updateSession(user, sessionId, { context, status: "in_progress" });
  return { ...session, context, status: "in_progress" as const };
}

export async function buildSessionTransformationPreview(user: AppUser, sessionId: string) {
  const session = await getAuthorizedSession(user, sessionId);
  if (!session || session.userId !== user.id) throw new Error("Session not found");
  const legacyFlow = session.context.legacyFlow?.length ? session.context.legacyFlow : legacyFlowFromWorkflowResponse(session);
  if (!legacyFlow.length) throw new Error("请先保存旧流程节点，再生成重构预览");
  const goal = parseBusinessGoalAnchor(session.responses.business_goal);
  const breakpoints = session.context.breakpointScan?.length
    ? session.context.breakpointScan
    : scanWorkflowBreakpoints(legacyFlow, goal?.successSignal);
  const processTransformation = buildProcessTransformation({
    legacyNodes: legacyFlow,
    successSignal: goal?.successSignal,
    confirmedBreakpoints: breakpoints,
  });
  const context: SessionContext = {
    ...session.context,
    legacyFlow,
    breakpointScan: breakpoints,
    processTransformation,
    lastError: undefined,
  };
  const outputs: SessionOutputs = session.outputs.currentPlan
    ? { ...session.outputs, currentPlan: { ...session.outputs.currentPlan, processTransformation } }
    : session.outputs;
  await updateSession(user, sessionId, { context, outputs, status: "in_progress" });
  return { ...session, context, outputs, status: "in_progress" as const };
}

function summarizeAnswerForChat(stepId: string, answer: string) {
  if (stepId === "business_goal") {
    return "已保存：业务目标锚点\n意图、目标、输出、成功标志、周期和约束已进入右侧摘要。";
  }
  if (stepId === "workflow") {
    const cellCount = answer.match(/单元ID：/g)?.length;
    return `已保存：业务回路单元${cellCount ? `（${cellCount} 个单元）` : ""}\n完整步骤和单元事实已进入右侧摘要。`;
  }
  if (stepId === "diagnosis") {
    return "已保存：拆解确认与补充说明\n完整确认内容已进入右侧摘要。";
  }
  return "已保存：用户输入\n完整内容已进入右侧摘要。";
}

function legacyFlowFromWorkflowResponse(session: LoopDesignerSession) {
  const workflow = parseWorkflowInput(session.responses.workflow);
  return workflow ? legacyNodesFromLoopCells(normalizeLoopCells(workflow)) : [];
}

function normalizeLegacyNodes(nodes: LegacyWorkflowNode[]) {
  return nodes
    .filter((node) => node && (node.action?.trim() || node.input?.trim() || node.output?.trim()))
    .map((node, index) => ({
      id: node.id?.trim() || `legacy-node-${index + 1}`,
      order: Number.isInteger(node.order) && node.order > 0 ? node.order : index + 1,
      action: node.action?.trim() || "",
      owner: node.owner?.trim() || "",
      input: node.input?.trim() || "",
      output: node.output?.trim() || "",
      handoffTo: node.handoffTo?.trim() || undefined,
      waitFor: node.waitFor?.trim() || undefined,
      decision: node.decision?.trim() || undefined,
      approval: node.approval?.trim() || undefined,
      system: node.system?.trim() || undefined,
      acceptance: node.acceptance?.trim() || undefined,
      verification: node.verification?.trim() || undefined,
      painNote: node.painNote?.trim() || undefined,
    }));
}

export async function updateSession(
  user: AppUser,
  sessionId: string,
  values: Partial<Pick<LoopDesignerSession, "status" | "context" | "responses" | "outputs" | "matrixIntegration">>,
) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const payload: Record<string, unknown> = {};
  if (values.status) payload.status = values.status;
  if (values.context) payload.context = values.context;
  if (values.responses) payload.responses = values.responses;
  if (values.outputs) payload.outputs = values.outputs;
  if (values.matrixIntegration) payload.matrix_integration = values.matrixIntegration;
  if (values.status === "submitted") payload.submitted_at = new Date().toISOString();
  payload.updated_at = new Date().toISOString();
  const { error } = await admin
    .from("loop_designer_sessions")
    .update(payload)
    .eq("id", sessionId)
    .eq("enterprise_id", user.enterpriseId) // Phase 1: 强制企业隔离
    .eq("user_id", user.id); // 防止同企业横向越权
  if (error) throw new Error(error.message);
}

export async function renameSession(user: AppUser, sessionId: string, title: string) {
  const session = await getAuthorizedSession(user, sessionId);
  if (!session) throw new Error("Session not found");
  const normalized = title.trim();
  if (!normalized || normalized.length > 120) throw new Error("Title must contain 1-120 characters");
  const context = { ...session.context, loopType: normalized };
  const outputs: SessionOutputs = session.outputs.currentPlan
    ? { ...session.outputs, currentPlan: { ...session.outputs.currentPlan, title: normalized } }
    : session.outputs;
  await updateSession(user, sessionId, { context, outputs });
  return { ...session, context, outputs };
}

type ReopenStepId = "business_goal" | "workflow" | "diagnosis";

export async function reopenSessionForEditing(user: AppUser, sessionId: string, stepId: ReopenStepId) {
  const session = await getAuthorizedSession(user, sessionId);
  if (!session) throw new Error("Session not found");
  const stepIndex = CONVERSATION_STEPS.findIndex((step) => step.id === stepId);
  if (stepIndex < 0) throw new Error("Unknown edit step");
  const now = new Date().toISOString();
  const currentPlan = session.outputs.currentPlan;
  const lastVersion = session.outputs.versions.at(-1);
  const shouldPreserveCurrentPlan = Boolean(
    currentPlan &&
    (!lastVersion || JSON.stringify(lastVersion.plan) !== JSON.stringify(currentPlan)),
  );
  const versions = currentPlan && shouldPreserveCurrentPlan
    ? [...session.outputs.versions, { id: randomUUID(), createdAt: now, focus: "重新编辑前版本", instruction: "用户回到输入重新编辑前自动保存。", plan: currentPlan }]
    : session.outputs.versions;
  const { currentPlan: _currentPlan, ...outputsWithoutCurrentPlan } = session.outputs;
  void _currentPlan;
  const outputs: SessionOutputs = {
    ...outputsWithoutCurrentPlan,
    versions,
    messages: [
      ...session.outputs.messages,
      {
        id: randomUUID(),
        role: "assistant",
        content: `已回到“${CONVERSATION_STEPS[stepIndex].title}”。上一版方案已保留，修改输入后可以重新生成一版。`,
        createdAt: now,
      },
    ],
  };
  const context: SessionContext = {
    ...session.context,
    currentStep: stepIndex,
    lastError: undefined,
  };
  await updateSession(user, sessionId, { status: "in_progress", context, outputs });
  return { ...session, status: "in_progress" as const, context, outputs };
}

export async function updateLoopPlanCellRuntime(
  user: AppUser,
  sessionId: string,
  input: {
    cellId: string;
    actorAssignments?: LoopPlan["toBeLoopCells"][number]["actorAssignments"];
    controlProfile?: LoopPlan["toBeLoopCells"][number]["controlProfile"];
    timeEstimate?: LoopPlan["toBeLoopCells"][number]["timeEstimate"];
  },
) {
  const session = await getAuthorizedSession(user, sessionId);
  if (!session?.outputs.currentPlan) throw new Error("Session plan not found");
  const cellIndex = session.outputs.currentPlan.toBeLoopCells.findIndex((cell) => cell.cellId === input.cellId);
  if (cellIndex < 0) throw new Error("Loop cell not found");

  const toBeLoopCells = session.outputs.currentPlan.toBeLoopCells.map((cell, index) =>
    index === cellIndex
      ? {
          ...cell,
          ...(input.actorAssignments ? { actorAssignments: input.actorAssignments } : {}),
          ...(input.controlProfile ? { controlProfile: input.controlProfile } : {}),
          ...(input.timeEstimate ? { timeEstimate: input.timeEstimate } : {}),
        }
      : cell,
  );
  const currentPlan = { ...session.outputs.currentPlan, toBeLoopCells };
  const parsedPlan = loopPlanSchema.safeParse(currentPlan);
  if (!parsedPlan.success) throw new Error("Invalid plan runtime patch");
  const outputs: SessionOutputs = {
    ...session.outputs,
    currentPlan: parsedPlan.data,
  };
  await updateSession(user, sessionId, { outputs });
  return { ...session, outputs };
}

export async function deleteSession(user: AppUser, sessionId: string) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const { error } = await admin
    .from("loop_designer_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("enterprise_id", user.enterpriseId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}
