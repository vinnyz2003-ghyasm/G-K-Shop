import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    runtimeCaching: [
      {
        // Supabase REST reads: show last-known data instantly, refresh in background.
        // Writes (POST/PATCH/DELETE) go through our Dexie outbox in src/lib/offline,
        // not through this cache — that's what actually makes POS entry reliable
        // mid-outage, not the service worker by itself.
        urlPattern: ({ url }) => url.hostname.endsWith(".supabase.co"),
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "supabase-api-cache",
          expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }, // 1 day
        },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { optimizePackageImports: ["lucide-react", "recharts"] },
};

export default withPWA(nextConfig);
