import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, getUserWorkspace, isOrganizationAdmin } from "@/lib/auth/server";
import { createAssessmentRun } from "@/lib/runs/server";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const createRunSchema = z.object({
  slug: z.string().min(3).max(80).regex(slugRegex),
  title: z.string().min(2).max(120),
  runType: z.enum(["workshop", "organization_diagnosis", "cohort", "public"]),
  status: z.enum(["draft", "active", "closed", "archived"]),
  audience: z.string().max(160).optional(),
  description: z.string().max(600).optional(),
  date: z.string().optional(),
  accessCode: z.string().max(80).optional(),
  showOnHome: z.boolean().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, reason: "请先登录。" }, { status: 401 });

  const workspace = await getUserWorkspace(user.id);
  const membership = workspace.defaultMembership ?? workspace.memberships.find((item) => item.memberRole === "admin") ?? null;
  if (!isOrganizationAdmin(membership)) {
    return NextResponse.json({ ok: false, reason: "Only organization admins can create runs" }, { status: 403 });
  }

  const parsed = createRunSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "Invalid run payload" }, { status: 400 });
  }

  const result = await createAssessmentRun(parsed.data, { userId: user.id, organizationId: membership.organizationId });

  if (!result.ok) {
    const status = /duplicate|unique/i.test(result.reason) ? 409 : 500;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
