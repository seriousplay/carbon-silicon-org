import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { canAdministerRun, cleanupTestParticipants, updateAssessmentRun } from "@/lib/runs/server";

const updateRunSchema = z.object({
  title: z.string().min(2).max(120).optional(),
  status: z.enum(["draft", "active", "closed", "archived"]).optional(),
  audience: z.string().max(160).optional(),
  description: z.string().max(600).optional(),
  accessCode: z.string().max(80).optional(),
  showOnHome: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ runSlug: string }> }) {
  const { runSlug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, reason: "请先登录。" }, { status: 401 });
  if (!(await canAdministerRun(user.id, runSlug))) return NextResponse.json({ ok: false, reason: "Forbidden" }, { status: 403 });

  const parsed = updateRunSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "Invalid run update payload" }, { status: 400 });
  }

  const result = await updateAssessmentRun(runSlug, parsed.data);
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ runSlug: string }> }) {
  const { runSlug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, reason: "请先登录。" }, { status: 401 });
  if (!(await canAdministerRun(user.id, runSlug))) return NextResponse.json({ ok: false, reason: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);

  if (url.searchParams.get("mode") !== "test") {
    return NextResponse.json({ ok: false, reason: "Only test cleanup is supported" }, { status: 400 });
  }

  const result = await cleanupTestParticipants(runSlug);
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result);
}
