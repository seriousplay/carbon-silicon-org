import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession, getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";

export default async function OnboardingPage() {
  const session = await requireSession();
  const person = await getCurrentPerson();
  if (person) redirect("/app");

  const email = session.user.email?.toLowerCase() ?? "";
  const invitations = email
    ? await prisma.organizationInvitation.findMany({
        where: {
          email,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: { organization: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-card border border-border bg-card p-6 shadow-soft animate-fade-rise">
        <h1 className="font-serif text-2xl font-medium mb-2">完成加入</h1>
        <p className="text-sm text-muted-foreground mb-6">
          当前账号还没有组织内人员档案。使用邀请链接加入团队，或创建一个新组织。
        </p>
        {invitations.length > 0 && (
          <div className="space-y-2 mb-6">
            {invitations.map((invite) => (
              <div key={invite.id} className="rounded-input border border-border p-3">
                <p className="text-sm font-medium">{invite.organization.name}</p>
                <p className="text-xs text-muted-foreground">
                  请打开管理员发给你的邀请链接完成加入。
                </p>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          <Link href="/register" className="text-sm text-moss hover:underline">创建新组织</Link>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">切换账号</Link>
        </div>
      </div>
    </div>
  );
}
