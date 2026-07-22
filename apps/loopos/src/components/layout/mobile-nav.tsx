"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Goal, House, Network, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNavItemActive, type NavIcon, type NavItem } from "./sidebar";

const navIcons: Record<NavIcon, LucideIcon> = {
  workspace: House,
  goals: Goal,
  meetings: CalendarDays,
  organization: Network,
};

export function MobileNav({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="主要导航"
      className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-4 border-t border-border bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] supports-backdrop-filter:backdrop-blur-md md:hidden"
    >
      {items.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        const Icon = navIcons[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
              active ? "text-moss" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon aria-hidden="true" className="h-5 w-5" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
