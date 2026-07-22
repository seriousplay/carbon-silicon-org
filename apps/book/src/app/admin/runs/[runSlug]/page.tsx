import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { AppShell, Container } from "@/components/ui";
import { AdminRunDashboard } from "@/components/admin-run-dashboard";
import { getEventSummary } from "@/lib/assessment/server-summary";
import { getUserWorkspace, isOrganizationAdmin, requireUser } from "@/lib/auth/server";
import { getAssessmentRun } from "@/lib/runs/server";
import { getRunToolSessionSummary } from "@/lib/tools/sessions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminRunPage({ params }: { params: Promise<{ runSlug: string }> }) {
  const { runSlug } = await params;
  const user = await requireUser(`/admin/runs/${runSlug}`);
  const workspace = await getUserWorkspace(user.id);
  const run = await getAssessmentRun(runSlug);

  if (!run) notFound();
  const membership = workspace.memberships.find((item) => item.organizationId === run.organizationId) ?? workspace.defaultMembership;
  if (!workspace.profile || !workspace.memberships.length) redirect("/onboarding");
  if (!isOrganizationAdmin(membership) || (run.organizationId && membership?.organizationId !== run.organizationId)) redirect("/dashboard");

  const summary = await getEventSummary(run.slug);
  const toolSummary = await getRunToolSessionSummary(run.slug);
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const entryUrl = host ? `${protocol}://${host}/e/${run.slug}` : `/e/${run.slug}`;

  return (
    <AppShell>
      <Container className="py-10">
        <AdminRunDashboard run={run} summary={summary} toolSummary={toolSummary} entryUrl={entryUrl} />
      </Container>
    </AppShell>
  );
}
