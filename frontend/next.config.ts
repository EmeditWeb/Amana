import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
  experimental: {
    optimizePackageImports: ["@stellar/stellar-sdk", "lucide-react"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  },
  turbopack: {},
};

export default async function config() {
  if (process.env.ANALYZE !== "true") {
    return nextConfig;
  }

  const bundleAnalyzerPackage = "@next/bundle-analyzer";
  const withBundleAnalyzer = (await import(bundleAnalyzerPackage)).default({
    enabled: true,
  });
  return withBundleAnalyzer(nextConfig);
}
