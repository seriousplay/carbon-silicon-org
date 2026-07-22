import Link from "next/link";
import { getCurrentOrgId } from "@/lib/session";
import { prisma } from "@/lib/db";

const statusLabel: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "进行中", color: "text-growing" },
  COMPLETED: { label: "已完成", color: "text-mature" },
  PAUSED: { label: "已暂停", color: "text-seed" },
};

export default async function ProjectsPage() {
  const orgId = await getCurrentOrgId();

  const projects = await prisma.project.findMany({
    where: { organizationId: orgId },
    include: {
      circle: { select: { id: true, name: true } },
      bearer: { select: { id: true, name: true } },
      _count: { select: { tensions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-5xl mx-auto animate-fade-rise">
      <div className="mb-8">
        <div>
          <h1 className="font-serif text-2xl font-medium mb-1">项目</h1>
          <p className="text-sm text-muted-foreground">
            项目是回路的工作容器——有始有终，包含多个行动项。
          </p>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="text-4xl mb-4 text-moss/60">📦</div>
          <h2 className="font-serif text-lg font-medium mb-2">还没有项目</h2>
          <p className="text-sm text-muted-foreground">
            在战术会上从张力发起项目，拆解为行动项。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p, i) => {
            const sInfo = statusLabel[p.status] ?? statusLabel.ACTIVE;
            return (
              <Link
                key={p.id}
                href={`/app/projects/${p.id}`}
                className="block rounded-card border border-border bg-card p-5 shadow-soft card-hover animate-fade-rise"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium">{p.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.circle.name}</p>
                  </div>
                  <span className={`text-xs ${sInfo.color} shrink-0`}>{sInfo.label}</span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {p.expectedResult ?? p.goal}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  承担人 {p.bearer?.name ?? "—"} · {p._count.tensions} 个行动项
                  {p.linkedDataVersion ? ` · ${p.linkedDataVersion}` : ""}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
