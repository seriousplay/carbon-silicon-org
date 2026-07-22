/**
 * 回路层级树 — 共享类型和纯工具函数
 *
 * 这些类型和函数不依赖 Prisma，可在客户端组件中安全使用。
 */
import type { CircleNodeData, InterfaceData } from "@/components/circles/circle-map";

// ─── 类型定义 ────────────────────────────────────────────────

export interface CircleTreeNode {
  id: string;
  name: string;
  type: string;
  status: string;
  purpose: string;
  parentId: string | null;
  roles: {
    id: string;
    name: string;
    purpose: string;
    assigneeCount: number;
  }[];
  memberCount: number;
  tensionCount: number;
  blockerCount: number;
  children: CircleTreeNode[];
  childCount: number;
  descendantCount: number;
}

export interface CircleInterfaceLink {
  id: string;
  fromCircleId: string;
  toCircleId: string;
  name: string;
  status: string;
}

// ─── 工具函数 ────────────────────────────────────────────────

/**
 * 在树中查找指定 id 的节点
 */
export function findNodeInTree(roots: CircleTreeNode[], id: string): CircleTreeNode | undefined {
  for (const root of roots) {
    if (root.id === id) return root;
    const found = findNodeInTree(root.children, id);
    if (found) return found;
  }
  return undefined;
}

/**
 * 获取从根到指定节点的路径（面包屑用）
 */
export function getNodePath(roots: CircleTreeNode[], targetId: string): CircleTreeNode[] {
  function find(node: CircleTreeNode, path: CircleTreeNode[]): CircleTreeNode[] | null {
    const newPath = [...path, node];
    if (node.id === targetId) return newPath;
    for (const child of node.children) {
      const result = find(child, newPath);
      if (result) return result;
    }
    return null;
  }

  for (const root of roots) {
    const result = find(root, []);
    if (result) return result;
  }
  return [];
}

/**
 * 将树节点转为 circle-map 使用的扁平数据
 */
export function flattenTreeNode(node: CircleTreeNode): CircleNodeData {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    status: node.status,
    purpose: node.purpose,
    roles: node.roles,
    memberCount: node.memberCount,
    tensionCount: node.tensionCount,
    blockerCount: node.blockerCount,
    parentId: node.parentId,
  };
}
