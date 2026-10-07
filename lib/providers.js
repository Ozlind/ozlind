const PROVIDERS = {
  gatewayFast: {
    id: "gateway",
    modelEnv: "AI_GATEWAY_FAST_MODEL",
    keyEnv: "AI_GATEWAY_API_KEY",
    baseUrl:
      "https://ai-gateway.vercel.sh/v1/chat/completions",
  },

  gatewayPro: {
    id: "gateway",
    modelEnv: "AI_GATEWAY_PRO_MODEL",
    keyEnv: "AI_GATEWAY_API_KEY",
    baseUrl:
      "https://ai-gateway.vercel.sh/v1/chat/completions",
  },

  gatewayVision: {
    id: "gateway",
    modelEnv: "AI_GATEWAY_VISION_MODEL",
    keyEnv: "AI_GATEWAY_API_KEY",
    baseUrl:
      "https://ai-gateway.vercel.sh/v1/chat/completions",
  },

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

const REQUEST_LIMITS = {
  simpleChars: 12000,
  complexChars: 30000,
  maxMessages: 20,
  requestTimeoutMs: 45000,
  firstProviderTimeoutMs: 30000,
};

const providerHealth = new Map();

function healthState(name) {
  return providerHealth.get(name) || {
    failures: 0,
    cooldownUntil: 0,
  };
}

function providerCoolingDown(name) {
  return healthState(name).cooldownUntil > Date.now();
}

function markProviderSuccess(name) {
  providerHealth.set(name, {
    failures: 0,
    cooldownUntil: 0,
  });
}

function markProviderFailure(name) {
  const failures = Math.min(
    healthState(name).failures + 1,
    5,
  );

  providerHealth.set(name, {
    failures,
    cooldownUntil:
      Date.now() + 5000 * 2 ** (failures - 1),
  });
}

function retryDelay(attempt) {
  return 250 * 2 ** attempt + Math.floor(Math.random() * 150);
}

function sleep(ms) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms),
  );
}

function env(name) {
  const value = process.env[name];

  if (!value || typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

function providerConfig(name) {
  const config = PROVIDERS[name];

  if (!config) {
    return null;
  }

  const apiKey = env(config.keyEnv);
  const model = env(config.modelEnv);

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
/* MESSAGE HELPERS                                                            */
/* -------------------------------------------------------------------------- */

function textFromPart(part) {
  if (
    part?.type === "text" &&
    typeof part.text === "string"
  ) {
    return part.text;
  }

  return "";
}

function textFromMessage(message) {
  if (typeof message?.content === "string") {
    return message.content;
  }

  if (Array.isArray(message?.content)) {
    return message.content
      .map(textFromPart)
      .filter(Boolean)
      .join(" ");
  }

  return "";
}

function textFromMessages(messages) {
  return messages
    .map(textFromMessage)
    .filter(Boolean)
    .join("\n")
    .trim();
}

function containsImage(messages) {
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

/* -------------------------------------------------------------------------- */
/* INTENT CLASSIFICATION                                                      */
/* -------------------------------------------------------------------------- */

function looksLikeCurrentInformation(text) {
  const query = String(text || "").trim();

  if (!query) {
    return false;
  }

  if (
    /^(write|draft|compose|create|generate|translate|rewrite|fix|debug|refactor|summarize|summarise|explain this)\b/i.test(
      query,
    )
  ) {
    return false;
  }

  const current =
    /\b(latest|current|today|tonight|right now|recent|breaking|this week|this month)\b/i;

  const subject =
    /\b(news|price|score|status|rate|weather|forecast|schedule|result|results|release|version|update|election|market|stock|share|gold|petrol|diesel|bitcoin|crypto)\b/i;

  const explicitSearch =
    /\b(search the web|search online|look (this|it) up|find online|find on the web|according to sources|according to the internet|web search)\b/i;

  const currentRole =
    /\b(current|new|present)\s+(ceo|president|prime minister|chief minister|governor|captain|coach|head)\b/i;

  const Malayalam =
    /(വാർത്ത|കാലാവസ്ഥ|ഇന്നത്തെ|ഇപ്പോഴത്തെ|വില|ഫലം|സ്കോർ|innathe|vartha|vaartha|kaalavastha)/i;

  return (
    (current.test(query) && subject.test(query)) ||
    explicitSearch.test(query) ||
    currentRole.test(query) ||
    Malayalam.test(query)
  );
}

function looksComplex(text) {
  const query = String(text || "").trim();

  if (!query) {
    return false;
  }

  const strongSignals =
    /\b(analyze|analyse|architecture|architect|debug|debugging|optimize|optimise|refactor|compare|evaluate|derive|prove|reason|investigate|design|implement|build|engineer|algorithm|strategy|migration|security|production|database|system design)\b/i;

  const technical =
    /\b(next\.?js|react|typescript|javascript|python|java|sql|supabase|vercel|docker|kubernetes|api|backend|frontend|oauth|authentication|authorization|postgres|postgresql)\b/i;

  const multiStep =
    /\b(step by step|multiple|several|first.*then|then.*finally|requirements|constraints)\b/i;

  const longRequest =
    query.length > 900 ||
    query.split(/[.!?]+/).filter(Boolean).length >= 6;

  if (strongSignals.test(query)) {
    return true;
  }

  if (technical.test(query) && (multiStep.test(query) || query.length > 350)) {
    return true;
  }

  return longRequest;
}

export function classifyRequest(
  messages = [],
  {
    vision = false,
    research = false,
  } = {},
) {
  if (vision || containsImage(messages)) {
    return "vision";
  }

  if (research || looksLikeCurrentInformation(textFromMessages(messages))) {
    return "research";
  }

  if (looksComplex(textFromMessages(messages))) {
    return "complex";
  }

  return "simple";
}

/* -------------------------------------------------------------------------- */
/* ROUTING                                                                    */
/* -------------------------------------------------------------------------- */

export function providerOrder(
  mode = "auto",
  vision = false,
  context = {},
) {
  const messages = Array.isArray(context.messages)
    ? context.messages
    : [];

  const research = context.research === true;

  const classification = classifyRequest(messages, {
    vision,
    research,
  });

  const configured = (name) =>
    Boolean(providerConfig(name));

  if (vision || mode === "vision") {
    return [
      ...(configured("gatewayVision")
        ? ["gatewayVision"]
        : []),
      "gemini",
    ];
  }

  if (mode === "fast") {
    return [
      ...(configured("gatewayFast")
        ? ["gatewayFast"]
        : []),
      "groqFast",
      "gemini",
      "groqPro",
    ];
  }

  if (mode === "pro") {
    return [
      ...(configured("gatewayPro")
        ? ["gatewayPro"]
        : []),
      "gemini",
      "groqPro",
      "groqFast",
    ];
  }

  if (classification === "vision") {
    return [
      ...(configured("gatewayVision")
        ? ["gatewayVision"]
        : []),
      "gemini",
    ];
  }

  if (
    classification === "complex" ||
    classification === "research"
  ) {
    return [
      ...(configured("gatewayPro")
        ? ["gatewayPro"]
        : []),
      "gemini",
      "groqPro",
      "groqFast",
    ];
  }

  return [
    ...(configured("gatewayFast")
      ? ["gatewayFast"]
      : []),
    "groqFast",
    "gemini",
    "groqPro",
  ];
}

/* -------------------------------------------------------------------------- */
/* REASONING                                                                  */
/* -------------------------------------------------------------------------- */

function groqReasoning(mode) {
  if (mode === "pro") {
    return "high";
  }

  if (mode === "fast") {
    return "low";
  }

  return "medium";
}

function geminiThinking(mode) {
  if (mode === "pro") {
    return "high";
  }

  if (mode === "fast") {
    return "low";
  }

  return "medium";
}

/* -------------------------------------------------------------------------- */
/* GEMINI MESSAGE CONVERSION                                                  */
/* -------------------------------------------------------------------------- */

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

function convertGeminiPart(part) {
  if (!part || typeof part !== "object") {
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
    typeof part.image_url?.url === "string"
  ) {
    const inline = dataUrlToInlineData(
      part.image_url.url,
    );

    if (!inline) {
      return null;
    }

    return {
      inline_data: inline,
    };
  }

  return null;
}

function convertGeminiMessage(message) {
  const parts = [];

  if (typeof message.content === "string") {
    if (message.content.trim()) {
      parts.push({
        text: message.content,
      });
    }
  } else if (Array.isArray(message.content)) {
    for (const part of message.content) {
      const converted = convertGeminiPart(part);

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
  const contents = [];

  for (const message of messages) {
    const converted =
      convertGeminiMessage(message);

    if (!converted.parts.length) {
      continue;
    }

    const previous =
      contents[contents.length - 1];

    if (
      previous &&
      previous.role === converted.role
    ) {
      previous.parts.push(
        ...converted.parts,
      );
    } else {
      contents.push(converted);
    }
  }

  while (
    contents.length &&
    contents[0].role === "model"
  ) {
    contents.shift();
  }

  while (
    contents.length &&
    contents[contents.length - 1].role === "model"
  ) {
    contents.pop();
  }

  return contents;
}

/* -------------------------------------------------------------------------- */
/* SSE HELPERS                                                                */
/* -------------------------------------------------------------------------- */

function parseSseBuffer(buffer) {
  const events = [];
  let remaining = buffer;

  while (true) {
    const lf = remaining.indexOf("\n\n");
    const crlf = remaining.indexOf("\r\n\r\n");

    let index = -1;
    let separator = 0;

    if (
      crlf !== -1 &&
      (lf === -1 || crlf < lf)
    ) {
      index = crlf;
      separator = 4;
    } else if (lf !== -1) {
      index = lf;
      separator = 2;
    }

    if (index === -1) {
      break;
    }

    const block =
      remaining.slice(0, index);

    remaining =
      remaining.slice(index + separator);

    const lines = block.split(/\r?\n/);

    const data = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");

    if (data) {
      events.push(data);
    }
  }

  return {
    events,
    remaining,
  };
}

/* -------------------------------------------------------------------------- */
/* FETCH TIMEOUT                                                              */
/* -------------------------------------------------------------------------- */

function createTimeoutSignal(parentSignal, ms) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    ms,
  );

  const abortParent = () => {
    controller.abort();
  };

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener(
        "abort",
        abortParent,
        { once: true },
      );
    }
  }

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);

      parentSignal?.removeEventListener(
        "abort",
        abortParent,
      );
    },
  };
}

/* -------------------------------------------------------------------------- */
/* GROQ                                                                       */
/* -------------------------------------------------------------------------- */

async function streamGroq({
  config,
  messages,
  systemPrompt,
  mode,
  onDelta,
  signal,
  state,
}) {
  const timeout = createTimeoutSignal(
    signal,
    REQUEST_LIMITS.requestTimeoutMs,
  );

  try {
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
        body: JSON.stringify({
          model: config.model,
          stream: true,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            ...messages.map((message) => ({
              role: message.role,
              content: message.content,
            })),
          ],
          ...(config.id === "groq"
            ? {
                reasoning_effort:
                  groqReasoning(mode),
              }
            : {}),
        }),
        signal: timeout.signal,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const body = await response.text();

      const error = new Error(
        `Groq request failed (${response.status}): ${body.slice(
          0,
          500,
        )}`,
      );

      error.status = response.status;
      throw error;
    }

    if (!response.body) {
      throw new Error(
        "Groq returned no response stream.",
      );
    }

    const reader =
      response.body.getReader();

    const decoder = new TextDecoder();

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
          parseSseBuffer(buffer);

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
              content
            ) {
              state.emitted = true;
              onDelta(content);
            }
          } catch {
            // Ignore malformed chunks.
          }
        }
      }

      buffer += decoder.decode();

      const final =
        parseSseBuffer(
          `${buffer}\n\n`,
        );

      for (const data of final.events) {
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
            content
          ) {
            state.emitted = true;
            onDelta(content);
          }
        } catch {
          // Ignore malformed final chunks.
        }
      }
    } finally {
      reader.releaseLock();
    }
  } finally {
    timeout.cleanup();
  }

  if (!state.emitted) {
    throw new Error(
      "Groq returned no text content.",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* GEMINI                                                                     */
/* -------------------------------------------------------------------------- */

function extractGeminiText(payload) {
  const candidates =
    Array.isArray(payload?.candidates)
      ? payload.candidates
      : [];

  let output = "";

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
        part.thought !== true
      ) {
        output += part.text;
      }
    }
  }

  return output;
}

function geminiError(payload) {
  if (!payload?.error) {
    return null;
  }

  const message =
    typeof payload.error.message === "string"
      ? payload.error.message
      : "Gemini request failed.";

  const error = new Error(
    `Gemini API error: ${message}`,
  );

  if (Number.isFinite(Number(payload.error.code))) {
    error.status = Number(payload.error.code);
  }

  return error;
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

  if (!contents.length) {
    throw new Error(
      "Gemini received no usable messages.",
    );
  }

  const timeout = createTimeoutSignal(
    signal,
    REQUEST_LIMITS.requestTimeoutMs,
  );

  try {
    const url =
      `${config.baseUrl}/${encodeURIComponent(
        config.model,
      )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(
        config.apiKey,
      )}`;

    const response = await fetch(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
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
                geminiThinking(mode),
            },
          },
        }),
        signal: timeout.signal,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const body =
        await response.text();

      const error = new Error(
        `Gemini request failed (${response.status}): ${body.slice(
          0,
          500,
        )}`,
      );

      error.status = response.status;
      throw error;
    }

    if (!response.body) {
      throw new Error(
        "Gemini returned no response stream.",
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
          parseSseBuffer(buffer);

        buffer = parsed.remaining;

        for (const data of parsed.events) {
          try {
            const payload =
              JSON.parse(data);

            const apiError =
              geminiError(payload);

            if (apiError) {
              throw apiError;
            }

            const content =
              extractGeminiText(payload);

            if (content) {
              state.emitted = true;
              onDelta(content);
            }
          } catch (error) {
            if (
              error?.message?.startsWith(
                "Gemini API error:",
              )
            ) {
              throw error;
            }

            // Ignore malformed chunks.
          }
        }
      }

      buffer += decoder.decode();

      const final =
        parseSseBuffer(
          `${buffer}\n\n`,
        );

      for (const data of final.events) {
        try {
          const payload =
            JSON.parse(data);

          const apiError =
            geminiError(payload);

          if (apiError) {
            throw apiError;
          }

          const content =
            extractGeminiText(payload);

          if (content) {
            state.emitted = true;
            onDelta(content);
          }
        } catch (error) {
          if (
            error?.message?.startsWith(
              "Gemini API error:",
            )
          ) {
            throw error;
          }

          // Ignore malformed final chunks.
        }
      }
    } finally {
      reader.releaseLock();
    }
  } finally {
    timeout.cleanup();
  }

  if (!state.emitted) {
    throw new Error(
      "Gemini returned no text content.",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* FALLBACK                                                                   */
/* -------------------------------------------------------------------------- */

function permanentError(error) {
  const status =
    Number(error?.status);

  return [
    400,
    401,
    403,
    404,
    413,
    422,
  ].includes(status);
}

function retryableStatus(error) {
  const status =
    Number(error?.status);

  return (
    status === 408 ||
    status === 409 ||
    status === 429 ||
    status >= 500
  );
}

/* -------------------------------------------------------------------------- */
/* PUBLIC API                                                                 */
/* -------------------------------------------------------------------------- */

export async function streamFromProviders({
  messages,
  mode = "auto",
  vision = false,
  systemPrompt,
  providers = [],
  onProvider,
  onDelta,
  signal,
}) {
  let lastError = null;

  for (
    let index = 0;
    index < providers.length;
    index += 1
  ) {
    const providerName =
      providers[index];

    if (
      vision &&
      providerName !== "gemini" &&
      providerName !== "gatewayVision"
    ) {
      continue;
    }

    const config =
      providerConfig(providerName);

    if (!config) {
      continue;
    }

    if (signal?.aborted) {
      throw new Error(
        "Request cancelled.",
      );
    }

    if (providerCoolingDown(providerName)) {
      continue;
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const state = {
        emitted: false,
      };

      try {
        /*
         * Provider/model information stays server-side.
         * onProvider receives it only for server-side
         * observability; the route does not expose it.
         */
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
          await streamGroq({
            config,
            messages,
            systemPrompt,
            mode,
            onDelta,
            signal,
            state,
          });
        }

        markProviderSuccess(providerName);

        return {
          provider: config.id,
          model: config.model,
        };
      } catch (error) {
        lastError = error;

        if (signal?.aborted) {
          throw error;
        }

        if (state.emitted) {
          markProviderFailure(providerName);
          throw error;
        }

        if (permanentError(error)) {
          throw error;
        }

        const transient =
          retryableStatus(error) ||
          !Number.isFinite(Number(error?.status));

        if (transient && attempt === 0) {
          await sleep(retryDelay(attempt));
          continue;
        }

        if (transient) {
          markProviderFailure(providerName);
        }

        break;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error(
    "No configured AI provider is available.",
  );
}

export const providerLimits =
  REQUEST_LIMITS;