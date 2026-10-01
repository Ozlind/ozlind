interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

const entries = new Map<
  string,
  RateLimitEntry
>();

function cleanup(now: number): void {
  for (const [key, entry] of entries) {
    if (entry.resetAt <= now) {
      entries.delete(key);
    }
  }
}

export function checkRateLimit(
  key: string,
): RateLimitResult {
  const now = Date.now();

  if (entries.size > 1_000) {
    cleanup(now);
  }

  const existing = entries.get(key);

  if (!existing || existing.resetAt <= now) {
    entries.set(key, {
      count: 1,
      resetAt: now + WINDOW_MS,
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
        Math.ceil(
          (existing.resetAt - now) / 1000,
        ),
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