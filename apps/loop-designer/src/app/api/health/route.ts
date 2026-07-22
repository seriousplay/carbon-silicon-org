import { NextResponse } from "next/server";
import { checkGenerationQueueSchema } from "@/lib/generation-jobs";
import { getConfiguredModelCandidates, getModelCandidateSummaries } from "@/lib/model-config";
import { probeConfiguredModels } from "@/lib/model";
import { getAdminClient } from "@/lib/supabase";

/**
 * GET /api/health
 * Health check for load balancers and monitoring systems.
 */
export async function GET(request: Request) {
  const checks: Record<string, { status: "ok" | "down"; latencyMs?: number; details?: unknown }> = {};

  // Database check
  const dbStart = Date.now();
  try {
    const admin = getAdminClient();
    if (!admin) throw new Error("Not configured");
    await admin.loopDesignerUser.findFirst({ select: { id: true }, take: 1 });
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch {
    checks.database = { status: "down", latencyMs: Date.now() - dbStart };
  }

  // Persistent generation queue schema check
  const queueStart = Date.now();
  try {
    const queue = await checkGenerationQueueSchema();
    checks.generationQueue = {
      status: queue.ok ? "ok" : "down",
      latencyMs: Date.now() - queueStart,
      ...(queue.ok ? {} : { details: queue.error }),
    };
  } catch (error) {
    checks.generationQueue = {
      status: "down",
      latencyMs: Date.now() - queueStart,
      details: error instanceof Error ? error.message : String(error),
    };
  }

  // Model service check. Default is lightweight; ?models=probe performs real calls.
  try {
    const shouldProbeModels = new URL(request.url).searchParams.get("models") === "probe";
    const candidates = getConfiguredModelCandidates();
    if (shouldProbeModels && candidates.length > 0) {
      const modelStart = Date.now();
      const probes = await probeConfiguredModels();
      checks.model = {
        status: probes.some((probe) => probe.status === "ok") ? "ok" : "down",
        latencyMs: Date.now() - modelStart,
        details: probes,
      };
    } else {
      checks.model = {
        status: candidates.length > 0 ? "ok" : "down",
        details: getModelCandidateSummaries(),
      };
    }
  } catch {
    checks.model = { status: "down" };
  }

  const allOk = Object.values(checks).every((c) => c.status === "ok");
  const status = allOk ? 200 : 503;

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status }
  );
}
