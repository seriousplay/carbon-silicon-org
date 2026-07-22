import "server-only";

import { db } from "@/lib/supabase/pool";
import type { Report } from "./types";

export async function getRemoteReport(reportId: string): Promise<Report | null> {
  if (!db || reportId === "demo" || reportId.startsWith("local-")) {
    return null;
  }

  try {
    const data = await db.report.findUnique({
      where: { id: reportId },
      select: { reportPayload: true },
    });

    if (!data?.reportPayload) {
      return null;
    }

    return data.reportPayload as Report;
  } catch {
    return null;
  }
}
