import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Loop OS v1 acceptance surface keeps the organization asset loop wired", () => {
  const homePage = readFileSync("src/app/page.tsx", "utf8");
  const assetsPage = readFileSync("src/app/assets/page.tsx", "utf8");
  const assetDetailPage = readFileSync("src/app/assets/[assetId]/page.tsx", "utf8");
  const memoryPage = readFileSync("src/app/memory/page.tsx", "utf8");
  const createAssetRoute = readFileSync("src/app/api/loop-assets/route.ts", "utf8");
  const relationshipRoute = readFileSync("src/app/api/loop-assets/[assetId]/relationships/route.ts", "utf8");
  const iterationRoute = readFileSync("src/app/api/loop-assets/[assetId]/iterations/route.ts", "utf8");
  const versionRoute = readFileSync("src/app/api/loop-assets/[assetId]/versions/route.ts", "utf8");

  assert.match(homePage, /LOOP OS \/ 组织回路管理系统/);
  assert.match(homePage, /回路资产台/);
  assert.match(homePage, /href="\/assets"/);
  assert.match(homePage, /组织记忆/);
  assert.match(homePage, /href="\/memory"/);

  assert.match(assetsPage, /listLoopAssets/);
  assert.match(assetsPage, /getOrgProfileSnapshot/);
  assert.match(assetsPage, /buildLoopNetworkWarnings/);
  assert.match(assetsPage, /LoopAssetBoard/);
  assert.match(assetsPage, /轻量关系拓扑/);
  assert.match(assetsPage, /href="\/memory"/);

  assert.match(memoryPage, /getOrgProfileSnapshot/);
  assert.match(memoryPage, /listLoopAssets/);
  assert.match(memoryPage, /组织角色库/);
  assert.match(memoryPage, /组织术语/);
  assert.match(memoryPage, /成熟度分布/);
  assert.match(memoryPage, /主要弱维度/);
  assert.match(memoryPage, /常见依赖/);

  assert.match(assetDetailPage, /出生证/);
  assert.match(assetDetailPage, /回路关系/);
  assert.match(assetDetailPage, /Matrix 引用/);
  assert.match(assetDetailPage, /版本记录/);
  assert.match(assetDetailPage, /LoopAssetIterationButton/);

  assert.match(createAssetRoute, /createLoopAssetFromSession/);
  assert.match(createAssetRoute, /sourceSessionId/);
  assert.match(createAssetRoute, /refreshOrgProfileSnapshotBestEffort/);
  assert.match(relationshipRoute, /createLoopRelationship/);
  assert.match(relationshipRoute, /refreshOrgProfileSnapshotBestEffort/);
  assert.match(iterationRoute, /createLoopAssetIterationSession/);
  assert.match(versionRoute, /createLoopAssetVersionFromSession/);
});

test("Loop OS v1 acceptance surface keeps memory and Matrix review boundaries wired", () => {
  const generateRoute = readFileSync("src/app/api/sessions/[sessionId]/generate/route.ts", "utf8");
  const generationJobs = readFileSync("src/lib/generation-jobs.ts", "utf8");
  const memoryRoute = readFileSync("src/app/api/memory/context/route.ts", "utf8");
  const matrixLaunchRoute = readFileSync("src/app/api/integrations/matrix-origin/launch/route.ts", "utf8");
  const matrixStudyRoute = readFileSync("src/app/api/integrations/matrix-origin/design-studies/route.ts", "utf8");
  const sessions = readFileSync("src/lib/sessions.ts", "utf8");
  const loopAssetsCore = readFileSync("src/lib/loop-assets-core.ts", "utf8");
  const versionIdempotencyMigration = readFileSync("supabase/migrations/202606200001_loop_os_version_source_idempotency.sql", "utf8");

  assert.match(generateRoute, /useOrgMemory !== false/);
  assert.match(generateRoute, /enqueuePlanGenerationJob/);
  assert.match(generationJobs, /buildMemoryContextForEnterpriseBestEffort/);
  assert.match(generationJobs, /memoryContext = job\.useOrgMemory/);
  assert.match(memoryRoute, /buildMemoryContextForEnterprise/);
  assert.doesNotMatch(memoryRoute, /generatePlan|callModel|completeChat|MODEL_API|model\.ts/);

  assert.match(matrixLaunchRoute, /findLoopAssetByMatrixCircuit/);
  assert.match(matrixLaunchRoute, /createLoopAssetIterationSession/);
  assert.match(matrixLaunchRoute, /createIntegratedSession/);
  assert.match(sessions, /loopPurpose: circuit\.purpose/);
  assert.match(loopAssetsCore, /context\.loopPurpose/);
  assert.match(matrixStudyRoute, /createLoopAssetVersionFromSession/);
  assert.match(matrixStudyRoute, /loopVersionId: loopAssetRef\.sourceAssetVersionId/);
  assert.match(matrixStudyRoute, /proposedOperations:\s*\[\]/);
  assert.doesNotMatch(matrixStudyRoute, /createCell|publishNetworkVersion|promoteChangeSet/);

  assert.match(versionIdempotencyMigration, /idx_loop_os_versions_source_session_version_unique/);
});

test("Loop OS v1 release gate covers local, database, status and Matrix checks", () => {
  const releaseGate = readFileSync("scripts/verify-loop-os-v1-release.mjs", "utf8");
  const headDeploy = readFileSync("scripts/deploy-loop-os-v1-head.sh", "utf8");
  const runbook = readFileSync("docs/loop-os-v1-migration-runbook.md", "utf8");

  assert.match(releaseGate, /src\/lib\/loop-os-v1-acceptance\.test\.ts/);
  assert.match(releaseGate, /npm", \["test"\]/);
  assert.match(releaseGate, /npm", \["run", "build"\]/);
  assert.match(releaseGate, /scripts\/verify-loop-os-v1\.mjs/);
  assert.match(releaseGate, /--write-probe/);
  assert.match(releaseGate, /LOOP_OS_STATUS_URL/);
  assert.match(releaseGate, /verify:matrix-loop/);
  assert.match(runbook, /node scripts\/verify-loop-os-v1-release\.mjs --status-url/);
  assert.match(runbook, /node scripts\/verify-loop-os-v1-release\.mjs --local-only/);
  assert.match(runbook, /deploy-loop-os-v1-head\.sh/);
  assert.match(headDeploy, /git -C "\$REPO_ROOT" archive/);
  assert.match(headDeploy, /apps\/loop-designer/);
  assert.match(headDeploy, /packages\/types/);
  assert.match(headDeploy, /LOCAL_STATUS_CODE/);
  assert.match(headDeploy, /PUBLIC_STATUS_CODE/);
  assert.match(headDeploy, /!= "200" && "\$PUBLIC_STATUS_CODE" != "503"/);
});
