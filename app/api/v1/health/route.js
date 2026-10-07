import { getOptionalBackendConfig } from "@/lib/backend/config";
import { errorResponse, json, requestId } from "@/lib/backend/http";
import { logger } from "@/lib/backend/logger";
import { healthQuerySchema } from "@/lib/backend/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function checkSupabase() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !key) return "not_configured";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

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

    return response.ok || response.status === 401 ? "ok" : "degraded";
  } catch {
    return "degraded";
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request) {
  const id = requestId();
  const startedAt = Date.now();

  try {
    const params = Object.fromEntries(
      new URL(request.url).searchParams.entries(),
    );
    const parsed = healthQuerySchema.safeParse(params);

    if (!parsed.success) {
      return errorResponse({
        requestId: id,
        status: 400,
        code: "INVALID_QUERY",
        message: "Invalid health-check query.",
      });
    }

    const config = getOptionalBackendConfig();
    const database = await checkSupabase();
    const healthy = database === "ok";

    const body = {
      status: healthy ? "ok" : database === "not_configured" ? "degraded" : "degraded",
      service: "ozlind-api",
      version: "v1",
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      dependencies: {
        database,
        groq: config.groqConfigured ? "configured" : "not_configured",
        tavily: config.tavilyConfigured ? "configured" : "not_configured",
      },
      ...(parsed.data.detailed
        ? {
            environment: config.nodeEnv,
            uptimeSeconds: Math.floor(process.uptime()),
          }
        : {}),
    };

    return json(body, healthy ? 200 : 503, {
      "X-OZLIND-Request-ID": id,
    });
  } catch (error) {
    logger.error("health.unhandled_error", error, { requestId: id });

    return errorResponse({
      requestId: id,
      status: 503,
      code: "HEALTH_CHECK_FAILED",
      message: "OZLIND backend health check failed.",
    });
  }
}
