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
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Avatars (Google) and user-attached images (data:/blob:).
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigins().join(" ")}`,
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
            // Microphone is allowed for same-origin (voice input, coming soon).
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;