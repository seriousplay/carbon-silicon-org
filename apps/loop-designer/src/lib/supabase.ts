import "server-only";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

let prismaClient: PrismaClient | null = null;

export function getAdminClient() {
  if (prismaClient) return prismaClient;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  const pool = new Pool({ connectionString, max: 20 });
  const adapter = new PrismaPg(pool);
  prismaClient = new PrismaClient({ adapter });
  return prismaClient;
}
