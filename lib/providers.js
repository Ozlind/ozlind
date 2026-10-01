const PROVIDERS = {
  groqFast: {
    id: "groq",
    modelEnv: "GROQ_FAST_MODEL",
    keyEnv: "GROQ_API_KEY",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
  },

  groqPro: {
    id: "groq",
    modelEnv: "GROQ_PRO_MODEL",
    keyEnv: "GROQ_API_KEY",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
  },

  gemini: {
    id: "gemini",
    modelEnv: "GEMINI_MODEL",
    keyEnv: "GEMINI_API_KEY",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
  },
};

function getEnv(name) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    return null;
  }

  return value.trim();
}

function getProviderConfig(provider) {
  const config = PROVIDERS[provider];

  if (!config) {
    return null;
  }

  const apiKey = getEnv(config.keyEnv);
  const model = getEnv(config.modelEnv);

  if (!apiKey || !model) {
    return null;
  }

  return {
    ...config,
    apiKey,
    model,
  };
}

/**
 * Provider routing.
 *
 * AUTO:
 *   GPT-OSS 20B -> Gemini
 *
 * FAST:
 *   GPT-OSS 20B -> Gemini
 *
 * PRO:
 *   Gemini high thinking -> GPT-OSS 120B
 *
 * VISION:
 *   Gemini only
 *
 * RESEARCH:
 *   Gemini high thinking -> GPT-OSS 120B
 */
export function providerOrder(mode, vision = false) {
  if (vision || mode === "vision") {
    return ["gemini"];
  }

  switch (mode) {
    case "fast":
      return ["groqFast", "gemini"];

    case "pro":
      return ["gemini", "groqPro"];

    case "research":
      return ["gemini", "groqPro"];

    case "auto":
    default:
      return ["groqFast", "gemini"];
  }
}

function getGroqReasoningEffort(mode) {
  if (
    mode === "pro" ||
    mode === "research"
  ) {
    return "high";
  }

  if (mode === "fast") {
    return "low";
  }

  return "medium";
}

function getGeminiThinkingLevel(mode) {
  if (
    mode === "pro" ||
    mode === "research"
  ) {
    return "high";
  }

  if (mode === "fast") {
    return "low";
  }

  return "medium";
}

function normalizeMessages(messages) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function dataUrlToInlineData(url) {
  if (
    typeof url !== "string" ||
    !url.startsWith("data:")
  ) {
    return null;
  }

  const match = url.match(
    /^data:([^;,]+);base64,(.+)$/s,
  );

  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    data: match[2],
  };
}

function convertPartToGemini(part) {
  if (
    !part ||
    typeof part !== "object"
  ) {
    return null;
  }

  if (
    part.type === "text" &&
    typeof part.text === "string"
  ) {
    return {
      text: part.text,
    };
  }

  if (
    part.type === "image_url" &&
    part.image_url &&
    typeof part.image_url.url === "string"
  ) {
    const inlineData =
      dataUrlToInlineData(
        part.image_url.url,
      );

    if (!inlineData) {
      return null;
    }

    return {
      inline_data: inlineData,
    };
  }

  return null;
}

function convertMessageToGemini(message) {
  const parts = [];

  if (typeof message.content === "string") {
    if (message.content.trim()) {
      parts.push({
        text: message.content,
      });
    }
  } else if (Array.isArray(message.content)) {
    for (const part of message.content) {
      const converted =
        convertPartToGemini(part);

      if (converted) {
        parts.push(converted);
      }
    }
  }

  return {
    role:
      message.role === "assistant"
        ? "model"
        : "user",
    parts,
  };
}

function buildGeminiContents(messages) {
  const result = [];

  for (const message of messages) {
    const converted =
      convertMessageToGemini(message);

    if (
      converted.parts.length === 0
    ) {
      continue;
    }

    const previous =
      result[result.length - 1];

    if (
      previous &&
      previous.role === converted.role
    ) {
      previous.parts.push(
        ...converted.parts,
      );
    } else {
      result.push(converted);
    }
  }

  while (
    result.length > 0 &&
    result[0].role === "model"
  ) {
    result.shift();
  }

  while (
    result.length > 0 &&
    result[result.length - 1].role ===
      "model"
  ) {
    result.pop();
  }

  return result;
}

function buildOpenAIRequest({
  messages,
  systemPrompt,
  mode,
}) {
  return {
    model: undefined,
    stream: true,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      ...normalizeMessages(messages),
    ],
    reasoning_effort:
      getGroqReasoningEffort(mode),
  };
}

function extractSseData(buffer) {
  const events = [];
  let remaining = buffer;

  while (true) {
    const index =
      remaining.indexOf("\n\n");

    if (index === -1) {
      break;
    }

    const block =
      remaining.slice(0, index);

    remaining =
      remaining.slice(index + 2);

    const lines = block.split("\n");
    let data = "";

    for (const line of lines) {
      if (line.startsWith("data:")) {
        data += line.slice(5).trim();
      }
    }

    if (data) {
      events.push(data);
    }
  }

  return {
    events,
    remaining,
  };
}

async function streamOpenAI({
  config,
  messages,
  systemPrompt,
  mode,
  onDelta,
  signal,
  state,
}) {
  const payload = buildOpenAIRequest({
    messages,
    systemPrompt,
    mode,
  });

  payload.model = config.model;

  const response = await fetch(
    config.baseUrl,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${config.apiKey}`,
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify(payload),
      signal,
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const text =
      await response.text();

    const error = new Error(
      `Groq request failed (${response.status}): ${text.slice(
        0,
        500,
      )}`,
    );

    error.status = response.status;

    throw error;
  }

  if (!response.body) {
    throw new Error(
      "Groq returned an empty stream.",
    );
  }

  const reader =
    response.body.getReader();

  const decoder =
    new TextDecoder();

  let buffer = "";

  try {
    while (true) {
      const { done, value } =
        await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(
        value,
        { stream: true },
      );

      const parsed =
        extractSseData(buffer);

      buffer = parsed.remaining;

      for (const data of parsed.events) {
        if (data === "[DONE]") {
          continue;
        }

        try {
          const json =
            JSON.parse(data);

          const content =
            json?.choices?.[0]?.delta
              ?.content;

          if (
            typeof content === "string" &&
            content.length > 0
          ) {
            state.emitted = true;
            onDelta(content);
          }
        } catch {
          // Ignore malformed individual SSE chunks.
        }
      }
    }

    buffer += decoder.decode();

    const parsed =
      extractSseData(
        `${buffer}\n\n`,
      );

    for (const data of parsed.events) {
      if (data === "[DONE]") {
        continue;
      }

      try {
        const json =
          JSON.parse(data);

        const content =
          json?.choices?.[0]?.delta
            ?.content;

        if (
          typeof content === "string" &&
          content.length > 0
        ) {
          state.emitted = true;
          onDelta(content);
        }
      } catch {
        // Ignore malformed final chunk.
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function extractGeminiText(json) {
  const candidates =
    Array.isArray(json?.candidates)
      ? json.candidates
      : [];

  let text = "";

  for (const candidate of candidates) {
    const parts =
      Array.isArray(
        candidate?.content?.parts,
      )
        ? candidate.content.parts
        : [];

    for (const part of parts) {
      if (
        typeof part?.text === "string"
      ) {
        text += part.text;
      }
    }
  }

  return text;
}

async function streamGemini({
  config,
  messages,
  systemPrompt,
  mode,
  onDelta,
  signal,
  state,
}) {
  const contents =
    buildGeminiContents(messages);

  if (contents.length === 0) {
    throw new Error(
      "Gemini received no usable messages.",
    );
  }

  const url =
    `${config.baseUrl}/${encodeURIComponent(
      config.model,
    )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(
      config.apiKey,
    )}`;

  const payload = {
    systemInstruction: {
      parts: [
        {
          text: systemPrompt,
        },
      ],
    },

    contents,

    generationConfig: {
      thinkingConfig: {
        thinkingLevel:
          getGeminiThinkingLevel(mode),
      },
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type":
        "application/json",
    },
    body: JSON.stringify(payload),
    signal,
    cache: "no-store",
  });

  if (!response.ok) {
    const text =
      await response.text();

    const error = new Error(
      `Gemini request failed (${response.status}): ${text.slice(
        0,
        500,
      )}`,
    );

    error.status = response.status;

    throw error;
  }

  if (!response.body) {
    throw new Error(
      "Gemini returned an empty stream.",
    );
  }

  const reader =
    response.body.getReader();

  const decoder =
    new TextDecoder();

  let buffer = "";

  try {
    while (true) {
      const { done, value } =
        await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(
        value,
        { stream: true },
      );

      const parsed =
        extractSseData(buffer);

      buffer = parsed.remaining;

      for (const data of parsed.events) {
        try {
          const json =
            JSON.parse(data);

          const text =
            extractGeminiText(json);

          if (text) {
            state.emitted = true;
            onDelta(text);
          }
        } catch {
          // Ignore malformed SSE chunks.
        }
      }
    }

    buffer += decoder.decode();

    const parsed =
      extractSseData(
        `${buffer}\n\n`,
      );

    for (const data of parsed.events) {
      try {
        const json =
          JSON.parse(data);

        const text =
          extractGeminiText(json);

        if (text) {
          state.emitted = true;
          onDelta(text);
        }
      } catch {
        // Ignore malformed final chunk.
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function isPermanentError(error) {
  const status =
    Number(error?.status);

  if (!Number.isFinite(status)) {
    return false;
  }

  /*
   * These errors should not waste time trying
   * another provider.
   */
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
  messages,
  mode,
  vision,
  systemPrompt,
  providers,
  onProvider,
  onDelta,
  signal,
}) {
  let lastError = null;

  for (const providerName of providers) {
    /*
     * Never send an image request to a
     * non-vision provider.
     */
    if (
      vision &&
      providerName !== "gemini"
    ) {
      continue;
    }

    const config =
      getProviderConfig(
        providerName,
      );

    if (!config) {
      continue;
    }

    const state = {
      emitted: false,
    };

    try {
      onProvider?.(
        config.id,
        config.model,
      );

      if (providerName === "gemini") {
        await streamGemini({
          config,
          messages,
          systemPrompt,
          mode,
          onDelta,
          signal,
          state,
        });
      } else {
        await streamOpenAI({
          config,
          messages,
          systemPrompt,
          mode,
          onDelta,
          signal,
          state,
        });
      }

      return {
        provider: config.id,
        model: config.model,
      };
    } catch (error) {
      lastError = error;

      /*
       * CRITICAL:
       *
       * Once visible text has reached the client,
       * fallback is forbidden.
       *
       * Otherwise:
       * Provider A -> "Hello..." -> fails
       * Provider B -> "Hello..." -> duplicate
       */
      if (state.emitted) {
        throw error;
      }

      /*
       * User cancellation should never trigger
       * another provider.
       */
      if (
        signal?.aborted
      ) {
        throw error;
      }

      /*
       * Permanent request/config errors should
       * not blindly retry another provider.
       */
      if (isPermanentError(error)) {
        throw error;
      }

      /*
       * Otherwise continue to the next configured
       * provider.
       */
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error(
    "No configured AI provider is available.",
  );
}