import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";
import { consumeInviteCode } from "@/lib/invite-codes";
import type { PrismaClient } from "@prisma/client";

/**
 * POST /api/auth/join-enterprise/[code]
 * Use invite code to join enterprise
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "数据库未配置" }, { status: 500 });
    }

    // Try atomic transaction first
    try {
      const result = await (admin as PrismaClient).$transaction(async (tx) => {
        // 1. Validate and consume invite code
        const inviteInfo = await consumeInviteCode(code);

        // 2. Check if user is already in target enterprise
        const existingMember = await tx.loopDesignerEnterpriseMember.findFirst({
          where: {
            enterpriseId: inviteInfo.enterpriseId,
            userId: user.id,
          },
          select: { id: true, isActive: true },
        });

        if (existingMember?.isActive) {
          return { success: true, message: "你已在该企业中", alreadyMember: true };
        }

        if (existingMember && !existingMember.isActive) {
          // Reactivate previously deactivated member
          await tx.loopDesignerEnterpriseMember.update({
            where: { id: existingMember.id },
            data: { isActive: true, leftAt: null },
          });
          await tx.loopDesignerUser.update({
            where: { id: user.id },
            data: { enterpriseId: inviteInfo.enterpriseId },
          });
          await tx.loopDesignerEnterprise.update({
            where: { id: inviteInfo.enterpriseId },
            data: { usedSeats: { increment: 1 } },
          });
          return {
            success: true,
            enterpriseId: inviteInfo.enterpriseId,
            enterpriseName: inviteInfo.enterpriseName,
          };
        }

        // Save old enterprise ID for seat release
        const oldEnterpriseId = user.enterpriseId;

        // Create new member record
        await tx.loopDesignerEnterpriseMember.create({
          data: {
            enterpriseId: inviteInfo.enterpriseId,
            userId: user.id,
            role: "member",
            isActive: true,
          },
        });

        // Update user's enterprise_id
        await tx.loopDesignerUser.update({
          where: { id: user.id },
          data: { enterpriseId: inviteInfo.enterpriseId },
        });

        // Increment target enterprise seats
        await tx.loopDesignerEnterprise.update({
          where: { id: inviteInfo.enterpriseId },
          data: { usedSeats: { increment: 1 } },
        });

        // Release old enterprise seats
        if (oldEnterpriseId && oldEnterpriseId !== inviteInfo.enterpriseId) {
          await tx.loopDesignerEnterprise.update({
            where: { id: oldEnterpriseId },
            data: { usedSeats: { decrement: 1 } },
          });
        }

        // Audit log
        await tx.loopDesignerAuditLog.create({
          data: {
            enterpriseId: inviteInfo.enterpriseId,
            userId: user.id,
            action: "member_joined_via_invite",
            resourceType: "enterprise",
            resourceId: inviteInfo.enterpriseId,
            details: { old_enterprise_id: oldEnterpriseId, code },
          },
        });

        return {
          success: true,
          enterpriseId: inviteInfo.enterpriseId,
          enterpriseName: inviteInfo.enterpriseName,
        };
      });

      if ((result as any).alreadyMember) {
        return NextResponse.json({ success: true, message: (result as any).message }, { status: 200 });
      }
      return NextResponse.json({
        success: true,
        message: `已加入 ${(result as any).enterpriseName}`,
        data: { enterpriseId: (result as any).enterpriseId, enterpriseName: (result as any).enterpriseName },
      });
    } catch (txError) {
      // Fallback to legacy multi-step approach
      // 1. Validate and consume invite code
      const inviteInfo = await consumeInviteCode(code);

      // 2. Check if user is already in target enterprise
      const existingMember = await admin.loopDesignerEnterpriseMember.findFirst({
        where: {
          enterpriseId: inviteInfo.enterpriseId,
          userId: user.id,
        },
        select: { id: true, isActive: true },
      });

      if (existingMember?.isActive) {
        return NextResponse.json({ success: true, message: "你已在该企业中" }, { status: 200 });
      }

      // 3. Reactivate previously deactivated member
      if (existingMember && !existingMember.isActive) {
        await admin.loopDesignerEnterpriseMember.update({
          where: { id: existingMember.id },
          data: { isActive: true, leftAt: null },
        });

        await admin.loopDesignerUser.update({
          where: { id: user.id },
          data: { enterpriseId: inviteInfo.enterpriseId },
        });

        await admin.loopDesignerEnterprise.update({
          where: { id: inviteInfo.enterpriseId },
          data: { usedSeats: { increment: 1 } },
        });

        return NextResponse.json({
          success: true,
          data: { enterpriseId: inviteInfo.enterpriseId, enterpriseName: inviteInfo.enterpriseName },
        });
      }

      // 4. Save old enterprise ID
      const oldEnterpriseId = user.enterpriseId;

      // 5. Create member record
      await admin.loopDesignerEnterpriseMember.create({
        data: {
          enterpriseId: inviteInfo.enterpriseId,
          userId: user.id,
          role: "member",
          isActive: true,
        },
      });

      // 6. Update enterprise_id
      await admin.loopDesignerUser.update({
        where: { id: user.id },
        data: { enterpriseId: inviteInfo.enterpriseId },
      });

      // 7. Increment target enterprise seats
      await admin.loopDesignerEnterprise.update({
        where: { id: inviteInfo.enterpriseId },
        data: { usedSeats: { increment: 1 } },
      });

      // 8. Release old enterprise seats
      if (oldEnterpriseId && oldEnterpriseId !== inviteInfo.enterpriseId) {
        await admin.loopDesignerEnterprise.update({
          where: { id: oldEnterpriseId },
          data: { usedSeats: { decrement: 1 } },
        });
      }

      // 9. Audit log
      await admin.loopDesignerAuditLog.create({
        data: {
          enterpriseId: inviteInfo.enterpriseId,
          userId: user.id,
          action: "member_joined_via_invite",
          resourceType: "enterprise",
          resourceId: inviteInfo.enterpriseId,
          details: { old_enterprise_id: oldEnterpriseId, code },
        },
      });

      return NextResponse.json({
        success: true,
        message: `已加入 ${inviteInfo.enterpriseName}`,
        data: { enterpriseId: inviteInfo.enterpriseId, enterpriseName: inviteInfo.enterpriseName },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "加入企业失败";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
