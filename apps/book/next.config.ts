import type { NextConfig } from "next";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../..");

const nextConfig: NextConfig = {
  basePath: "/book",
  outputFileTracingRoot: repoRoot,

  compress: true,
  poweredByHeader: false,

  // TODO: Fix Prisma JsonValue → app type mismatches (null vs undefined)
  typescript: {
    ignoreBuildErrors: true,
  },

  turbopack: {
    root: repoRoot,
  },
};

export default nextConfig;
