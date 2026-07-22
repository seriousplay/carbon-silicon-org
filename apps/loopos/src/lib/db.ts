/**
 * Prisma 客户端单例（Prisma 7 driver adapter 模式）
 *
 * Prisma 7 不再支持仅用 DATABASE_URL 直连，必须用 driver adapter。
 * 我们用 @prisma/adapter-pg（基于 node-postgres）直连 PostgreSQL。
 *
 * 防止 Next.js 开发模式热重载时创建过多连接。
 * 基于 docs/07-技术架构与栈选型.md
 */
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool, { schema: "public" });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
