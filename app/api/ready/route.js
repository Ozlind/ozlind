import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("feature_flags")
      .select("key")
      .limit(1);

    if (error) {
      throw error;
    }

    return NextResponse.json(
      {
        status: "ready",
        service: "ozlind",
        checks: { database: "ok" },
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    console.error("OZLIND readiness check failed:", error);

    return NextResponse.json(
      {
        status: "not_ready",
        service: "ozlind",
        checks: { database: "failed" },
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }
}
