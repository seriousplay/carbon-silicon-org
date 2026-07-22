import { BrainClient } from "@/components/organization-brain/brain-client";
import { BrainHomeContext } from "@/components/organization-brain/brain-home-context";
import { getOrganizationBrainHomeReadModel } from "@/lib/organization-brain/home-read-model";
import { BrainCircuit, LockKeyhole } from "lucide-react";

export default async function OrganizationBrainHome() {
  const projection = await getOrganizationBrainHomeReadModel();

  return (
    <main
      data-brain-command-center="true"
      className="mx-auto flex min-h-[calc(100dvh-8.5rem)] max-w-7xl flex-col animate-fade-rise md:min-h-[calc(100dvh-7.5rem)]"
    >
      <header className="flex flex-wrap items-start justify-between gap-4 pb-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
            <BrainCircuit className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="font-serif text-2xl font-medium">组织大脑</h1>
            <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">
              基于你有权访问的组织事实，获得可追溯的回答与建议。
            </p>
          </div>
        </div>
        <span className="inline-flex min-h-10 items-center gap-2 text-xs font-medium text-muted-foreground">
          <LockKeyhole className="size-4 text-[var(--brain-success)]" aria-hidden="true" />
          权限边界已启用
        </span>
      </header>

      <div className="space-y-5">
        <section id="brain-workspace" aria-labelledby="brain-workspace-heading" className="scroll-mt-20">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="brain-workspace-heading" className="text-sm font-semibold">协作工作区</h2>
              <p className="mt-1 text-xs text-muted-foreground">私人对话、建议与待确认操作</p>
            </div>
          </div>
          <BrainClient mode="workspace" className="min-h-[27rem] md:min-h-[30rem]" />
        </section>
        <BrainHomeContext projection={projection} />
      </div>
    </main>
  );
}
