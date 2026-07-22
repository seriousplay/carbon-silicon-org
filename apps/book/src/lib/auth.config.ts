/**
 * NextAuth 配置（Edge-safe 部分）
 * basePath 和 pages 使用相对路径，Next.js basePath 自动前缀
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  basePath: "/api/auth",
  session: { strategy: "jwt" as const },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string | undefined;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
