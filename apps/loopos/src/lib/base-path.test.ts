import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const root = new URL("../../", import.meta.url);
const globalSearch = readFileSync(new URL("../components/layout/global-search.tsx", import.meta.url), "utf8");

function evaluate(source: string, env: Record<string, string | undefined> = {}) {
  const result = spawnSync(process.execPath, ["--import", "tsx", "--eval", source], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NEXT_PUBLIC_BASE_PATH: "", ...env },
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

describe("optional Next.js base path", () => {
  test("defaults to the root path and prefixes explicit deployments", () => {
    const source = `const { basePath, withBasePath } = require("./src/lib/base-path.ts");
      console.log(JSON.stringify({ basePath, api: withBasePath("/api/search") }));`;

    assert.deepEqual(JSON.parse(evaluate(source)), { basePath: "", api: "/api/search" });
    assert.deepEqual(JSON.parse(evaluate(source, { NEXT_PUBLIC_BASE_PATH: "/loopos" })), {
      basePath: "/loopos",
      api: "/loopos/api/search",
    });
  });

  test("configures the public NextAuth client URL without changing AUTH_URL", () => {
    const source = `const { default: nextConfig } = require("./next.config.ts");
      console.log(JSON.stringify({ basePath: nextConfig.basePath, nextAuthUrl: nextConfig.env?.NEXTAUTH_URL, authUrl: process.env.AUTH_URL }));`;
    const result = JSON.parse(
      evaluate(source, { NEXT_PUBLIC_BASE_PATH: "/loopos", AUTH_URL: "https://csi-org.com" })
    );

    assert.deepEqual(result, {
      basePath: "/loopos",
      nextAuthUrl: "https://csi-org.com/loopos/api/auth",
      authUrl: "https://csi-org.com",
    });
  });

  test("keeps the Auth.js server handler internal while prefixing public sign-in and app paths", () => {
    const source = `const { authConfig } = require("./src/lib/auth.config.ts");
      const authorized = authConfig.callbacks.authorized;
      const check = (pathname, loggedIn = false) => authorized({ auth: loggedIn ? { user: {} } : null, request: { nextUrl: { pathname } } });
      console.log(JSON.stringify({ basePath: authConfig.basePath, signIn: authConfig.pages.signIn, app: check("/loopos/app"), child: check("/loopos/app/people"), lookalike: check("/loopos/application"), rootApp: check("/app"), loggedIn: check("/loopos/app", true) }));`;
    const result = JSON.parse(evaluate(source, { NEXT_PUBLIC_BASE_PATH: "/loopos" }));

    assert.deepEqual(result, {
      basePath: "/api/auth",
      signIn: "/loopos/login",
      app: false,
      child: false,
      lookalike: true,
      rootApp: true,
      loggedIn: true,
    });
  });

  test("lets Next.js apply the configured base path to the middleware matcher", () => {
    const source = `globalThis.AsyncLocalStorage = require("node:async_hooks").AsyncLocalStorage;
      const { unstable_doesMiddlewareMatch } = require("next/experimental/testing/server");
      const { config } = require("./src/middleware.ts");
      const match = (url, basePath) => unstable_doesMiddlewareMatch({ config, nextConfig: { basePath }, url });
      console.log(JSON.stringify({ root: match("/app", undefined), prefixed: match("/loopos/app", "/loopos"), child: match("/loopos/app/people", "/loopos"), unprefixedProduction: match("/app", "/loopos") }));`;
    const result = JSON.parse(evaluate(source));

    assert.deepEqual(result, {
      root: true,
      prefixed: true,
      child: true,
      unprefixedProduction: false,
    });
  });

  test("prefixes native search fetches", () => {
    assert.match(globalSearch, /fetch\(withBasePath\(`\/api\/search\?q=/);
  });
});
