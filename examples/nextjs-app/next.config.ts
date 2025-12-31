import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Avoid Next.js inferring an incorrect monorepo root (can break output tracing).
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
  // Transpile the local package
  transpilePackages: ["s3kit"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@base-ui/react': require.resolve('@base-ui/react'),
    };
    return config;
  },
};

export default nextConfig;
