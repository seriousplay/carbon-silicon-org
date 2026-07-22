/**
 * NextAuth API Route Handler
 *
 * Handles all NextAuth requests: sign in, sign out, session, csrf, callback, verify-request, etc.
 */
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
