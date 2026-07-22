export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { AppShell, Container, SectionLabel } from "@/components/ui";
import { getUserWorkspace, requireUser } from "@/lib/auth/server";
import { canSubmitAssessmentAsGuest, getAssessmentRun } from "@/lib/runs/server";
import { StartForm } from "./start-form";

export default async function StartPage({ params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await params;
  const run = await getAssessmentRun(eventSlug);

  if (!run || !["active", "draft"].includes(run.status)) {
    notFound();
  }

  const allowsGuestSubmission = canSubmitAssessmentAsGuest(eventSlug);
  const workspace = allowsGuestSubmission ? null : await (async () => {
    const user = await requireUser(`/e/${eventSlug}/start`);
    const userWorkspace = await getUserWorkspace(user.id);
    if (!userWorkspace.profile || !userWorkspace.memberships.length) redirect("/onboarding");
    return { user, ...userWorkspace };
  })();

  return (
    <AppShell>
      <Container className="max-w-4xl py-12">
        <SectionLabel>Step 1 / 基础信息</SectionLabel>
        <h1 className="text-4xl font-black text-white">先标记你的组织现场</h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-emerald-50/68">
          {allowsGuestSubmission
            ? "本次数据会进入工作坊匿名汇总，用于现场讨论、群体画像和后续行动设计。"
            : "本次数据会进入你的个人工作台；如果入口归属企业组织，也会进入组织管理员可见的数据空间。"}
        </p>

        <StartForm
          eventSlug={eventSlug}
          requiresAccessCode={Boolean(run.accessCode)}
          initialProfile={
            workspace
              ? {
                  displayName: workspace.profile?.displayName ?? "",
                  role: workspace.profile?.role ?? "HR 一号位",
                  companyName: workspace.defaultMembership?.organizationName ?? "",
                  contact: workspace.user.email ?? "",
                }
              : {
                  role: "HR 一号位",
                }
          }
        />
      </Container>
    </AppShell>
  );
}
