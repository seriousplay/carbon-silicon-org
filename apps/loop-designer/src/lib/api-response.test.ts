import assert from "node:assert/strict";
import test from "node:test";
import { readApiResponse } from "./api-response";

test("reads JSON API responses", async () => {
  const response = new Response(JSON.stringify({ id: "session-1" }), {
    headers: { "content-type": "application/json" },
  });

  assert.deepEqual(await readApiResponse<{ id?: string }>(response, "请求失败"), { id: "session-1" });
});

test("turns an HTML gateway timeout into an actionable error", async () => {
  const response = new Response("<html><h1>504 Gateway Time-out</h1></html>", {
    status: 504,
    headers: { "content-type": "text/html" },
  });

  const payload = await readApiResponse(response, "生成失败");
  assert.match(payload.error ?? "", /后台生成/);
});

test("handles malformed JSON without throwing", async () => {
  const response = new Response("<not-json>", {
    status: 502,
    headers: { "content-type": "application/json" },
  });

  assert.deepEqual(await readApiResponse(response, "生成失败"), { error: "生成失败" });
});
