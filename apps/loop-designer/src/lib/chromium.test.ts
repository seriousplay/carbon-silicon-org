import assert from "node:assert/strict";
import test from "node:test";

import { resolveChromiumExecutablePath } from "./chromium";

test("Chromium path resolver uses configured executable first", () => {
  assert.equal(
    resolveChromiumExecutablePath({
      env: { CHROMIUM_EXECUTABLE_PATH: "/custom/chromium" },
      exists: () => false,
      which: () => null,
    }),
    "/custom/chromium",
  );
});

test("Chromium path resolver falls back to installed desktop browsers", () => {
  assert.equal(
    resolveChromiumExecutablePath({
      env: {},
      exists: (path) => path === "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      which: () => null,
    }),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  );
});

test("Chromium path resolver reports an actionable setup error", () => {
  assert.throws(
    () => resolveChromiumExecutablePath({ env: {}, exists: () => false, which: () => null }),
    /CHROMIUM_EXECUTABLE_PATH 尚未配置，且未找到本机 Chrome\/Chromium/,
  );
});
