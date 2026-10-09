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
export async function checkUserRateLimit(): Promise<RateLimitResult> {
  let user;
  let admin;

  try {
    const supabase = await createClient();
    const auth = await supabase.auth.getUser();
    user = auth.data.user;

    if (auth.error) {
      return { allowed: false, remaining: 0, retryAfterSeconds: 0, unauthorized: true };
    }

    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !secretKey) throw new Error("Rate limiter server configuration is missing.");

    admin = createSupabaseClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
  } catch {
    return { allowed: false, remaining: 0, retryAfterSeconds: 5, unavailable: true };
  }

  if (!user) {
    return { allowed: false, remaining: 0, retryAfterSeconds: 0, unauthorized: true };
  }

  try {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const result = await Promise.race([
      admin.rpc("check_rate_limit", {
        p_user_id: user.id,
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
      userId: user.id,
      allowed: Boolean(row.allowed),
      remaining: Math.max(0, Number(row.remaining) || 0),
      retryAfterSeconds: Math.max(0, Number(row.retry_after) || 0),
    };
  } catch {
    return { allowed: false, remaining: 0, retryAfterSeconds: 5, unavailable: true };
  }
}
