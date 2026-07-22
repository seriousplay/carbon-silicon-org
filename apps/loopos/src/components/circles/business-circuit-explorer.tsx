"use client";

import { useState, useCallback, useMemo } from "react";
import { ZoomIn } from "lucide-react";
import type { CircleTreeNode, CircleInterfaceLink } from "@/lib/circles/types";
import { findNodeInTree, getNodePath, flattenTreeNode } from "@/lib/circles/types";
import { CircuitBreadcrumb } from "./circuit-breadcrumb";
import { CircleMapClient, type CircleNodeData, type InterfaceData } from "./circle-map";

/**
 * 业务回路层级钻取探索器
 *
 * 管理视图栈：用户在回路层级中钻入/钻出。
 * 每个层级渲染为一个 OrganismView，以当前 focusCircle 为边界，
 * 其子回路为内部细胞。
 */
export function BusinessCircuitExplorer({
  tree,
  links,
}: {
  tree: CircleTreeNode[];
  links: CircleInterfaceLink[];
}) {
  // 视图栈：从根到当前聚焦节点的路径
  // 空栈 = 顶层视图（显示所有根节点）
  const [viewStack, setViewStack] = useState<CircleTreeNode[]>([]);

  // 过渡动画状态
  const [transitioning, setTransitioning] = useState(false);
  const [transitionDir, setTransitionDir] = useState<"in" | "out">("in");

  const focusNode = viewStack.length > 0 ? viewStack[viewStack.length - 1] : null;

  // 面包屑路径：从某个根节点到当前 focusNode 的完整路径
  const breadcrumbPath = useMemo(() => {
    if (!focusNode) return [];
    // 在树中找到 focusNode 的根
    const rootOfFocus = findRoot(tree, focusNode.id);
    if (!rootOfFocus) return [];
    return getNodePath([rootOfFocus], focusNode.id);
  }, [tree, focusNode]);

  // 获取当前视图的回路和接口数据
  const viewData = useMemo(() => {
    let circles: CircleNodeData[] = [];
    let focusFlat: CircleNodeData | null = null;

    if (!focusNode) {
      // 顶层：显示所有根节点作为细胞，无 organism 边界回路
      const rootNodes = tree.map(flattenTreeNode);
      circles = rootNodes;
    } else {
      // 钻入层级：focusNode 作为 organism，其子节点作为细胞
      focusFlat = flattenTreeNode(focusNode);

      // 需要包含 focusNode 本身（作为 organism 边界）和其子节点
      circles.push(focusFlat);

      for (const child of focusNode.children) {
        const childFlat = flattenTreeNode(child);
        childFlat.parentId = focusNode.id; // 确保父子关系正确
        circles.push(childFlat);
      }
    }

    // 筛选当前视图内回路之间的接口
    const viewCircleIds = new Set(circles.map((c) => c.id));
    const viewInterfaces: InterfaceData[] = links
      .filter(
        (l) => viewCircleIds.has(l.fromCircleId) && viewCircleIds.has(l.toCircleId)
      )
      .map((l) => ({
        fromId: l.fromCircleId,
        toId: l.toCircleId,
        name: l.name,
        status: l.status,
      }));

    return {
      circles,
      interfaces: viewInterfaces,
      focusCircle: focusFlat || undefined,
    };
  }, [tree, focusNode, links]);

  // 钻入操作
  const drillDown = useCallback(
    (circleId: string) => {
      // 在树中查找目标节点
      const target = findNodeInTree(tree, circleId);
      if (!target || target.children.length === 0) return; // 无子回路则不钻入

      setTransitionDir("in");
      setTransitioning(true);
      setViewStack((prev) => [...prev, target]);

      // 动画结束后清除过渡状态
      setTimeout(() => setTransitioning(false), 400);
    },
    [tree]
  );

  // 钻出操作
  const drillUp = useCallback(
    (index: number) => {
      if (index < 0) return;

      setTransitionDir("out");
      setTransitioning(true);
      setViewStack((prev) => prev.slice(0, index + 1));

      setTimeout(() => setTransitioning(false), 400);
    },
    []
  );

  // 面包屑导航
  const handleBreadcrumbNavigate = useCallback(
    (index: number) => {
      // index 0 = 某个根节点的第一级
      // 需要回到对应层级
      const targetPath = breadcrumbPath.slice(0, index + 1);
      if (targetPath.length === 0) {
        // 回到顶层
        drillUp(-1);
      } else if (targetPath.length === 1) {
        // 回到某个根节点（顶层视图）
        setTransitionDir("out");
        setTransitioning(true);
        setViewStack([]);
        setTimeout(() => setTransitioning(false), 400);
      } else {
        // 回到中间层级
        setTransitionDir("out");
        setTransitioning(true);
        setViewStack(targetPath.slice(0, -1)); // 去掉最后一个（是当前focusNode的父级？不对...）
        setTimeout(() => setTransitioning(false), 400);
      }
    },
    [breadcrumbPath]
  );

  // 简化版面包屑导航：
  // 面包屑显示从根到 focusNode 的路径
  // 点击 index i 意味着：focus 到 path[i]（即 viewStack = path.slice(0, i+1)，去掉后面的）
  const handleBreadcrumbClick = useCallback(
    (index: number) => {
      setTransitionDir("out");
      setTransitioning(true);

      if (index === 0 && breadcrumbPath.length > 0) {
        // 点击根节点 → 回到顶层
        setViewStack([]);
      } else {
        // 点击中间节点 → 设置 viewStack 到 path[0..index]
        setViewStack(breadcrumbPath.slice(0, index));
      }

      setTimeout(() => setTransitioning(false), 400);
    },
    [breadcrumbPath]
  );

  // 判断一个回路是否有子回路
  const childCounts = useMemo(() => {
    const map = new Map<string, number>();
    function collect(node: CircleTreeNode) {
      map.set(node.id, node.children.length);
      for (const child of node.children) collect(child);
    }
    for (const root of tree) collect(root);
    return map;
  }, [tree]);

  // 判断当前是否有任何层级可以展示
  const hasContent = viewData.circles.length > 0;

  return (
    <div className="space-y-4">
      {/* 面包屑导航 */}
      <div className="flex items-center justify-between">
        <CircuitBreadcrumb
          path={
            viewStack.length === 0 && tree.length > 0
              ? [tree[0]] // 顶层时显示第一个根节点
              : breadcrumbPath
          }
          onNavigate={handleBreadcrumbClick}
        />
        {/* 层级指示器 */}
        <span className="text-xs text-muted-foreground shrink-0">
          {viewStack.length === 0
            ? `全局视图 · ${tree.length} 个顶层回路`
            : focusNode
              ? `${focusNode.children.length} 个子回路 · ${focusNode.descendantCount} 个下级`
              : ""}
        </span>
      </div>

      {/* 过渡动画容器 */}
      <div
        className="transition-opacity duration-300"
        style={{ opacity: transitioning ? 0.5 : 1 }}
      >
        {hasContent ? (
          <CircleMapClient
            circles={viewData.circles}
            interfaces={viewData.interfaces}
            focusCircleId={focusNode?.id ?? null}
            childCounts={childCounts}
            onDrillDown={drillDown}
            transitionDir={transitioning ? transitionDir : undefined}
            showFlowLines={true}
          />
        ) : (
          <EmptyCircuitState
            isTopLevel={viewStack.length === 0}
            onBackToTop={
              viewStack.length > 0
                ? () => {
                    setViewStack([]);
                  }
                : undefined
            }
          />
        )}
      </div>

      {/* 回顶层按钮 */}
      {viewStack.length > 0 && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => {
              setTransitionDir("out");
              setTransitioning(true);
              setViewStack([]);
              setTimeout(() => setTransitioning(false), 400);
            }}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-moss transition-colors cursor-pointer"
          >
            <ZoomIn className="h-3.5 w-3.5 rotate-180" />
            返回全局视图
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 辅助 ────────────────────────────────────────────────────

function findRoot(
  nodes: CircleTreeNode[],
  targetId: string
): CircleTreeNode | undefined {
  for (const node of nodes) {
    if (node.id === targetId) return node;
    const found = findRoot(node.children, targetId);
    if (found) return found;
  }
  return undefined;
}

function EmptyCircuitState({
  isTopLevel,
  onBackToTop,
}: {
  isTopLevel: boolean;
  onBackToTop?: () => void;
}) {
  return (
    <div className="rounded-card border border-dashed border-border bg-card/50 p-12 text-center">
      <div className="text-3xl mb-3 text-muted-foreground/30">❋</div>
      <p className="text-sm text-muted-foreground">
        {isTopLevel ? "还没有创建回路" : "此回路下暂无子回路"}
      </p>
      {onBackToTop && (
        <button
          type="button"
          onClick={onBackToTop}
          className="mt-3 text-xs text-moss hover:underline cursor-pointer"
        >
          返回全局视图
        </button>
      )}
    </div>
  );
}
