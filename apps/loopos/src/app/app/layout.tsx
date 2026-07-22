import { redirect } from "next/navigation";
import { requireSession, getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { GlobalSearch } from "@/components/layout/global-search";
import { OrganizationBrainProvider } from "@/components/organization-brain/brain-client";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const person = await getCurrentPerson();

  if (!person) {
    redirect("/onboarding");
  }

  const org = person.organization;

  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: session.user.id, organizationId: org.id } },
    select: { role: true },
  });

  // 未读通知数（review 产品 P0-4）
  const unreadCount = person
    ? await prisma.notification.count({
        where: { recipientId: person.id, readAt: null },
      })
    : 0;

  const primaryItems = [
    { href: "/app/organization", label: "组织", icon: "organization" },
    { href: "/app/workspace", label: "工作", icon: "workspace" },
    { href: "/app/goals", label: "目标", icon: "goals" },
    { href: "/app/meetings", label: "会议", icon: "meetings" },
  ] as const;
  const isOrgAdmin = membership?.role === "ORG_ADMIN";

  return (
    <OrganizationBrainProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar
          orgName={org.name}
          items={primaryItems}
        />

        <div className="flex flex-1 flex-col min-w-0">
          <Topbar
            userName={person.name}
            userEmail={session.user.email ?? ""}
            homeCircleName={person.homeCircle.name}
            navItems={primaryItems}
            unreadNotifications={unreadCount}
            isOrgAdmin={isOrgAdmin}
          />
          <main className="flex-1 overflow-y-auto px-4 pt-6 pb-24 sm:px-6 md:px-8 md:py-8">
            {children}
          </main>
        </div>

        {/* 全局搜索 ⌘K */}
        <GlobalSearch />
      </div>
    </OrganizationBrainProvider>
  );
}
