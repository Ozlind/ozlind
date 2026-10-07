const DEFAULTS = Object.freeze({
  appName: "OZLIND AI",
  apiVersion: "v1",
  maxJsonBytes: 1_000_000,
  requestTimeoutMs: 45_000,
});

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export function getBackendConfig() {
  const siteUrl = process.env.SITE_URL?.trim() || "http://localhost:3000";

  return Object.freeze({
    ...DEFAULTS,
    siteUrl,
    supabaseUrl: required("SUPABASE_URL"),
    supabasePublishableKey: required("SUPABASE_PUBLISHABLE_KEY"),
  });
}

export function getOptionalBackendConfig() {
  return Object.freeze({
    nodeEnv: process.env.NODE_ENV || "development",
    sentryDsn: process.env.SENTRY_DSN?.trim() || null,
    tavilyConfigured: Boolean(process.env.TAVILY_API_KEY?.trim()),
    groqConfigured: Boolean(process.env.GROQ_API_KEY?.trim()),
  });
}
