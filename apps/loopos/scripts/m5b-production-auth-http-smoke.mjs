#!/usr/bin/env node

const DEFAULT_BASE_URL = "https://csi-org.com/loopos";

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    email: process.env.M5B_SMOKE_EMAIL,
    password: process.env.M5B_SMOKE_PASSWORD,
    timeoutMs: 10000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base-url") {
      const value = argv[index + 1];
      if (!value) throw new Error("--base-url requires a value");
      options.baseUrl = value;
      index += 1;
    } else if (arg === "--timeout-ms") {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("--timeout-ms requires a positive integer");
      }
      options.timeoutMs = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.email || !options.password) {
    throw new Error("M5B_SMOKE_EMAIL and M5B_SMOKE_PASSWORD are required");
  }

  return options;
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url;
}

function joinUrl(baseUrl, suffix) {
  const url = new URL(baseUrl.toString());
  url.pathname = `${baseUrl.pathname}${suffix}`;
  return url;
}

function parseSetCookie(headers) {
  const raw = headers.getSetCookie?.() ?? [];
  const fallback = headers.get("set-cookie");
  return raw.length > 0 ? raw : fallback ? [fallback] : [];
}

function addCookies(jar, headers) {
  for (const cookie of parseSetCookie(headers)) {
    const pair = cookie.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    jar.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function request(url, options, jar, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "user-agent": "loopos-production-auth-http-smoke/1.0",
        ...(jar.size > 0 ? { cookie: cookieHeader(jar) } : {}),
        ...options.headers,
      },
    });
    addCookies(jar, response.headers);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const jar = new Map();

  const csrfResponse = await request(joinUrl(baseUrl, "/api/auth/csrf"), {}, jar, options.timeoutMs);
  const csrfBody = await csrfResponse.json();
  const csrfToken = csrfBody?.csrfToken;
  if (!csrfToken) throw new Error("CSRF token missing");

  const form = new URLSearchParams();
  form.set("csrfToken", csrfToken);
  form.set("email", options.email);
  form.set("password", options.password);
  form.set("redirect", "false");
  form.set("callbackUrl", joinUrl(baseUrl, "/app").toString());

  const loginResponse = await request(
    joinUrl(baseUrl, "/api/auth/callback/credentials"),
    {
      method: "POST",
      body: form,
      headers: { "content-type": "application/x-www-form-urlencoded" },
    },
    jar,
    options.timeoutMs,
  );

  const checks = [];
  for (const [name, suffix] of [
    ["app", "/app"],
    ["brain", "/app/brain"],
    ["session", "/api/auth/session"],
  ]) {
    const response = await request(joinUrl(baseUrl, suffix), {}, jar, options.timeoutMs);
    const text = await response.text();
    checks.push({
      name,
      url: joinUrl(baseUrl, suffix).toString(),
      status: response.status,
      contentType: response.headers.get("content-type"),
      bytes: Buffer.byteLength(text),
      redirectedToLogin: response.headers.get("location")?.includes("/login") ?? false,
      hasSessionUser: name === "session" ? text.includes(options.email) : undefined,
    });
  }

  const ok =
    csrfResponse.ok &&
    loginResponse.status < 400 &&
    checks.every((check) => check.status < 500 && check.status !== 404 && !check.redirectedToLogin) &&
    checks.find((check) => check.name === "session")?.hasSessionUser === true;

  console.log(JSON.stringify({
    ok,
    baseUrl: baseUrl.toString(),
    email: options.email,
    csrfStatus: csrfResponse.status,
    loginStatus: loginResponse.status,
    checks,
  }, null, 2));

  if (!ok) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
