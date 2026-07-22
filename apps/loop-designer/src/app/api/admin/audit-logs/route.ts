import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-auth";
import { getEnterpriseAuditLogs } from "@/lib/admin-console";
import { statusFromAdminError } from "@/lib/admin-api";

/**
 * GET /api/admin/audit-logs
 * 获取企业审计日志（需要 view_audit_logs 权限）
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await requireAdmin(user, ["view_audit_logs"]);

    // 从查询参数获取分页
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const logs = await getEnterpriseAuditLogs(user.enterpriseId, limit, offset);

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch audit logs";
    const status = statusFromAdminError(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
