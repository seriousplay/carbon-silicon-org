import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";
import { NewMeetingForm } from "../new-form";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";

export default async function NewMeetingPage() {
  const orgId = await getCurrentOrgId();
  const [currentPerson, circles, people, organization] = await Promise.all([
    getCurrentPerson(),
    prisma.circle.findMany({
      where: { organizationId: orgId, status: { not: "ARCHIVED" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.person.findMany({
      where: { organizationId: orgId, entityType: "HUMAN" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { lifecycleStatus: true },
    }),
  ]);
  const setupLocked = organization?.lifecycleStatus !== "ACTIVE";

  return (
    <div className="max-w-2xl mx-auto animate-fade-rise">
      <h1 className="font-serif text-2xl font-medium mb-1">发起会议</h1>
      <p className="text-sm text-muted-foreground mb-8">
        战术会处理运营卡点，治理会澄清组织结构与权责边界。透明 &gt; 完美。
      </p>
      {setupLocked ? (
        <section className="rounded-card border border-amber-300 bg-amber-50 p-6 text-amber-900">
          <div className="flex items-start gap-3">
            <LockKeyhole className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <h2 className="font-medium">组织尚未启用，暂不能发起会议</h2>
              <p className="mt-2 text-sm leading-6">
                设置模式下可以补齐组织身份、结构、目标、角色和成员邀请。启用后，战术会和治理会会自动开放。
              </p>
              <Link href="/app/organization" className="mt-4 inline-flex text-sm font-medium underline-offset-4 hover:underline">
                查看组织准备度
              </Link>
            </div>
          </div>
        </section>
      ) : (
      <NewMeetingForm circles={circles} people={people} currentPersonId={currentPerson?.id ?? null} />
      )}
    </div>
  );
}
