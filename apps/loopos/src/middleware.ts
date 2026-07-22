/**
 * 中间件：保护 /app/* 路由
 *
 * NextAuth v5 + Next.js 16 标准写法。
 * 用 authConfig 的 authorized callback（Edge-safe，不导入 Prisma）。
 * 未登录访问 /app/* → authorized 返回 false → 自动重定向到 /login。
 */
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/app/:path*"],
};
