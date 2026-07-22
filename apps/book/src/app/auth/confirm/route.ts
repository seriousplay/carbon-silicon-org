import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/auth/server";

function resolveNextPath(requestUrl: URL) {
  const redirectTo = requestUrl.searchParams.get("redirect_to");
  const next = requestUrl.searchParams.get("next");

  if (next?.startsWith("/")) return next;

  if (redirectTo) {
    try {
      const redirectUrl = new URL(redirectTo);
      const redirectNext = redirectUrl.searchParams.get("next");
      if (redirectNext?.startsWith("/")) return redirectNext;
    } catch {
      // Ignore malformed redirect targets and fall back to the dashboard.
    }
  }

  return "/dashboard";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin).replace(/\/$/, "");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const nextPath = resolveNextPath(requestUrl);

  console.log("Auth confirm request:", { tokenHash: tokenHash?.substring(0, 20) + "...", type, nextPath });

  if (tokenHash && type) {
    const supabase = await createServerSupabaseClient();
    const result = await supabase?.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    console.log("verifyOtp result:", { error: result?.error, hasData: !!result?.data, hasSession: !!result?.data?.session });

    const { error } = result ?? {};

    if (!error && result?.data?.session) {
      console.log("OTP verified successfully, user:", result.data.user?.email);

      // ✅ FIX: Manually set auth cookies on the response
      // Supabase's setAll callback doesn't work reliably in Route Handlers
      const response = NextResponse.redirect(new URL(nextPath, siteUrl));

      // Set access token cookie
      response.cookies.set("sb-access-token", result.data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: result.data.session.expires_in || 3600,
        path: "/",
      });

      // Set refresh token cookie (30 days)
      response.cookies.set("sb-refresh-token", result.data.session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      });

      console.log("Auth cookies manually set for confirm flow");
      return response;
    } else {
      console.error("OTP verification failed:", { error, sessionExists: !!result?.data?.session });
    }
  }

  console.warn("Redirecting to login due to failed verification or missing params");
  return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(nextPath)}`, siteUrl));
}
