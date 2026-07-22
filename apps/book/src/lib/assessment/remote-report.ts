import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Report } from "./types";

export async function getRemoteReport(reportId: string): Promise<Report | null> {
  const supabase = createAdminSupabaseClient();

  if (!supabase || reportId === "demo" || reportId.startsWith("local-")) {
    return null;
  }

  const { data, error } = await supabase.from("reports").select("report_payload").eq("id", reportId).maybeSingle();

  if (error || !data?.report_payload) {
    return null;
  }

  return data.report_payload as Report;
}
