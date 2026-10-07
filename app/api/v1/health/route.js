import { createClient } from "@/lib/supabase/server";
import { getOptionalBackendConfig } from "@/lib/backend/config";
import { errorResponse, json, requestId } from "@/lib/backend/http";
import { logger } from "@/lib/backend/logger";
import { healthQuerySchema } from "@/lib/backend/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    let database = "unknown";

    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from("user_settings")
        .select("user_id")
        .limit(1);

      database = error ? "degraded" : "ok";
    } catch (error) {
      database = "degraded";
      logger.warn("health.database_check_failed", {
        requestId: id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const healthy = database === "ok";
    const body = {
      status: healthy ? "ok" : "degraded",
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
