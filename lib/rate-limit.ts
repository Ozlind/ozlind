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
 * Shared, database-backed rate limiter for authenticated chat requests.
 *
 * Security note:
 * We intentionally fail closed when the shared limiter cannot be reached.
 * An in-memory fallback is unsafe on a distributed Vercel deployment because
 * each instance would have its own counter and could be bypassed by routing
 * requests across instances.
 */
export async function checkUserRateLimit(): Promise<RateLimitResult> {
  let supabase;

  try {
    supabase = await createClient();
  } catch {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 5,
      unavailable: true,
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 0,
      unauthorized: true,
    };
  }

  try {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const result = await Promise.race([
      supabase.rpc("check_rate_limit", {
        p_limit: MAX_REQUESTS,
        p_window_seconds: WINDOW_SECONDS,
      }),

      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error("rate limit timeout")),
          DATABASE_TIMEOUT_MS,
        );
      }),
    ]).finally(() => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    });

    if (result.error) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: 5,
        unavailable: true,
      };
    }

    const row = Array.isArray(result.data)
      ? result.data[0]
      : null;

    if (!row) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: 5,
        unavailable: true,
      };
    }

    return {
      userId: user.id,
      allowed: Boolean(row.allowed),
      remaining: Math.max(
        0,
        Number(row.remaining) || 0,
      ),
      retryAfterSeconds: Math.max(
        0,
        Number(row.retry_after) || 0,
      ),
    };
  } catch {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 5,
      unavailable: true,
    };
  }
}