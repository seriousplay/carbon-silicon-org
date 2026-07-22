/**
 * NextAuth v5 完整配置 —— Email magic link 登录
 *
 * 替换原有的 Supabase Auth (magic link OTP)。
 * 使用 PrismaAdapter 持久化 session/account 到 PostgreSQL。
 *
 * 生成 AUTH_SECRET: npx auth secret
 */
import NextAuth from "next-auth";
import Email from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/supabase/pool";
import { authConfig } from "@/lib/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  adapter: PrismaAdapter(db!),

  providers: [
    Email({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT) || 587,
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM || "noreply@csi-org.com",
      maxAge: 10 * 60, // 10 minutes (matching Supabase OTP expiry)
    }),
  ],

  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      // Allow all verified emails
      return true;
    },
  },
});
