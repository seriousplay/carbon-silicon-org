import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

type ChromiumResolverEnv = {
  CHROMIUM_EXECUTABLE_PATH?: string;
};

type ChromiumResolverInput = {
  env?: ChromiumResolverEnv;
  exists?: (path: string) => boolean;
  which?: (command: string) => string | null;
};

const LOCAL_CHROMIUM_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
];

const CHROMIUM_COMMANDS = [
  "chromium-browser",
  "chromium",
  "google-chrome-stable",
  "google-chrome",
  "chrome",
  "brave-browser",
  "microsoft-edge",
];

export function resolveChromiumExecutablePath(input: ChromiumResolverInput = {}) {
  const env = input.env ?? process.env;
  const configuredPath = env.CHROMIUM_EXECUTABLE_PATH;
  if (configuredPath?.trim()) return configuredPath.trim();

  const exists = input.exists ?? existsSync;
  const localPath = LOCAL_CHROMIUM_PATHS.find((path) => exists(path));
  if (localPath) return localPath;

  const which = input.which ?? whichCommand;
  for (const command of CHROMIUM_COMMANDS) {
    const executablePath = which(command);
    if (executablePath) return executablePath;
  }

  throw new Error("CHROMIUM_EXECUTABLE_PATH 尚未配置，且未找到本机 Chrome/Chromium。请安装 Chrome/Chromium，或设置 CHROMIUM_EXECUTABLE_PATH。");
}

function whichCommand(command: string) {
  try {
    const output = execFileSync("which", [command], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return output || null;
  } catch {
    return null;
  }
}
