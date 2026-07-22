/**
 * Next.js Proxy (Middleware)
 * Protects admin and dashboard routes. Public pages are open.
 */
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*"],
};
