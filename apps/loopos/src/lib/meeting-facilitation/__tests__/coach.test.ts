import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createMeetingCoach } from "../coach";
import { parseMeetingCoachSuggestion } from "../coach-schema";
import type { MeetingContextSnapshot } from "../context-builder";

describe("structured meeting coach", () => {
  test("uses the approved persona and accepts grounded structured output", async () => {
    let systemPrompt = "";
    const coach = createMeetingCoach({
      isAvailable: () => true,
      generate: async (system) => {
        systemPrompt = system;
        return JSON.stringify({
          speech: "产品角色已经确认需要一名发布负责人。现在请明确谁愿意接收。",
          intervention: "SUGGEST_OUTPUT",
          evidenceRefs: ["role:role-product", "project:project-1"],
          confidence: 0.9,
          suggestedOutput: { kind: "ACTION", title: "确认发布负责人" },
        });
      },
    });
    const suggestion = await coach.suggest(tacticalSnapshot(), { type: "OUTPUT_CANDIDATE" });
    assert.equal(suggestion.source, "AI");
    assert.equal(suggestion.intervention, "SUGGEST_OUTPUT");
    assert.match(systemPrompt, /David Allen/);
  });

  test("falls back deterministically when AI is absent or cites unknown facts", async () => {
    const absent = createMeetingCoach({ isAvailable: () => false, generate: async () => "unexpected" });
    assert.equal((await absent.suggest(tacticalSnapshot(), { type: "TURN_NEEDED" })).source, "DETERMINISTIC");

    const hallucinating = createMeetingCoach({
      isAvailable: () => true,
      generate: async () => JSON.stringify({
        speech: "A fact that does not exist.",
        intervention: "REDIRECT_DRIFT",
        evidenceRefs: ["project:invented"],
        confidence: 0.8,
      }),
    });
    const fallback = await hallucinating.suggest(tacticalSnapshot(), { type: "DRIFT_DETECTED" });
    assert.equal(fallback.source, "DETERMINISTIC");
    assert.equal(fallback.evidenceRefs.length, 0);
  });

  test("requires all four objection criteria with known evidence", () => {
    const context = governanceSnapshot();
    const raw = JSON.stringify({
      speech: "初判有效：该提案会移除数据角色履责所需的发布权限。任何参会者都可以推翻此判断。",
      intervention: "ASSESS_OBJECTION",
      evidenceRefs: ["proposal:proposal-1", "role:role-data", "objection:objection-1:r1"],
      confidence: 0.86,
      objectionAssessment: {
        validity: "VALID",
        rationale: "提案新增的权限移除会造成角色履责损害。",
        criteria: [
          criterion("SUBSTANTIAL_HARM", "PASS", ["role:role-data", "objection:objection-1:r1"]),
          criterion("CAUSED_BY_PROPOSAL", "PASS", ["proposal:proposal-1"]),
          criterion("ROLE_RELEVANCE", "PASS", ["role:role-data"]),
          criterion("SAFE_TO_TRY", "FAIL", ["proposal:proposal-1", "objection:objection-1:r1"]),
        ],
      },
    });
    const parsed = parseMeetingCoachSuggestion(raw, new Set(context.facts.map((fact) => fact.ref)));
    assert.equal(parsed.objectionAssessment?.criteria.length, 4);
    assert.equal(parsed.objectionAssessment?.validity, "VALID");

    const incomplete = JSON.parse(raw) as { objectionAssessment: { criteria: unknown[] } };
    incomplete.objectionAssessment.criteria.pop();
    assert.throws(
      () => parseMeetingCoachSuggestion(JSON.stringify(incomplete), new Set(context.facts.map((fact) => fact.ref))),
      /OBJECTION_CRITERIA_INCOMPLETE/,
    );
  });
});

function criterion(
  name: "SUBSTANTIAL_HARM" | "CAUSED_BY_PROPOSAL" | "ROLE_RELEVANCE" | "SAFE_TO_TRY",
  result: "PASS" | "FAIL" | "UNCERTAIN",
  evidenceRefs: readonly string[],
) {
  return { criterion: name, result, rationale: `${name} assessed`, evidenceRefs };
}

function governanceSnapshot(): MeetingContextSnapshot {
  return {
    ...tacticalSnapshot(),
    engine: "GOVERNANCE",
    title: "Governance",
    phase: "AI_ASSESSMENT",
    facts: [
      { ref: "proposal:proposal-1", category: "PROPOSAL", label: "Modify data role", value: { revision: 1 } },
      { ref: "role:role-data", category: "ROLE", label: "Data", value: { accountabilities: "Publish data" } },
      { ref: "objection:objection-1:r1", category: "OBJECTION", label: "Publishing blocked", value: { statement: "Authority removed" } },
    ],
  };
}

function tacticalSnapshot(): MeetingContextSnapshot {
  return {
    organizationId: "org-1",
    meetingId: "meeting-1",
    engine: "TACTICAL",
    title: "Weekly tactical",
    phase: "TRIAGE_ITEM",
    revision: 8,
    paused: false,
    activeAgendaItemId: "agenda-1",
    participantRoleIds: { "participant-1": ["role-product"] },
    agenda: [{ id: "agenda-1", label: "launch", ownerParticipantId: "participant-1" }],
    recentEvents: [{ sequence: 9, type: "AGENDA_NEED_CONFIRMED", payload: { itemId: "agenda-1" } }],
    recentMessages: [{
      id: "message-1",
      participantId: "participant-1",
      roleId: "role-product",
      phase: "TRIAGE_ITEM",
      content: "I need a release owner.",
    }],
    facts: [
      { ref: "meeting:meeting-1", category: "MEETING", label: "Weekly tactical", value: { durationMin: 30 } },
      { ref: "role:role-product", category: "ROLE", label: "Product", value: { accountabilities: "Own release" } },
      { ref: "project:project-1", category: "PROJECT", label: "Launch", value: { status: "ACTIVE" } },
    ],
  };
}
