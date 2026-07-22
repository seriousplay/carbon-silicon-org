"use client";

/**
 * Re-export NextAuth hooks for client-side auth state.
 * Replaces the old Supabase browser client.
 */
export { useSession, signIn, signOut, getSession } from "next-auth/react";
