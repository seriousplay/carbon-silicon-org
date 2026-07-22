import type { NextConfig } from "next";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../..");

const nextConfig: NextConfig = {
  basePath: "/book",
  outputFileTracingRoot: repoRoot,

  // Enable compression for responses (gzip/brotli)
  compress: true,

  // Remove X-Powered-By header for security
  poweredByHeader: false,

  turbopack: {
    root: repoRoot,
  },
};

export default nextConfig;
