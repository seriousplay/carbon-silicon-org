import Link from "next/link";
import { ArrowRight, CalendarClock, CircleDot, FolderKanban, ListChecks } from "lucide-react";
import type { WeeklyRhythmItem } from "@/lib/weekly-rhythm";

const iconByKind = {
  MEETING: CalendarClock,
  TENSION: CircleDot,
  ACTION: ListChecks,
  PROJECT: FolderKanban,
};

export function WeeklyRhythmQueue({ items }: { items: WeeklyRhythmItem[] }) {
  return (
    <section className="mb-8" aria-labelledby="weekly-rhythm-title">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 id="weekly-rhythm-title" className="text-sm font-medium">本周下一步</h2>
          <p className="mt-1 text-xs text-muted-foreground">只显示需要你现在处理的事项</p>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div className="border-y border-border py-5 text-sm text-muted-foreground">
          当前没有需要你处理的事项。
        </div>
      ) : (
        <div className="divide-y divide-border border-y border-border">
          {items.map((item) => {
            const Icon = iconByKind[item.kind];
            return (
              <Link
                key={item.id}
                href={item.href}
                className="group flex min-h-14 items-center gap-3 py-3 transition-colors hover:bg-muted/30"
              >
                <Icon className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.context}</span>
                </span>
                <ArrowRight className="mr-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
