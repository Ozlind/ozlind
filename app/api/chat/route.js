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

  try {
    const controller =
      new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      12_000,
    );

    /*
     * If the parent request is aborted, abort the
     * Tavily request as well.
     */
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
    } finally {
      clearTimeout(timeout);

      signal?.removeEventListener(
        "abort",
        abortParent,
      );
    }
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }

    return {
      sources: [],
      notice:
        "Web research timed out, so I continued without live sources.",
    };
  }
}

export async function POST(request) {
  try {
    /*
     * ---------------------------------------------------------
     * 1. RATE LIMIT
     * ---------------------------------------------------------
     */
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

    /*
     * ---------------------------------------------------------
     * 2. PARSE REQUEST
     * ---------------------------------------------------------
     */
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

    /*
     * ---------------------------------------------------------
     * 3. VALIDATE MESSAGE CONTRACT
     * ---------------------------------------------------------
     *
     * This is the critical fix.
     *
     * validateMessages() now returns:
     * { ok, messages }
     *
     * instead of the previous bare array.
     */
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

    /*
     * ---------------------------------------------------------
     * 4. NORMALIZE MODE
     * ---------------------------------------------------------
     */
    const allowedModes = new Set([
      "auto",
      "fast",
      "pro",
      "vision",
      "research",
    ]);

    const mode =
      typeof body.mode === "string" &&
      allowedModes.has(body.mode)
        ? body.mode
        : "auto";

    /*
     * ---------------------------------------------------------
     * 5. DETECT VISION
     * ---------------------------------------------------------
     */
    const vision =
      hasVision(messages);

    /*
     * ---------------------------------------------------------
     * 6. DETERMINE RESEARCH
     * ---------------------------------------------------------
     */
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
     * ---------------------------------------------------------
     * 7. OPTIONAL WEB RESEARCH
     * ---------------------------------------------------------
     *
     * Research failure is deliberately non-fatal.
     * The AI request should continue without research
     * when Tavily is unavailable.
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

    /*
     * ---------------------------------------------------------
     * 8. BUILD SYSTEM PROMPT
     * ---------------------------------------------------------
     *
     * Critical second fix:
     *
     * systemPrompt() expects:
     * {
     *   results: [...]
     * }
     *
     * not the raw array.
     */
    const prompt = systemPrompt(
      {
        responseStyle:
          body.responseStyle,
        responseLength:
          body.responseLength,
        customInstructions:
          body.customInstructions,
        memory: body.memory,
      },
      {
        answer: researchAnswer,
        results: researchSources,
      },
    );

    /*
     * ---------------------------------------------------------
     * 9. SELECT PROVIDERS
     * ---------------------------------------------------------
     */
    const providers =
      providerOrder(
        mode,
        vision,
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

    /*
     * ---------------------------------------------------------
     * 10. SSE STREAM
     * ---------------------------------------------------------
     */
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
            send("ready", {
              type: "ready",
            });

            if (researchNotice) {
              send("notice", {
                type: "notice",
                message:
                  researchNotice,
              });
            }

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

            /*
             * Keep the existing client protocol:
             * an empty notice clears any temporary
             * provider/research notice UI.
             */
            if (
              selectedProvider &&
              selectedModel
            ) {
              send("notice", {
                type: "notice",
                message: "",
              });
            }

            send("done", {
              type: "done",
            });

            close();
          } catch (error) {
            if (closed) {
              return;
            }

            /*
             * Abort is expected when the user presses
             * Stop. Do not turn that into a visible
             * server error event.
             */
            if (
              request.signal?.aborted
            ) {
              close();
              return;
            }

            send("error", {
              type: "error",
              error: safeError(error),
            });

            close();
          }
        },
      });

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
        error: safeError(error),
      },
      500,
    );
  }
}