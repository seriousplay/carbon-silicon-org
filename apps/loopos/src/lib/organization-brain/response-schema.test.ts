import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ORGANIZATION_BRAIN_FIELD_LABELS,
  ORGANIZATION_BRAIN_RESOURCE_LABELS,
  OrganizationBrainModelOutputError,
  parseOrganizationBrainModelOutput,
  type OrganizationBrainModelOutputErrorCode,
} from "./response-schema";
import { BRAIN_QUERY_CATALOG, BRAIN_QUERY_RESOURCES } from "./query-plan";

const evidence = [
  { evidenceId: `ev_${"a".repeat(64)}`, fields: ["name", "purpose"] },
  { evidenceId: `ev_${"b".repeat(64)}`, fields: ["title", "status"] },
] as const;

function rejectsOutput(raw: string, code: OrganizationBrainModelOutputErrorCode): void {
  assert.throws(
    () => parseOrganizationBrainModelOutput(raw, evidence),
    (error) =>
      error instanceof OrganizationBrainModelOutputError && error.code === code,
  );
}

describe("V5-M1-D1 frozen response labels", () => {
  test("covers every catalog resource and display field", () => {
    assert.deepEqual(Object.keys(ORGANIZATION_BRAIN_RESOURCE_LABELS), [
      ...BRAIN_QUERY_RESOURCES,
    ]);
    assert.equal(Object.isFrozen(ORGANIZATION_BRAIN_RESOURCE_LABELS), true);
    assert.equal(Object.isFrozen(ORGANIZATION_BRAIN_FIELD_LABELS), true);
    for (const resource of BRAIN_QUERY_RESOURCES) {
      assert.ok(ORGANIZATION_BRAIN_RESOURCE_LABELS[resource]);
      for (const field of BRAIN_QUERY_CATALOG[resource].displayFields) {
        assert.ok(ORGANIZATION_BRAIN_FIELD_LABELS[field], `${resource}.${field}`);
      }
    }
  });

  test("uses the exact V5-M3-B Goal resource and field labels", () => {
    assert.deepEqual(
      Object.fromEntries(
        [
          "goalCycles",
          "goals",
          "goalTargets",
          "goalEffectiveCheckIns",
          "goalActiveWorkLinks",
        ].map((resource) => [
          resource,
          ORGANIZATION_BRAIN_RESOURCE_LABELS[resource as keyof typeof ORGANIZATION_BRAIN_RESOURCE_LABELS],
        ]),
      ),
      {
        goalCycles: "目标周期",
        goals: "目标",
        goalTargets: "目标靶点",
        goalEffectiveCheckIns: "目标有效检查",
        goalActiveWorkLinks: "目标工作关联",
      },
    );
    assert.deepEqual(
      Object.fromEntries(
        [
          "startAt",
          "endAt",
          "checkInCadenceDays",
          "intendedOutcome",
          "adoptedAt",
          "terminalOutcome",
          "terminalAt",
          "position",
          "label",
          "baselineValue",
          "desiredValue",
          "unit",
          "fact",
          "evidenceSummary",
          "currentValue",
          "milestoneState",
          "acceptanceEvidence",
          "assessment",
          "recordedAt",
          "objectLabel",
          "objectStatus",
        ].map((field) => [field, ORGANIZATION_BRAIN_FIELD_LABELS[field]]),
      ),
      {
        startAt: "开始时间",
        endAt: "结束时间",
        checkInCadenceDays: "检查节奏（天）",
        intendedOutcome: "预期成果",
        adoptedAt: "采纳时间",
        terminalOutcome: "终态结果",
        terminalAt: "终止时间",
        position: "顺序",
        label: "指标",
        baselineValue: "基线值",
        desiredValue: "目标值",
        unit: "单位",
        fact: "事实",
        evidenceSummary: "证据摘要",
        currentValue: "当前值",
        milestoneState: "里程碑状态",
        acceptanceEvidence: "验收证据",
        assessment: "评估",
        recordedAt: "记录时间",
        objectLabel: "工作对象",
        objectStatus: "工作对象状态",
      },
    );
  });
});

describe("V5-M1-D1 exact model response parsing", () => {
  test("accepts bounded FACT and visibly labeled prose categories", () => {
    const parsed = parseOrganizationBrainModelOutput(
      JSON.stringify({
        schemaVersion: 1,
        items: [
          { type: "FACT", citation: evidence[0].evidenceId, fields: ["purpose", "name"] },
          { type: "INFERENCE", text: "这可能表明目标边界仍需澄清。", citations: [evidence[0].evidenceId] },
          { type: "RECOMMENDATION", text: "建议在下次会议核对目标。", citations: [evidence[0].evidenceId, evidence[1].evidenceId] },
          { type: "MISSING_EVIDENCE", text: "缺少最近一次复盘记录。" },
        ],
      }),
      evidence,
    );

    assert.deepEqual(parsed[0], {
      type: "FACT",
      citation: evidence[0].evidenceId,
      fields: ["name", "purpose"],
    });
    assert.deepEqual(parsed[1], {
      type: "INFERENCE",
      text: "这可能表明目标边界仍需澄清。",
      citations: [evidence[0].evidenceId],
    });
  });

  test("allows one evidence ID across distinct claims", () => {
    const parsed = parseOrganizationBrainModelOutput(
      JSON.stringify({
        schemaVersion: 1,
        items: [
          { type: "INFERENCE", text: "推断一", citations: [evidence[0].evidenceId] },
          { type: "INFERENCE", text: "推断二", citations: [evidence[0].evidenceId] },
        ],
      }),
      evidence,
    );
    assert.equal(parsed.length, 2);
  });

  test("rejects malformed JSON, Markdown fences, extra keys, and unknown labels", () => {
    rejectsOutput("not json", "OUTPUT_SCHEMA_INVALID");
    rejectsOutput('```json\n{"schemaVersion":1,"items":[]}\n```', "OUTPUT_SCHEMA_INVALID");
    rejectsOutput(JSON.stringify({ schemaVersion: 1, items: [], url: "/app" }), "OUTPUT_SCHEMA_INVALID");
    rejectsOutput(
      JSON.stringify({ schemaVersion: 1, items: [{ type: "OPINION", text: "x" }] }),
      "OUTPUT_SCHEMA_INVALID",
    );
  });

  test("rejects factual prose and model-supplied source or operation fields", () => {
    rejectsOutput(
      JSON.stringify({
        schemaVersion: 1,
        items: [{ type: "FACT", citation: evidence[0].evidenceId, fields: ["name"], text: "自行断言" }],
      }),
      "OUTPUT_SCHEMA_INVALID",
    );
    rejectsOutput(
      JSON.stringify({
        schemaVersion: 1,
        items: [{ type: "RECOMMENDATION", text: "建议核对", citations: [evidence[0].evidenceId], action: "write" }],
      }),
      "OUTPUT_SCHEMA_INVALID",
    );
    rejectsOutput(
      JSON.stringify({
        schemaVersion: 1,
        items: [{ type: "MISSING_EVIDENCE", text: "缺少资料", url: "https://invalid.test" }],
      }),
      "OUTPUT_SCHEMA_INVALID",
    );
  });

  test("rejects invented, duplicate, and missing citations", () => {
    rejectsOutput(
      JSON.stringify({
        schemaVersion: 1,
        items: [{ type: "FACT", citation: `ev_${"c".repeat(64)}`, fields: ["name"] }],
      }),
      "CITATION_INVALID",
    );
    rejectsOutput(
      JSON.stringify({
        schemaVersion: 1,
        items: [{ type: "INFERENCE", text: "推断", citations: [evidence[0].evidenceId, evidence[0].evidenceId] }],
      }),
      "CITATION_INVALID",
    );
    rejectsOutput(
      JSON.stringify({
        schemaVersion: 1,
        items: [{ type: "RECOMMENDATION", text: "建议", citations: [] }],
      }),
      "CITATION_INVALID",
    );
  });

  test("rejects unsupported or duplicate FACT fields", () => {
    rejectsOutput(
      JSON.stringify({
        schemaVersion: 1,
        items: [{ type: "FACT", citation: evidence[0].evidenceId, fields: ["recordId"] }],
      }),
      "UNSUPPORTED_FACT",
    );
    rejectsOutput(
      JSON.stringify({
        schemaVersion: 1,
        items: [{ type: "FACT", citation: evidence[0].evidenceId, fields: ["name", "name"] }],
      }),
      "UNSUPPORTED_FACT",
    );
  });

  test("rejects canonical duplicate items even when list order differs", () => {
    rejectsOutput(
      JSON.stringify({
        schemaVersion: 1,
        items: [
          { type: "FACT", citation: evidence[0].evidenceId, fields: ["name", "purpose"] },
          { type: "FACT", citation: evidence[0].evidenceId, fields: ["purpose", "name"] },
        ],
      }),
      "OUTPUT_SCHEMA_INVALID",
    );
    rejectsOutput(
      JSON.stringify({
        schemaVersion: 1,
        items: [
          { type: "INFERENCE", text: "同一推断", citations: [evidence[1].evidenceId, evidence[0].evidenceId] },
          { type: "INFERENCE", text: "同一推断", citations: [evidence[0].evidenceId, evidence[1].evidenceId] },
        ],
      }),
      "OUTPUT_SCHEMA_INVALID",
    );
  });

  test("enforces output, item, category, citation, and narrative bounds", () => {
    rejectsOutput(" ".repeat(16 * 1024 + 1), "OUTPUT_LIMIT_EXCEEDED");
    rejectsOutput(
      JSON.stringify({
        schemaVersion: 1,
        items: Array.from({ length: 25 }, (_, index) => ({
          type: "MISSING_EVIDENCE",
          text: `缺失 ${index}`,
        })),
      }),
      "OUTPUT_SCHEMA_INVALID",
    );
    rejectsOutput(
      JSON.stringify({
        schemaVersion: 1,
        items: Array.from({ length: 7 }, (_, index) => ({
          type: "INFERENCE",
          text: `推断 ${index}`,
          citations: [evidence[0].evidenceId],
        })),
      }),
      "OUTPUT_SCHEMA_INVALID",
    );
    rejectsOutput(
      JSON.stringify({
        schemaVersion: 1,
        items: [{
          type: "INFERENCE",
          text: "推断",
          citations: Array.from({ length: 6 }, (_, index) => `ev_${String(index).repeat(64)}`),
        }],
      }),
      "CITATION_INVALID",
    );
    rejectsOutput(
      JSON.stringify({
        schemaVersion: 1,
        items: [{ type: "MISSING_EVIDENCE", text: "界".repeat(201) }],
      }),
      "OUTPUT_SCHEMA_INVALID",
    );
  });

  test("accepts exact output, item, category, citation, FACT, and narrative maxima", () => {
    const manyEvidence = Array.from({ length: 21 }, (_, index) => ({
      evidenceId: `ev_${index.toString(16).padStart(64, "0")}`,
      fields: ["name"],
    }));
    const maximumItems = [
      ...Array.from({ length: 6 }, (_, index) => ({
        type: "FACT",
        citation: manyEvidence[index]!.evidenceId,
        fields: ["name"],
      })),
      ...Array.from({ length: 6 }, (_, index) => ({
        type: "INFERENCE",
        text: `推断 ${index}`,
        citations: manyEvidence.slice(0, 5).map((entry) => entry.evidenceId),
      })),
      ...Array.from({ length: 6 }, (_, index) => ({
        type: "RECOMMENDATION",
        text: `建议 ${index}`,
        citations: [manyEvidence[index]!.evidenceId],
      })),
      ...Array.from({ length: 6 }, (_, index) => ({
        type: "MISSING_EVIDENCE",
        text: index === 0 ? "界".repeat(200) : `缺失 ${index}`,
      })),
    ];
    assert.equal(
      parseOrganizationBrainModelOutput(
        JSON.stringify({ schemaVersion: 1, items: maximumItems }),
        manyEvidence,
      ).length,
      24,
    );

    const twentyFacts = Array.from({ length: 20 }, (_, index) => ({
      type: "FACT",
      citation: manyEvidence[index]!.evidenceId,
      fields: ["name"],
    }));
    assert.equal(
      parseOrganizationBrainModelOutput(
        JSON.stringify({ schemaVersion: 1, items: twentyFacts }),
        manyEvidence,
      ).length,
      20,
    );
    assert.throws(
      () => parseOrganizationBrainModelOutput(
        JSON.stringify({
          schemaVersion: 1,
          items: [...twentyFacts, {
            type: "FACT",
            citation: manyEvidence[20]!.evidenceId,
            fields: ["name"],
          }],
        }),
        manyEvidence,
      ),
      (error) =>
        error instanceof OrganizationBrainModelOutputError &&
        error.code === "OUTPUT_SCHEMA_INVALID",
    );

    const minimal = JSON.stringify({ schemaVersion: 1, items: [] });
    const exactSize = minimal + " ".repeat(16 * 1024 - Buffer.byteLength(minimal, "utf8"));
    assert.deepEqual(parseOrganizationBrainModelOutput(exactSize, evidence), []);
  });
});
