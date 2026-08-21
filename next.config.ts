import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingIncludes: {
    "/[locale]": ["./data/grocery-copilot.db"],
    "/api/catalog": ["./data/grocery-copilot.db"],
    "/api/catalog/[id]": ["./data/grocery-copilot.db"],
    "/api/chat": ["./data/grocery-copilot.db"],
    "/api/checkout": ["./data/grocery-copilot.db"],
  },
  outputFileTracingExcludes: {
    "/*": ["./data/*.db-shm", "./data/*.db-wal", "./data/grocery.db", "./data/grocery.db-*"],
  },
};

export default nextConfig;
