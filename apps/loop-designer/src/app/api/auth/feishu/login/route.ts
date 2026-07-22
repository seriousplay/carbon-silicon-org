import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createPkcePair, normalizeReturnPath, sealOAuthState } from "@/lib/auth-crypto";
import { setOAuthStateCookie } from "@/lib/app-session";
import { buildFeishuAuthorizeUrl } from "@/lib/feishu-auth";
import { checkRateLimit, getClientIP, rateLimitHeaders } from "@/lib/rate-limit";
import { publicUrl } from "@/lib/public-url";

const OAUTH_RATE_LIMIT = { maxRequests: 10, windowSeconds: 60 };

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIP(request);
    const limit = checkRateLimit(ip, OAUTH_RATE_LIMIT);
    if (!limit.allowed) {
      const resetAt = Date.now() + limit.retryAfter * 1000;
      const headers = rateLimitHeaders(OAUTH_RATE_LIMIT.maxRequests, OAUTH_RATE_LIMIT.windowSeconds, 0, resetAt);
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试" },
        { status: 429, headers }
      );
    }

    const secret = process.env.LOOP_AUTH_SESSION_SECRET;
    if (!secret || secret.length < 32) throw new Error("应用会话密钥尚未配置");
    const state = randomBytes(24).toString("base64url");
    const { verifier, challenge } = createPkcePair();
    const next = normalizeReturnPath(request.nextUrl.searchParams.get("next"));
    await setOAuthStateCookie(
      sealOAuthState({ state, verifier, next, expiresAt: Date.now() + 10 * 60 * 1000 }, secret),
    );
    return NextResponse.redirect(buildFeishuAuthorizeUrl({ state, challenge }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "登录初始化失败";
    return NextResponse.redirect(
      publicUrl(`/loop-designer/auth/error?reason=${encodeURIComponent(message)}`),
    );
  }
}
