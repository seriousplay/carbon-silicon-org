import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, getUserWorkspace } from "@/lib/auth/server";
import { createToolSession } from "@/lib/tools/sessions";

const profileSchema = z.object({
  displayName: z.string().min(1).max(80),
  role: z.string().max(120).optional(),
  companyName: z.string().max(160).optional(),
  teamName: z.string().max(160).optional(),
  contact: z.string().max(160).optional(),
});

const submissionSchema = z.object({
  runSlug: z.string().min(1).max(120).optional(),
  accessCode: z.string().max(120).optional(),
  profile: profileSchema,
  context: z.object({
    useCase: z.string().min(1).max(500),
    dataScope: z.string().max(1200).optional(),
    currentSituation: z.string().max(1200).optional(),
    evidenceSignal: z.string().max(1200).optional(),
    expectedOutput: z.string().max(1200).optional(),
  }),
  responses: z.record(z.string(), z.string().max(2000)),
  nextAction: z.string().max(1000).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ toolSlug: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, reason: "请先登录后再提交工具记录。" }, { status: 401 });

  const { toolSlug } = await params;
  const parsed = submissionSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "Invalid tool session payload" }, { status: 400 });
  }

  const workspace = await getUserWorkspace(user.id);
  const result = await createToolSession(toolSlug, {
    ...parsed.data,
    userId: user.id,
    defaultOrganizationId: workspace.defaultMembership?.organizationId ?? null,
  });
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
