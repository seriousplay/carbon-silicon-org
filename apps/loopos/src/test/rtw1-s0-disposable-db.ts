import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

export type DisposableDbClient = {
  pool: Pool;
  prisma: PrismaClient;
};

export function requiredRtw1S0DatabaseUrl(): string {
  const value = process.env.RTW1_S0_TEST_DATABASE_URL;
  assert.ok(value, "RTW1_S0_TEST_DATABASE_URL is required in DB-required mode");
  const databaseName = decodeURIComponent(new URL(value).pathname.replace(/^\//, ""));
  assert.match(
    databaseName,
    /^loopos_rtw1_s0_[a-z0-9_]+$/,
    "RTW1-S0 tests refuse any database without the disposable loopos_rtw1_s0_ prefix",
  );
  return value;
}

export function createDisposableDbClient(connectionString: string): DisposableDbClient {
  const pool = new Pool({ connectionString, max: 2 });
  const adapter = new PrismaPg(pool, { schema: "public" });
  return { pool, prisma: new PrismaClient({ adapter }) };
}

export async function closeDisposableDbClient(client: DisposableDbClient): Promise<void> {
  await client.prisma.$disconnect();
  await client.pool.end();
}
