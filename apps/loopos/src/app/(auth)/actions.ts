"use server";

/**
 * 认证相关的 Server Actions
 *
 * 注册流程（基于 docs/07 技术架构）：
 *   1. 校验邮箱唯一性
 *   2. bcrypt 哈希密码
 *   3. 创建 User
 *   4. 创建 Organization（用户为 admin）
 *   5. 创建默认回路（"主回路"，作为新成员的归属）
 *   6. 创建 Person 关联 User，归属到主回路
 *   7. 签发 session，跳转 /app
 *
 * 这些操作在一个事务里完成，保证原子性。
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

// ─── 表单状态类型 ────────────────────────────────────────
export type AuthState = {
  error?: string;
  ok?: boolean;
};

// ─── 注册 ────────────────────────────────────────────────
export async function registerAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const name = (formData.get("name") as string)?.trim();
  const orgName = (formData.get("orgName") as string)?.trim();

  // 基础校验
  if (!email || !password || !name || !orgName) {
    return { error: "请填写所有字段" };
  }
  if (password.length < 8) {
    return { error: "密码至少 8 位" };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { error: "邮箱格式不正确" };
  }

  // 邮箱唯一性
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "该邮箱已注册" };
  }

  // 哈希密码
  const passwordHash = await bcrypt.hash(password, 12);

  // 事务：建账号 + 组织 + 默认回路 + 人员
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, name, passwordHash },
      });

      // 组织 slug：邮箱域名 + 随机后缀，保证唯一
      const domain = email.split("@")[1]?.split(".")[0] ?? "org";
      const slug = `${domain}-${Math.random().toString(36).slice(2, 6)}`;

      const org = await tx.organization.create({
        data: {
          name: orgName,
          slug,
          members: {
            create: { userId: user.id, role: "ORG_ADMIN" },
          },
        },
      });

      // 默认回路（回路制的第一个回路，作为组织起点）
      const homeCircle = await tx.circle.create({
        data: {
          organizationId: org.id,
          name: "主回路",
          number: "CUSTOM",
          type: "PRODUCTION",
          purpose: `${orgName} 的核心回路`,
        },
      });

      // 人员档案，归属到主回路
      await tx.person.create({
        data: {
          organizationId: org.id,
          name,
          email,
          userId: user.id,
          homeCircleId: homeCircle.id,
        },
      });
    });
  } catch (e) {
    console.error("注册失败:", e);
    return { error: "注册失败，请稍后重试" };
  }

  // 自动登录
  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: "注册成功但自动登录失败，请手动登录" };
    }
    throw e;
  }

  revalidatePath("/");
  redirect("/app/setup");
}

// ─── 登录 ────────────────────────────────────────────────
export async function loginAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "请填写邮箱和密码" };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: "邮箱或密码不正确" };
    }
    throw e;
  }

  redirect("/app");
}
