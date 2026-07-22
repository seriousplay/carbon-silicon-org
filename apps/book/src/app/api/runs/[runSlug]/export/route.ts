import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { canAdministerRun, exportRunCsv } from "@/lib/runs/server";

export async function GET(_: Request, { params }: { params: Promise<{ runSlug: string }> }) {
  const { runSlug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, reason: "请先登录。" }, { status: 401 });
  if (!(await canAdministerRun(user.id, runSlug))) return NextResponse.json({ ok: false, reason: "Forbidden" }, { status: 403 });

  const result = await exportRunCsv(runSlug);

  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  return new NextResponse(`\uFEFF${result.csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
