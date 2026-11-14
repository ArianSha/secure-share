import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: ["jazz-napi"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Quick Tunnel hostnames are assigned at runtime; their pages need dev assets.
  allowedDevOrigins: ["127.0.0.1", "*.trycloudflare.com"],
};

export default nextConfig;
