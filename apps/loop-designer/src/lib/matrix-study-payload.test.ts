import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildLoopStudyIdempotencyKey, normalizeMatrixStudyError } from "./matrix-study-payload";

test("buildLoopStudyIdempotencyKey prefers Loop OS asset version ids", () => {
  assert.equal(
    buildLoopStudyIdempotencyKey({
      sessionId: "session-1",
      sessionVersionId: "session-version-1",
      loopVersionId: "loop-version-1",
    }),
    "loop-study:session-1:loop-version-1",
  );
});

test("buildLoopStudyIdempotencyKey falls back to session versions for unpromoted studies", () => {
  assert.equal(
    buildLoopStudyIdempotencyKey({
      sessionId: "session-1",
      sessionVersionId: "session-version-1",
    }),
    "loop-study:session-1:session-version-1",
  );
  assert.equal(buildLoopStudyIdempotencyKey({ sessionId: "session-1" }), "loop-study:session-1:initial");
});

test("normalizeMatrixStudyError turns stale Matrix base versions into an actionable re-entry prompt", () => {
  assert.equal(
    normalizeMatrixStudyError({ code: "staleBaseVersion", message: "基础版本已变化，请重新进入 Loop Designer" }),
    "Matrix 已有新版本，请从 Matrix 重新进入",
  );
  assert.equal(
    normalizeMatrixStudyError({ message: "基础版本已过期" }),
    "Matrix 已有新版本，请从 Matrix 重新进入",
  );
});

test("normalizeMatrixStudyError preserves non-version Matrix rejection messages", () => {
  assert.equal(normalizeMatrixStudyError({ message: "签名无效" }), "签名无效");
  assert.equal(normalizeMatrixStudyError(undefined), "Matrix 拒绝接收 Study");
});

test("Matrix DesignStudy submission keeps Loop OS behind Matrix review boundaries", () => {
  const route = readFileSync("src/app/api/integrations/matrix-origin/design-studies/route.ts", "utf8");
  const payload = readFileSync("src/lib/matrix-study-payload.ts", "utf8");

  assert.match(route, /proposedOperations:\s*\[\]/);
  assert.doesNotMatch(route, /createCell|publishNetworkVersion|promoteChangeSet/);
  assert.match(payload, /不绕过 Matrix Origin ChangeSet 审阅机制/);
});

test("Matrix DesignStudy submission promotes asset iterations before review tracking", () => {
  const route = readFileSync("src/app/api/integrations/matrix-origin/design-studies/route.ts", "utf8");

  assert.match(route, /createLoopAssetVersionFromSession/);
  assert.match(route, /const promotedAssetVersion = session\.responses\.sourceAssetId/);
  assert.match(route, /sourceAssetVersionId: promotedAssetVersion\?\.currentVersion\.id/);
  assert.match(route, /loopVersionId: loopAssetRef\.sourceAssetVersionId/);
  assert.match(route, /versionId: loopAssetRef\.sourceAssetVersionId/);
  assert.ok(
    route.indexOf("const promotedAssetVersion = session.responses.sourceAssetId")
      < route.indexOf("const payload: CircuitDesignStudyPayload"),
    "asset iteration sessions must get a stable Loop OS version before building the Matrix payload",
  );
});
