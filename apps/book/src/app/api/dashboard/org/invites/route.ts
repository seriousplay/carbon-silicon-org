import { NextResponse } from "next/server";
import { getCurrentUser, getUserWorkspace, isOrganizationAdmin } from "@/lib/auth/server";
import { createInviteForOrganization } from "@/lib/organizations/server";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, reason: "请先登录。" }, { status: 401 });

  const workspace = await getUserWorkspace(user.id);
  const membership =
    workspace.defaultMembership ?? workspace.memberships.find((item) => item.memberRole === "admin") ?? workspace.memberships[0] ?? null;
  if (!isOrganizationAdmin(membership)) {
    return NextResponse.json({ ok: false, reason: "Only organization admins can create invites" }, { status: 403 });
  }

  const result = await createInviteForOrganization(membership.organizationId, user.id);
  if (!result.ok) return NextResponse.json(result, { status: 400 });

  return NextResponse.json(result);
}
