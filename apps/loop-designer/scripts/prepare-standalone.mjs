import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const appRoot = process.cwd();
const standaloneNext = path.join(
  appRoot,
  ".next",
  "standalone",
  "apps",
  "loop-designer",
  ".next",
);
const standaloneApp = path.dirname(standaloneNext);

await mkdir(standaloneNext, { recursive: true });
await cp(path.join(appRoot, ".next", "static"), path.join(standaloneNext, "static"), {
  recursive: true,
  force: true,
});
await cp(path.join(appRoot, "public"), path.join(standaloneApp, "public"), {
  recursive: true,
  force: true,
});
