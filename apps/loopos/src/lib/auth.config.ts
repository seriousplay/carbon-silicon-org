/**
 * NextAuth 配置（Edge-safe 部分）
 *
 * 这个文件只包含 JWT 验证逻辑，不导入 Prisma 或任何 Node-only 模块。
 * middleware.ts（Edge Runtime）只用这个文件。
 *
 * 完整的 auth 配置（含 Prisma Adapter）在 src/lib/auth.ts。
 */
import type { NextAuthConfig } from "next-auth";
import { withBasePath } from "@/lib/base-path";

const appPath = withBasePath("/app");

export const authConfig = {
  basePath: "/api/auth",
  session: { strategy: "jwt" },
  pages: {
    signIn: withBasePath("/login"),
  },
  providers: [], // middleware 不需要 providers，留给 auth.ts 补全
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const pathname = request.nextUrl.pathname;
      const isProtected = pathname === appPath || pathname.startsWith(`${appPath}/`);
      if (isProtected && !isLoggedIn) {
        return false; // 跳转到 signIn 页
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.uid) {
        session.user.id = token.uid as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
