const endpoint = process.env.LOOP_GENERATION_WORKER_URL
  || `http://127.0.0.1:${process.env.PORT || 3010}/loop-designer/api/generation-jobs/run`;
const intervalMs = Math.max(1000, Number(process.env.LOOP_GENERATION_WORKER_INTERVAL_MS || 5000));
const limit = Math.max(1, Math.min(10, Number(process.env.LOOP_GENERATION_WORKER_LIMIT || 1)));
const once = process.env.LOOP_GENERATION_WORKER_ONCE === "true";
const secret = process.env.LOOP_GENERATION_WORKER_SECRET || "";

async function runOnce() {
  const headers = { "content-type": "application/json" };
  if (secret) {
    headers.authorization = `Bearer ${secret}`;
    headers["x-loop-worker-secret"] = secret;
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ limit }),
  });
  const payload = await response.json().catch(() => ({}));
  const level = response.ok ? "log" : "error";
  console[level](JSON.stringify({
    at: new Date().toISOString(),
    endpoint,
    status: response.status,
    payload,
  }));
}

async function main() {
  console.log(JSON.stringify({
    at: new Date().toISOString(),
    event: "generation-worker-started",
    endpoint,
    intervalMs,
    limit,
    once,
  }));
  do {
    try {
      await runOnce();
    } catch (error) {
      console.error(JSON.stringify({
        at: new Date().toISOString(),
        event: "generation-worker-error",
        error: error instanceof Error ? error.message : String(error),
      }));
    }
    if (!once) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (!once);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
