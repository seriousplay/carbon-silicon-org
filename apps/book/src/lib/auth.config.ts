/**
 * NextAuth 配置（Edge-safe 部分）
 *
 * 只包含 JWT 验证逻辑，不导入 Prisma 或任何 Node-only 模块。
 * middleware.ts（Edge Runtime）只用这个文件。
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  basePath: "/book/api/auth",
  session: { strategy: "jwt" as const },
  pages: {
    signIn: "/book/login",
    verifyRequest: "/book/login?verify=1",
  },
  providers: [], // middleware 不需要 providers，留给 auth.ts 补全
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const pathname = request.nextUrl.pathname;

      // Protected routes under /book
      const protectedPaths = ["/book/dashboard", "/book/admin", "/book/onboarding"];
      const isProtected = protectedPaths.some(
        (p) => pathname === p || pathname.startsWith(p + "/")
      );

      if (isProtected && !isLoggedIn) {
        const nextUrl = pathname.replace("/book", "");
        const signInUrl = new URL("/book/login", request.url);
        if (nextUrl && nextUrl !== "/login") {
          signInUrl.searchParams.set("next", nextUrl);
        }
        return Response.redirect(signInUrl);
      }
      return true;
    },
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
