import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/auth/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin).replace(/\/$/, "");
  const supabase = await createServerSupabaseClient();
  await supabase?.auth.signOut();
  return NextResponse.redirect(new URL("/", siteUrl));
}
