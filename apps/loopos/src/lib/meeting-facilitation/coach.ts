import type { MeetingContextSnapshot } from "./context-builder";
import { parseMeetingCoachSuggestion, type MeetingCoachSuggestion } from "./coach-schema";
import { MEETING_COACH_PERSONAS } from "./personas";

export type MeetingCoachTrigger = Readonly<{
  type:
    | "PHASE_ENTERED"
    | "TURN_NEEDED"
    | "DRIFT_DETECTED"
    | "NEED_UNCLEAR"
    | "OUTPUT_CANDIDATE"
    | "OBJECTION_RECORDED"
    | "PROCESS_QUESTION";
  detail?: Readonly<Record<string, unknown>>;
}>;

export type MeetingCoachDependencies = Readonly<{
  isAvailable(): boolean;
  generate(systemPrompt: string, userPrompt: string): Promise<string>;
}>;

export function createMeetingCoach(dependencies: MeetingCoachDependencies) {
  return {
    async suggest(
      context: MeetingContextSnapshot,
      trigger: MeetingCoachTrigger,
    ): Promise<MeetingCoachSuggestion> {
      if (!dependencies.isAvailable()) return fallbackSuggestion(context, trigger);
      const persona = MEETING_COACH_PERSONAS[context.engine];
      const allowedEvidenceRefs = new Set(context.facts.map((fact) => fact.ref));
      try {
        const raw = await dependencies.generate(
          `${persona.systemPrompt}\n\n你只能使用上下文中带 ref 的事实。输出必须是一个 JSON 对象，不要输出 Markdown。`,
          JSON.stringify({
            task: trigger,
            meeting: {
              engine: context.engine,
              title: context.title,
              phase: context.phase,
              revision: context.revision,
              paused: context.paused,
              activeAgendaItemId: context.activeAgendaItemId,
            },
            participantRoleIds: context.participantRoleIds,
            agenda: context.agenda,
            recentEvents: context.recentEvents,
            recentMessages: context.recentMessages,
            evidenceFacts: context.facts,
            outputContract: outputContract(),
          }),
        );
        return parseMeetingCoachSuggestion(raw, allowedEvidenceRefs);
      } catch {
        return fallbackSuggestion(context, trigger);
      }
    },
  };
}

export async function createDefaultMeetingCoach() {
  const { askAI, isAIAvailable } = await import("@/lib/ai/provider");
  return createMeetingCoach({
    isAvailable: isAIAvailable,
    generate: (systemPrompt, userPrompt) => askAI(systemPrompt, userPrompt, {
      temperature: 0.2,
      maxTokens: 1400,
      timeoutMs: 12_000,
      maxRetries: 1,
    }),
  });
}

function fallbackSuggestion(
  context: MeetingContextSnapshot,
  trigger: MeetingCoachTrigger,
): MeetingCoachSuggestion {
  const phaseSpeech: Record<string, string> = context.engine === "TACTICAL"
    ? {
        ENTRY: "角色确认完成后，我们开始。",
        CHECK_IN: "请当前角色做签到分享，不回应其他人。",
        CHECKLIST_REVIEW: "请只回答完成、未完成或不适用；产生的张力先放入议程。",
        METRICS_REVIEW: "请只确认指标事实；需要处理的内容先加入议程。",
        PROJECT_UPDATES: "请只报告自上次会议以来的变化。",
        BUILD_AGENDA: "请提交一到两个词的议程标签，先不解释。",
        TRIAGE_ITEM: "议程拥有者，你需要什么来推动这件事？",
        CLOSING_ROUND: "请依次分享一句结束感受，不讨论。",
      }
    : {
        ENTRY: "角色确认完成后，我们开始。",
        CHECK_IN: "请当前角色做签到分享，不回应其他人。",
        BUILD_AGENDA: "请提交简短治理张力标签，先不解释。",
        PRESENT_PROPOSAL: "请提案人提出处理当前张力的最小治理变更。",
        CLARIFYING_QUESTIONS: "现在只接受理解性问题，不表达观点。",
        REACTION_ROUND: "请依次回应；提案人只听，不答辩。",
        AMEND_OR_CLARIFY: "请提案人选择修改、澄清或保持原案。",
        OBJECTION_ROUND: "请依次说明是否存在由提案新增的具体损害。",
        AI_ASSESSMENT: "AI 初判暂不可用，请参会者直接按四项标准复核反对。",
        DISTRIBUTED_REVIEW: "任何参会者都可维持或推翻初判，并说明角色依据。",
        INTEGRATION: "先请反对者说明什么改变能消除损害，再请提案人确认仍能处理原张力。",
        ADOPTION_CONFIRMATION: "当前没有维持有效的反对；请由人类显式确认是否采纳。",
        CLOSING_ROUND: "请依次分享一句结束感受，不讨论。",
      };
  return {
    speech: phaseSpeech[context.phase] ?? "请按当前阶段继续。",
    intervention: trigger.type === "PROCESS_QUESTION" ? "EXPLAIN_PROCESS" : "PROMPT_TURN",
    evidenceRefs: [],
    confidence: 1,
    source: "DETERMINISTIC",
  };
}

function outputContract() {
  return {
    speech: "一到三句中文",
    intervention: ["PROMPT_TURN", "REDIRECT_DRIFT", "CLARIFY_NEED", "SUGGEST_OUTPUT", "ASSESS_OBJECTION", "EXPLAIN_PROCESS", "NONE"],
    evidenceRefs: "只能使用 evidenceFacts 中存在的 ref",
    confidence: "0 到 1",
    suggestedTransition: "可选；状态机将再次校验",
    suggestedOutput: "可选；SUGGEST_OUTPUT 时必填",
    objectionAssessment: {
      when: "ASSESS_OBJECTION 时必填",
      validity: ["VALID", "INVALID", "INSUFFICIENT_INFO"],
      criteria: ["SUBSTANTIAL_HARM", "CAUSED_BY_PROPOSAL", "ROLE_RELEVANCE", "SAFE_TO_TRY"],
      criterionResult: ["PASS", "FAIL", "UNCERTAIN"],
      rationale: "必须引用具体 evidenceRefs",
    },
  };
}
