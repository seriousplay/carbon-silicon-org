import { NextResponse } from "next/server";
import { normalizeUser } from "@/lib/app-session";
import { safeLogError } from "@/lib/api-error";
import { quickLoginWithFixedEventCode } from "@/lib/event-auth";
import { checkRateLimit, getClientIP, rateLimitHeaders } from "@/lib/rate-limit";
import { getOrCreatePreworkQuestionnaireSession } from "@/lib/sessions";

const PREWORK_ACCESS_CODE = "CSI2026SZ";
const PREWORK_RATE_LIMIT = { maxRequests: 20, windowSeconds: 600 };

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const isFormPost = contentType.includes("application/x-www-form-urlencoded")
    || contentType.includes("multipart/form-data");
  const ip = getClientIP(request);
  const limit = checkRateLimit(`prework-624:${ip}`, PREWORK_RATE_LIMIT);
  if (!limit.allowed) {
    return respondWithError(isFormPost, request, "请求过于频繁，请稍后再试", 429, limit.retryAfter);
  }

  try {
    const body = isFormPost ? Object.fromEntries(await request.formData()) : await request.json();
    const login = await quickLoginWithFixedEventCode({
      accessCode: String(body.accessCode || ""),
      phone: String(body.phone || ""),
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    }, PREWORK_ACCESS_CODE);
    const session = await getOrCreatePreworkQuestionnaireSession(normalizeUser(login.user));
    const nextUrl = `/loop-designer/sessions/${session.id}/questionnaire`;
    if (isFormPost) return NextResponse.redirect(externalUrl(request, nextUrl), 303);
    return NextResponse.json({ success: true, nextUrl, sessionId: session.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "课前问卷登录失败";
    const status = message.includes("无效") || message.includes("填写") ? 400 : 500;
    if (status >= 500) safeLogError("prework-624-login", error);
    return respondWithError(isFormPost, request, status >= 500 ? "课前问卷登录失败，请稍后重试" : message, status);
  }
}

function respondWithError(isFormPost: boolean, request: Request, message: string, status: number, retryAfter?: number) {
  if (isFormPost) {
    return NextResponse.redirect(
      externalUrl(request, `/loop-designer/prework/624?error=${encodeURIComponent(message)}`),
      303,
    );
  }
  const headers = retryAfter
    ? rateLimitHeaders(PREWORK_RATE_LIMIT.maxRequests, PREWORK_RATE_LIMIT.windowSeconds, 0, Date.now() + retryAfter * 1000)
    : undefined;
    return NextResponse.json({ error: message }, { status, headers });
}

function externalUrl(request: Request, path: string) {
  const fallback = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host") || fallback.host;
  const protocol = forwardedProto || fallback.protocol.replace(/:$/, "");
  return new URL(path, `${protocol}://${host}`);
}
