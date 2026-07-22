import { NextRequest, NextResponse } from "next/server";
import { revokeCurrentAppSession } from "@/lib/app-session";
import { getPublicBaseUrl, publicUrl } from "@/lib/public-url";
import { forwardedRequestOrigin, isTrustedRequestSource } from "@/lib/request-origin";

/**
 * POST /api/auth/logout
 * CSRF protection: validates Origin/Referer against the site URL.
 */
export async function POST(request: NextRequest) {
  const siteUrl = getPublicBaseUrl();

  const requestOrigin = forwardedRequestOrigin(request.headers, request.nextUrl.origin);
  if (!isTrustedRequestSource(request.headers, siteUrl, requestOrigin)) {
    return NextResponse.json({ error: "无效的请求来源" }, { status: 403 });
  }

  await revokeCurrentAppSession();
  return NextResponse.redirect(publicUrl(safeLogoutNext(request.nextUrl.searchParams.get("next"))), 303);
}

function safeLogoutNext(value: string | null) {
  if (!value) return "/loop-designer";
  if (value === "/loop-designer" || value.startsWith("/loop-designer/")) return value;
  return "/loop-designer";
}
