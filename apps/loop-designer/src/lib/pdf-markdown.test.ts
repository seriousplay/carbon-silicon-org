import assert from "node:assert/strict";
import test from "node:test";

import { renderMarkdownForPdfHtml } from "./pdf-markdown";

test("PDF markdown renderer turns report tables into HTML tables", () => {
  const html = renderMarkdownForPdfHtml([
    "# 标题",
    "",
    "> 摘要",
    "",
    "## 人类角色",
    "",
    "| 角色 | 使命 | 决策权 |",
    "|---|---|---|",
    "| 回路负责人 | **闭环负责** | 通过 / 驳回 |",
    "",
    "- 下一步任务",
  ].join("\n"));

  assert.match(html, /<h1>标题<\/h1>/);
  assert.match(html, /<blockquote>摘要<\/blockquote>/);
  assert.match(html, /<table>/);
  assert.match(html, /<th>角色<\/th>/);
  assert.match(html, /<strong>闭环负责<\/strong>/);
  assert.match(html, /<ul class="report-list">/);
  assert.doesNotMatch(html, /\|---\|/);
});
