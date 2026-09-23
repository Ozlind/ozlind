const PROVIDERS = {
  groq: {
    base: "https://api.groq.com/openai/v1",
    key: "GROQ_API_KEY",
    model: "GROQ_MODEL",
  },
  experiential: {
    base: "https://api.experientiallabs.ai/v1",
    key: "EXPERIENTIAL_API_KEY",
    model: "EXPERIENTIAL_MODEL",
  },
  gemini: {
    base: "https://generativelanguage.googleapis.com/v1beta",
    key: "GEMINI_API_KEY",
    model: "GEMINI_TEXT_MODEL",
  },
};

const TIMEOUT_MS = 45000;

function clean(value, max = 12000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function fetchWithTimeout(url, options = {}, timeout = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function providerConfig(name) {
  const config = PROVIDERS[name];
  if (!config) throw new Error("Unsupported AI provider.");
  const key = process.env[config.key];
  if (!key) throw new Error(`${name} is not configured.`);
  const model = process.env[config.model];
  if (!model) throw new Error(`${name} model is not configured.`);
  return { ...config, key, model };
}

function shouldFallback(error) {
  const status = Number(error?.status || 0);
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function providerError(name, response, body) {
  const error = new Error(
    `${name} request failed (${response.status}).`
  );
  error.status = response.status;
  error.retryable = shouldFallback(error);
  error.details = body?.error?.message || body?.message || "";
  return error;
}

export function hasProvider(name) {
  const config = PROVIDERS[name];
  return Boolean(config && process.env[config.key] && process.env[config.model]);
}

export function providerOrder(mode, hasVision) {
  if (hasVision || mode === "vision") return ["gemini", "experiential", "groq"];
  if (mode === "fast") return ["groq", "experiential", "gemini"];
  if (mode === "pro") return ["experiential", "gemini", "groq"];
  return ["experiential", "groq", "gemini"];
}

function openAiMessages(messages, system) {
  return [{ role: "system", content: system }, ...messages];
}

function geminiParts(content) {
  if (typeof content === "string") return [{ text: content }];
  return content
    .map((part) => {
      if (part?.type === "text") return { text: clean(part.text, 12000) };
      if (part?.type === "image_url" && typeof part.image_url?.url === "string") {
        const match = part.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) return null;
        return {
          inline_data: {
            mime_type: match[1],
            data: match[2],
          },
        };
      }
      return null;
    })
    .filter(Boolean);
}

function geminiContents(messages) {
  const contents = [];
  for (const message of messages) {
    if (!["user", "assistant"].includes(message.role)) continue;
    const parts = geminiParts(message.content);
    if (!parts.length) continue;
    const role = message.role === "assistant" ? "model" : "user";
    const last = contents.at(-1);
    if (last?.role === role) last.parts.push(...parts);
    else contents.push({ role, parts });
  }
  while (contents[0]?.role === "model") contents.shift();
  while (contents.at(-1)?.role === "model") contents.pop();
  if (!contents.length || contents.at(-1).role !== "user") {
    throw new Error("Invalid Gemini conversation context.");
  }
  return contents;
}

async function streamOpenAI(name, messages, system, onDelta) {
  const config = providerConfig(name);
  const response = await fetchWithTimeout(
    `${config.base}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.key}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: openAiMessages(messages, system),
        temperature: 0.3,
        stream: true,
      }),
    }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw providerError(name, response, body);
  }
  if (!response.body) throw new Error(`${name} returned no stream.`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;

      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        continue;
      }

      const delta = payload.choices?.[0]?.delta?.content || "";
      if (delta) {
        fullText += delta;
        onDelta(delta);
      }
    }
  }

  return { provider: name, model: config.model, text: fullText };
}

async function streamGemini(messages, system, onDelta) {
  const config = providerConfig("gemini");
  const response = await fetchWithTimeout(
    `${config.base}/models/${encodeURIComponent(
      config.model
    )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(config.key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: geminiContents(messages),
        generationConfig: {},
      }),
    }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw providerError("gemini", response, body);
  }
  if (!response.body) throw new Error("gemini returned no stream.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;

      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        continue;
      }

      const delta =
        payload.candidates?.[0]?.content?.parts
          ?.map((part) => part.text || "")
          .join("") || "";

      if (delta) {
        fullText += delta;
        onDelta(delta);
      }
    }
  }

  return {
    provider: "gemini",
    model: config.model,
    text: fullText,
  };
}

export async function streamFromProviders({
  order,
  messages,
  system,
  onDelta,
}) {
  let lastError = null;

  for (const name of order) {
    if (!hasProvider(name)) continue;

    try {
      const result =
        name === "gemini"
          ? await streamGemini(messages, system, onDelta)
          : await streamOpenAI(name, messages, system, onDelta);

      if (!result.text.trim()) throw new Error(`${name} returned an empty response.`);
      return result;
    } catch (error) {
      lastError = error;

      // Never fall through on invalid credentials, malformed input, or other 4xx errors.
      if (!error.retryable && error.status && error.status < 500) {
        throw error;
      }
    }
  }

  throw lastError || new Error("No configured AI provider is available.");
}
