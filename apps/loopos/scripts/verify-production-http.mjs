#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const DEFAULT_BASE_URL = "https://csi-org.com/loopos";
const execFile = promisify(execFileCallback);

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    timeoutMs: 10000,
    json: false,
    dryRun: false,
    transport: "fetch",
    noProxy: false,
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
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--transport") {
      const value = argv[index + 1];
      if (value !== "fetch" && value !== "curl") {
        throw new Error("--transport must be fetch or curl");
      }
      options.transport = value;
      index += 1;
    } else if (arg === "--no-proxy") {
      options.noProxy = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/verify-production-http.mjs [options]

Options:
  --base-url <url>     Base URL with path prefix. Default: ${DEFAULT_BASE_URL}
  --timeout-ms <ms>    Per-request timeout. Default: 10000
  --transport <name>   Request transport: fetch or curl. Default: fetch
  --no-proxy           With curl transport, bypass proxy environment variables
  --json               Print JSON output
  --dry-run            Print planned checks without network calls
`);
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  if (url.hash || url.search) {
    throw new Error("base URL must not contain query or hash");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url;
}

function checkUrl(baseUrl, suffix) {
  const url = new URL(baseUrl.toString());
  url.pathname = `${baseUrl.pathname}${suffix}`;
  return url;
}

function plannedChecks(baseUrl) {
  return [
    {
      name: "base-path",
      url: checkUrl(baseUrl, ""),
      redirect: "manual",
      expect: "status < 500 and not 404",
    },
    {
      name: "trailing-slash-normalization",
      url: checkUrl(baseUrl, "/"),
      redirect: "manual",
      expect: "redirect location ends with /loopos, or final status < 500 when a proxy follows redirects",
    },
    {
      name: "login-route",
      url: checkUrl(baseUrl, "/login"),
      redirect: "manual",
      expect: "status < 500 and not 404",
    },
    {
      name: "auth-session-endpoint",
      url: checkUrl(baseUrl, "/api/auth/session"),
      redirect: "manual",
      expect: "status < 500 and not 404",
    },
  ];
}

function sanitizeHeaders(headers) {
  return {
    location: headers.get("location") ?? null,
    contentType: headers.get("content-type") ?? null,
  };
}

function parseCurlHeaders(rawHeaders) {
  const blocks = rawHeaders
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  const headerLines = blocks.at(-1)?.split(/\r?\n/).slice(1) ?? [];
  const headers = new Map();
  for (const line of headerLines) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    headers.set(name, value);
  }
  return {
    location: headers.get("location") ?? null,
    contentType: headers.get("content-type") ?? null,
  };
}

async function runCurlCheck(check, timeoutMs, noProxy) {
  const dir = await mkdtemp(path.join(tmpdir(), "loopos-production-http-"));
  const headersFile = path.join(dir, "headers.txt");
  const bodyFile = path.join(dir, "body.bin");
  const args = [
    "--silent",
    "--show-error",
    "--max-time",
    String(Math.ceil(timeoutMs / 1000)),
    "--user-agent",
    "loopos-production-http-smoke/1.0",
    "--dump-header",
    headersFile,
    "--output",
    bodyFile,
    "--write-out",
    "%{http_code}",
    check.url.toString(),
  ];
  if (noProxy) args.unshift("--noproxy", "*");

  try {
    const { stdout } = await execFile("curl", args, { timeout: timeoutMs + 1000 });
    const status = Number(stdout.trim());
    const rawHeaders = await readFile(headersFile, "utf8").catch(() => "");
    const body = await stat(bodyFile).catch(() => ({ size: 0 }));
    const headers = parseCurlHeaders(rawHeaders);
    const statusOk = status < 500 && status !== 404;
    const redirectOk = check.name !== "trailing-slash-normalization"
      || status < 300
      || (status < 400 && Boolean(headers.location?.endsWith("/loopos")));

    return {
      name: check.name,
      url: check.url.toString(),
      status,
      ok: statusOk && redirectOk,
      headers,
      bodyBytes: body.size,
      transport: "curl",
      noProxy,
    };
  } catch (error) {
    return {
      name: check.name,
      url: check.url.toString(),
      status: null,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      transport: "curl",
      noProxy,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function runCheck(check, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(check.url, {
      method: "GET",
      redirect: check.redirect,
      signal: controller.signal,
      headers: {
        "user-agent": "loopos-production-http-smoke/1.0",
      },
    });
    const headers = sanitizeHeaders(response.headers);
    const text = await response.text().catch(() => "");
    const statusOk = response.status < 500 && response.status !== 404;
    const redirectOk = check.name !== "trailing-slash-normalization"
      || response.status < 300
      || (response.status < 400 && Boolean(headers.location?.endsWith("/loopos")));

    return {
      name: check.name,
      url: check.url.toString(),
      status: response.status,
      ok: statusOk && redirectOk,
      headers,
      bodyBytes: Buffer.byteLength(text),
      transport: "fetch",
    };
  } catch (error) {
    return {
      name: check.name,
      url: check.url.toString(),
      status: null,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      transport: "fetch",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function printHuman(results) {
  for (const result of results) {
    const status = result.ok ? "PASS" : "FAIL";
    const code = result.status === null ? "no-status" : result.status;
    console.log(`${status} ${result.name} ${code} ${result.url}`);
    if (result.headers?.location) console.log(`  location: ${result.headers.location}`);
    if (result.error) console.log(`  error: ${result.error}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const checks = plannedChecks(baseUrl);

  if (options.dryRun) {
    const planned = checks.map((check) => ({
      name: check.name,
      url: check.url.toString(),
      expect: check.expect,
    }));
    if (options.json) console.log(JSON.stringify({ dryRun: true, checks: planned }, null, 2));
    else {
      for (const check of planned) {
        console.log(`DRY ${check.name} ${check.url}`);
        console.log(`  expect: ${check.expect}`);
      }
    }
    return;
  }

  const results = [];
  for (const check of checks) {
    results.push(
      options.transport === "curl"
        ? await runCurlCheck(check, options.timeoutMs, options.noProxy)
        : await runCheck(check, options.timeoutMs),
    );
  }

  if (options.json) console.log(JSON.stringify({ baseUrl: baseUrl.toString(), results }, null, 2));
  else printHuman(results);

  if (results.some((result) => !result.ok)) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
