/**
 * NextAuth v5 配置 —— 自建账号体系
 *
 * 基于 docs/07-技术架构与栈选型.md 第三节"认证方式"：
 *   - 邮箱 + 密码（bcrypt 哈希）—— Credentials Provider
 *   - 魔法链接（免密码登录）—— Email Provider（后续接 Resend）
 *
 * 完全脱离飞书身份（呼应"不受飞书平台认证局限"的诉求）。
 *
 * 生成 AUTH_SECRET: npx auth secret
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
// Email Provider 暂未启用：魔法链接后续接 Resend（nodemailer 在 Turbopack 下有兼容问题）
// import Email from "next-auth/providers/email";
import bcrypt from "bcryptjs";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { authConfig } from "@/lib/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig, // 继承 Edge-safe 的 session/pages/callbacks 配置

  // Prisma Adapter 持久化 session/account 到数据库
  adapter: PrismaAdapter(prisma),

  providers: [
    // ─── 邮箱 + 密码 ─────────────────────────────────
    Credentials({
      name: "邮箱密码",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          image: user.image ?? undefined,
        };
      },
    }),

    // ─── 魔法链接（免密码登录，后续接 Resend）─────────
    // Email({ server: {...}, from: process.env.MAIL_FROM }),
  ],
});
