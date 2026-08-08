import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@agentarena/shared"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
