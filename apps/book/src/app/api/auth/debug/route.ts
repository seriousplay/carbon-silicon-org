import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";

export async function GET() {
  const cookieStore = await cookies();
  const user = await getCurrentUser();
  const cookieNames = cookieStore
    .getAll()
    .map((cookie) => cookie.name)
    .filter((name) => name.includes("supabase") || name.startsWith("sb-"));

  return NextResponse.json({
    authenticated: Boolean(user),
    email: user?.email ?? null,
    cookieNames,
  });
}
