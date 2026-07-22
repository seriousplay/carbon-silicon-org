import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getRunResponses, getQuestionDistributions, generateInsightsForRun } from "@/lib/assessment/server-summary";
import { canAdministerRun } from "@/lib/runs/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runSlug: string }> },
) {
  try {
    const { runSlug } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, reason: "请先登录。" }, { status: 401 });
    if (!(await canAdministerRun(user.id, runSlug))) return NextResponse.json({ ok: false, reason: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");

    const [responses, distributions, insights] = await Promise.all([
      getRunResponses(runSlug, { page, pageSize, excludeTest: true }),
      getQuestionDistributions(runSlug),
      generateInsightsForRun(runSlug),
    ]);

    const response = NextResponse.json({
      responses,
      distributions,
      insights,
    });

    // Cache for 30 seconds (stale-while-revalidate pattern)
    // Analytics data doesn't need to be real-time
    // Reduces database load for frequent polling
    response.headers.set("Cache-Control", "public, max-age=30, s-maxage=30, stale-while-revalidate=60");

    return response;
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ ok: false, reason: "Internal error" }, { status: 500 });
  }
}
