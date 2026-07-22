import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyRunAccessCode } from "@/lib/runs/server";

const verifySchema = z.object({
  accessCode: z.string().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ runSlug: string }> }) {
  const { runSlug } = await params;
  const parsed = verifySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "Invalid access payload" }, { status: 400 });
  }

  const result = await verifyRunAccessCode(runSlug, parsed.data.accessCode);
  return NextResponse.json(result, { status: result.ok ? 200 : 403 });
}
