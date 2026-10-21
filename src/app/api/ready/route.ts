import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_HEALTH_TIMEOUT_MS = 2_500;

async function checkSupabaseReachability(): Promise<boolean> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) return false;

  try {
    const healthUrl = new URL("/auth/v1/health", supabaseUrl);
    const response = await fetch(healthUrl, {
      method: "GET",
      headers: { apikey: publishableKey },
      cache: "no-store",
      signal: AbortSignal.timeout(SUPABASE_HEALTH_TIMEOUT_MS),
    });

    return response.ok;
  } catch {
    // Readiness must not leak provider URLs, credentials, or raw fetch errors.
    return false;
  }
}

export async function GET() {
  const supabaseConfigured = Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY,
  );
  const [supabaseReachable, groqConfigured, googleConfigured] = await Promise.all([
    checkSupabaseReachability(),
    Promise.resolve(Boolean(
      process.env.GROQ_API_KEY &&
        (process.env.GROQ_FAST_MODEL || process.env.GROQ_PRO_MODEL),
    )),
    Promise.resolve(Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL)),
  ]);

  const checks = {
    supabase: supabaseConfigured && supabaseReachable,
    supabaseConfigured,
    supabaseReachable,
    groq: groqConfigured,
    google: googleConfigured,
  };
  const ready = checks.supabase && (checks.groq || checks.google);

  return NextResponse.json(
    {
      ready,
      service: "ozlind",
      checks,
      timestamp: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
