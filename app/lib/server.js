const buckets =
  globalThis.__ozlindRateBuckets ||
  new Map();

globalThis.__ozlindRateBuckets = buckets;

/* -------------------------------------------------------
   JSON response
------------------------------------------------------- */

export function json(data, init = {}) {
  const headers = new Headers(
    init.headers || {}
  );

  headers.set("Cache-Control", "no-store");
  headers.set(
    "X-Content-Type-Options",
    "nosniff"
  );
  headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin"
  );

  return Response.json(data, {
    ...init,
    headers,
  });
}

/* -------------------------------------------------------
   Client IP
------------------------------------------------------- */

export function getClientIp(request) {
  /*
   * Vercel commonly provides x-forwarded-for.
   * Use the first address only.
   */
  const forwarded =
    request.headers.get("x-forwarded-for");

  if (forwarded) {
    const first = forwarded
      .split(",")[0]
      .trim();

    if (first) return first;
  }

  const realIp =
    request.headers.get("x-real-ip");

  if (realIp?.trim()) {
    return realIp.trim();
  }

  return "unknown";
}

/* -------------------------------------------------------
   Rate limiting
------------------------------------------------------- */

export function rateLimit(
  request,
  {
    limit = 30,
    windowMs = 60_000,
  } = {}
) {
  const key = getClientIp(request);
  const now = Date.now();

  const existing = buckets.get(key);

  if (
    !existing ||
    now - existing.start >= windowMs
  ) {
    buckets.set(key, {
      start: now,
      count: 1,
    });

    return {
      ok: true,
      remaining: Math.max(limit - 1, 0),
    };
  }

  existing.count += 1;

  if (existing.count > limit) {
    const retryAfter = Math.max(
      1,
      Math.ceil(
        (windowMs -
          (now - existing.start)) /
          1000
      )
    );

    return {
      ok: false,
      remaining: 0,
      retryAfter,
    };
  }

  return {
    ok: true,
    remaining: Math.max(
      limit - existing.count,
      0
    ),
  };
}

/* -------------------------------------------------------
   Periodic bucket cleanup
------------------------------------------------------- */

let lastCleanup = 0;

function cleanupBuckets() {
  const now = Date.now();

  /*
   * Avoid doing cleanup on every request.
   */
  if (now - lastCleanup < 300_000) {
    return;
  }

  lastCleanup = now;

  for (const [key, bucket] of buckets) {
    if (
      !bucket ||
      now - bucket.start > 300_000
    ) {
      buckets.delete(key);
    }
  }
}

/*
 * Wrap the original rate limiter so stale
 * entries don't grow indefinitely.
 */
const originalRateLimit = rateLimit;

export function secureRateLimit(
  request,
  options = {}
) {
  cleanupBuckets();

  return originalRateLimit(
    request,
    options
  );
}

/* -------------------------------------------------------
   Origin protection
------------------------------------------------------- */

export function originAllowed(request) {
  const configured =
    process.env.OZLIND_ALLOWED_ORIGIN?.trim();

  /*
   * If no explicit origin is configured,
   * same-origin protection is not enforced here.
   */
  if (!configured) {
    return true;
  }

  const origin =
    request.headers.get("origin");

  /*
   * Some legitimate server-to-server requests
   * don't contain an Origin header.
   */
  if (!origin) {
    return true;
  }

  return origin === configured;
}

/* -------------------------------------------------------
   Security headers
------------------------------------------------------- */

export function securityHeaders(
  extra = {}
) {
  return {
    "X-Content-Type-Options":
      "nosniff",

    "Referrer-Policy":
      "strict-origin-when-cross-origin",

    "X-Frame-Options":
      "SAMEORIGIN",

    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=()",

    ...extra,
  };
}

/* -------------------------------------------------------
   Text sanitization
------------------------------------------------------- */

export function cleanText(
  value,
  max = 12000
) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()
    .slice(0, max);
}

/* -------------------------------------------------------
   Safe JSON parsing
------------------------------------------------------- */

export async function readJson(
  request
) {
  try {
    const body = await request.json();

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return {
        ok: false,
        body: null,
      };
    }

    return {
      ok: true,
      body,
    };
  } catch {
    return {
      ok: false,
      body: null,
    };
  }
}

/* -------------------------------------------------------
   Error normalization
------------------------------------------------------- */

export function errorMessage(error) {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  if (
    typeof error === "string"
  ) {
    return error.slice(0, 500);
  }

  return "Unknown server error";
}

/* -------------------------------------------------------
   Provider-safe error
------------------------------------------------------- */

export function publicError(
  fallback =
    "Something went wrong. Please try again."
) {
  return fallback;
    }
