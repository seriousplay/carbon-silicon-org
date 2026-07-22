import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserProfile, updateUserProfile } from "@/lib/user-profile";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ profile: await getUserProfile(user) });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json()) as { displayName?: string; companyName?: string; currentPassword?: string; newPassword?: string; newPasswordConfirm?: string };
    const profile = await updateUserProfile(user, {
      displayName: body.displayName ?? "",
      companyName: body.companyName ?? "",
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      newPasswordConfirm: body.newPasswordConfirm,
    });
    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Update failed" }, { status: 400 });
  }
}
