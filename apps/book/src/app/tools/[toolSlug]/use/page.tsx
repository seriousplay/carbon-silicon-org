import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell, Container, GlassCard, SectionLabel } from "@/components/ui";
import { ToolUseForm } from "@/components/tool-use-form";
import { getUserWorkspace, requireUser } from "@/lib/auth/server";
import { getAssessmentRun } from "@/lib/runs/server";
import { chapterLabel, getTool, toolLibrary, toolTypeMeta } from "@/lib/tools/tool-library";

export function generateStaticParams() {
  return toolLibrary.map((tool) => ({ toolSlug: tool.id }));
}

export default async function ToolUsePage({
  params,
  searchParams,
}: {
  params: Promise<{ toolSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { toolSlug } = await params;
  const query = await searchParams;
  const user = await requireUser(`/tools/${toolSlug}/use`);
  const workspace = await getUserWorkspace(user.id);
  if (!workspace.profile || !workspace.memberships.length) redirect("/onboarding");
  const runSlug = Array.isArray(query.run) ? query.run[0] : query.run;
  const tool = getTool(toolSlug);

  if (!tool) notFound();

  const run = runSlug ? await getAssessmentRun(runSlug) : null;
  if (runSlug && !run) notFound();

  return (
    <AppShell>
      <Container className="max-w-6xl py-12">
        <Link href={`/tools/${tool.id}`} className="no-print mb-8 inline-flex items-center gap-2 text-sm font-bold text-emerald-200 hover:text-emerald-100">
          <ArrowLeft className="h-4 w-4" />
          返回工具说明
        </Link>

        <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="space-y-5">
            <GlassCard className="p-7">
              <SectionLabel>{chapterLabel(tool.chapter)} · {toolTypeMeta[tool.toolType].label}</SectionLabel>
              <h1 className="text-4xl font-black leading-tight text-white">{tool.name}</h1>
              <p className="mt-3 text-lg font-semibold leading-8 text-emerald-100/78">{tool.subtitle}</p>
              <p className="mt-5 text-sm leading-7 text-emerald-50/66">{tool.problem}</p>
            </GlassCard>

            {run ? (
              <GlassCard className="p-6">
                <div className="text-sm font-black text-emerald-200">归属入口</div>
                <h2 className="mt-2 text-2xl font-black text-white">{run.title}</h2>
                <p className="mt-3 text-sm leading-7 text-emerald-50/62">
                  本次工具使用会归入该入口的数据池，引导师可在后台查看团队使用汇总并导出企业数据。
                </p>
              </GlassCard>
            ) : (
              <GlassCard className="p-6">
                <div className="text-sm font-black text-emerald-200">单独使用</div>
                <h2 className="mt-2 text-2xl font-black text-white">独立工具会话</h2>
                <p className="mt-3 text-sm leading-7 text-emerald-50/62">
                  适合企业用户先单独试用某个工具。后续可通过企业入口把多个工具组合成完整诊断路径。
                </p>
              </GlassCard>
            )}
          </div>

          <ToolUseForm
            tool={tool}
            runSlug={run?.slug}
            requiresAccessCode={Boolean(run?.accessCode)}
            initialProfile={{
              displayName: workspace.profile?.displayName ?? "",
              role: workspace.profile?.role ?? "",
              companyName: workspace.defaultMembership?.organizationName ?? "",
              contact: user.email ?? "",
            }}
          />
        </div>
      </Container>
    </AppShell>
  );
}
