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
    baseUrl:
      "https://generativelanguage.googleapis.com/v1beta/models",
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

/* -------------------------------------------------------------------------- */
/* Request classification                                                     */
/* -------------------------------------------------------------------------- */

function messageHasImage(messages) {
  return messages.some(
    (message) =>
      Array.isArray(message?.content) &&
      message.content.some(
        (part) =>
          part?.type === "image_url" &&
          typeof part?.image_url?.url === "string",
      ),
  );
}

function getTextFromMessages(messages) {
  return messages
    .map((message) => {
      if (typeof message?.content === "string") {
        return message.content;
      }

      if (Array.isArray(message?.content)) {
        return message.content
          .filter((part) => part?.type === "text")
          .map((part) => part.text || "")
          .join(" ");
      }

      return "";
    })
    .join("\n")
    .trim();
}

function isCurrentInformationQuery(text) {
  const query = String(text || "").trim();

  if (!query) {
    return false;
  }

  return (
    (/\b(latest|breaking|current|today|tonight|right now|recent)\b/i.test(
      query,
    ) &&
      /\b(news|price|score|status|rate|weather|schedule|result|update|version|release)\b/i.test(
        query,
      )) ||
    /\b(search|look up|lookup|find online|search online|on the web|web search)\b/i.test(
      query,
    ) ||
    /\b(according to sources|according to the internet)\b/i.test(
      query,
    ) ||
    /\b(stock price|share price|exchange rate|live score|weather forecast)\b/i.test(
      query,
    )
  );
}

function isComplexQuery(text) {
  const query = String(text || "").trim();

  if (!query) {
    return false;
  }

  if (
    /\b(analyze|analyse|architecture|architect|debug|debugging|optimize|optimise|refactor|compare|evaluate|derive|prove|reason|investigate|design|implement|build|engineer|research|strategy|algorithm)\b/i.test(
      query,
    )
  ) {
    return true;
  }

  if (
    /\b(next\.?js|react|typescript|javascript|python|api|backend|frontend|database|sql|supabase|vercel|docker|kubernetes|authentication|oauth|security)\b/i.test(
      query,
    ) &&
    (
      query.length > 180 ||
      /\b(fix|debug|architecture|production|error|issue|implement|rewrite|review)\b/i.test(
        query,
      )
    )
  ) {
    return true;
  }

  const sentenceCount =
    query.split(/[.!?]+/).filter(Boolean).length;

  if (query.length > 700 || sentenceCount >= 5) {
    return true;
  }

  return false;
}

export function classifyRequest(
  messages = [],
  {
    vision = false,
    research = false,
  } = {},
) {
  const text = getTextFromMessages(messages);

  if (vision || messageHasImage(messages)) {
    return "vision";
  }

  if (research || isCurrentInformationQuery(text)) {
    return "research";
  }

  if (isComplexQuery(text)) {
    return "complex";
  }

  return "simple";
}

/* -------------------------------------------------------------------------- */
/* Provider routing                                                           */
/* -------------------------------------------------------------------------- */

export function providerOrder(
  mode,
  vision = false,
  context = {},
) {
  const messages = Array.isArray(context?.messages)
    ? context.messages
    : [];

  const research =
    context?.research === true ||
    mode === "research";

  const classification = classifyRequest(
    messages,
    {
      vision,
      research,
    },
  );

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
      if (classification === "vision") {
        return ["gemini"];
      }

      if (classification === "research") {
        return ["gemini", "groqPro"];
      }

      if (classification === "complex") {
        return ["gemini", "groqPro"];
      }

      return ["groqFast", "gemini"];
  }
}

/* -------------------------------------------------------------------------- */
/* Reasoning configuration                                                    */
/* -------------------------------------------------------------------------- */

function getGroqReasoningEffort(mode) {
  if (mode === "pro") {
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

/* -------------------------------------------------------------------------- */
/* Message conversion                                                         */
/* -------------------------------------------------------------------------- */

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
    mime_type: match[1],
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

    if (converted.parts.length === 0) {
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
    result[result.length - 1].role === "model"
  ) {
    result.pop();
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* SSE parsing                                                                */
/* -------------------------------------------------------------------------- */

/*
 * Gemini SSE can use either LF or CRLF line endings.
 *
 * The previous implementation only searched for "\n\n".
 * That can leave the entire response buffered and produce
 * zero deltas even though Gemini actually returned data.
 */
function extractSseData(buffer) {
  const events = [];
  let remaining = buffer;

  while (true) {
    const lfIndex =
      remaining.indexOf("\n\n");

    const crlfIndex =
      remaining.indexOf("\r\n\r\n");

    let index = -1;
    let separatorLength = 0;

    if (
      crlfIndex !== -1 &&
      (lfIndex === -1 ||
        crlfIndex < lfIndex)
    ) {
      index = crlfIndex;
      separatorLength = 4;
    } else if (lfIndex !== -1) {
      index = lfIndex;
      separatorLength = 2;
    }

    if (index === -1) {
      break;
    }

    const block =
      remaining.slice(0, index);

    remaining =
      remaining.slice(
        index + separatorLength,
      );

    const lines =
      block.split(/\r?\n/);

    const dataLines = [];

    for (const line of lines) {
      if (line.startsWith("data:")) {
        dataLines.push(
          line.slice(5).trim(),
        );
      }
    }

    if (dataLines.length > 0) {
      events.push(
        dataLines.join("\n"),
      );
    }
  }

  return {
    events,
    remaining,
  };
}

/* -------------------------------------------------------------------------- */
/* Groq streaming                                                             */
/* -------------------------------------------------------------------------- */

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

async function streamOpenAI({
  config,
  messages,
  systemPrompt,
  mode,
  onDelta,
  signal,
  state,
}) {
  const payload =
    buildOpenAIRequest({
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
          // Ignore malformed individual chunks.
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

/* -------------------------------------------------------------------------- */
/* Gemini streaming                                                           */
/* -------------------------------------------------------------------------- */

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
        typeof part?.text === "string" &&
        part?.thought !== true
      ) {
        text += part.text;
      }
    }
  }

  return text;
}

function extractGeminiError(json) {
  if (
    json?.error &&
    typeof json.error === "object"
  ) {
    const message =
      typeof json.error.message === "string"
        ? json.error.message
        : "Gemini returned an API error.";

    const error =
      new Error(
        `Gemini API error: ${message}`,
      );

    if (
      Number.isFinite(
        Number(json.error.code),
      )
    ) {
      error.status =
        Number(json.error.code);
    }

    return error;
  }

  return null;
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

          const apiError =
            extractGeminiError(json);

          if (apiError) {
            throw apiError;
          }

          const text =
            extractGeminiText(json);

          if (text) {
            state.emitted = true;
            onDelta(text);
          }
        } catch (error) {
          if (
            error?.message?.startsWith(
              "Gemini API error:",
            )
          ) {
            throw error;
          }

          // Ignore malformed individual SSE chunks.
        }
      }
    }

    buffer += decoder.decode();

    /*
     * Flush a final event regardless of whether the
     * upstream server used LF or CRLF.
     */
    const parsed =
      extractSseData(
        `${buffer}\n\n`,
      );

    for (const data of parsed.events) {
      try {
        const json =
          JSON.parse(data);

        const apiError =
          extractGeminiError(json);

        if (apiError) {
          throw apiError;
        }

        const text =
          extractGeminiText(json);

        if (text) {
          state.emitted = true;
          onDelta(text);
        }
      } catch (error) {
        if (
          error?.message?.startsWith(
            "Gemini API error:",
          )
        ) {
          throw error;
        }

        // Ignore malformed final chunk.
      }
    }
  } finally {
    reader.releaseLock();
  }

  /*
   * A successful HTTP response without any text is not
   * considered a successful AI response.
   *
   * This lets the provider layer expose the real failure
   * instead of silently returning an empty answer.
   */
  if (!state.emitted) {
    throw new Error(
      "Gemini returned no text content.",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Fallback policy                                                            */
/* -------------------------------------------------------------------------- */

function isPermanentError(error) {
  const status =
    Number(error?.status);

  if (!Number.isFinite(status)) {
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

/* -------------------------------------------------------------------------- */
/* Public streaming API                                                       */
/* -------------------------------------------------------------------------- */

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
     * Images must stay on Gemini.
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

    /*
     * Missing environment variables should
     * simply move to the next configured provider.
     */
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
       * Never duplicate an already-visible answer.
       */
      if (state.emitted) {
        throw error;
      }

      /*
       * Never fallback after user cancellation.
       */
      if (signal?.aborted) {
        throw error;
      }

      /*
       * Don't blindly retry invalid requests,
       * authentication failures or payload limits.
       */
      if (isPermanentError(error)) {
        throw error;
      }

      /*
       * Temporary/provider failures can move
       * to the next compatible provider.
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