import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./read-model.ts", import.meta.url), "utf8");

test("business loop read model stays read-only in M3-C", () => {
  assert.match(source, /findMany/);
  for (const forbidden of ["create(", "update(", "upsert(", "delete(", "$executeRaw"]) {
    assert.doesNotMatch(source, new RegExp(forbidden.replace("(", "\\(").replace("$", "\\$")));
  }
});

test("business loop read model preserves CircleInterface fallback", () => {
  assert.match(source, /circle\.findMany/);
  assert.match(source, /circleInterface\.count/);
  assert.match(source, /circleInterface\.findMany/);
  assert.match(source, /take: 8/);
  assert.match(source, /candidateFlows/);
  assert.match(source, /readyInterfaces/);
  assert.match(source, /delayedInterfaces/);
  assert.match(source, /source: hasPersistedLoops \? "persisted" : "fallback"/);
});

test("business loop read model does not derive counts from preview rows", () => {
  assert.match(source, /flows: hasPersistedLoops \? persistedEdgeCount : interfaceCount/);
  assert.match(source, /readyInterfaces: readyInterfaceCount/);
  assert.match(source, /delayedInterfaces: interfaceCount - readyInterfaceCount/);
  assert.doesNotMatch(source, /flows: previewInterfaces\.length/);
});

test("business loop read model reads persisted loops, activities, edges, and evidence", () => {
  assert.match(source, /businessLoop\.findMany/);
  assert.match(source, /businessLoopActivity\.count/);
  assert.match(source, /businessLoopEdge\.count/);
  assert.match(source, /businessLoopEvidenceRef\.count/);
  assert.match(source, /businessLoop\.count\(\{ where: \{ organizationId, status: "ACTIVE" \} \}\)/);
  assert.match(source, /businessLoop: \{ status: "ACTIVE" \}/);
  assert.match(source, /businessLoop\.findMany\(\{\s*where: \{ organizationId, status: "ACTIVE" \}/);
  assert.doesNotMatch(source, /businessLoop\.findMany\(\{\s*where: \{ organizationId, status: \{ not: "ARCHIVED" \}/);
  assert.match(source, /persistedLoops/);
  assert.match(source, /versions: \{/);
  assert.match(source, /publishedAt/);
  assert.match(source, /activityType/);
  assert.match(source, /edgeType/);
  assert.match(source, /ownerRoleName/);
  assert.match(source, /interfaceName/);
});
