/* eslint-disable @typescript-eslint/no-require-imports */
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { parseEnv } = require("node:util");

const appDir = "/var/www/loopos/current";
const envFile = "/var/www/loopos/shared/.env";

const runtimeEnv = {
  ...parseEnv(readFileSync(envFile, "utf8")),
  NODE_ENV: "production",
};
delete runtimeEnv.NODE_OPTIONS;

module.exports = {
  apps: [
    {
      name: "loopos-web",
      cwd: appDir,
      script: path.join(appDir, ".next/standalone/server.js"),
      args: "",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      env: { ...runtimeEnv, PORT: "3040", HOSTNAME: "127.0.0.1" },
    },
    {
      name: "loopos-worker",
      cwd: appDir,
      script: path.join(appDir, "node_modules/tsx/dist/cli.mjs"),
      args: "worker/index.ts",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      env: runtimeEnv,
    },
  ],
};
