import { notFound, redirect } from "next/navigation";
import { AppShell, Container } from "@/components/ui";
import { EnhancedSummaryReport } from "@/components/enhanced-summary-report";
import { getEventSummary } from "@/lib/assessment/server-summary";
import { getUserWorkspace, isOrganizationAdmin, requireUser } from "@/lib/auth/server";
import { getAssessmentRun } from "@/lib/runs/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminRunReportPage({ params }: { params: Promise<{ runSlug: string }> }) {
  const { runSlug } = await params;
  const user = await requireUser(`/admin/runs/${runSlug}/report`);
  const workspace = await getUserWorkspace(user.id);
  const run = await getAssessmentRun(runSlug);

  if (!run) notFound();
  const membership = workspace.memberships.find((item) => item.organizationId === run.organizationId) ?? workspace.defaultMembership;
  if (!workspace.profile || !workspace.memberships.length) redirect("/onboarding");
  if (!isOrganizationAdmin(membership) || (run.organizationId && membership?.organizationId !== run.organizationId)) redirect("/dashboard");

  const summary = await getEventSummary(run.slug);

  return (
    <AppShell>
      <Container className="max-w-7xl py-10">
        <EnhancedSummaryReport run={run} initialSummary={summary} />
      </Container>
    </AppShell>
  );
}
