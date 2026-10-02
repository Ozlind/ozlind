import {
  hasVision,
  json,
  latestUserMessage,
  safeError,
  shouldResearch,
  systemPrompt,
  validateMessages,
} from "@/lib/server";

import {
  providerOrder,
  streamFromProviders,
} from "@/lib/providers";

import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function sse(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function getClientKey(request) {
  const forwarded =
    request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded
      .split(",")[0]
      .trim();
  }

  return (
    request.headers.get("x-real-ip") ||
    "anonymous"
  );
}

/* -------------------------------------------------------------------------- */
/* Tavily research                                                            */
/* -------------------------------------------------------------------------- */

async function performResearch(query, signal) {
  const tavilyKey =
    process.env.TAVILY_API_KEY;

  if (!tavilyKey) {
    return {
      sources: [],
      notice:
        "Web research is not configured, so I continued without live sources.",
    };
  }

  const normalizedQuery = String(query || "")
    .trim()
    .slice(0, 500);

  if (!normalizedQuery) {
    return {
      sources: [],
      notice: null,
    };
  }

  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    12_000,
  );

  const abortParent = () => {
    controller.abort();
  };

  signal?.addEventListener(
    "abort",
    abortParent,
    { once: true },
  );

  try {
    const response = await fetch(
      "https://api.tavily.com/search",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: normalizedQuery,
          search_depth: "basic",
          include_answer: false,
          max_results: 5,
        }),
        signal: controller.signal,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return {
        sources: [],
        notice:
          "Web research was unavailable, so I continued without live sources.",
      };
    }

    const data =
      await response.json();

    if (!Array.isArray(data?.results)) {
      return {
        sources: [],
        notice:
          "Web research returned no usable sources, so I continued without live sources.",
      };
    }

    const sources = data.results
      .filter(
        (item) =>
          item &&
          typeof item.url === "string" &&
          item.url.trim(),
      )
      .slice(0, 5)
      .map((item) => ({
        title:
          typeof item.title === "string" &&
          item.title.trim()
            ? item.title.trim()
            : item.url,

        url: item.url,

        domain:
          (() => {
            try {
              return new URL(
                item.url,
              ).hostname;
            } catch {
              return "";
            }
          })(),

        content:
          typeof item.content === "string"
            ? item.content
            : "",
      }));

    return {
      sources,

      notice:
        sources.length === 0
          ? "Web research returned no usable sources, so I continued without live sources."
          : null,
    };
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }

    return {
      sources: [],
      notice:
        "Web research timed out, so I continued without live sources.",
    };
  } finally {
    clearTimeout(timeout);

    signal?.removeEventListener(
      "abort",
      abortParent,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* POST /api/chat                                                             */
/* -------------------------------------------------------------------------- */

export async function POST(request) {
  try {
    /* ---------------------------------------------------------------------- */
    /* 1. RATE LIMIT                                                          */
    /* ---------------------------------------------------------------------- */

    const rate = checkRateLimit(
      getClientKey(request),
    );

    if (!rate.allowed) {
      return json(
        {
          error:
            "Too many requests. Please wait a moment and try again.",
        },
        429,
        {
          "Retry-After": String(
            rate.retryAfterSeconds,
          ),
          "X-RateLimit-Remaining": "0",
        },
      );
    }

    /* ---------------------------------------------------------------------- */
    /* 2. PARSE REQUEST                                                       */
    /* ---------------------------------------------------------------------- */

    let body;

    try {
      body = await request.json();
    } catch {
      return json(
        {
          error: "Invalid JSON request.",
        },
        400,
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return json(
        {
          error:
            "Invalid request body.",
        },
        400,
      );
    }

    /* ---------------------------------------------------------------------- */
    /* 3. VALIDATE MESSAGES                                                   */
    /* ---------------------------------------------------------------------- */

    const validation =
      validateMessages(body.messages);

    if (!validation.ok) {
      return json(
        {
          error:
            validation.error ||
            "Invalid chat messages.",
        },
        400,
      );
    }

    const messages =
      validation.messages;

    /* ---------------------------------------------------------------------- */
    /* 4. NORMALIZE MODE                                                      */
    /* ---------------------------------------------------------------------- */

    const allowedModes = new Set([
      "auto",
      "fast",
      "pro",
      "vision",
      
    ]);

    const mode =
      typeof body.mode === "string" &&
      allowedModes.has(body.mode)
        ? body.mode
        : "auto";

    /* ---------------------------------------------------------------------- */
    /* 5. DETECT VISION                                                       */
    /* ---------------------------------------------------------------------- */

    const vision =
      hasVision(messages);

    /* ---------------------------------------------------------------------- */
    /* 6. DETERMINE WEB RESEARCH                                              */
    /* ---------------------------------------------------------------------- */

    const userQuery =
      latestUserMessage(messages);

    const researchEnabled =
      shouldResearch(
        body,
        userQuery,
      );

    let researchSources = [];
    let researchNotice = null;
    let researchAnswer = null;

    /*
     * Tavily runs before the AI provider when
     * current/live information is required.
     */
    if (researchEnabled) {
      const research =
        await performResearch(
          userQuery,
          request.signal,
        );

      researchSources =
        research.sources;

      researchNotice =
        research.notice;

      researchAnswer =
        research.answer || null;
    }

    /* ---------------------------------------------------------------------- */
    /* 7. BUILD ONE OZLIND SYSTEM PROMPT                                      */
    /* ---------------------------------------------------------------------- */

    /*
     * The same prompt is sent to Groq and Gemini.
     *
     * This keeps the assistant personality consistent
     * even when Auto switches providers.
     */
    const prompt = systemPrompt(
      {
        responseStyle:
          body.responseStyle,

        responseLength:
          body.responseLength,

        customInstructions:
          body.customInstructions,

        memory:
          body.memory,
      },
      {
        answer:
          researchAnswer,

        results:
          researchSources,
      },
    );

    /* ---------------------------------------------------------------------- */
    /* 8. SELECT AI PROVIDER(S)                                               */
    /* ---------------------------------------------------------------------- */

    /*
     * IMPORTANT:
     *
     * Auto routing receives the actual messages and
     * research state.
     *
     * Example:
     *
     * simple  -> Groq
     * complex -> Gemini
     * image   -> Gemini
     * current -> Tavily + Gemini
     */
    const providers =
      providerOrder(
        mode,
        vision,
        {
          messages,
          research:
            researchEnabled,
        },
      );

    if (!providers.length) {
      return json(
        {
          error:
            vision
              ? "No compatible vision provider is configured."
              : "No compatible AI provider is configured.",
        },
        503,
      );
    }

    /* ---------------------------------------------------------------------- */
    /* 9. CREATE SSE STREAM                                                   */
    /* ---------------------------------------------------------------------- */

    const encoder =
      new TextEncoder();

    const stream =
      new ReadableStream({
        async start(controller) {
          let closed = false;

          const send = (
            event,
            data,
          ) => {
            if (closed) {
              return;
            }

            try {
              controller.enqueue(
                encoder.encode(
                  sse(event, data),
                ),
              );
            } catch {
              closed = true;
            }
          };

          const close = () => {
            if (closed) {
              return;
            }

            closed = true;

            try {
              controller.close();
            } catch {
              // Stream already closed.
            }
          };

          try {
            /* ---------------------------------------------------------------- */
            /* READY                                                             */
            /* ---------------------------------------------------------------- */

            send("ready", {
              type: "ready",
            });

            /* ---------------------------------------------------------------- */
            /* RESEARCH NOTICE                                                  */
            /* ---------------------------------------------------------------- */

            if (researchNotice) {
              send("notice", {
                type: "notice",
                message:
                  researchNotice,
              });
            }

            /* ---------------------------------------------------------------- */
            /* RESEARCH SOURCES                                                 */
            /* ---------------------------------------------------------------- */

            if (
              researchSources.length
            ) {
              send("sources", {
                type: "sources",
                sources:
                  researchSources,
              });
            }

            let selectedProvider =
              null;

            let selectedModel =
              null;

            /* ---------------------------------------------------------------- */
            /* AI STREAM                                                         */
            /* ---------------------------------------------------------------- */

            await streamFromProviders({
              messages,

              mode,

              vision,

              systemPrompt:
                prompt,

              providers,

              signal:
                request.signal,

              onProvider: (
                provider,
                model,
              ) => {
                selectedProvider =
                  provider;

                selectedModel =
                  model;

                send("meta", {
                  type: "meta",
                  provider,
                  model,
                });
              },

              onDelta: (
                content,
              ) => {
                if (
                  typeof content !==
                    "string" ||
                  !content
                ) {
                  return;
                }

                send("delta", {
                  type: "delta",
                  content,
                });
              },
            });

            /* ---------------------------------------------------------------- */
            /* CLEAR TEMPORARY NOTICE                                           */
            /* ---------------------------------------------------------------- */

            if (
              selectedProvider &&
              selectedModel
            ) {
              send("notice", {
                type: "notice",
                message: "",
              });
            }

            /* ---------------------------------------------------------------- */
            /* DONE                                                              */
            /* ---------------------------------------------------------------- */

            send("done", {
              type: "done",
            });

            close();
          } catch (error) {
            if (closed) {
              return;
            }

            /*
             * User pressed Stop / request was aborted.
             * This is not an AI error.
             */
            if (
              request.signal?.aborted
            ) {
              close();
              return;
            }

            send("error", {
              type: "error",
              error:
                safeError(error),
            });

            close();
          }
        },
      });

    /* ---------------------------------------------------------------------- */
    /* 10. RETURN SSE RESPONSE                                                */
    /* ---------------------------------------------------------------------- */

    return new Response(
      stream,
      {
        status: 200,

        headers: {
          "Content-Type":
            "text/event-stream; charset=utf-8",

          "Cache-Control":
            "no-cache, no-transform",

          Connection:
            "keep-alive",

          "X-Accel-Buffering":
            "no",

          "X-RateLimit-Remaining":
            String(
              rate.remaining,
            ),
        },
      },
    );
  } catch (error) {
    return json(
      {
        error:
          safeError(error),
      },
      500,
    );
  }
}