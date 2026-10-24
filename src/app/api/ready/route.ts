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
  const supabaseReachable = await checkSupabaseReachability();
  // Fast and Pro model IDs have safe defaults in the chat route, so their
  // environment overrides are optional. A configured Groq key is sufficient
  // to make the text-generation path available.
  const groqConfigured = Boolean(process.env.GROQ_API_KEY);
  const googleConfigured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL);
  // The vision route uses Gemini when configured and falls back to Groq's
  // Qwen 3.8 vision model when a Groq key is available.
  const researchConfigured = Boolean(process.env.TAVILY_API_KEY);
  const aiGatewayConfigured = Boolean(process.env.AI_GATEWAY_API_KEY);
  const gatewayFastModelConfigured = Boolean(process.env.AI_GATEWAY_FAST_MODEL?.trim());
  const gatewayProModelConfigured = Boolean(process.env.AI_GATEWAY_PRO_MODEL?.trim());
  const gatewayAutoModelConfigured = Boolean(process.env.AI_GATEWAY_AUTO_MODEL?.trim());
  const gatewayVisionModelConfigured = Boolean(process.env.AI_GATEWAY_VISION_MODEL?.trim());
  const visionConfigured = Boolean(
    (process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL) ||
      process.env.GROQ_API_KEY,
  );

  const checks = {
    supabase: supabaseConfigured && supabaseReachable,
    supabaseConfigured,
    supabaseReachable,
    groq: groqConfigured,
    google: googleConfigured,
    vision: visionConfigured,
    researchConfigured,
    aiGatewayConfigured,
    gatewayFastModelConfigured,
    gatewayProModelConfigured,
    gatewayAutoModelConfigured,
    gatewayVisionModelConfigured,
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
