"use client";

import { ChevronRight } from "lucide-react";
import type { CircleTreeNode } from "@/lib/circles/hierarchy";

export function CircuitBreadcrumb({
  path,
  onNavigate,
}: {
  path: CircleTreeNode[];
  onNavigate: (index: number) => void;
}) {
  if (path.length <= 1) return null;

  // 顶层视图：path 只有一个元素（根回路），不显示面包屑
  // 钻入后：path 有多个元素，显示路径

  return (
    <nav
      className="flex items-center gap-1 text-sm mb-4 px-1 animate-fade-rise select-none"
      aria-label="回路层级导航"
    >
      {path.map((node, i) => {
        const isLast = i === path.length - 1;
        return (
          <span key={node.id} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
            )}
            {isLast ? (
              <span className="font-medium text-moss">{node.name}</span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(i)}
                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {node.name}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
