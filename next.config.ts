import type { NextConfig } from "next";

function getPostHogOrigin(): string | null {
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
  if (!host) return null;
  try {
    const url = new URL(host);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

const postHogOrigin = getPostHogOrigin();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  // Only public Supabase configuration is bundled for browser use.
  // Never add SUPABASE_SECRET_KEY or provider API keys to this object.
  env: {
    SUPABASE_URL: process.env.SUPABASE_URL ?? "",
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  },
  async rewrites() {
    // Keep the event request same-origin so the browser's connect-src 'self'
    // policy allows it and tracker blockers are less likely to drop it.
    // Only the capture endpoint is proxied; this is not an open proxy.
    return postHogOrigin
      ? [{ source: "/ingest/i/v0/e", destination: `${postHogOrigin}/i/v0/e/` }]
      : [];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Voice input uses the browser's Web Speech API. Keep microphone
          // access same-origin only; camera and geolocation remain disabled.
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.groq.com https://generativelanguage.googleapis.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
