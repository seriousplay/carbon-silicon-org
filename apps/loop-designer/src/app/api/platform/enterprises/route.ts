import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  listPlatformEnterprises,
  requirePlatformAdmin,
  setEnterpriseAccess,
} from "@/lib/platform-admin";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePlatformAdmin(user);

    const enterprises = await listPlatformEnterprises();
    return NextResponse.json({ success: true, data: enterprises });
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取租户列表失败";
    return NextResponse.json({ success: false, error: message }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePlatformAdmin(user);

    const body = (await request.json()) as {
      enterpriseId?: string;
      isActive?: boolean;
    };
    if (!body.enterpriseId || typeof body.isActive !== "boolean") {
      return NextResponse.json({ success: false, error: "缺少租户 ID 或状态" }, { status: 400 });
    }
    if (body.enterpriseId === user.enterpriseId && body.isActive === false) {
      return NextResponse.json({ success: false, error: "不能关闭当前平台管理员所在租户" }, { status: 422 });
    }

    const updated = await setEnterpriseAccess({
      enterpriseId: body.enterpriseId,
      isActive: body.isActive,
      actorUserId: user.id,
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新租户访问失败";
    return NextResponse.json({ success: false, error: message }, { status: 403 });
  }
}
