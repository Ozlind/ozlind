// Server-side Tavily web research helper. Real sources only - never fabricated.

function safeDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

export async function searchWeb(query) {
  const apiKey = process.env.TAVILY_API_KEY || '';
  if (!apiKey) return { configured: false, sources: [] };

  const resp = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query, max_results: 5, search_depth: 'basic' }),
  });
  if (!resp.ok) {
    const e = new Error(`research_error:${resp.status}`);
    e.status = resp.status;
    throw e;
  }
  const data = await resp.json();
  const sources = (data.results || []).slice(0, 5).map((r) => ({
    title: r.title || r.url,
    url: r.url,
    domain: safeDomain(r.url),
    excerpt: (r.content || '').slice(0, 320),
  }));
  return { configured: true, sources };
}
