import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { isNavItemActive, type NavItem } from "./sidebar";

const layout = readFileSync(new URL("../../app/app/layout.tsx", import.meta.url), "utf8");
const topbar = readFileSync(new URL("./topbar.tsx", import.meta.url), "utf8");
const mobile = readFileSync(new URL("./mobile-nav.tsx", import.meta.url), "utf8");

const primaryItems = [
  { href: "/app/organization", label: "组织", icon: "organization" },
  { href: "/app/workspace", label: "工作", icon: "workspace" },
  { href: "/app/goals", label: "目标", icon: "goals" },
  { href: "/app/meetings", label: "会议", icon: "meetings" },
] satisfies readonly NavItem[];

test("mobile navigation receives the same four primary items as desktop", () => {
  assert.match(layout, /items=\{primaryItems\}/);
  assert.match(layout, /navItems=\{primaryItems\}/);
  assert.match(topbar, /<MobileNav items=\{navItems\}/);
  assert.match(mobile, /items\.map/);
  assert.doesNotMatch(mobile, /const navItems/);
});

test("mobile navigation is a fixed four-tab bottom bar with Lucide icons", () => {
  assert.match(mobile, /fixed inset-x-0 bottom-0/);
  assert.match(mobile, /env\(safe-area-inset-bottom\)/);
  assert.match(mobile, /grid-cols-4/);
  assert.match(mobile, /from "lucide-react"/);
  assert.doesNotMatch(mobile, /Sheet/);
  assert.equal((layout.match(/href:/g) ?? []).length, 4);
});

test("every governed route activates exactly one primary navigation item", () => {
  const routeTable = [
    ["/app/workspace", "/app/workspace"],
    ["/app/projects", "/app/workspace"],
    ["/app/projects/project-1", "/app/workspace"],
    ["/app/tracker/item-1", "/app/workspace"],
    ["/app/tensions/new", "/app/workspace"],
    ["/app/review", "/app/workspace"],
    ["/app/goals", "/app/goals"],
    ["/app/goals/current", "/app/goals"],
    ["/app/meetings", "/app/meetings"],
    ["/app/meetings/meeting-1", "/app/meetings"],
    ["/app/organization", "/app/organization"],
    ["/app/setup", "/app/organization"],
    ["/app/circles/map", "/app/organization"],
    ["/app/circles/circle-1", "/app/organization"],
    ["/app/roles/role-1", "/app/organization"],
    ["/app/me", "/app/organization"],
    ["/app/people/person-1", "/app/organization"],
    ["/app/governance", "/app/organization"],
  ] as const;

  for (const [pathname, expectedHref] of routeTable) {
    const activeItems = primaryItems.filter((item) =>
      isNavItemActive(pathname, item.href),
    );
    assert.deepEqual(
      activeItems.map((item) => item.href),
      [expectedHref],
      pathname,
    );
  }
});

test("secondary utilities do not accidentally activate a primary item", () => {
  for (const pathname of ["/app", "/app/brain", "/app/interfaces", "/app/notifications"]) {
    const activeItems = primaryItems.filter((item) =>
      isNavItemActive(pathname, item.href),
    );
    assert.equal(activeItems.length, 0, pathname);
  }
});

test("sign-out returns to the base-path login page", () => {
  assert.match(topbar, /signOut\(\{ callbackUrl: withBasePath\("\/login"\) \}\)/);
});

test("topbar keeps Brain, search, notifications, account, and Raise Tension global", () => {
  for (const label of ["打开组织大脑", "搜索", "通知", "提出张力"]) {
    assert.match(topbar, new RegExp(`aria-label=["']${label}["']`));
  }
  assert.match(topbar, /<BrainClient mode="panel"/);
  assert.match(topbar, /href="\/app"/);
  assert.doesNotMatch(topbar, /href="\/app\/brain"/);
});
