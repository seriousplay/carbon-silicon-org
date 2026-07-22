import { NextRequest, NextResponse } from "next/server";
import { openOAuthState } from "@/lib/auth-crypto";
import { consumeOAuthStateCookie, createAppSession } from "@/lib/app-session";
import {
  assertTenantAccess,
  exchangeAuthorizationCode,
  fetchFeishuUserInfo,
} from "@/lib/feishu-auth";
import { getAdminClient } from "@/lib/supabase";
import { activateEnterprise } from "@/lib/enterprise";
import { publicUrl } from "@/lib/public-url";

function errorRedirect(message: string) {
  return NextResponse.redirect(
    publicUrl(`/loop-designer/auth/error?reason=${encodeURIComponent(message)}`),
  );
}

export async function GET(request: NextRequest) {
  const secret = process.env.LOOP_AUTH_SESSION_SECRET;
  const rawState = await consumeOAuthStateCookie();
  const stored = secret ? openOAuthState(rawState, secret) : null;
  const returnedState = request.nextUrl.searchParams.get("state");
  if (!stored || !returnedState || returnedState !== stored.state) {
    return errorRedirect("授权请求已过期，请重新登录");
  }
  if (request.nextUrl.searchParams.get("error")) {
    return errorRedirect("你已取消飞书授权");
  }
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return errorRedirect("飞书未返回授权码");

  try {
    const accessToken = await exchangeAuthorizationCode(code, stored.verifier);
    const feishuUser = await fetchFeishuUserInfo(accessToken);
    await assertTenantAccess(feishuUser.tenantKey);
    const admin = getAdminClient();
    if (!admin) throw new Error("Supabase service role is not configured");

    // Phase 1: 自动激活企业
    const enterprise = await activateEnterprise({
      tenantKey: feishuUser.tenantKey,
      companyName: feishuUser.displayName,
      displayName: feishuUser.displayName,
    });

    const now = new Date().toISOString();
    const { data: user, error } = await admin
      .from("loop_designer_users")
      .upsert(
        {
          tenant_key: feishuUser.tenantKey,
          enterprise_id: enterprise.id, // Phase 1: 关联企业
          open_id: feishuUser.openId,
          union_id: feishuUser.unionId,
          feishu_user_id: feishuUser.userId,
          display_name: feishuUser.displayName,
          avatar_url: feishuUser.avatarUrl,
          status: "active",
          updated_at: now,
          last_login_at: now,
        },
        { onConflict: "tenant_key,open_id" },
      )
      .select("id,enterprise_id")
      .single();
    if (error || !user) throw new Error(error?.message || "无法建立本地飞书用户");

    // 返回完整的用户信息给 createAppSession
    const appUser = {
      id: user.id,
      tenantKey: feishuUser.tenantKey,
      enterpriseId: user.enterprise_id,
      openId: feishuUser.openId,
      unionId: feishuUser.unionId,
      feishuUserId: feishuUser.userId,
      displayName: feishuUser.displayName,
      avatarUrl: feishuUser.avatarUrl,
    };

    await createAppSession(appUser);
    return NextResponse.redirect(publicUrl(stored.next));
  } catch (error) {
    const message = error instanceof Error ? error.message : "飞书登录失败";
    return errorRedirect(message);
  }
}
