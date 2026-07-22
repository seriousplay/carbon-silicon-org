const fs = require("node:fs");
const path = require("node:path");

function loadEnvFile(fileName) {
  const filePath = path.join(__dirname, fileName);
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const equalsIndex = line.indexOf("=");
        if (equalsIndex === -1) return null;
        const key = line.slice(0, equalsIndex).trim();
        let value = line.slice(equalsIndex + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"'))
          || (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        return key ? [key, value] : null;
      })
      .filter(Boolean),
  );
}

const fileEnv = {
  ...loadEnvFile(".env.production"),
  ...loadEnvFile(".env.local"),
};

module.exports = {
  apps: [
    {
      name: "csi-loop-designer",
      script: ".next/standalone/apps/loop-designer/server.js",
      cwd: __dirname,
      exec_mode: "cluster",
      instances: "max",
      env: {
        ...fileEnv,
        NODE_ENV: "production",
        PORT: 3010,
        HOSTNAME: "127.0.0.1",
      },
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      max_memory_restart: "1G",
      log_file: "./logs/combined.log",
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      kill_timeout: 5000,
      listen_timeout: 10000,
      node_args: "--enable-source-maps",
    },
    {
      name: "csi-loop-designer-worker",
      script: "scripts/generation-worker.mjs",
      cwd: __dirname,
      instances: 1,
      env: {
        ...fileEnv,
        NODE_ENV: "production",
        LOOP_GENERATION_WORKER_URL: "http://127.0.0.1:3010/loop-designer/api/generation-jobs/run",
        LOOP_GENERATION_WORKER_INTERVAL_MS: 5000,
        LOOP_GENERATION_WORKER_LIMIT: 1,
      },
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      max_memory_restart: "768M",
      log_file: "./logs/worker-combined.log",
      out_file: "./logs/worker-out.log",
      error_file: "./logs/worker-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      kill_timeout: 30000,
      node_args: "--enable-source-maps",
    },
  ],
};
