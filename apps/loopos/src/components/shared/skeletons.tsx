/**
 * 通用骨架屏组件 — 活体组织美学风格
 */
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="max-w-5xl mx-auto space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-card border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-muted animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="max-w-5xl mx-auto grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-card border border-border bg-card p-6 shadow-soft">
          <div className="h-8 w-8 rounded-full bg-muted animate-pulse mb-3" />
          <div className="h-4 w-2/3 rounded bg-muted animate-pulse mb-2" />
          <div className="h-3 w-full rounded bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function KanbanSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="w-72 shrink-0 space-y-2">
          <div className="h-6 w-20 rounded bg-muted animate-pulse px-1" />
          {Array.from({ length: 3 }).map((_, j) => (
            <div key={j} className="rounded-card border border-border bg-card p-3 shadow-soft">
              <div className="h-3 w-full rounded bg-muted animate-pulse mb-2" />
              <div className="h-2 w-1/2 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
