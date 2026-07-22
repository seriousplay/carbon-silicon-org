"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Goal, House, Network, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavIcon = "workspace" | "goals" | "meetings" | "organization";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
};

const navIcons: Record<NavIcon, LucideIcon> = {
  workspace: House,
  goals: Goal,
  meetings: CalendarDays,
  organization: Network,
};

export function isNavItemActive(pathname: string, href: string): boolean {
  const matchesSegment = (prefix: string) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`);

  if (href === "/app") {
    return pathname === "/app";
  }
  if (href === "/app/workspace") {
    return ["/app/workspace", "/app/projects", "/app/tracker", "/app/tensions", "/app/review"].some(matchesSegment);
  }
  if (href === "/app/organization") {
    return ["/app/organization", "/app/setup", "/app/circles", "/app/roles", "/app/me", "/app/people", "/app/governance"].some(matchesSegment);
  }
  return matchesSegment(href);
}

export function Sidebar({
  orgName,
  items,
}: {
  orgName: string;
  items: readonly NavItem[];
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 flex-col border-r border-sidebar-border bg-sidebar">
      {/* 组织标识 */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <Link href="/app" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full border-2 border-moss flex items-center justify-center shrink-0">
            <div className="h-3 w-3 rounded-full bg-moss" />
          </div>
          <div className="min-w-0">
            <p className="font-serif text-sm font-medium truncate">{orgName}</p>
            <p className="text-[11px] text-muted-foreground">回路OS</p>
          </div>
        </Link>
      </div>

      {/* 导航 */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          const Icon = navIcons[item.icon];

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon
                aria-hidden="true"
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-moss" : "text-muted-foreground/70"
                )}
              />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* 底部：组织呼吸状态 */}
      <div className="px-5 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-moss/40 animate-ping opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-moss" />
          </span>
          组织呼吸中
        </div>
      </div>
    </aside>
  );
}
