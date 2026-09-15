const buckets = globalThis.__ozlindRateBuckets || new Map();
globalThis.__ozlindRateBuckets = buckets;

export function json(data, init = {}) {
  return Response.json(data, { ...init, headers: { 'Cache-Control': 'no-store', ...(init.headers || {}) } });
}

export function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  return (forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown').trim();
}

export function rateLimit(request, { limit = 30, windowMs = 60_000 } = {}) {
  const key = getClientIp(request);
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || now - existing.start > windowMs) {
    buckets.set(key, { start: now, count: 1 });
    return { ok: true, remaining: limit - 1 };
  }
  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((windowMs - (now - existing.start)) / 1000) };
  }
  return { ok: true, remaining: limit - existing.count };
}

export function originAllowed(request) {
  const configured = process.env.OZLIND_ALLOWED_ORIGIN?.trim();
  if (!configured) return true;
  const origin = request.headers.get('origin');
  return !origin || origin === configured;
}

export function securityHeaders(extra = {}) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    ...extra,
  };
}

export function cleanText(value, max = 12000) {
  return typeof value === 'string' ? value.replace(/\u0000/g, '').trim().slice(0, max) : '';
}

export function errorMessage(error) {
  if (error instanceof Error) return error.message.slice(0, 500);
  return 'Unknown provider error';
}
