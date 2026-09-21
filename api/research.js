import { searchWeb } from './_lib/tavily.js';
import { checkRateLimit, clientIp } from './_lib/ratelimit.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!checkRateLimit(`research:${clientIp(req)}`, 20, 60_000)) {
    return res.status(429).json({ error: 'Too many research requests. Please try again shortly.' });
  }

  const { query } = req.body || {};
  if (typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'A search query is required.' });
  }

  try {
    const result = await searchWeb(query.trim().slice(0, 500));
    if (!result.configured) {
      return res.status(200).json({ configured: false, sources: [], message: 'Research is not configured yet.' });
    }
    if (result.sources.length === 0) {
      return res.status(200).json({ configured: true, sources: [], message: 'No relevant sources were found for this query.' });
    }
    return res.status(200).json({ configured: true, sources: result.sources });
  } catch (err) {
    console.error('research error:', err?.message);
    const status = typeof err?.status === 'number' && err.status < 500 ? err.status : 502;
    return res.status(status).json({ error: 'Web research is temporarily unavailable. Please try again shortly.' });
  }
}
