import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashInvitationToken } from "@/lib/invitations";
import { InviteAcceptForm } from "./invite-accept-form";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();
  const invitation = await loadInvitation(token);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-card border border-border bg-card p-6 shadow-soft animate-fade-rise">
        <h1 className="font-serif text-2xl font-medium mb-2">加入组织</h1>
        {!invitation ? (
          <>
            <p className="text-sm text-muted-foreground mb-6">邀请链接无效、已过期或已被使用。</p>
            <Link href="/login" className="text-sm text-moss hover:underline">返回登录</Link>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              你将以 {invitation.email} 加入 {invitation.organization.name}。
            </p>
            {session?.user?.email && session.user.email.toLowerCase() !== invitation.email && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-input px-3 py-2 mb-4">
                当前登录邮箱与邀请邮箱不一致，请切换账号后再接受邀请。
              </p>
            )}
            <InviteAcceptForm token={token} isSignedIn={Boolean(session?.user?.id)} />
          </>
        )}
      </div>
    </div>
  );
}

async function loadInvitation(token: string) {
  const invitation = await prisma.organizationInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    include: { organization: { select: { name: true } } },
  });
  if (
    !invitation ||
    invitation.revokedAt ||
    invitation.consumedAt ||
    invitation.expiresAt.getTime() <= Date.now()
  ) {
    return null;
  }
  return invitation;
}
