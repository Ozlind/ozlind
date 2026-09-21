import supabase from './db-client.js';

const MAX_INPUT_LENGTH = 32000;
const MAX_OUTPUT_TOKENS = 4096;
const DAILY_REQUEST_LIMIT = 100;

function normalizeError(err, requestId) {
  const msg = err.message || String(err);
  if (msg.includes('401') || msg.includes('403')) {
    return { error: 'AI service authentication failed. Please check configuration.', requestId };
  }
  if (msg.includes('429')) {
    return { error: 'AI service is temporarily busy. Please try again shortly.', requestId };
  }
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
    return { error: 'Request timed out. Please try again.', requestId };
  }
  return { error: 'Something went wrong. Please try again.', requestId };
}

function getRequestId() {
  return 'req_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

async function verifyAuth(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

async function checkRateLimit(userId, ip) {
  const today = new Date().toISOString().split('T')[0];
  const { data: existing } = await supabase
    .from('usage_counters')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  const current = existing ? existing.requests_count : 0;
  if (current >= DAILY_REQUEST_LIMIT) {
    return { allowed: false, message: 'Daily request limit reached. Please try again tomorrow.' };
  }

  return { allowed: true };
}

async function incrementUsage(userId) {
  const today = new Date().toISOString().split('T')[0];
  const { data: existing } = await supabase
    .from('usage_counters')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (existing) {
    await supabase.from('usage_counters').update({ requests_count: existing.requests_count + 1 }).eq('id', existing.id);
  } else {
    await supabase.from('usage_counters').insert({ user_id: userId, date: today, requests_count: 1, tokens_count: 0 });
  }
}

function selectProvider(mode, hasImages, message) {
  const len = message?.length || 0;
  const mentionsResearch = /research|search|current|latest|news|today|now|recent|202[4-6]/.test(message?.toLowerCase() || '');

  if (mode === 'research' || mentionsResearch) return 'research';
  if (mode === 'vision' || hasImages) return 'vision';
  if (mode === 'fast') return 'fast';
  if (mode === 'pro' || len > 800) return 'pro';
  if (mode === 'auto') {
    if (hasImages) return 'vision';
    if (mentionsResearch) return 'research';
    if (len > 800) return 'pro';
    if (len < 150) return 'fast';
    return 'pro';
  }
  return 'pro';
}

async function streamGroq(messages, res, requestId, model) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.write(`data: ${JSON.stringify({ error: 'AI service not configured. Please add GROQ_API_KEY.' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'llama-3.1-8b-instant',
        messages,
        stream: true,
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const err = await response.text();
      const norm = normalizeError({ message: err }, requestId);
      res.write(`data: ${JSON.stringify(norm)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            res.write('data: [DONE]\n\n');
            res.end();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              res.write(`data: ${JSON.stringify({ chunk: delta, requestId })}\n\n`);
            }
          } catch (e) {
            // ignore malformed chunks
          }
        }
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    clearTimeout(timeout);
    const norm = normalizeError(err, requestId);
    res.write(`data: ${JSON.stringify(norm)}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

async function streamGemini(messages, res, requestId, model, hasImages) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.write(`data: ${JSON.stringify({ error: 'AI service not configured. Please add GEMINI_API_KEY.' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  const geminiModel = model || (hasImages ? process.env.GEMINI_IMAGE_MODEL || 'gemini-1.5-flash' : process.env.GEMINI_TEXT_MODEL || 'gemini-1.5-flash');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    // Convert messages to Gemini format
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.7 },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const err = await response.text();
      const norm = normalizeError({ message: err }, requestId);
      res.write(`data: ${JSON.stringify(norm)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (text) {
              res.write(`data: ${JSON.stringify({ chunk: text, requestId })}\n\n`);
            }
          } catch (e) {
            // ignore
          }
        }
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    clearTimeout(timeout);
    const norm = normalizeError(err, requestId);
    res.write(`data: ${JSON.stringify(norm)}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

async function streamResearch(messages, res, requestId) {
  const tavilyKey = process.env.TAVILY_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!tavilyKey || !geminiKey) {
    res.write(`data: ${JSON.stringify({ error: 'Research mode not configured. Please add TAVILY_API_KEY and GEMINI_API_KEY.' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  const userQuery = messages[messages.length - 1]?.content || '';

  try {
    // Step 1: Tavily search
    const searchRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': tavilyKey },
      body: JSON.stringify({ query: userQuery, search_depth: 'advanced', max_results: 6 }),
    });

    if (!searchRes.ok) throw new Error('Search failed');
    const searchData = await searchRes.json();
    const results = searchData.results || [];

    // Send source cards
    const sources = results.map((r, i) => ({
      index: i + 1,
      title: r.title,
      url: r.url,
      domain: new URL(r.url).hostname.replace('www.', ''),
      snippet: r.content?.slice(0, 300) || '',
    }));
    res.write(`data: ${JSON.stringify({ sources, requestId })}\n\n`);

    // Step 2: Synthesize with Gemini
    const context = results.map((r, i) => `[${i + 1}] ${r.title}\n${r.content?.slice(0, 2000) || ''}`).join('\n\n');
    const systemMsg = `You are a research assistant. Use the provided search results to answer the user's question. Cite sources using [1], [2], etc. format. Be concise and accurate.\n\nSearch results:\n${context}`;

    const geminiMessages = [
      { role: 'user', content: systemMsg },
      { role: 'user', content: userQuery },
    ];

    const geminiModel = process.env.GEMINI_TEXT_MODEL || 'gemini-1.5-flash';
    const contents = geminiMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.3 },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const err = await response.text();
      const norm = normalizeError({ message: err }, requestId);
      res.write(`data: ${JSON.stringify(norm)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (text) {
              res.write(`data: ${JSON.stringify({ chunk: text, requestId })}\n\n`);
            }
          } catch (e) {
            // ignore
          }
        }
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    const norm = normalizeError(err, requestId);
    res.write(`data: ${JSON.stringify(norm)}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'X-Request-ID');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const requestId = getRequestId();
  res.setHeader('X-Request-ID', requestId);

  try {
    const user = await verifyAuth(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { messages, mode, conversation_id, attachments, custom_instructions, style, length } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages required' });
    }

    const lastMsg = messages[messages.length - 1];
    if (lastMsg.content?.length > MAX_INPUT_LENGTH) {
      return res.status(400).json({ error: 'Input too long' });
    }

    const rateCheck = await checkRateLimit(user.id, req.headers['x-forwarded-for'] || req.socket.remoteAddress);
    if (!rateCheck.allowed) {
      return res.status(429).json({ error: rateCheck.message });
    }

    await incrementUsage(user.id);

    // Get memories
    const { data: memories } = await supabase
      .from('memories')
      .select('content')
      .eq('user_id', user.id)
      .eq('enabled', true);

    const memoryText = memories?.length ? `User preferences:\n${memories.map(m => `- ${m.content}`).join('\n')}` : '';
    const instructionText = custom_instructions ? `Custom instructions: ${custom_instructions}` : '';
    const styleText = style ? `Response style: ${style}` : '';
    const lengthText = length ? `Response length: ${length}` : '';

    const systemParts = [memoryText, instructionText, styleText, lengthText].filter(Boolean);
    const systemContent = systemParts.length ? systemParts.join('\n\n') : 'You are a helpful AI assistant.';

    const hasImages = attachments?.some(a => /image\/(png|jpeg|webp)/.test(a.type));
    const provider = selectProvider(mode, hasImages, lastMsg.content);

    const apiMessages = [
      { role: 'system', content: systemContent },
      ...messages.slice(-20).map(m => ({
        role: m.role,
        content: m.content,
      })),
    ];

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (provider === 'fast') {
      const groqModel = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
      await streamGroq(apiMessages, res, requestId, groqModel);
    } else if (provider === 'research') {
      await streamResearch(apiMessages, res, requestId);
    } else if (provider === 'vision' || provider === 'pro') {
      await streamGemini(apiMessages, res, requestId, null, hasImages);
    } else {
      await streamGemini(apiMessages, res, requestId, null, hasImages);
    }

    // Save user message if conversation_id provided
    if (conversation_id) {
      await supabase.from('messages').insert({
        conversation_id,
        role: 'user',
        content: lastMsg.content,
        attachments: attachments || [],
      });
    }
  } catch (err) {
    console.error('Chat API error:', err);
    const norm = normalizeError(err, requestId);
    res.status(500).json(norm);
  }
}
