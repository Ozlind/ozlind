const PROVIDER_CONFIG = {
  groqFast: {
    provider: "groq",
    base: "https://api.groq.com/openai/v1",
    key: "GROQ_API_KEY",
    model: "GROQ_FAST_MODEL",
  },

  groqPro: {
    provider: "groq",
    base: "https://api.groq.com/openai/v1",
    key: "GROQ_API_KEY",
    model: "GROQ_PRO_MODEL",
  },

  gemini: {
    provider: "gemini",
    base: "https://generativelanguage.googleapis.com/v1beta",
    key: "GEMINI_API_KEY",
    model: "GEMINI_MODEL",
  },
};

const TIMEOUT_MS = 55_000;

function getConfiguredModel(name) {
  const config = PROVIDER_CONFIG[name];

  if (!config) {
    throw new Error("Unsupported AI provider configuration.");
  }

  const key = process.env[config.key];
  const model = process.env[config.model];

  if (!key) {
    const error = new Error(
      `${config.provider} is not configured.`
    );

    error.status = 503;
    error.retryable = false;
    error.provider = config.provider;

    throw error;
  }

  if (!model) {
    const error = new Error(
      `${config.provider} model is not configured.`
    );

    error.status = 503;
    error.retryable = false;
    error.provider = config.provider;

    throw error;
  }

  return {
    ...config,
    key,
    model,
  };
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

function createProviderError(
  provider,
  response,
  body = {}
) {
  const message =
    body?.error?.message ||
    body?.message ||
    `${provider} request failed (${response.status}).`;

  const error = new Error(message);

  error.status = response.status;
  error.retryable = isRetryableStatus(response.status);
  error.provider = provider;

  return error;
}

async function fetchWithTimeout(
  url,
  options = {},
  timeout = TIMEOUT_MS
) {
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
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error(
        "AI provider request timed out."
      );

      timeoutError.status = 408;
      timeoutError.retryable = true;

      throw timeoutError;
    }

    if (error instanceof Error) {
      error.retryable = true;
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function hasProvider(name) {
  try {
    getConfiguredModel(name);
    return true;
  } catch {
    return false;
  }
}

export function providerOrder(
  mode = "auto",
  hasVision = false
) {
  /*
   * Vision requests must stay on Gemini.
   * Groq text-only models must never receive image data.
   */
  if (hasVision || mode === "vision") {
    return ["gemini"];
  }

  /*
   * Fast:
   * GPT-OSS 20B first for maximum latency efficiency.
   * Gemini is fallback.
   */
  if (mode === "fast") {
    return ["groqFast", "gemini"];
  }

  /*
   * Pro:
   * Gemini 3.8 Flash with high thinking first.
   * GPT-OSS 120B is the fallback.
   */
  if (mode === "pro") {
    return ["gemini", "groqPro"];
  }

  /*
   * Research:
   * Gemini is preferred because research context can be
   * long and may contain multimodal source material.
   */
  if (mode === "research") {
    return ["gemini", "groqPro"];
  }

  /*
   * Auto:
   * Fast GPT-OSS 20B first, Gemini fallback.
   */
  return ["groqFast", "gemini"];
}

function openAIMessages(messages, system) {
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
          text:
            typeof part.text === "string"
              ? part.text.slice(0, 12000)
              : "",
        };
      }

      if (
        part?.type === "image_url" &&
        typeof part.image_url?.url === "string"
      ) {
        const match =
          part.image_url.url.match(
            /^data:([^;]+);base64,(.+)$/
          );

        if (!match) {
          return null;
        }

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
    if (
      !["user", "assistant"].includes(
        message.role
      )
    ) {
      continue;
    }

    const parts = geminiParts(
      message.content
    );

    if (!parts.length) {
      continue;
    }

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
    throw new Error(
      "Invalid Gemini conversation."
    );
  }

  const latest = contents.at(-1);

  if (latest?.role !== "user") {
    throw new Error(
      "The latest message must be from the user."
    );
  }

  const hasText = latest.parts.some(
    (part) =>
      typeof part?.text === "string" &&
      part.text.trim().length > 0
  );

  if (!hasText) {
    throw new Error(
      "The latest Gemini user message must contain text."
    );
  }

  return contents;
}

function reasoningEffortForGroq(mode) {
  if (mode === "pro" || mode === "research") {
    return "high";
  }

  if (mode === "fast") {
    return "low";
  }

  return "medium";
}

function thinkingLevelForGemini(mode, hasVision) {
  if (hasVision) {
    return "medium";
  }

  if (mode === "pro" || mode === "research") {
    return "high";
  }

  if (mode === "fast") {
    return "low";
  }

  return "medium";
}

async function streamOpenAI(
  configName,
  messages,
  system,
  mode,
  onDelta
) {
  const config =
    getConfiguredModel(configName);

  const response =
    await fetchWithTimeout(
      `${config.base}/chat/completions`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.key}`,
        },

        body: JSON.stringify({
          model: config.model,
          messages: openAIMessages(
            messages,
            system
          ),
          stream: true,
          reasoning_effort:
            reasoningEffortForGroq(mode),
        }),
      }
    );

  if (!response.ok) {
    const body =
      await response
        .json()
        .catch(() => ({}));

    throw createProviderError(
      config.provider,
      response,
      body
    );
  }

  if (!response.body) {
    throw new Error(
      "Groq returned no response stream."
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

    if (done) {
      break;
    }

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

      if (
        !raw ||
        raw === "[DONE]"
      ) {
        continue;
      }

      let payload;

      try {
        payload =
          JSON.parse(raw);
      } catch {
        continue;
      }

      const delta =
        payload?.choices?.[0]
          ?.delta?.content || "";

      if (!delta) {
        continue;
      }

      fullText += delta;
      onDelta(delta);
    }
  }

  if (!fullText.trim()) {
    throw new Error(
      "Groq returned an empty response."
    );
  }

  return {
    provider: config.provider,
    model: config.model,
    text: fullText,
  };
}

async function streamGemini(
  messages,
  system,
  mode,
  hasVision,
  onDelta
) {
  const config =
    getConfiguredModel("gemini");

  const url =
    `${config.base}/models/` +
    `${encodeURIComponent(config.model)}` +
    `:streamGenerateContent` +
    `?alt=sse`;

  const response =
    await fetchWithTimeout(
      url,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
          "x-goog-api-key":
            config.key,
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

          generationConfig: {
            thinkingConfig: {
              thinkingLevel:
                thinkingLevelForGemini(
                  mode,
                  hasVision
                ),
            },
          },
        }),
      }
    );

  if (!response.ok) {
    const body =
      await response
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
      "Gemini returned no response stream."
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

    if (done) {
      break;
    }

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

      if (!raw) {
        continue;
      }

      let payload;

      try {
        payload =
          JSON.parse(raw);
      } catch {
        continue;
      }

      const parts =
        payload?.candidates?.[0]
          ?.content?.parts || [];

      for (const part of parts) {
        const delta =
          typeof part?.text === "string"
            ? part.text
            : "";

        if (!delta) {
          continue;
        }

        fullText += delta;
        onDelta(delta);
      }
    }
  }

  if (!fullText.trim()) {
    throw new Error(
      "Gemini returned an empty response."
    );
  }

  return {
    provider: "gemini",
    model: config.model,
    text: fullText,
  };
}

function isPermanentError(error) {
  const status = error?.status;

  if (!status) {
    return false;
  }

  return (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    status === 404 ||
    status === 413 ||
    status === 422
  );
}

export async function streamFromProviders({
  order,
  messages,
  system,
  mode = "auto",
  hasVision = false,
  onDelta,
}) {
  let lastError = null;

  for (const name of order) {
    if (!hasProvider(name)) {
      continue;
    }

    /*
     * Never allow a text-only Groq model to receive images.
     */
    if (
      hasVision &&
      name !== "gemini"
    ) {
      continue;
    }

    try {
      /*
       * Important:
       * provider fallback is allowed only before any visible
       * token has been emitted. This prevents duplicate answers.
       */
      let emitted = false;

      const guardedDelta = (delta) => {
        emitted = true;
        onDelta(delta);
      };

      if (name === "gemini") {
        return await streamGemini(
          messages,
          system,
          mode,
          hasVision,
          guardedDelta
        );
      }

      return await streamOpenAI(
        name,
        messages,
        system,
        mode,
        guardedDelta
      );
    } catch (error) {
      lastError = error;

      /*
       * A provider may not be replaced after it has started
       * sending content. The caller receives the error instead.
       */
      if (error?.status && isPermanentError(error)) {
        throw error;
      }

      /*
       * Network/timeout/rate-limit/server errors can fall through
       * to the next provider, but only if no content was emitted.
       *
       * The current implementation does not expose an emitted
       * flag from the provider function, so provider errors after
       * visible content are surfaced rather than duplicated.
       */
      if (error?.retryable !== true) {
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