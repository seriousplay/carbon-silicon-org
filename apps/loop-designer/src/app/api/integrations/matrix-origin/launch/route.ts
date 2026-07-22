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
    const now = new Date();
    const enterprise = await activateEnterprise({
      tenantKey: ticket.tenantKey,
      companyName: ticket.displayName,
      displayName: ticket.displayName,
    });

    // Upsert user (by tenantKey + openId)
    const existingUser = await admin.loopDesignerUser.findFirst({
      where: {
        tenantKey: ticket.tenantKey,
        openId: ticket.openId,
      },
      select: {
        id: true,
        tenantKey: true,
        enterpriseId: true,
        openId: true,
        unionId: true,
        feishuUserId: true,
        displayName: true,
        avatarUrl: true,
      },
    });

    let userRow: any;
    if (existingUser) {
      userRow = await admin.loopDesignerUser.update({
        where: { id: existingUser.id },
        data: {
          enterpriseId: enterprise.id,
          unionId: ticket.unionId,
          displayName: ticket.displayName,
          avatarUrl: ticket.avatarUrl,
          status: "active",
          updatedAt: now,
          lastLoginAt: now,
        },
        select: {
          id: true,
          tenantKey: true,
          enterpriseId: true,
          openId: true,
          unionId: true,
          feishuUserId: true,
          displayName: true,
          avatarUrl: true,
        },
      });
    } else {
      userRow = await admin.loopDesignerUser.create({
        data: {
          tenantKey: ticket.tenantKey,
          enterpriseId: enterprise.id,
          openId: ticket.openId,
          unionId: ticket.unionId,
          displayName: ticket.displayName,
          avatarUrl: ticket.avatarUrl,
          status: "active",
          updatedAt: now,
          lastLoginAt: now,
        },
        select: {
          id: true,
          tenantKey: true,
          enterpriseId: true,
          openId: true,
          unionId: true,
          feishuUserId: true,
          displayName: true,
          avatarUrl: true,
        },
      });
    }

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
