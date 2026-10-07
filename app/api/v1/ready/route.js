import { getOptionalBackendConfig } from "@/lib/backend/config";
import { errorResponse, json, requestId } from "@/lib/backend/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function probeDatabase() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !key) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);

  try {
    const response = await fetch(
      `${url.replace(/\/$/, "")}/rest/v1/`,
      {
        method: "GET",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        cache: "no-store",
        signal: controller.signal,
      },
    );

    return response.ok || response.status === 401;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const id = requestId();

  try {
    const config = getOptionalBackendConfig();
    const databaseReady = await probeDatabase();
    const ready = databaseReady && config.supabaseConfigured;

    const body = {
      status: ready ? "ready" : "not_ready",
      service: "ozlind-api",
      version: "v1",
      timestamp: new Date().toISOString(),
      dependencies: {
        database: databaseReady ? "ready" : "unavailable",
        supabase: config.supabaseConfigured ? "configured" : "not_configured",
        groq: config.groqConfigured ? "configured" : "not_configured",
        tavily: config.tavilyConfigured ? "configured" : "not_configured",
      },
    };

    return json(body, ready ? 200 : 503, {
      "Cache-Control": "no-store",
      "X-OZLIND-Request-ID": id,
    });
  } catch {
    return errorResponse({
      requestId: id,
      status: 503,
      code: "NOT_READY",
      message: "OZLIND backend is not ready.",
    });
  }
}
