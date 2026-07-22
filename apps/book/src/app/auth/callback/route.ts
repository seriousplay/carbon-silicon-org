import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/auth/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin).replace(/\/$/, "");
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";

  if (code) {
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      try {
        // Exchange code for session
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error("Auth callback error:", error);
          console.error("Error details:", JSON.stringify(error, null, 2));
          return NextResponse.redirect(new URL("/login?error=code_exchange_failed", siteUrl));
        }

        if (!data.session) {
          console.error("No session returned from code exchange");
          return NextResponse.redirect(new URL("/login?error=no_session", siteUrl));
        }

        console.log("Session established for user:", data.user?.email);
        if (data.session.expires_at) {
          console.log("Access token expires:", new Date(data.session.expires_at * 1000).toISOString());
        }

        // ✅ FIX: Manually set auth cookies on the response
        // Supabase's setAll callback doesn't work reliably in Route Handlers
        const response = NextResponse.redirect(new URL(next, siteUrl));

        // Set access token cookie
        response.cookies.set("sb-access-token", data.session.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: data.session.expires_in || 3600,
          path: "/",
        });

        // Set refresh token cookie (30 days)
        response.cookies.set("sb-refresh-token", data.session.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 30, // 30 days
          path: "/",
        });

        console.log("Auth cookies manually set on redirect response");
        return response;
      } catch (err) {
        console.error("Exception during session exchange:", err);
        return NextResponse.redirect(new URL("/login?error=exception", siteUrl));
      }
    } else {
      console.error("Failed to create Supabase client");
      return NextResponse.redirect(new URL("/login?error=no_client", siteUrl));
    }
  } else {
    console.warn("No code parameter in callback URL");
  }

  return NextResponse.redirect(new URL(next, siteUrl));
}
