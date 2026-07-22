import { NextResponse } from "next/server";
import { runPlanGenerationJobBatch } from "@/lib/generation-jobs";

type RunBody = {
  limit?: number;
};

export async function POST(request: Request) {
  if (!isAuthorizedWorker(request)) {
    return NextResponse.json({ error: "Unauthorized generation worker" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({})) as RunBody;
    const result = await runPlanGenerationJobBatch({
      limit: body.limit,
      workerId: `api-worker-${crypto.randomUUID()}`,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Generation worker failed" }, { status: 500 });
  }
}

function isAuthorizedWorker(request: Request) {
  const configuredSecret = process.env.LOOP_GENERATION_WORKER_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const headerSecret = request.headers.get("x-loop-worker-secret") ?? "";
  if (configuredSecret) {
    return authorization === `Bearer ${configuredSecret}` || headerSecret === configuredSecret;
  }
  if (process.env.NODE_ENV !== "production") return true;
  const host = request.headers.get("host") ?? "";
  const forwardedFor = request.headers.get("x-forwarded-for");
  return !forwardedFor && (host.startsWith("127.0.0.1:") || host.startsWith("localhost:"));
}
