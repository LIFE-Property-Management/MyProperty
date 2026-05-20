import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Standalone output: Next.js traces the import graph and emits a
  // self-contained .next/standalone/ directory containing only the
  // node_modules actually used at runtime. This shrinks the production
  // Docker image by ~90% vs copying the full node_modules tree.
  //
  // Known gap (M4.2 follow-up): MockProvider is imported unconditionally
  // by tenant and dashboard layouts. The tracer will pull msw into the
  // standalone output, where it's dead code at runtime (gated by
  // process.env.NODE_ENV !== "production"). ~10 MB wasted. Cleanup
  // batched with the audit F3 follow-up post-M4.
  output: "standalone",
};

export default withBundleAnalyzer(nextConfig);
