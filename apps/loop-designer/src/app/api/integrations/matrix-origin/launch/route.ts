import { NextRequest, NextResponse } from "next/server";
import type { MatrixIntegrationContext } from "@carbon-silicon/types";
import { createAppSession, normalizeUser } from "@/lib/app-session";
import { activateEnterprise } from "@/lib/enterprise";
import { createLoopAssetIterationSession, findLoopAssetByMatrixCircuit } from "@/lib/loop-assets";
import { signIntegrationBody, verifyMatrixLaunchTicket } from "@/lib/matrix-integration";
import { createIntegratedSession } from "@/lib/sessions";
import { getAdminClient } from "@/lib/supabase";

function errorRedirect(request: NextRequest, message: string) {
  return NextResponse.redirect(new URL(`/loop-designer/auth/error?reason=${encodeURIComponent(message)}`, request.url));
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("ticket");
    if (!token) return errorRedirect(request, "缺少 Matrix 启动票据");
    const ticket = verifyMatrixLaunchTicket(token);
    const admin = getAdminClient();
    if (!admin) throw new Error("Supabase service role is not configured");
    const now = new Date().toISOString();
    const enterprise = await activateEnterprise({
      tenantKey: ticket.tenantKey,
      companyName: ticket.displayName,
      displayName: ticket.displayName,
    });
    const { data: userRow, error: userError } = await admin.from("loop_designer_users").upsert({
      tenant_key: ticket.tenantKey,
      enterprise_id: enterprise.id,
      open_id: ticket.openId,
      union_id: ticket.unionId,
      display_name: ticket.displayName,
      avatar_url: ticket.avatarUrl,
      status: "active",
      updated_at: now,
      last_login_at: now,
    }, { onConflict: "tenant_key,open_id" })
      .select("id,tenant_key,enterprise_id,open_id,union_id,feishu_user_id,display_name,avatar_url").single();
    if (userError || !userRow) throw new Error(userError?.message || "无法映射 Loop 用户");
    const appUser = normalizeUser(userRow);

    const consume = signIntegrationBody({ ticket: token, loopUserId: appUser.id, loopEnterpriseId: enterprise.id });
    const matrixOrigin = process.env.MATRIX_ORIGIN_INTERNAL_URL || "http://localhost:3020";
    const consumeResponse = await fetch(`${matrixOrigin}/matrix-origin/api/v1/integrations/loop-designer/consume-launch`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-integration-signature": consume.signature },
      body: consume.body,
      signal: AbortSignal.timeout(15000),
    });
    const consumeResult = await consumeResponse.json() as { ok?: boolean; error?: { message?: string } };
    if (!consumeResponse.ok || !consumeResult.ok) throw new Error(consumeResult.error?.message || "Matrix 拒绝消费启动票据");

    const integration: MatrixIntegrationContext = {
      matrixWorkspaceId: ticket.matrixWorkspaceId,
      circuitLogicalId: ticket.circuitLogicalId,
      baseVersionId: ticket.baseVersionId,
      matrixUserId: ticket.matrixUserId,
      integrationStatus: "designing",
      launchJti: ticket.launchJti,
      returnUrl: ticket.returnUrl,
    };
    await createAppSession(appUser, { skipEnterpriseActivation: true });
    const boundAsset = await findLoopAssetByMatrixCircuit(appUser, {
      matrixWorkspaceId: integration.matrixWorkspaceId,
      matrixCircuitLogicalId: integration.circuitLogicalId,
    });
    if (boundAsset?.currentVersion) {
      const session = await createLoopAssetIterationSession(appUser, boundAsset.asset.id, { matrixIntegration: integration });
      return NextResponse.redirect(new URL(`/loop-designer/sessions/${session.id}`, request.url));
    }

    const session = await createIntegratedSession(appUser, integration, {
      name: ticket.circuitName,
      purpose: ticket.circuitPurpose,
    });
    return NextResponse.redirect(new URL(`/loop-designer/sessions/${session.id}`, request.url));
  } catch (error) {
    return errorRedirect(request, error instanceof Error ? error.message : "Matrix 无感登录失败");
  }
}
