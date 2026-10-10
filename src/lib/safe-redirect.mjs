export function getSafeRedirect(next, origin) {
  const fallback = new URL("/app", origin);

  if (
    typeof next !== "string" ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(next)
  ) {
    return fallback;
  }

  try {
    const destination = new URL(next, origin);
    return destination.origin === origin ? destination : fallback;
  } catch {
    return fallback;
  }
}
