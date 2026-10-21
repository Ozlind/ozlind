/**
 * Normalize untrusted search-provider output into a small set of usable sources.
 * Only HTTP(S) URLs with non-empty source content are accepted as evidence.
 *
 * @typedef {{ title: string, url: string, content: string }} TavilySource
 * @param {unknown} value
 * @returns {{ answer: string | null, results: TavilySource[] }}
 */
export function normalizeTavilyResponse(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { answer: null, results: [] };
  }

  const payload = /** @type {{ answer?: unknown, results?: unknown }} */ (value);
  const answer = typeof payload.answer === "string"
    ? payload.answer.trim().slice(0, 4000) || null
    : null;
  const rawResults = Array.isArray(payload.results) ? payload.results : [];
  const seenUrls = new Set();
  const results = [];

  for (const candidate of rawResults) {
    if (results.length >= 5) break;
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;

    const item = /** @type {{ title?: unknown, url?: unknown, content?: unknown }} */ (candidate);
    const rawUrl = typeof item.url === "string" ? item.url.trim() : "";
    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      continue;
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") continue;

    const url = parsedUrl.href;
    if (seenUrls.has(url)) continue;

    const content = typeof item.content === "string" ? item.content.trim().slice(0, 1800) : "";
    if (!content) continue;

    const title = typeof item.title === "string" ? item.title.trim().slice(0, 300) : "";
    results.push({ title: title || parsedUrl.hostname, url, content });
    seenUrls.add(url);
  }

  return { answer, results };
}
