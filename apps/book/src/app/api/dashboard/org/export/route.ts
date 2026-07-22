import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { exportOrganizationDataCsv } from "@/lib/organizations/server";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, reason: "请先登录。" }, { status: 401 });

  const result = await exportOrganizationDataCsv(user.id);
  if (!result.ok) return NextResponse.json(result, { status: 403 });

  return new NextResponse(result.csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
