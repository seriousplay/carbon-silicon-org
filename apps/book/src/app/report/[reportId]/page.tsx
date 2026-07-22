import { getRemoteReport } from "@/lib/assessment/remote-report";
import { ReportPageClient } from "./report-page-client";

export default async function ReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  const remoteReport = await getRemoteReport(reportId);

  return <ReportPageClient reportId={reportId} remoteReport={remoteReport} />;
}
