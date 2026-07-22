/**
 * NextAuth API Route Handler
 * 路由: /api/auth/[...nextauth]
 */
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
