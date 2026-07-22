import { redirect } from "next/navigation";

export default async function SummaryReportPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const runSlug = eventId === "20260517" ? "20260517-hr-od-workshop" : eventId;

  redirect(`/admin/runs/${runSlug}/report`);
}
