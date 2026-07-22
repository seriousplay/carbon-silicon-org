import Link from "next/link";
import { getCurrentOrgId } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";

const meetingTypeLabel = {
  TACTICAL: { label: "战术会", desc: "≤30min，处理运营卡点", color: "text-growing" },
  GOVERNANCE: { label: "治理会", desc: "≤90min，澄清结构与权责", color: "text-moss" },
  STRATEGY: { label: "战略回路", desc: "决定做什么", color: "text-needs-light" },
} as const;

const UPCOMING_MEETING_LIMIT = 50;
const HISTORICAL_MEETING_LIMIT = 50;

const meetingListInclude = {
  circle: { select: { name: true } },
  _count: { select: { decisions: true } },
} satisfies Prisma.MeetingInclude;

type MeetingListItem = Prisma.MeetingGetPayload<{
  include: typeof meetingListInclude;
}>;

type FindMeetings = (args: {
  where: Prisma.MeetingWhereInput;
  include: typeof meetingListInclude;
  orderBy: Prisma.MeetingOrderByWithRelationInput;
  take?: number;
}) => Promise<MeetingListItem[]>;

export async function loadMeetingGroups(
  findMeetings: FindMeetings,
  organizationId: string,
  now: Date,
) {
  const [activeMeetings, upcomingMeetings, historicalMeetings] = await Promise.all([
    findMeetings({
      where: {
        organizationId,
        endedAt: null,
        startedAt: { lte: now },
      },
      include: meetingListInclude,
      orderBy: { startedAt: "desc" },
    }),
    findMeetings({
      where: {
        organizationId,
        endedAt: null,
        startedAt: { gt: now },
      },
      include: meetingListInclude,
      orderBy: { startedAt: "asc" },
      take: UPCOMING_MEETING_LIMIT,
    }),
    findMeetings({
      where: {
        organizationId,
        endedAt: { not: null },
      },
      include: meetingListInclude,
      orderBy: { startedAt: "desc" },
      take: HISTORICAL_MEETING_LIMIT,
    }),
  ]);

  return { activeMeetings, upcomingMeetings, historicalMeetings };
}

function MeetingGroup({
  title,
  items,
}: {
  title: string;
  items: readonly MeetingListItem[];
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-xs font-medium text-muted-foreground">{title}</h2>
      <div className="space-y-2">
        {items.map((meeting) => {
          const typeInfo = meetingTypeLabel[meeting.type];
          return (
            <Link
              key={meeting.id}
              href={`/app/meetings/${meeting.id}`}
              className="block rounded-card border border-border bg-card p-4 shadow-soft transition-colors hover:bg-muted/30"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="mb-1 truncate text-sm font-medium">{meeting.title}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className={typeInfo.color}>{typeInfo.label}</span>
                    {meeting.circle && <span>{meeting.circle.name}</span>}
                    <span>{meeting.durationMin}min</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-muted-foreground">
                    {meeting.startedAt.toLocaleString("zh-CN", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {meeting._count.decisions > 0 && (
                    <p className="mt-1 text-xs text-moss">{meeting._count.decisions} 决议</p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default async function MeetingsPage() {
  const orgId = await getCurrentOrgId();
  const now = new Date();
  const { activeMeetings, upcomingMeetings, historicalMeetings } = await loadMeetingGroups(
    (args) => prisma.meeting.findMany(args),
    orgId,
    now,
  );
  const hasMeetings =
    activeMeetings.length > 0 || upcomingMeetings.length > 0 || historicalMeetings.length > 0;

  return (
    <div className="max-w-5xl mx-auto animate-fade-rise">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl font-medium mb-1">会议</h1>
          <p className="text-sm text-muted-foreground">
            战术会处理运营卡点，治理会澄清组织结构与权责边界。透明 &gt; 完美。
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/app/meetings/new" />}>
          <Plus aria-hidden="true" />
          发起会议
        </Button>
      </div>

      {!hasMeetings ? (
        <div className="rounded-card border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="text-4xl mb-4 text-moss/60">⊕</div>
          <h2 className="font-serif text-lg font-medium mb-2">还没有会议记录</h2>
          <p className="text-sm text-muted-foreground mb-6">
            从第一次战术会开始——处理本周的运营卡点。
          </p>
          <Button nativeButton={false} render={<Link href="/app/meetings/new" />}>发起第一次会议</Button>
        </div>
      ) : (
        <div className="space-y-8">
          <MeetingGroup title="进行中" items={activeMeetings} />
          <MeetingGroup title="待开始" items={upcomingMeetings} />
          <MeetingGroup title="历史记录" items={historicalMeetings} />
        </div>
      )}
    </div>
  );
}
