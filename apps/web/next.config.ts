import path from "node:path";
import type { NextConfig } from "next";
import { SECURITY_RESPONSE_HEADERS } from "./lib/securityHeaders";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@modules": path.resolve(__dirname, "../../modules"),
    };
    return config;
  },
  images: {
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: Object.entries(SECURITY_RESPONSE_HEADERS).map(([key, value]) => ({
          key,
          value,
        })),
      },
    ];
  },
};

export default nextConfig;
