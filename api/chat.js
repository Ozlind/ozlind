import { pickEngine, buildSystemPrompt, isRetryable, safeErrorMessage } from './_lib/providers.js';
import { searchWeb } from './_lib/tavily.js';
import { checkRateLimit, clientIp } from './_lib/ratelimit.js';
import { validateChatBody } from './_lib/validate.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!checkRateLimit(`chat:${clientIp(req)}`, 30, 60_000)) {
    return res.status(429).json({ error: 'Too many requests. Please slow down and try again shortly.' });
  }

  const validation = validateChatBody(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }
  const { message, mode, history, attachments, settings, sources: providedSources } = validation.value;

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (obj) => {
    try { res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch { /* stream already closed */ }
  };

  let aborted = false;
  req.on('close', () => { aborted = true; });

  try {
    const hasImage = attachments.some((a) => a.kind === 'image');
    const engine = pickEngine({ mode, hasImage, message, researchPreferred: settings.researchEnabled });

    send({ mode: engine.label });

    let systemPrompt = buildSystemPrompt(settings);
    let sources = [];

    if (engine.kind === 'research') {
      if (providedSources) {
        sources = providedSources;
      } else {
        try {
          const result = await searchWeb(message);
          if (!result.configured) {
            send({ error: 'Research is not configured yet. Please add the required key in the environment.', code: 'not_configured' });
            return res.end();
          }
          sources = result.sources;
        } catch (err) {
          send({ error: 'Web research is temporarily unavailable. Please try again shortly.', code: 'unavailable' });
          return res.end();
        }
      }

      if (sources.length === 0) {
        systemPrompt += '\n\nNo relevant web sources were found for this query. Clearly tell the user no sources were found, then answer briefly from general knowledge with a caveat that it is not grounded in current sources.';
      } else {
        const sourceBlock = sources.map((s, i) => `[${i + 1}] ${s.title} (${s.domain})\n${s.excerpt}`).join('\n\n');
        systemPrompt += `\n\nGround your answer in ONLY the following web sources. Cite them inline like [1], [2] where relevant. Sources:\n\n${sourceBlock}`;
      }
    }

    if (engine.chain.length === 0) {
      send({ error: 'This mode is not configured yet. Please add the required API key to enable it.', code: 'not_configured' });
      return res.end();
    }

    let streamed = false;
    let lastErr = null;

    for (const provider of engine.chain) {
      if (aborted) break;
      try {
        const iterator = provider.stream({ message, history, systemPrompt, attachments });
        for await (const delta of iterator) {
          if (aborted) break;
          streamed = true;
          send({ delta });
        }
        if (streamed) { lastErr = null; break; }
      } catch (err) {
        lastErr = err;
        if (!isRetryable(err)) break;
      }
    }

    if (aborted) return res.end();

    if (!streamed) {
      const msg = lastErr ? safeErrorMessage(lastErr) : 'This mode is not configured yet. Please add the required API key to enable it.';
      send({ error: msg, code: lastErr?.status ? String(lastErr.status) : 'unavailable' });
      return res.end();
    }

    send({ done: true, mode: engine.label, sources });
    return res.end();
  } catch (err) {
    console.error('chat error:', err?.message);
    send({ error: 'Something went wrong. Please try again.', code: 'server_error' });
    try { return res.end(); } catch { return undefined; }
  }
}
