#!/usr/bin/env node

import { readFileSync } from "node:fs";

const checks = [];

function add(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function countMatches(value, pattern) {
  return value.match(pattern)?.length ?? 0;
}

const ecosystem = readFileSync("deploy/aliyun/ecosystem.config.cjs", "utf8");
const nginx = readFileSync("deploy/aliyun/nginx-loopos.conf", "utf8");
const httpNginx = readFileSync("deploy/aliyun/nginx-loopos-http.conf", "utf8");
const readme = readFileSync("deploy/aliyun/README.md", "utf8");
const checklist = readFileSync("docs/evidence/production-recovery-checklist.md", "utf8");

add(
  "pm2-process-scope",
  ecosystem.includes('name: "loopos-web"') && ecosystem.includes('name: "loopos-worker"'),
  "ecosystem declares only the LoopOS web and worker process names",
);
add(
  "pm2-release-cwd",
  ecosystem.includes('const appDir = "/var/www/loopos/current"'),
  "ecosystem uses the current LoopOS release path",
);
add(
  "https-loopos-locations",
  countMatches(nginx, /location\s+=\s+\/loopos\b/g) === 1
    && countMatches(nginx, /location\s+\^~\s+\/loopos\//g) === 1
    && countMatches(nginx, /proxy_pass http:\/\/127\.0\.0\.1:3040;/g) === 2,
  "HTTPS fragment contains exactly the two LoopOS locations and upstreams",
);
add(
  "http-loopos-redirects",
  countMatches(httpNginx, /location\s+=\s+\/loopos\b/g) === 1
    && countMatches(httpNginx, /location\s+\^~\s+\/loopos\//g) === 1
    && httpNginx.includes("https://csi-org.com$request_uri"),
  "HTTP fragment contains only LoopOS redirect exceptions",
);
add(
  "readme-rollback-boundary",
  readme.includes("Application rollback restores the previous application release only")
    && /does\s+not roll back database data/.test(readme)
    && /remove only the two LoopOS `location`\s+blocks/.test(readme),
  "README distinguishes application rollback, database boundary, and scoped Nginx withdrawal",
);
add(
  "recovery-checklist-boundary",
  checklist.includes("do not restart unrelated PM2 applications")
    && checklist.includes("Application rollback does not automatically roll back data")
    && checklist.includes("Do not run ad hoc SQL against production"),
  "checklist states PM2, database, and SQL boundaries",
);
add(
  "restoration-checks",
  checklist.includes("pm2 show loopos-web")
    && checklist.includes("pm2 show loopos-worker")
    && checklist.includes("node scripts/verify-production-http.mjs"),
  "checklist requires PM2 and public HTTP restoration checks",
);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`);
}

if (checks.some((check) => !check.ok)) process.exit(1);
