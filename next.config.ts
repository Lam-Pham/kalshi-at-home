import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // A stray package-lock.json in the home dir makes Next infer the wrong
  // workspace root; pin it to this project so file tracing stays correct.
  turbopack: { root: __dirname },
};

export default nextConfig;

// Makes getCloudflareContext() (D1, env, etc.) work in `next dev`.
initOpenNextCloudflareForDev();
