import { NextResponse } from "next/server";
import type { CircuitDesignStudyPayload } from "@carbon-silicon/types";
import { getCurrentUser } from "@/lib/auth";
import { createLoopAssetVersionFromSession, recordLoopVersionMatrixReview } from "@/lib/loop-assets";
import { signStudyPayload } from "@/lib/matrix-integration";
import { buildLoopStudyIdempotencyKey, buildMethodologyAnalysis, normalizeMatrixStudyError } from "@/lib/matrix-study-payload";
import { withMaturityMapping } from "@/lib/maturity";
import { refreshOrgProfileSnapshotBestEffort } from "@/lib/org-profile";
import { getAuthorizedSession, updateSession } from "@/lib/sessions";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { sessionId } = await request.json() as { sessionId?: string };
    if (!sessionId) return NextResponse.json({ error: "缺少 sessionId" }, { status: 400 });
    const session = await getAuthorizedSession(user, sessionId);
    if (!session?.matrixIntegration) return NextResponse.json({ error: "该会话不是 Matrix 关联会话" }, { status: 409 });
    const plan = session.outputs.currentPlan;
    if (!plan) return NextResponse.json({ error: "请先生成完整回路方案" }, { status: 409 });
    const enrichedPlan = withMaturityMapping(plan);
    const integration = session.matrixIntegration;
    const versionRef = session.outputs.versions.at(-1)?.id || "initial";
    const promotedAssetVersion = session.responses.sourceAssetId
      ? await createLoopAssetVersionFromSession(user, {
          assetId: session.responses.sourceAssetId,
          sessionId: session.id,
        })
      : null;
    if (promotedAssetVersion?.versionCreated) await refreshOrgProfileSnapshotBestEffort(user);
    const loopAssetRef = session.responses.sourceAssetId
      ? {
          loopAssetId: session.responses.sourceAssetId,
          sourceAssetVersionId: promotedAssetVersion?.currentVersion.id,
          currentSessionVersionId: versionRef,
        }
      : undefined;
    const payload: CircuitDesignStudyPayload = {
      workspaceId: integration.matrixWorkspaceId,
      circuitLogicalId: integration.circuitLogicalId,
      baseVersionId: integration.baseVersionId,
      matrixUserId: integration.matrixUserId,
      loopDesignerSessionId: session.id,
      ...(loopAssetRef?.loopAssetId ? { loopAssetId: loopAssetRef.loopAssetId } : {}),
      ...(loopAssetRef?.sourceAssetVersionId ? { loopVersionId: loopAssetRef.sourceAssetVersionId } : {}),
      loopPlan: enrichedPlan as unknown as Record<string, unknown>,
      methodologyAnalysis: {
        ...buildMethodologyAnalysis(enrichedPlan),
        ...(loopAssetRef ? { loopAssetRef } : {}),
      },
      proposedOperations: [],
      warnings: [],
      idempotencyKey: buildLoopStudyIdempotencyKey({
        sessionId: session.id,
        sessionVersionId: versionRef,
        loopVersionId: loopAssetRef?.sourceAssetVersionId,
      }),
      sourceArtifactUrl: integration.returnUrl,
    };
    const signed = signStudyPayload(payload);
    const origin = process.env.MATRIX_ORIGIN_INTERNAL_URL || "http://localhost:3020";
    const response = await fetch(`${origin}/matrix-origin/api/v1/design-studies`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-integration-signature": signed.signature },
      body: signed.body,
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json() as { ok?: boolean; data?: { id: string; status: string }; error?: { code?: string; message?: string } };
    if (!response.ok || !result.ok || !result.data) throw new Error(normalizeMatrixStudyError(result.error));
    await updateSession(user, session.id, {
      matrixIntegration: { ...integration, integrationStatus: result.data.status === "ready" ? "ready" : "mapping_review" },
    });
    const returnUrl = new URL(integration.returnUrl || "http://localhost:3020/matrix-origin");
    returnUrl.searchParams.set("studyId", result.data.id);
    if (loopAssetRef?.loopAssetId && loopAssetRef.sourceAssetVersionId) {
      await recordLoopVersionMatrixReview(user, {
        assetId: loopAssetRef.loopAssetId,
        versionId: loopAssetRef.sourceAssetVersionId,
        review: {
          studyId: result.data.id,
          status: result.data.status,
          returnUrl: returnUrl.toString(),
          submittedAt: new Date().toISOString(),
        },
      });
    }
    return NextResponse.json({
      study: result.data,
      returnUrl: returnUrl.toString(),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "提交失败" }, { status: 400 });
  }
}
