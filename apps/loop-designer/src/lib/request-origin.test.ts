import assert from "node:assert/strict";
import test from "node:test";
import { forwardedRequestOrigin, isTrustedRequestSource, originFromUrl } from "./request-origin";

test("originFromUrl normalizes public URLs that include the loop-designer path", () => {
  assert.equal(originFromUrl("https://csi-org.com/loop-designer"), "https://csi-org.com");
  assert.equal(originFromUrl("https://csi-org.com/loop-designer/"), "https://csi-org.com");
  assert.equal(originFromUrl("not a url"), null);
});

test("logout source check accepts same-origin posts when public URL has a path", () => {
  const headers = new Headers({ origin: "https://csi-org.com" });
  assert.equal(isTrustedRequestSource(headers, "https://csi-org.com/loop-designer", "https://csi-org.com"), true);
});

test("logout source check accepts trusted forwarded host origins", () => {
  const headers = new Headers({
    host: "127.0.0.1:3010",
    "x-forwarded-host": "csi-org.com",
    "x-forwarded-proto": "https",
    origin: "https://csi-org.com",
  });
  const requestOrigin = forwardedRequestOrigin(headers, "http://127.0.0.1:3010");
  assert.equal(requestOrigin, "https://csi-org.com");
  assert.equal(isTrustedRequestSource(headers, "https://loop.csi-org.com", requestOrigin), true);
});

test("logout source check accepts browser same-origin metadata when origin and referer are absent", () => {
  const headers = new Headers({ "sec-fetch-site": "same-origin" });
  assert.equal(isTrustedRequestSource(headers, "https://csi-org.com", "https://csi-org.com"), true);
});

test("logout source check rejects cross-site posts", () => {
  const headers = new Headers({
    origin: "https://evil.example",
    "sec-fetch-site": "cross-site",
  });
  assert.equal(isTrustedRequestSource(headers, "https://csi-org.com", "https://csi-org.com"), false);
});
