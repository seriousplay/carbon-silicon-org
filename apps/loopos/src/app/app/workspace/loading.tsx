export default function WorkspaceLoading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse" aria-label="正在加载工作台">
      <div className="mb-8 flex items-start justify-between gap-5">
        <div className="space-y-3">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-4 w-64 max-w-full rounded bg-muted" />
        </div>
        <div className="hidden h-28 w-40 rounded-card border border-border bg-card sm:block" />
      </div>
      <div className="space-y-4">
        <div className="h-28 rounded-card border border-border bg-card" />
        <div className="h-24 rounded-card border border-border bg-card" />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-11 rounded-input border border-border bg-card" />
          ))}
        </div>
      </div>
    </div>
  );
}
