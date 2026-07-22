import Link from "next/link";
import { ArrowLeft, Goal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { resolveActorContext } from "@/lib/authorization/actor-context";
import { prisma } from "@/lib/db";
import { queryGoalTree } from "@/lib/goals/read-model";
import { GoalTreeWorkspace } from "./goal-tree-workspace";
import { CreateCycleForm } from "./create-cycle-form";
import { OrganizationSubnav } from "../organization/organization-subnav";

type GoalsSearchParams = Promise<{
  cycle?: string | string[];
  goal?: string | string[];
  proposalPage?: string | string[];
}>;

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: GoalsSearchParams;
}) {
  const actor = await resolveActorContext();
  const params = await searchParams;
  const cycleId = singleValue(params.cycle);
  const goalId = singleValue(params.goal);
  const projection = await queryGoalTree(
    {
      organizationId: actor.organizationId,
      viewerPersonId: actor.personId,
      ...(cycleId ? { cycleId } : {}),
      ...(goalId ? { goalId } : {}),
      proposalPage: parsePage(params.proposalPage),
    },
    { prisma, now: new Date() },
  );

  if (projection.status === "READY") {
    return (
      <main className="mx-auto max-w-7xl space-y-5 animate-fade-rise">
        <OrganizationSubnav active="goals" />
        <header className="border-b border-border pb-3">
          <h1 className="font-serif text-2xl font-medium">目标</h1>
        </header>
        <GoalTreeWorkspace projection={projection} />
      </main>
    );
  }

  if (projection.status === "EMPTY") {
    return (
      <main className="mx-auto max-w-5xl space-y-5 animate-fade-rise">
        <OrganizationSubnav active="goals" />
        <header className="border-b border-border pb-3">
          <h1 className="font-serif text-2xl font-medium">目标</h1>
        </header>
        <section className="border-y border-border py-10 sm:py-12">
          <div className="flex max-w-2xl items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Goal aria-hidden="true" className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-medium">尚未建立目标循环</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                建立组织的第一个目标周期后，这里会显示经会议流程确认的目标树。
              </p>
              <CreateCycleForm />
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (projection.status === "TRUNCATED") {
    return (
      <main className="mx-auto max-w-5xl space-y-5 animate-fade-rise">
        <OrganizationSubnav active="goals" />
        <header className="border-b border-border pb-3">
          <h1 className="font-serif text-2xl font-medium">目标</h1>
        </header>
        <section className="border-y border-border py-10 sm:py-12">
          <div className="max-w-2xl">
            <h2 className="text-base font-medium">目标树数据超出安全展示范围</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              当前周期的目标结构或判据数量无法完整投影，因此不会显示不完整的健康度和缺口结论。
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5 animate-fade-rise">
      <OrganizationSubnav active="goals" />
      <header className="border-b border-border pb-3">
        <h1 className="font-serif text-2xl font-medium">目标</h1>
      </header>
      <section className="border-y border-border py-10 sm:py-12">
        <div className="max-w-2xl">
          <h2 className="text-base font-medium">这个目标视图当前不可用</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            请求的目标周期不存在，或你当前无法查看其中的信息。
          </p>
          <Button
            className="mt-5"
            variant="outline"
            nativeButton={false}
            render={<Link href="/app/goals" />}
          >
            <ArrowLeft aria-hidden="true" />
            返回默认目标页
          </Button>
        </div>
      </section>
    </main>
  );
}

function singleValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parsePage(value: string | string[] | undefined): number | undefined {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return undefined;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : undefined;
}
