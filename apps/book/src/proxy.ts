/**
 * NextAuth Middleware
 *
 * 替换原有的 Supabase SSR proxy.ts。
 * 保护 /book/dashboard, /book/admin, /book/onboarding 路由。
 */
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/book/dashboard/:path*",
    "/book/admin/:path*", 
    "/book/onboarding/:path*",
  ],
};
