import { createClient } from "@/lib/supabase/server";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  /** True when there is no signed-in user for this request. */
  unauthorized?: boolean;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 20;
const DATABASE_TIMEOUT_MS = 2_500;

/* ---------- fallback: per-instance memory ---------- */

const entries = new Map<string, RateLimitEntry>();

function cleanup(now: number): void {
  for (const [key, entry] of entries) {
    if (entry.resetAt <= now) {
      entries.delete(key);
    }
  }
}

function checkMemoryLimit(key: string): RateLimitResult {
  const now = Date.now();

  if (entries.size > 1_000) {
    cleanup(now);
  }

  const existing = entries.get(key);

  if (!existing || existing.resetAt <= now) {
    entries.set(key, {
      count: 1,
      resetAt: now + WINDOW_SECONDS * 1000,
    });

    return {
      allowed: true,
      remaining: MAX_REQUESTS - 1,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existing.resetAt - now) / 1000),
      ),
    };
  }

  existing.count += 1;

  return {
    allowed: true,
    remaining: MAX_REQUESTS - existing.count,
    retryAfterSeconds: 0,
  };
}

/* ---------- main entry ---------- */

/**
 * Limits chat requests per signed-in user.
 *
 * The count lives in Supabase (check_rate_limit function), so it is shared
 * by every server instance. If the database is unreachable or the function
 * is not installed yet, it falls back to an in-memory counter so chat keeps
 * working.
 */
export async function checkUserRateLimit(): Promise<RateLimitResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 0,
      unauthorized: true,
    };
  }

  try {
    const result = await Promise.race([
      supabase.rpc("check_rate_limit", {
        p_limit: MAX_REQUESTS,
        p_window_seconds: WINDOW_SECONDS,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("rate limit timeout")),
          DATABASE_TIMEOUT_MS,
        ),
      ),
    ]);

    const row = Array.isArray(result.data) ? result.data[0] : null;

    if (!result.error && row) {
      return {
        allowed: Boolean(row.allowed),
        remaining: Number(row.remaining) || 0,
        retryAfterSeconds: Number(row.retry_after) || 0,
      };
    }
  } catch {
    // fall through to the in-memory limiter
  }

  return checkMemoryLimit(user.id);
}