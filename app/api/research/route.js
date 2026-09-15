import { cleanText, json, originAllowed, rateLimit } from '../../lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    if (!originAllowed(request)) return json({ error: 'Origin rejected' }, { status: 403 });
    const limit = rateLimit(request, { limit: 20, windowMs: 60_000 });
    if (!limit.ok) return json({ error: 'Too many research requests. Please wait.' }, { status: 429 });
    if (!process.env.TAVILY_API_KEY) return json({ error: 'Tavily is not configured.' }, { status: 503 });
    const body = await request.json();
    const query = cleanText(body.query, 800);
    if (!query) return json({ error: 'Research query is required.' }, { status: 400 });
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
      body: JSON.stringify({ query, search_depth: body.depth === 'advanced' ? 'advanced' : 'basic', max_results: 8, include_answer: true }), cache: 'no-store'
    });
    if (!response.ok) throw new Error(`Tavily returned ${response.status}`);
    const data = await response.json();
    return json({ success: true, answer: data.answer || '', sources: (data.results || []).map(r => ({ title: r.title, url: r.url, content: r.content })) });
  } catch (error) {
    console.error('[ozlind/research]', error);
    return json({ error: 'Research could not be completed.' }, { status: 502 });
  }
}
