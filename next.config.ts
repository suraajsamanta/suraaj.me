import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  env: {
    NEXT_PUBLIC_BEERIO_RELAY_URL:
      process.env.NEXT_PUBLIC_BEERIO_RELAY_URL ||
      (process.env.NODE_ENV === "production" ? "wss://beerio-relay.onrender.com/room" : ""),
  },
};

export default nextConfig;
