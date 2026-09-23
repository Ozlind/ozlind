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
  return typeof value === "string""
    ? value.trim().slice(0, max)
    : "";
}

function getConfig(name) {
  const config = PROVIDERS[name];

  if (!config) {
    throw new Error("Unsupported AI provider.");
  }

  const key = process.env[config.key];
  const model = process.env[config.model];

  if (!key) {
    const error = new Error(`${name} is not configured.`);
    error.status = 503;
    error.retryable = false;
    throw error;
  }

  if (!model) {
    const error = new Error(`${name} model is not configured.`);
    error.status = 503;
    error.retryable = false;
    throw error;
  }

  return {
    ...config,
    key,
    model,
  };
}

async function fetchWithTimeout(url, options = {}, timeout = TIMEOUT_MS) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

function isRetryableStatus(status) {
  return (
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
}

function createProviderError(name, response, body = {}) {
  const error = new Error(
    body?.error?.message ||
      body?.message ||
      `${name} request failed (${response.status}).`
  );

  error.status = response.status;
  error.retryable = isRetryableStatus(response.status);
  error.provider = name;

  return error;
}

export function hasProvider(name) {
  const config = PROVIDERS[name];

  return Boolean(
    config &&
      process.env[config.key] &&
      process.env[config.model]
  );
}

export function providerOrder(mode = "auto", hasVision = false) {
  if (hasVision || mode === "vision") {
    return ["gemini", "groq", "experiential"];
  }

  if (mode === "fast") {
    return ["groq", "gemini", "experiential"];
  }

  if (mode === "pro") {
    return ["experiential", "gemini", "groq"];
  }

  if (mode === "research") {
    return ["gemini", "groq", "experiential"];
  }

  return ["groq", "gemini", "experiential"];
}

function toOpenAIMessages(messages, system) {
  return [
    {
      role: "system",
      content: system,
    },
    ...messages,
  ];
}

function geminiParts(content) {
  if (typeof content === "string") {
    return [
      {
        text: content,
      },
    ];
  }

  if (!Array.isArray(content)) {
    return [];
  }

  return content
    .map((part) => {
      if (part?.type === "text") {
        return {
          text: clean(part.text, 12000),
        };
      }

      if (
        part?.type === "image_url" &&
        typeof part.image_url?.url === "string"
      ) {
        const match = part.image_url.url.match(
          /^data:([^;]+);base64,(.+)$/
        );

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
    if (!["user", "assistant"].includes(message.role)) {
      continue;
    }

    const parts = geminiParts(message.content);

    if (!parts.length) continue;

    const role =
      message.role === "assistant"
        ? "model"
        : "user";

    const previous = contents.at(-1);

    if (previous?.role === role) {
      previous.parts.push(...parts);
    } else {
      contents.push({
        role,
        parts,
      });
    }
  }

  while (contents[0]?.role === "model") {
    contents.shift();
  }

  while (contents.at(-1)?.role === "model") {
    contents.pop();
  }

  if (!contents.length) {
    throw new Error("Invalid conversation.");
  }

  if (contents.at(-1).role !== "user") {
    throw new Error("The latest message must be from the user.");
  }

  return contents;
}

async function streamOpenAI(
  name,
  messages,
  system,
  onDelta
) {
  const config = getConfig(name);

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
        messages: toOpenAIMessages(
          messages,
          system
        ),
        stream: true,
      }),
    }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));

    throw createProviderError(
      name,
      response,
      body
    );
  }

  if (!response.body) {
    throw new Error(
      `${name} returned no response stream.`
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let fullText = "";

  while (true) {
    const { value, done } =
      await reader.read();

    if (done) break;

    buffer += decoder.decode(value, {
      stream: true,
    });

    const lines = buffer.split(/\r?\n/);

    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data:")) {
        continue;
      }

      const raw = line
        .slice(5)
        .trim();

      if (!raw || raw === "[DONE]") {
        continue;
      }

      let payload;

      try {
        payload = JSON.parse(raw);
      } catch {
        continue;
      }

      const delta =
        payload?.choices?.[0]?.delta
          ?.content || "";

      if (!delta) continue;

      fullText += delta;

      onDelta(delta);
    }
  }

  if (!fullText.trim()) {
    throw new Error(
      `${name} returned an empty response.`
    );
  }

  return {
    provider: name,
    model: config.model,
    text: fullText,
  };
}

async function streamGemini(
  messages,
  system,
  onDelta
) {
  const config = getConfig("gemini");

  const url =
    `${config.base}/models/` +
    `${encodeURIComponent(config.model)}` +
    `:streamGenerateContent` +
    `?alt=sse&key=` +
    `${encodeURIComponent(config.key)}`;

  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: system,
            },
          ],
        },

        contents:
          geminiContents(messages),

        generationConfig: {},
      }),
    }
  );

  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({}));

    throw createProviderError(
      "gemini",
      response,
      body
    );
  }

  if (!response.body) {
    throw new Error(
      "gemini returned no response stream."
    );
  }

  const reader =
    response.body.getReader();

  const decoder =
    new TextDecoder();

  let buffer = "";
  let fullText = "";

  while (true) {
    const { value, done } =
      await reader.read();

    if (done) break;

    buffer += decoder.decode(value, {
      stream: true,
    });

    const lines =
      buffer.split(/\r?\n/);

    buffer =
      lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data:")) {
        continue;
      }

      const raw =
        line.slice(5).trim();

      if (!raw) continue;

      let payload;

      try {
        payload = JSON.parse(raw);
      } catch {
        continue;
      }

      const parts =
        payload?.candidates?.[0]
          ?.content?.parts || [];

      const delta = parts
        .map((part) => part?.text || "")
        .join("");

      if (!delta) continue;

      fullText += delta;

      onDelta(delta);
    }
  }

  if (!fullText.trim()) {
    throw new Error(
      "gemini returned an empty response."
    );
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
    if (!hasProvider(name)) {
      continue;
    }

    try {
      if (name === "gemini") {
        return await streamGemini(
          messages,
          system,
          onDelta
        );
      }

      return await streamOpenAI(
        name,
        messages,
        system,
        onDelta
      );
    } catch (error) {
      lastError = error;

      /*
       * Important:
       * Do NOT fallback for authentication,
       * invalid request, missing configuration,
       * or other permanent 4xx errors.
       */

      if (
        error?.status &&
        error.status < 500 &&
        !isRetryableStatus(error.status)
      ) {
        throw error;
      }
    }
  }

  throw (
    lastError ||
    new Error(
      "No configured AI provider is available."
    )
  );
    }
