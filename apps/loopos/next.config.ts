import type { NextConfig } from "next";
import { basePath, withBasePath } from "./src/lib/base-path";

const siteOrigin = (process.env.AUTH_URL ?? "http://localhost:3001").replace(/\/$/, "");

const nextConfig: NextConfig = {
  basePath,
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    NEXTAUTH_URL: `${siteOrigin}${withBasePath("/api/auth")}`,
  },
};

export default nextConfig;
