import Link from "next/link";
import {
  FileText,
  GitBranch,
  Goal,
  LayoutDashboard,
  Network,
  Search,
  UserRound,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type OrganizationSubnavKey =
  | "overview"
  | "structure"
  | "business-loops"
  | "my-roles"
  | "role-market"
  | "people"
  | "governance"
  | "goals";

export function OrganizationSubnav({ active }: { active: OrganizationSubnavKey }) {
  const items = [
    {
      key: "overview" as const,
      href: "/app/organization",
      label: "概览",
      icon: LayoutDashboard,
    },
    {
      key: "structure" as const,
      href: "/app/circles/map",
      label: "组织结构",
      icon: Network,
    },
    {
      key: "business-loops" as const,
      href: "/app/organization/business-loops",
      label: "业务回路",
      icon: GitBranch,
    },
    {
      key: "my-roles" as const,
      href: "/app/me",
      label: "我的角色",
      icon: UserRound,
    },
    {
      key: "role-market" as const,
      href: "/app/roles/market",
      label: "角色市场",
      icon: Search,
    },
    {
      key: "people" as const,
      href: "/app/people",
      label: "人员",
      icon: Users,
    },
    {
      key: "governance" as const,
      href: "/app/governance",
      label: "治理记录",
      icon: FileText,
    },
    {
      key: "goals" as const,
      href: "/app/goals",
      label: "目标",
      icon: Goal,
    },
  ];

  return (
    <nav aria-label="组织主视图" className="flex gap-1 overflow-x-auto border-b border-border pb-2">
      {items.map((item) => {
        const Icon = item.icon;
        const selected = active === item.key;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition",
              selected
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <Icon aria-hidden="true" className={cn("size-4", selected ? "text-moss" : "text-muted-foreground/70")} />
            <span className="whitespace-nowrap">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
