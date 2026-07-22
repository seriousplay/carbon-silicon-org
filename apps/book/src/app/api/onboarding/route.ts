import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { completeOnboarding } from "@/lib/organizations/server";

const schema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("create"),
    displayName: z.string().min(1).max(80),
    role: z.string().max(120).optional(),
    organizationName: z.string().min(2).max(160),
  }),
  z.object({
    mode: z.literal("join"),
    displayName: z.string().min(1).max(80),
    role: z.string().max(120).optional(),
    inviteCode: z.string().min(4).max(24),
  }),
]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, reason: "请先登录。" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "Invalid onboarding payload" }, { status: 400 });

  const result = await completeOnboarding({ ...parsed.data, userId: user.id, email: user.email });
  if (!result.ok) return NextResponse.json(result, { status: 400 });

  return NextResponse.json(result);
}
