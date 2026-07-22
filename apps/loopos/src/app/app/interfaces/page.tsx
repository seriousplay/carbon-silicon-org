import Link from "next/link";
import { getCurrentOrgId } from "@/lib/session";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

const interfaceStatusMap = {
  READY: { label: "就绪", variant: "growing" },
  DELAYED: { label: "延迟", variant: "needs-light" },
  BLOCKED: { label: "阻塞", variant: "urgent" },
  ARCHIVED: { label: "归档", variant: "mature" },
} as const;

export default async function InterfacesPage() {
  const orgId = await getCurrentOrgId();

  const interfaces = await prisma.circleInterface.findMany({
    where: { organizationId: orgId, status: { not: "ARCHIVED" } },
    include: {
      fromCircle: { select: { id: true, name: true } },
      toCircle: { select: { id: true, name: true } },
      owner: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="max-w-5xl mx-auto animate-fade-rise">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl font-medium mb-1">回路间接口</h1>
          <p className="text-sm text-muted-foreground">
            回路之间的交付契约。接口延迟是回路间张力的主要来源。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/app/interfaces/runs" />}>
            <Play />运行工作流
          </Button>
        </div>
      </div>

      {interfaces.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="text-4xl mb-4 text-moss/60">⇄</div>
          <h2 className="font-serif text-lg font-medium mb-2">还没有接口契约</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            回路之间的交付需要明确的契约——交付什么、何时交付、验收标准。
            接口结构变更需通过正式治理流程。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {interfaces.map((intf, i) => {
            const statusInfo = interfaceStatusMap[intf.status];
            return (
              <div
                key={intf.id}
                className="rounded-card border border-border bg-card p-5 shadow-soft animate-fade-rise"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-sm mb-1">{intf.name}</h3>
                    <div className="flex items-center gap-2 text-sm">
                      <Link
                        href={`/app/circles/${intf.fromCircle.id}`}
                        className="text-moss hover:underline"
                      >
                        {intf.fromCircle.name}
                      </Link>
                      <span className="text-muted-foreground">→</span>
                      <Link
                        href={`/app/circles/${intf.toCircle.id}`}
                        className="text-moss hover:underline"
                      >
                        {intf.toCircle.name}
                      </Link>
                    </div>
                  </div>
                  <StatusBadge variant={statusInfo.variant} label={statusInfo.label} />
                </div>

                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                  {intf.contractContent}
                </p>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>SLA: {intf.sla}</span>
                  <span>·</span>
                  <span>负责人 {intf.owner.name}</span>
                  {intf.nextDeliveryAt && (
                    <>
                      <span>·</span>
                      <span>下次交付 {intf.nextDeliveryAt.toLocaleDateString("zh-CN")}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
