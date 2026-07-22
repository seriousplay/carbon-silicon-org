/**
 * 回路层级树 — 服务端数据查询
 *
 * 仅包含 Prisma 数据查询。类型和工具函数在 types.ts（客户端安全）。
 */
import { prisma } from "@/lib/db";
import type { CircleTreeNode, CircleInterfaceLink } from "./types";

// Re-export types for convenience
export type { CircleTreeNode, CircleInterfaceLink } from "./types";
export { findNodeInTree, getNodePath, flattenTreeNode } from "./types";

/**
 * 获取组织全部活跃回路的层级树和接口关系。
 * 用于业务回路钻取探索器（Server Component 数据获取）。
 */
export async function fetchCircleHierarchy(orgId: string) {
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
        _count: { select: { people: true } },
      },
    }),
    prisma.circleInterface.findMany({
      where: { organizationId: orgId, status: { not: "ARCHIVED" } },
      select: {
        id: true,
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
    Promise.all(
      circleIds.map(async (id) => ({
        circleId: id,
        count: await prisma.tension.count({
          where: { circles: { some: { id } } },
        }),
      }))
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

  // 构建扁平节点列表
  const flatNodes: Omit<CircleTreeNode, "children" | "childCount" | "descendantCount">[] = circles.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    status: c.status,
    purpose: c.purpose,
    parentId: c.parentId,
    roles: c.roles.map((role) => ({
      id: role.id,
      name: role.name,
      purpose: role.purpose,
      assigneeCount: role._count.assignees,
    })),
    memberCount: c._count.people,
    tensionCount: tensionMap.get(c.id) ?? 0,
    blockerCount: blockerMap.get(c.id) ?? 0,
  }));

  // 构建树结构
  const tree = buildTree(flatNodes);

  const linkList: CircleInterfaceLink[] = interfaces.map((i) => ({
    id: i.id,
    fromCircleId: i.fromCircleId,
    toCircleId: i.toCircleId,
    name: i.name,
    status: i.status,
  }));

  return { tree, links: linkList };
}

// ─── 树构建（仅服务端使用）───────────────────────────────────

function buildTree(
  flatNodes: Omit<CircleTreeNode, "children" | "childCount" | "descendantCount">[]
): CircleTreeNode[] {
  const nodeMap = new Map<string, CircleTreeNode>();

  for (const node of flatNodes) {
    nodeMap.set(node.id, {
      ...node,
      children: [],
      childCount: 0,
      descendantCount: 0,
    });
  }

  const roots: CircleTreeNode[] = [];
  for (const node of flatNodes) {
    const treeNode = nodeMap.get(node.id)!;
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(treeNode);
    } else {
      roots.push(treeNode);
    }
  }

  function computeCounts(node: CircleTreeNode): number {
    node.childCount = node.children.length;
    let desc = node.children.length;
    for (const child of node.children) {
      desc += computeCounts(child);
    }
    node.descendantCount = desc;
    return desc;
  }

  for (const root of roots) {
    computeCounts(root);
  }

  // 按类型和名称排序（战略回路在前）
  const typeOrder: Record<string, number> = {
    STRATEGY: 0,
    PRODUCTION: 1,
    INFRA: 2,
    CROSSCUTTING: 3,
  };
  function sortChildren(node: CircleTreeNode) {
    node.children.sort((a, b) => {
      const ta = typeOrder[a.type] ?? 99;
      const tb = typeOrder[b.type] ?? 99;
      if (ta !== tb) return ta - tb;
      return a.name.localeCompare(b.name);
    });
    for (const child of node.children) sortChildren(child);
  }
  for (const root of roots) sortChildren(root);

  return roots;
}
