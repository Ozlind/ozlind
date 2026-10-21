import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  unauthorized?: boolean;
  unavailable?: boolean;
  userId?: string;
}

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 20;
const DATABASE_TIMEOUT_MS = 2_500;

/**
 * Shared per-user rate limiter. It uses verified Supabase Auth identity and a
 * server-only privileged client to call the narrowly granted RPC. Fail closed
 * if configuration or the shared database limiter is unavailable.
 */
export async function checkUserRateLimit(verifiedUserId?: string): Promise<RateLimitResult> {
  let userId: string | null = verifiedUserId ?? null;
  let admin;

  try {
    // Routes that have already verified the session can pass its trusted user ID
    // and avoid a second Supabase Auth network round-trip. Other callers retain
    // the self-authenticating default behavior.
    if (!userId) {
      const supabase = await createClient();
      const auth = await supabase.auth.getUser();

      if (auth.error) {
        return { allowed: false, remaining: 0, retryAfterSeconds: 0, unauthorized: true };
      }

      userId = auth.data.user?.id ?? null;
    }

    const url = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    if (!url || !secretKey) throw new Error("Rate limiter server configuration is missing.");

    admin = createSupabaseClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
  } catch {
    return { allowed: false, remaining: 0, retryAfterSeconds: 5, unavailable: true };
  }

  if (!userId) {
    return { allowed: false, remaining: 0, retryAfterSeconds: 0, unauthorized: true };
  }

  try {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const result = await Promise.race([
      admin.rpc("check_rate_limit", {
        p_user_id: userId,
        p_limit: MAX_REQUESTS,
        p_window_seconds: WINDOW_SECONDS,
      }),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error("Rate limit database timeout.")), DATABASE_TIMEOUT_MS);
      }),
    ]).finally(() => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    });

    if (result.error || !Array.isArray(result.data) || !result.data[0]) {
      return { allowed: false, remaining: 0, retryAfterSeconds: 5, unavailable: true };
    }

    const row = result.data[0];
    return {
      userId,
      allowed: Boolean(row.allowed),
      remaining: Math.max(0, Number(row.remaining) || 0),
      retryAfterSeconds: Math.max(0, Number(row.retry_after) || 0),
    };
  } catch {
    return { allowed: false, remaining: 0, retryAfterSeconds: 5, unavailable: true };
  }
}


/**
 * Converts a shared rate-limit result into a consistent, non-cacheable API
 * response. A limiter/database failure is fail-closed: paid work must not run.
 */
export function rateLimitErrorResponse(
  result: RateLimitResult,
  requestId: string,
): Response | null {
  const headers = { "Cache-Control": "no-store" };

  if (result.unavailable) {
    return Response.json(
      {
        error: {
          code: "RATE_LIMITER_UNAVAILABLE",
          requestId,
          message: "Request protection is temporarily unavailable.",
        },
      },
      { status: 503, headers },
    );
  }

  if (result.unauthorized) {
    return Response.json(
      { error: { code: "AUTH_REQUIRED", requestId } },
      { status: 401, headers },
    );
  }

  if (!result.allowed) {
    return Response.json(
      {
        error: {
          code: "RATE_LIMITED",
          requestId,
          message: "Too many requests. Please try again shortly.",
        },
      },
      {
        status: 429,
        headers: {
          ...headers,
          "Retry-After": String(Math.max(1, result.retryAfterSeconds)),
        },
      },
    );
  }

  return null;
}
