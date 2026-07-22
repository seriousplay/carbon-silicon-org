import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { canAdministerRun } from "@/lib/runs/server";
import { exportRunToolSessionsCsv } from "@/lib/tools/sessions";

export async function GET(_: Request, { params }: { params: Promise<{ runSlug: string }> }) {
  const { runSlug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, reason: "请先登录。" }, { status: 401 });
  if (!(await canAdministerRun(user.id, runSlug))) return NextResponse.json({ ok: false, reason: "Forbidden" }, { status: 403 });

  const result = await exportRunToolSessionsCsv(runSlug);

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  return new NextResponse(result.csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
