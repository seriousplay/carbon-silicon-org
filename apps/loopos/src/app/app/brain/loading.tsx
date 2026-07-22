export default function OrganizationBrainLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse" aria-label="正在加载组织大脑">
      <div className="mb-5 h-7 w-32 rounded bg-muted" />
      <div className="h-[32rem] rounded-card border border-border bg-card p-5">
        <div className="h-4 w-48 rounded bg-muted" />
        <div className="mt-8 space-y-3">
          <div className="h-16 rounded bg-muted/70" />
          <div className="h-24 rounded bg-muted/70" />
        </div>
      </div>
    </div>
  );
}
