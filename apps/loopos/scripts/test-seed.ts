import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import bcrypt from "bcryptjs";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool, { schema: "public" });
  const prisma = new PrismaClient({ adapter });

  const passwordHash = await bcrypt.hash("testpass123", 12);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: "test@loopos.dev", name: "测试者", passwordHash },
    });
    const org = await tx.organization.create({
      data: {
        name: "测试组织",
        slug: "loopos-dev-test",
        members: { create: { userId: user.id, role: "ORG_ADMIN" } },
      },
    });
    const circle = await tx.circle.create({
      data: {
        organizationId: org.id,
        name: "主回路",
        number: "CUSTOM",
        type: "PRODUCTION",
        purpose: "测试组织的核心回路",
      },
    });
    const person = await tx.person.create({
      data: {
        organizationId: org.id,
        name: "测试者",
        email: "test@loopos.dev",
        userId: user.id,
        homeCircleId: circle.id,
      },
    });
    return { user, org, circle, person };
  });

  console.log("✅ 注册事务成功:");
  console.log("  User:", result.user.id, result.user.email);
  console.log("  Org:", result.org.id, result.org.name);
  console.log("  Circle:", result.circle.id, result.circle.name);
  console.log("  Person:", result.person.id, result.person.name);
  console.log("");
  console.log("账号: test@loopos.dev / 密码: testpass123");

  await pool.end();
}
main().catch((e) => { console.error("❌", e); process.exit(1); });
