"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Bell, Brain, Expand, Plus, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BrainClient } from "@/components/organization-brain/brain-client";
import { withBasePath } from "@/lib/base-path";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MobileNav } from "./mobile-nav";
import type { NavItem } from "./sidebar";

export function Topbar({
  userName,
  userEmail,
  homeCircleName,
  navItems,
  unreadNotifications = 0,
  isOrgAdmin = false,
}: {
  userName: string;
  userEmail: string;
  homeCircleName: string;
  navItems: readonly NavItem[];
  unreadNotifications?: number;
  isOrgAdmin?: boolean;
}) {
  const initials = userName.slice(0, 2);
  const [brainOpen, setBrainOpen] = useState(false);

  function openSearch() {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
    );
  }

  return (
    <header className="flex min-h-14 items-center justify-between border-b border-border bg-card/50 px-3 py-2 sm:px-6 md:px-8">
      {/* 当前归属回路 */}
      <div className="hidden min-w-0 items-center gap-2 text-sm sm:flex">
        <span className="hidden text-muted-foreground sm:inline">归属</span>
        <span className="truncate font-medium text-moss">{homeCircleName}</span>
      </div>

      <MobileNav items={navItems} />

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="搜索"
          title="搜索（⌘/Ctrl + K）"
          onClick={openSearch}
        >
          <Search aria-hidden="true" />
        </Button>

        <Button
          nativeButton={false}
          variant="outline"
          size="sm"
          aria-label="提出张力"
          title="提出张力"
          render={<Link href="/app/tensions/new" />}
        >
          <Plus aria-hidden="true" />
          <span className="hidden lg:inline">提出张力</span>
        </Button>

        <Sheet open={brainOpen} onOpenChange={setBrainOpen}>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="打开组织大脑"
                title="组织大脑"
              />
            }
          >
            <Brain aria-hidden="true" />
          </SheetTrigger>
          <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
            <SheetHeader className="border-b border-border pr-14">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <SheetTitle>组织大脑</SheetTitle>
                  <SheetDescription>基于你有权访问的组织信息回答问题。</SheetDescription>
                </div>
                <Button
                  nativeButton={false}
                  variant="ghost"
                  size="sm"
                  render={<Link href="/app" onClick={() => setBrainOpen(false)} />}
                >
                  <Expand aria-hidden="true" />
                  展开
                </Button>
              </div>
            </SheetHeader>
            <BrainClient mode="panel" className="min-h-0 flex-1" />
          </SheetContent>
        </Sheet>

        {/* 通知铃铛 */}
        <Button
          nativeButton={false}
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="通知"
          title="通知"
          render={<Link href="/app/notifications" />}
        >
          <Bell aria-hidden="true" />
          {unreadNotifications > 0 && (
            <span className="absolute top-1 right-1 inline-flex min-w-4 items-center justify-center rounded-full bg-urgent px-1 text-[9px] font-medium text-white">
              {unreadNotifications > 99 ? "99+" : unreadNotifications}
            </span>
          )}
        </Button>

        {/* 用户菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="flex items-center gap-2 px-2">
                <span className="sr-only">账户</span>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-moss-pale text-moss text-xs font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium hidden sm:inline">{userName}</span>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{userName}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {userEmail}
                  </span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href="/app/notifications">通知</Link>} />
              {isOrgAdmin && (
                <>
                  <DropdownMenuItem render={<Link href="/app/interfaces">组织扩展</Link>} />
                  <DropdownMenuItem render={<Link href="/app/setup">组织设置</Link>} />
                </>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => signOut({ callbackUrl: withBasePath("/login") })}
              >
                登出
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
