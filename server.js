const buckets = globalThis.__ozlindBuckets || new Map();
globalThis.__ozlindBuckets = buckets;

export function cleanText(value, max = 12000) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return Response.json(data, { ...init, headers });
}

export function rateLimit(request, { limit = 30, windowMs = 60000 } = {}) {
  const ip = (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const item = buckets.get(ip);
  if (!item || now - item.start >= windowMs) {
    buckets.set(ip, { start: now, count: 1 });
    return { ok: true, remaining: limit - 1 };
  }
  item.count += 1;
  if (item.count > limit) return { ok: false, remaining: 0, retryAfter: Math.max(1, Math.ceil((windowMs - (now - item.start)) / 1000)) };
  return { ok: true, remaining: limit - item.count };
}

export function originAllowed(request) {
  const allowed = process.env.OZLIND_ALLOWED_ORIGIN?.trim();
  if (!allowed) return true;
  const origin = request.headers.get('origin');
  return !origin || origin === allowed;
}

export function publicError(message = "OZLIND couldn't complete that request.") {
  return cleanText(message, 240) || "OZLIND couldn't complete that request.";
}

export function parseBody(request) {
  return request.json().catch(() => null);
}
