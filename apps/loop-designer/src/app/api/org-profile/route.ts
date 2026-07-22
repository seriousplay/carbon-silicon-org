import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getOrgProfileSnapshot } from "@/lib/org-profile";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const profile = await getOrgProfileSnapshot(user);
    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to build org profile" }, { status: 500 });
  }
}
