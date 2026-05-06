import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // resvg-js ships native (.node) bindings; Turbopack can't bundle them.
  // pg uses native pg-native bindings when available. Tell Next to leave
  // them as runtime requires.
  serverExternalPackages: ["@resvg/resvg-js", "pg"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
