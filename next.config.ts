import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Supabase host (read at build time) so the browser may talk to it for
 * auth. Falls back to *.supabase.co if the variable is not available.
 */
function supabaseOrigins(): string[] {
  const url = process.env.SUPABASE_URL;

  if (url) {
    try {
      const { host } = new URL(url);
      return [`https://${host}`, `wss://${host}`];
    } catch {
      // fall through to the wildcard below
    }
  }

  return ["https://*.supabase.co", "wss://*.supabase.co"];
}

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js injects small inline bootstrap scripts; 'unsafe-eval' is dev only.
  // challenges.cloudflare.com: Turnstile bot check (Stage 6).
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Avatars (Google) and user-attached images (data:/blob:).
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // *.ingest.*.sentry.io: error reports (Stage 1).
  `connect-src 'self' ${supabaseOrigins().join(" ")} https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io`,
  "frame-src https://challenges.cloudflare.com",
  // Read-aloud audio (Stage 4) and the installable app (Stage 7).
  "media-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          {
            // Microphone is allowed only for the same-origin dictation control.
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;