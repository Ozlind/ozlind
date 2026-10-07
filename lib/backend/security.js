const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isTrustedOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const siteUrl = process.env.SITE_URL?.trim();
  if (!siteUrl) return false;

  try {
    return new URL(origin).origin === new URL(siteUrl).origin;
  } catch {
    return false;
  }
}

export function requireTrustedMutation(request) {
  if (SAFE_METHODS.has(request.method)) return true;
  return isTrustedOrigin(request);
}

export function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;

  return request.headers.get("x-real-ip")?.trim() || null;
}

export function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  if (left.length !== right.length) return false;

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}
