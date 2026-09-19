const PROVIDERS = {
  groq: {
    base: 'https://api.groq.com/openai/v1',
    key: 'GROQ_API_KEY',
    model: () => process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    capabilities: ['text', 'reasoning', 'coding', 'structured'],
  },

  gemini: {
    base: 'https://generativelanguage.googleapis.com/v1beta',
    key: 'GEMINI_API_KEY',
    model: () =>
      process.env.GEMINI_TEXT_MODEL ||
      process.env.GEMINI_MODEL ||
      'gemini-2.5-flash',
    vision: () =>
      process.env.GEMINI_VISION_MODEL ||
      process.env.GEMINI_TEXT_MODEL ||
      process.env.GEMINI_MODEL ||
      'gemini-2.5-flash',
    capabilities: ['text', 'reasoning', 'coding', 'vision', 'documents', 'structured'],
  },

  experiential: {
    base: 'https://api.experientiallabs.ai/v1',
    key: () =>
      process.env.EXPERIENTIAL_API_KEY ||
      process.env.EXPLABS_API_KEY ||
      '',
    model: () =>
      process.env.EXPERIENTIAL_MODEL ||
      process.env.EXPLABS_MODEL ||
      '',
    capabilities: ['text', 'reasoning', 'coding', 'structured'],
  },
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 32_000_000;
const MAX_MESSAGE_CHARS = 12_000;
const MAX_HISTORY_MESSAGES = 24;
const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_CHARS = 11_500_000;
const MAX_TOTAL_ATTACHMENT_CHARS = 28_000_000;
const REQUEST_TIMEOUT = 60_000;
const RESEARCH_TIMEOUT = 20_000;

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
]);

const buckets = globalThis.__ozlindBuckets || new Map();
globalThis.__ozlindBuckets = buckets;

function cleanText(value, max = MAX_MESSAGE_CHARS) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, max);
}

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return Response.json(data, {
    ...init,
    headers,
  });
}

function configured(name) {
  const provider = PROVIDERS[name];

  if (!provider) return false;

  const key =
    typeof provider.key === 'function'
      ? provider.key()
      : process.env[provider.key];

  return Boolean(key);
}

function supports(name, capability) {
  return Boolean(
    PROVIDERS[name]?.capabilities?.includes(capability),
  );
}

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

function rateLimit(request, limit, windowMs = 60_000) {
  const ip = (
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
    .split(',')[0]
    .trim();

  const now = Date.now();
  const current = buckets.get(ip);

  if (!current || now - current.start >= windowMs) {
    buckets.set(ip, {
      start: now,
      count: 1,
    });

    return {
      ok: true,
    };
  }

  current.count += 1;

  if (current.count > limit) {
    return {
      ok: false,
      retryAfter: Math.max(
        1,
        Math.ceil((windowMs - (now - current.start)) / 1000),
      ),
    };
  }

  return {
    ok: true,
  };
}

function originAllowed(request) {
  const allowed = process.env.OZLIND_ALLOWED_ORIGIN?.trim();

  if (!allowed) return true;

  const origin = request.headers.get('origin');

  return !origin || origin === allowed;
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((message) =>
      ['user', 'assistant'].includes(message?.role),
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => {
      if (typeof message.content === 'string') {
        return {
          role: message.role,
          content: cleanText(message.content),
        };
      }

      if (Array.isArray(message.content)) {
        return {
          role: message.role,
          content: message.content,
        };
      }

      return null;
    })
    .filter(Boolean)
    .filter((message) => {
      if (typeof message.content === 'string') {
        return Boolean(message.content);
      }

      return message.content.length > 0;
    });
}

function validateAttachments(attachments) {
  if (!Array.isArray(attachments)) return [];

  if (attachments.length > MAX_ATTACHMENTS) {
    throw Object.assign(
      new Error(`You can attach up to ${MAX_ATTACHMENTS} files.`),
      { status: 400 },
    );
  }

  const result = [];
  let total = 0;

  for (const file of attachments) {
    const mimeType = cleanText(file?.mimeType, 100);
    const data = String(file?.data || '');

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw Object.assign(
        new Error('This file type is not supported.'),
        { status: 400 },
      );
    }

    if (!data) {
      throw Object.assign(
        new Error('One of the attached files is empty.'),
        { status: 400 },
      );
    }

    if (data.length > MAX_ATTACHMENT_CHARS) {
      throw Object.assign(
        new Error('One of the attached files is too large.'),
        { status: 413 },
      );
    }

    total += data.length;

    if (total > MAX_TOTAL_ATTACHMENT_CHARS) {
      throw Object.assign(
        new Error('The combined attachment size is too large.'),
        { status: 413 },
      );
    }

    result.push({
      name: cleanText(file?.name, 180),
      mimeType,
      data,
    });
  }

  return result;
}

function detectCapability(mode, attachments, text) {
  if (
    attachments.some((file) =>
      /^image\//i.test(file.mimeType || ''),
    )
  ) {
    return 'vision';
  }

  if (attachments.length) {
    return 'documents';
  }

  if (
    mode === 'pro' ||
    /\b(
      analy[sz]e|
      architecture|
      debug|
      algorithm|
      prove|
      calculate|
      complex|
      deeply\s+reason|
      compare|
      optimize|
      design
    )\b/ix.test(text)
  ) {
    return 'reasoning';
  }

  return 'text';
}

function candidateOrder(mode, capability) {
  const orders = {
    text: {
      auto: ['groq', 'experiential', 'gemini'],
      fast: ['groq', 'experiential', 'gemini'],
      pro: ['experiential', 'gemini', 'groq'],
      vision: ['gemini', 'experiential', 'groq'],
      research: ['experiential', 'groq', 'gemini'],
    },

    reasoning: {
      auto: ['experiential', 'gemini', 'groq'],
      fast: ['groq', 'experiential', 'gemini'],
      pro: ['experiential', 'gemini', 'groq'],
      vision: ['gemini'],
      research: ['experiential', 'gemini', 'groq'],
    },

    vision: {
      auto: ['gemini'],
      vision: ['gemini'],
      pro: ['gemini'],
    },

    documents: {
      auto: ['gemini'],
      vision: ['gemini'],
      pro: ['gemini'],
    },
  };

  const selected =
    orders[capability]?.[mode] ||
    orders[capability]?.auto ||
    orders.text.auto;

  return [...new Set(selected)].filter(
    (name) =>
      configured(name) &&
      supports(name, capability),
  );
}

function systemPrompt(custom, research) {
  return [
    'You are OZLIND AI, a professional general-purpose AI assistant.',
    'Answer the user directly and naturally.',
    'Do not mention internal providers, model IDs, API keys, routing, infrastructure, or fallback mechanics.',
    'Do not invent facts, citations, links, quotations, or actions.',
    'For simple questions, be concise.',
    'For complex questions, provide clear structured reasoning.',
    research
      ? 'Current web research is supplied as evidence. Distinguish sourced facts from general knowledge.'
      : '',
    custom
      ? `User preferences:\n${custom}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function latestUser(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role !== 'user') continue;

    if (typeof messages[i].content === 'string') {
      return messages[i].content;
    }

    if (Array.isArray(messages[i].content)) {
      return messages[i].content
        .filter((part) => part?.type === 'text')
        .map((part) => part.text || '')
        .join(' ');
    }
  }

  return '';
}

function sseEvent(encoder, payload) {
  return encoder.encode(
    `data: ${JSON.stringify(payload)}\n\n`,
  );
}

function sseResponse(stream) {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

function fallbackAllowed(error) {
  const status = Number(error?.status);

  return [
    408,
    409,
    425,
    429,
    500,
    502,
    503,
    504,
  ].includes(status);
}

function extractOpenAIText(data) {
  return (
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    ''
  );
}

function buildOpenAIMessages(messages, system, attachments = []) {
  const output = [
    {
      role: 'system',
      content: system,
    },
  ];

  for (const message of messages) {
    if (typeof message.content === 'string') {
      output.push({
        role: message.role,
        content: message.content,
      });

      continue;
    }

    const parts = [];

    for (const part of message.content || []) {
      if (part?.type === 'text') {
        parts.push({
          type: 'text',
          text: String(part.text || ''),
        });
      }

      if (
        part?.type === 'image_url' &&
        part?.image_url?.url
      ) {
        parts.push({
          type: 'image_url',
          image_url: {
            url: part.image_url.url,
          },
        });
      }
    }

    if (parts.length) {
      output.push({
        role: message.role,
        content: parts,
      });
    }
  }

  /*
   * The current OZLIND frontend sends attachment data separately.
   * Images can therefore be attached to the last user message here.
   */
  if (attachments.length) {
    const lastUserIndex = output
      .map((item, index) => ({ item, index }))
      .reverse()
      .find(({ item }) => item.role === 'user')?.index;

    if (lastUserIndex !== undefined) {
      const target = output[lastUserIndex];

      if (typeof target.content === 'string') {
        target.content = [
          {
            type: 'text',
            text: target.content,
          },
        ];
      }

      if (Array.isArray(target.content)) {
        for (const file of attachments) {
          if (!file.mimeType.startsWith('image/')) continue;

          target.content.push({
            type: 'image_url',
            image_url: {
              url: `data:${file.mimeType};base64,${file.data}`,
            },
          });
        }
      }
    }
  }

  return output;
}

async function getExperientialModel(capability = 'text') {
  const provider = PROVIDERS.experiential;

  const configuredModel = provider.model();

  if (configuredModel) {
    return configuredModel;
  }

  const key = provider.key();

  if (!key) {
    throw Object.assign(
      new Error('Service configuration is unavailable.'),
      {
        status: 503,
        permanent: true,
      },
    );
  }

  const timeout = timeoutSignal(10_000);

  try {
    const response = await fetch(
      `${provider.base}/models`,
      {
        method: 'GET',
        headers: {
          authorization: `Bearer ${key}`,
          accept: 'application/json',
        },
        cache: 'no-store',
        signal: timeout.signal,
      },
    );

    if (!response.ok) {
      throw Object.assign(
        new Error('Model catalog unavailable.'),
        {
          status: response.status,
        },
      );
    }

    const data = await response.json();

    const models = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.models)
        ? data.models
        : [];

    if (!models.length) {
      throw Object.assign(
        new Error('No compatible model is available.'),
        {
          status: 503,
        },
      );
    }

    const usable = models
      .map((model) => ({
        id: model?.id || model?.slug || model?.name || '',
        raw: model,
      }))
      .filter((model) => model.id);

    if (!usable.length) {
      throw Object.assign(
        new Error('No compatible model is available.'),
        {
          status: 503,
        },
      );
    }

    /*
     * Prefer models that advertise the requested capability.
     * Otherwise use the first model exposed by the account.
     */
    const capabilityWords = {
      reasoning: ['reason', 'think', 'o', 'opus', 'sonnet', 'pro'],
      coding: ['code', 'coder'],
      text: [],
    };

    const preferredWords =
      capabilityWords[capability] || [];

    const preferred = usable.find((model) => {
      const text = JSON.stringify(model.raw).toLowerCase();

      return preferredWords.some((word) =>
        text.includes(word),
      );
    });

    return preferred?.id || usable[0].id;
  } finally {
    timeout.clear();
  }
}

async function openAIStream(
  name,
  messages,
  system,
  attachments,
  request,
) {
  const provider = PROVIDERS[name];

  const key =
    typeof provider.key === 'function'
      ? provider.key()
      : process.env[provider.key];

  if (!key) {
    throw Object.assign(
      new Error('Service configuration is unavailable.'),
      {
        status: 503,
        permanent: true,
      },
    );
  }

  let model;

  if (name === 'experiential') {
    model = await getExperientialModel('reasoning');
  } else {
    model =
      typeof provider.model === 'function'
        ? provider.model()
        : provider.model;
  }

  if (!model) {
    throw Object.assign(
      new Error('No compatible model is configured.'),
      {
        status: 503,
        permanent: true,
      },
    );
  }

  const timeout = timeoutSignal(REQUEST_TIMEOUT);

  try {
    const response = await fetch(
      `${provider.base}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: buildOpenAIMessages(
            messages,
            system,
            attachments,
          ),
          stream: true,
          temperature: 0.35,
          max_tokens: 2400,
        }),
        cache: 'no-store',
        signal: request.signal || timeout.signal,
      },
    );

    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({}));

      const error = new Error(
        errorBody?.error?.message ||
          errorBody?.message ||
          `Service returned ${response.status}.`,
      );

      error.status = response.status;

      /*
       * Authentication, invalid model and invalid request
       * errors must NOT trigger provider fallback.
       */
      if (
        response.status === 400 ||
        response.status === 401 ||
        response.status === 403 ||
        response.status === 404
      ) {
        error.permanent = true;
      }

      throw error;
    }

    if (!response.body) {
      throw Object.assign(
        new Error('Empty service response.'),
        {
          status: 502,
        },
      );
    }

    return {
      body: response.body,
      model,
    };
  } finally {
    timeout.clear();
  }
}

function geminiParts(content) {
  if (typeof content === 'string') {
    return [
      {
        text: content,
      },
    ];
  }

  return (content || [])
    .map((part) => {
      if (part?.type === 'text') {
        return {
          text: part.text || '',
        };
      }

      if (
        part?.type === 'image_url' &&
        part?.image_url?.url
      ) {
        const match = part.image_url.url.match(
          /^data:([^;]+);base64,(.+)$/s,
        );

        if (!match) return null;

        return {
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        };
      }

      return null;
    })
    .filter(Boolean);
}

async function geminiText(
  messages,
  attachments,
  capability,
  system,
  request,
) {
  const provider = PROVIDERS.gemini;
  const key = process.env[provider.key];

  if (!key) {
    throw Object.assign(
      new Error('Service configuration is unavailable.'),
      {
        status: 503,
        permanent: true,
      },
    );
  }

  const model =
    capability === 'vision' ||
    capability === 'documents'
      ? provider.vision()
      : provider.model();

  if (!model) {
    throw Object.assign(
      new Error('No compatible model is configured.'),
      {
        status: 503,
        permanent: true,
      },
    );
  }

  const contents = [];

  for (const message of messages) {
    const parts = geminiParts(message.content);

    if (!parts.length) continue;

    const role =
      message.role === 'assistant'
        ? 'model'
        : 'user';

    if (contents.at(-1)?.role === role) {
      contents.at(-1).parts.push(...parts);
    } else {
      contents.push({
        role,
        parts,
      });
    }
  }

  while (contents[0]?.role === 'model') {
    contents.shift();
  }

  while (contents.at(-1)?.role === 'model') {
    contents.pop();
  }

  const lastUser = contents.at(-1);

  if (!lastUser || lastUser.role !== 'user') {
    throw Object.assign(
      new Error('Invalid conversation context.'),
      {
        status: 400,
        permanent: true,
      },
    );
  }

  /*
   * Attach current files to the last user turn.
   */
  for (const file of attachments) {
    lastUser.parts.push({
      inlineData: {
        mimeType: file.mimeType,
        data: file.data,
      },
    });
  }

  const timeout = timeoutSignal(REQUEST_TIMEOUT);

  try {
    const response = await fetch(
      `${provider.base}/models/${encodeURIComponent(
        model,
      )}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: system,
              },
            ],
          },
          contents,
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 2400,
          },
        }),
        cache: 'no-store',
        signal: request.signal || timeout.signal,
      },
    );

    if (!response.ok) {
      const data = await response
        .json()
        .catch(() => ({}));

      const error = new Error(
        data?.error?.message ||
          `Service returned ${response.status}.`,
      );

      error.status = response.status;

      if (
        response.status === 400 ||
        response.status === 401 ||
        response.status === 403 ||
        response.status === 404
      ) {
        error.permanent = true;
      }

      throw error;
    }

    const data = await response.json();

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || '')
        .join('') || '';

    if (!text.trim()) {
      throw Object.assign(
        new Error('The service returned an empty response.'),
        {
          status: 502,
        },
      );
    }

    return {
      text,
      model,
    };
  } finally {
    timeout.clear();
  }
}

async function runResearch(query, request) {
  const key = process.env.TAVILY_API_KEY;

  if (!key) {
    throw Object.assign(
      new Error('Research is temporarily unavailable.'),
      {
        status: 503,
        permanent: true,
      },
    );
  }

  const timeout = timeoutSignal(RESEARCH_TIMEOUT);

  try {
    const response = await fetch(
      'https://api.tavily.com/search',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          query: query.slice(0, 800),
          search_depth: 'basic',
          max_results: 5,
          include_answer: true,
        }),
        cache: 'no-store',
        signal: request.signal || timeout.signal,
      },
    );

    if (!response.ok) {
      throw Object.assign(
        new Error('Research service is temporarily unavailable.'),
        {
          status: response.status,
        },
      );
    }

    const data = await response.json();

    const sources = (
      Array.isArray(data?.results)
        ? data.results
        : []
    )
      .slice(0, 5)
      .map((item) => {
        const url = cleanText(item?.url, 1000);

        return {
          title: cleanText(item?.title, 240),
          url,
          domain: url
            .replace(/^https?:\/\//, '')
            .split('/')[0]
            .replace(/^www\./, ''),
          content: cleanText(item?.content, 1800),
        };
      })
      .filter((source) => /^https?:\/\//i.test(source.url));

    return {
      answer: cleanText(data?.answer, 3000),
      sources,
    };
  } finally {
    timeout.clear();
  }
}

async function handleChat(request, body) {
  const mode = [
    'auto',
    'fast',
    'pro',
    'vision',
    'research',
  ].includes(body?.mode)
    ? body.mode
    : 'auto';

  const messages = normalizeMessages(body?.messages);
  const attachments = validateAttachments(
    body?.attachments,
  );

  const custom = cleanText(
    body?.customInstructions,
    3000,
  );

  if (!messages.length) {
    return json(
      {
        error: 'Please enter a message.',
      },
      {
        status: 400,
      },
    );
  }

  const lastUser = [...messages]
    .reverse()
    .find((message) => message.role === 'user');

  if (!lastUser) {
    return json(
      {
        error: 'Please enter a message.',
      },
      {
        status: 400,
      },
    );
  }

  let researchData = null;

  if (mode === 'research') {
    researchData = await runResearch(
      lastUser.content,
      request,
    );
  }

  const capability = detectCapability(
    mode,
    attachments,
    lastUser.content,
  );

  if (
    (capability === 'vision' ||
      capability === 'documents') &&
    !configured('gemini')
  ) {
    return json(
      {
        error:
          'File understanding is temporarily unavailable.',
      },
      {
        status: 503,
      },
    );
  }

  const researchContext = researchData
    ? `Current web research:\n${JSON.stringify(
        researchData,
      ).slice(0, 10_000)}`
    : '';

  const system = systemPrompt(
    custom,
    Boolean(researchData),
  );

  const finalMessages = [
    ...messages,
  ];

  if (researchContext) {
    finalMessages.unshift({
      role: 'user',
      content: researchContext,
    });
  }

  const candidates = candidateOrder(
    mode,
    capability,
  );

  if (!candidates.length) {
    return json(
      {
        error:
          'No available AI capability is configured for this request.',
      },
      {
        status: 503,
      },
    );
  }

  const encoder = new TextEncoder();
  let lastError = null;

  for (const providerName of candidates) {
    try {
      /*
       * Gemini has native multimodal handling.
       */
      if (providerName === 'gemini') {
        const result = await geminiText(
          finalMessages,
          attachments,
          capability,
          system,
          request,
        );

        return sseResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                sseEvent(encoder, {
                  type: 'text',
                  text: result.text,
                }),
              );

              if (researchData?.sources?.length) {
                controller.enqueue(
                  sseEvent(encoder, {
                    type: 'sources',
                    sources: researchData.sources,
                  }),
                );
              }

              controller.enqueue(
                sseEvent(encoder, {
                  type: 'done',
                }),
              );

              controller.close();
            },
          }),
        );
      }

      /*
       * Groq + Experiential Labs use the
       * OpenAI-compatible streaming interface.
       */
      const result = await openAIStream(
        providerName,
        finalMessages,
        system,
        attachments,
        request,
      );

      const reader = result.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const stream = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { value, done } =
                await reader.read();

              if (done) break;

              buffer += decoder.decode(
                value,
                {
                  stream: true,
                },
              );

              const lines =
                buffer.split('\n');

              buffer =
                lines.pop() || '';

              for (const line of lines) {
                if (!line.startsWith('data:')) {
                  continue;
                }

                const raw = line
                  .slice(5)
                  .trim();

                if (
                  !raw ||
                  raw === '[DONE]'
                ) {
                  continue;
                }

                try {
                  const data =
                    JSON.parse(raw);

                  const text =
                    data?.choices?.[0]
                      ?.delta?.content ||
                    '';

                  if (text) {
                    controller.enqueue(
                      sseEvent(
                        encoder,
                        {
                          type: 'text',
                          text,
                        },
                      ),
                    );
                  }
                } catch {
                  /*
                   * Ignore malformed provider
                   * chunks without killing the
                   * whole response.
                   */
                }
              }
            }

            if (researchData?.sources?.length) {
              controller.enqueue(
                sseEvent(encoder, {
                  type: 'sources',
                  sources: researchData.sources,
                }),
              );
            }

            controller.enqueue(
              sseEvent(encoder, {
                type: 'done',
              }),
            );

            controller.close();
          } catch (error) {
            controller.error(error);
          } finally {
            reader.releaseLock();
          }
        },

        cancel() {
          reader.cancel().catch(() => {});
        },
      });

      return sseResponse(stream);
    } catch (error) {
      lastError = error;

      /*
       * Never silently switch providers for:
       * 400 / 401 / 403 / 404.
       *
       * Fallback is reserved for temporary
       * capacity/network/server failures.
       */
      if (!fallbackAllowed(error)) {
        break;
      }
    }
  }

  const status =
    Number(lastError?.status) === 429
      ? 429
      : 503;

  return json(
    {
      error:
        status === 429
          ? 'OZLIND is temporarily busy. Please try again in a moment.'
          : 'OZLIND could not complete that request right now.',
    },
    {
      status,
    },
  );
}

async function handleResearch(request, body) {
  const query = cleanText(
    body?.query,
    800,
  );

  if (!query) {
    return json(
      {
        error:
          'Please enter a research question.',
      },
      {
        status: 400,
      },
    );
  }

  return json({
    researchUsed: true,
    ...(await runResearch(
      query,
      request,
    )),
  });
}

export async function GET() {
  return json({
    ok: true,
    service: 'ozlind',
    capabilities: [
      'chat',
      'research',
      'vision',
      'documents',
    ],
  });
}

export async function POST(request) {
  if (!originAllowed(request)) {
    return json(
      {
        error: 'Request rejected.',
      },
      {
        status: 403,
      },
    );
  }

  const contentLength = Number(
    request.headers.get('content-length') || 0,
  );

  if (contentLength > MAX_BODY_BYTES) {
    return json(
      {
        error: 'Request payload is too large.',
      },
      {
        status: 413,
      },
    );
  }

  const action =
    new URL(request.url).searchParams.get(
      'action',
    ) || 'chat';

  if (!['chat', 'research'].includes(action)) {
    return json(
      {
        error: 'Unsupported request.',
      },
      {
        status: 400,
      },
    );
  }

  const rl = rateLimit(
    request,
    action === 'research' ? 12 : 24,
  );

  if (!rl.ok) {
    return json(
      {
        error:
          'OZLIND is temporarily busy. Please try again in a moment.',
        retryAfter: rl.retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(
            rl.retryAfter,
          ),
        },
      },
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return json(
      {
        error: 'Invalid request body.',
      },
      {
        status: 400,
      },
    );
  }

  try {
    if (action === 'research') {
      return await handleResearch(
        request,
        body,
      );
    }

    return await handleChat(
      request,
      body,
    );
  } catch (error) {
    if (error?.name === 'AbortError') {
      return json(
        {
          error:
            'The request took too long. Please try again.',
        },
        {
          status: 504,
        },
      );
    }

    const status =
      Number(error?.status) >= 400 &&
      Number(error?.status) < 600
        ? Number(error.status)
        : 503;

    return json(
      {
        error:
          cleanText(
            error?.message,
            240,
          ) ||
          'OZLIND could not complete that request.',
      },
      {
        status:
          status === 500
            ? 503
            : status,
      },
    );
  }
  }
