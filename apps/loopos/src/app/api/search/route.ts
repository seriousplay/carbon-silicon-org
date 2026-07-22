/**
 * 全局搜索 API
 * 基于 review/v1 产品 P1-1：无搜索/筛选
 * 搜索回路/张力/阻塞点/人员/会议
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentOrgId } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  const orgId = await getCurrentOrgId();
  const where = {
    organizationId: orgId,
    OR: [{ name: { contains: q, mode: "insensitive" as const } }],
  };

  const [circles, tensions, people] = await Promise.all([
    prisma.circle
      .findMany({
        where: { organizationId: orgId, name: { contains: q, mode: "insensitive" } },
        select: { id: true, name: true, purpose: true },
        take: 5,
      })
      .then((r) => r.map((x) => ({ type: "circle", id: x.id, label: x.name, sub: x.purpose, href: `/app/circles/${x.id}` }))),
    prisma.tension
      .findMany({
        where: {
          organizationId: orgId,
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
          ],
        },
        select: { id: true, title: true, status: true },
        take: 5,
      })
      .then((r) => r.map((x) => ({ type: "tension", id: x.id, label: x.title, sub: x.status, href: `/app/tensions/${x.id}` }))),
    prisma.person
      .findMany({
        where: { organizationId: orgId, name: { contains: q, mode: "insensitive" } },
        select: { id: true, name: true, email: true },
        take: 5,
      })
      .then((r) => r.map((x) => ({ type: "person", id: x.id, label: x.name, sub: x.email ?? "", href: `/app/people` }))),
  ]);

  return NextResponse.json({ results: [...circles, ...tensions, ...people] });
}
