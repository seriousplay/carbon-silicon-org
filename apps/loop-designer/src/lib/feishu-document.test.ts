import assert from "node:assert/strict";
import test from "node:test";
import { buildFeishuTableDescendants, parseMarkdownForFeishu } from "./feishu-document";

test("parses Markdown tables as native Feishu table items", () => {
  const items = parseMarkdownForFeishu([
    "## 人类角色",
    "| 角色 | 使命 |",
    "|---|---|",
    "| 回路主理人 | 协调资源\\|审批异常 |",
    "后续说明",
  ].join("\n"));

  assert.deepEqual(items, [
    { type: "text", content: "## 人类角色" },
    {
      type: "table",
      rows: [
        ["角色", "使命"],
        ["回路主理人", "协调资源|审批异常"],
      ],
    },
    { type: "text", content: "后续说明" },
  ]);
});

test("builds table, cells and text as one nested-block payload", () => {
  const payload = buildFeishuTableDescendants([
    ["角色", "使命"],
    ["回路主理人", "承担最终责任"],
  ], "table0");

  assert.deepEqual(payload.children_id, ["table0_table"]);
  assert.equal(payload.descendants[0].block_type, 31);
  assert.equal(payload.descendants.length, 9);
  assert.deepEqual(
    ((payload.descendants[2].text as { elements: Array<{ text_run: { text_element_style: object } }> }).elements[0].text_run.text_element_style),
    { bold: true },
  );
});
