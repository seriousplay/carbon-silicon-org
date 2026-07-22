/**
 * Database Client - Prisma singleton for connection reuse
 *
 * Replaces the Supabase client singleton pattern.
 * Uses Prisma with pg adapter for direct PostgreSQL access.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient | null {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("DATABASE_URL not set, running without database");
    return null;
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development"
      ? ["query", "warn", "error"]
      : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db ?? undefined;
}

/**
 * Get the database client (returns null if DATABASE_URL not configured)
 * Use this for backward compatibility with existing code that checks for null
 */
export function getDb(): PrismaClient | null {
  return db;
}

/**
 * Reset the cached client (useful for testing)
 */
export function resetDb(): void {
  globalForPrisma.prisma = undefined;
}

// Backward compatibility aliases
export const createAdminSupabaseClient = getDb;
export const getAdminSupabaseClient = getDb;

export { PrismaClient };
