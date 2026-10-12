import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    supabase: Boolean(
      process.env.SUPABASE_URL &&
      process.env.SUPABASE_PUBLISHABLE_KEY,
    ),
    groq: Boolean(
      process.env.GROQ_API_KEY &&
        (process.env.GROQ_FAST_MODEL || process.env.GROQ_PRO_MODEL),
    ),
    google: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL),
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
      headers: { "Cache-Control": "no-store" },
    },
  );
}
