import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Loop Designer organization module follows Matrix Origin terminology", () => {
  const sources = [
    "src/components/organization-architecture.tsx",
    "src/lib/markdown.ts",
    "src/lib/pdf.ts",
    "src/lib/organization-export.ts",
  ].map((path) => readFileSync(path, "utf8")).join("\n");

  assert.match(sources, /回路协作映射/);
  assert.match(sources, /人机协作拓扑图/);
  assert.match(sources, /HUMAN-AI TOPOLOGY MAP/);
  assert.match(sources, /旧版协作映射/);
  assert.match(sources, /角色、智能体、系统与协作接口映射/);
  assert.doesNotMatch(sources, /OPERATING ARCHITECTURE|组织运行架构|旧版组织映射/);
});
