/**
 * Shared Database Utilities
 *
 * Provides common Prisma patterns used across all Carbon-Silicon apps.
 * Each app generates its own Prisma client from its own schema,
 * and passes it to these utilities.
 *
 * Usage:
 *   import { createPrismaClient, withPagination } from "@carbon-silicon/db";
 *   import { PrismaClient } from "@prisma/client";
 *
 *   const db = createPrismaClient<PrismaClient>();
 */

import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Create a Prisma client with the pg adapter.
 * Uses a global singleton pattern to avoid connection churn.
 */
export function createPrismaClient<T>(ClientConstructor: new (opts: { adapter: PrismaPg; log?: string[] }) => T): T | null {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("DATABASE_URL not set, running without database");
    return null;
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globalKey = Symbol.for("prisma-client-instance");
  const existing = (globalThis as Record<symbol, T | undefined>)[globalKey];
  if (existing) return existing;

  const client = new ClientConstructor({
    adapter,
    log: process.env.NODE_ENV === "development"
      ? ["query", "warn", "error"]
      : ["error"],
  });

  if (process.env.NODE_ENV !== "production") {
    (globalThis as Record<symbol, T | undefined>)[globalKey] = client;
  }

  return client;
}

/**
 * Standard pagination helper.
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function paginationParams(params: PaginationParams) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}

export function paginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// Re-export adapter
export { PrismaPg } from "@prisma/adapter-pg";
export type { PrismaClient } from "@prisma/client";
