/**
 * Shared Authentication Utilities
 *
 * Provides common auth patterns used across all Carbon-Silicon apps.
 * Each app configures its own NextAuth providers.
 */

export { default as NextAuth } from "next-auth";
export type { Session } from "next-auth";
export type { DefaultSession, DefaultUser } from "next-auth";

// Re-export common utilities
export { bcryptjs as bcrypt } from "bcryptjs";
