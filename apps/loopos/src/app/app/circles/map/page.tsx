import { getCurrentOrgId } from "@/lib/session";
import { prisma } from "@/lib/db";
import { CircleMapClient, type CircleNodeData } from "@/components/circles/circle-map";
import { OrganizationSubnav } from "../../organization/organization-subnav";

export default async function CircleMapPage() {
  const orgId = await getCurrentOrgId();

  const [circles, interfaces] = await Promise.all([
    prisma.circle.findMany({
      where: { organizationId: orgId, status: { not: "ARCHIVED" } },
      include: {
        roles: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            name: true,
            purpose: true,
            _count: { select: { assignees: true } },
          },
          orderBy: { name: "asc" },
        },
        _count: {
          select: { people: true },
        },
      },
    }),
    prisma.circleInterface.findMany({
      where: { organizationId: orgId, status: { not: "ARCHIVED" } },
      select: {
        fromCircleId: true,
        toCircleId: true,
        name: true,
        status: true,
      },
    }),
  ]);

  // 查每个回路的张力和阻塞点计数
  const circleIds = circles.map((c) => c.id);
  const [tensionCounts, blockerCounts] = await Promise.all([
    prisma.tension.groupBy({
      by: ["status"],
      where: { organizationId: orgId },
      _count: true,
    }).then(() =>
      // Prisma 不支持按关联回路 groupBy，改用原始查询逻辑
      Promise.all(
        circleIds.map(async (id) => ({
          circleId: id,
          count: await prisma.tension.count({
            where: { circles: { some: { id } } },
          }),
        }))
      )
    ),
    Promise.all(
      circleIds.map(async (id) => ({
        circleId: id,
        count: await prisma.tension.count({
          where: {
            circleId: id,
            status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "BLOCKED"] },
          },
        }),
      }))
    ),
  ]);

  const tensionMap = new Map(tensionCounts.map((t) => [t.circleId, t.count]));
  const blockerMap = new Map(blockerCounts.map((b) => [b.circleId, b.count]));

  const nodes: CircleNodeData[] = circles.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    status: c.status,
    purpose: c.purpose,
    roles: c.roles.map((role) => ({
      id: role.id,
      name: role.name,
      purpose: role.purpose,
      assigneeCount: role._count.assignees,
    })),
    memberCount: c._count.people,
    tensionCount: tensionMap.get(c.id) ?? 0,
    blockerCount: blockerMap.get(c.id) ?? 0,
    parentId: c.parentId,
  }));

  return (
    <div className="max-w-5xl mx-auto animate-fade-rise space-y-6">
      <OrganizationSubnav active="structure" />

      <div className="mb-6">
        <div>
          <h1 className="font-serif text-2xl font-medium">组织</h1>
          <p className="text-sm text-muted-foreground mt-1">
            组织是一个有机体。主回路是边界，子回路是自闭环的细胞，弧线是滋养关系。
          </p>
        </div>
      </div>

      {circles.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="text-4xl mb-4 text-moss/60">❋</div>
          <p className="text-sm text-muted-foreground">
            还没有回路。先建立回路，它们会出现在地图上。
          </p>
        </div>
      ) : (
        <CircleMapClient
          circles={nodes}
          interfaces={interfaces.map((i) => ({
            fromId: i.fromCircleId,
            toId: i.toCircleId,
            name: i.name,
            status: i.status,
          }))}
        />
      )}

      {/* 图例 */}
      <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-growing" /> 正常
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-needs-light" /> 预警
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-urgent" /> 停摆
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 bg-moss" /> 接口就绪
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 bg-needs-light" /> 接口延迟（流动）
        </span>
        <span className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded-full bg-needs-light-pale text-needs-light">∿ 3</span>
          张力数
        </span>
        <span className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded-full bg-seed-pale text-seed">◐ 2</span>
          阻塞点数
        </span>
      </div>
    </div>
  );
}
