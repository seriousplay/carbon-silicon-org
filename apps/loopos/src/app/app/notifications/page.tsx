import { getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";
import { markAllReadAction } from "./actions";
import { Button } from "@/components/ui/button";
import { NotificationItem } from "./notification-item";

const typeLabel: Record<string, { label: string; color: string }> = {
  invitation_received: { label: "邀请", color: "text-moss" },
  meeting_participation: { label: "参会", color: "text-moss" },
  outcome_assigned: { label: "指派", color: "text-seed" },
  commitment_approaching: { label: "即将到期", color: "text-needs-light" },
  commitment_overdue: { label: "已逾期", color: "text-urgent" },
  blocker_overdue: { label: "超时", color: "text-urgent" },
  blocker_escalated: { label: "升级", color: "text-needs-light" },
  blocker_assigned: { label: "指派", color: "text-seed" },
  meeting_reminder: { label: "会议", color: "text-moss" },
  tension_received: { label: "张力", color: "text-needs-light" },
  ddl_approaching: { label: "DDL", color: "text-urgent" },
};

export default async function NotificationsPage() {
  const person = await getCurrentPerson();
  if (!person) return null;

  const notifications = await prisma.notification.findMany({
    where: { organizationId: person.organizationId, recipientId: person.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="max-w-3xl mx-auto animate-fade-rise">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl font-medium mb-1">通知</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} 条未读` : "全部已读"}
          </p>
        </div>
        {unreadCount > 0 && (
          <form action={markAllReadAction}>
            <Button type="submit" variant="outline" size="sm">
              全部标为已读
            </Button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="text-4xl mb-4 text-moss/60">○</div>
          <p className="text-sm text-muted-foreground">
            还没有通知。当阻塞点超时或升级时，你会在这里收到提醒。
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n, i) => {
            const info = typeLabel[n.type] ?? { label: n.type, color: "text-muted-foreground" };
            const className = `block rounded-card border p-4 shadow-soft animate-fade-rise transition-colors ${
              n.targetUrl ? "hover:bg-muted/20" : ""
            } ${n.readAt ? "border-border bg-card/50" : "border-moss/30 bg-moss-pale/20"}`;
            const content = (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium ${info.color}`}>{info.label}</span>
                      {!n.readAt && (
                        <span className="h-2 w-2 rounded-full bg-moss" />
                      )}
                    </div>
                    <p className={`text-sm ${n.readAt ? "text-muted-foreground" : "font-medium"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{n.body}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {n.createdAt.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
            );
            return (
              <NotificationItem
                key={n.id}
                id={n.id}
                targetUrl={n.targetUrl}
                className={className}
                animationDelay={`${i * 30}ms`}
              >
                {content}
              </NotificationItem>
            );
          })}
        </div>
      )}
    </div>
  );
}
