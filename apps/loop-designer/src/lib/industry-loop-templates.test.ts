import test from "node:test";
import assert from "node:assert/strict";
import {
  formatIndustryLoopTemplateForPrompt,
  getIndustryLoopTemplate,
  listIndustryLoopTemplateSummaries,
  listIndustryLoopTemplates,
} from "./industry-loop-templates";

test("industry loop templates expose all built-in cards", () => {
  const templates = listIndustryLoopTemplates();
  assert.equal(templates.length, 16);
  assert.deepEqual(
    Array.from(new Set(templates.map((template) => template.industry))).sort(),
    ["教育", "智能制造", "科技", "跨境出海"].sort(),
  );
  assert.ok(templates.every((template) => template.title.length > 0));
  assert.ok(templates.every((template) => template.stageMappings.length === 5));
});

test("template summaries keep only safe card fields", () => {
  const summaries = listIndustryLoopTemplateSummaries();
  assert.equal(summaries.length, 16);
  assert.ok(summaries[0].id);
  assert.ok(summaries[0].definition !== undefined);
  assert.equal("stageMappings" in summaries[0], false);
});

test("template prompt context makes customer input authoritative", () => {
  const template = getIndustryLoopTemplate("07_AI实时欺诈拦截与自适应跨境支付优化");
  assert.ok(template);

  const prompt = formatIndustryLoopTemplateForPrompt(template);
  assert.match(prompt, /行业回路参考模板/);
  assert.match(prompt, /客户真实输入/);
  assert.match(prompt, /以客户输入为准/);
  assert.doesNotMatch(prompt, /五阶段参考/);
  assert.match(prompt, /组织角色、接口、HITL 和治理设计/);
});

test("industry templates include before/after samples for cold start facilitation", () => {
  const enriched = listIndustryLoopTemplates().filter((template) => template.beforeAfterTemplate);
  assert.ok(enriched.length >= 3);
  const sample = enriched[0].beforeAfterTemplate;
  assert.ok(sample);
  assert.ok(sample.legacyFlow.length >= 3);
  assert.ok(sample.expectedBreakpoints.length >= 1);
  assert.deepEqual(sample.ownerTransition.map((item) => item.day), ["Day 0", "Day 7", "Day 30", "Day 90"]);
});
