import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    // Force Turbopack to use this app folder as the root.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
