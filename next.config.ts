import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ancienne adresse de « J'offre »
  async redirects() {
    return [{ source: "/mes-cadeaux", destination: "/j-offre", permanent: true }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
