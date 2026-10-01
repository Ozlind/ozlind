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

export async function POST(request) {
  try {
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

    const validation = validateMessages(
      body?.messages,
    );

    if (!validation.ok) {
      return json(
        {
          error: validation.error,
        },
        400,
      );
    }

    const messages = validation.messages;
    const mode =
      typeof body?.mode === "string"
        ? body.mode
        : "auto";

    const vision = hasVision(messages);

    const researchEnabled = shouldResearch(
      body,
      latestUserMessage(messages),
    );

    let researchSources = [];
    let researchNotice = null;

    if (researchEnabled) {
      const tavilyKey =
        process.env.TAVILY_API_KEY;

      if (tavilyKey) {
        try {
          const query = latestUserMessage(
            messages,
          ).slice(0, 500);

          if (query.trim()) {
            const controller =
              new AbortController();

            const timeout = setTimeout(
              () => controller.abort(),
              12_000,
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
                    query,
                    search_depth: "basic",
                    include_answer: false,
                    max_results: 5,
                  }),
                  signal: controller.signal,
                  cache: "no-store",
                },
              );

              if (response.ok) {
                const data =
                  await response.json();

                if (
                  Array.isArray(data?.results)
                ) {
                  researchSources =
                    data.results
                      .filter(
                        (item) =>
                          item &&
                          typeof item.url ===
                            "string",
                      )
                      .slice(0, 5)
                      .map((item) => ({
                        title:
                          typeof item.title ===
                          "string"
                            ? item.title
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
                          typeof item.content ===
                          "string"
                            ? item.content
                            : "",
                      }));
                }
              } else {
                researchNotice =
                  "Web research was unavailable, so I continued without live sources.";
              }
            } finally {
              clearTimeout(timeout);
            }
          }
        } catch {
          researchNotice =
            "Web research timed out, so I continued without live sources.";
        }
      } else {
        researchNotice =
          "Web research is not configured, so I continued without live sources.";
      }
    }

    const prompt = systemPrompt({
      responseStyle:
        body?.responseStyle,
      responseLength:
        body?.responseLength,
      customInstructions:
        body?.customInstructions,
      researchSources,
    });

    const providers = providerOrder(
      mode,
      vision,
    );

    if (providers.length === 0) {
      return json(
        {
          error:
            "No compatible AI provider is configured.",
        },
        503,
      );
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;

        const send = (event, data) => {
          if (closed) {
            return;
          }

          controller.enqueue(
            encoder.encode(
              sse(event, data),
            ),
          );
        };

        const close = () => {
          if (!closed) {
            closed = true;
            controller.close();
          }
        };

        try {
          send("ready", {
            type: "ready",
          });

          if (researchNotice) {
            send("notice", {
              type: "notice",
              message: researchNotice,
            });
          }

          if (researchSources.length > 0) {
            send("sources", {
              type: "sources",
              sources: researchSources,
            });
          }

          let selectedProvider = null;
          let selectedModel = null;

          await streamFromProviders({
            messages,
            mode,
            vision,
            systemPrompt: prompt,
            providers,
            onProvider: (
              provider,
              model,
            ) => {
              selectedProvider = provider;
              selectedModel = model;

              send("meta", {
                type: "meta",
                provider,
                model,
              });
            },
            onDelta: (content) => {
              send("delta", {
                type: "delta",
                content,
              });
            },
          });

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

          send("error", {
            type: "error",
            error: safeError(error),
          });

          close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type":
          "text/event-stream; charset=utf-8",
        "Cache-Control":
          "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "X-RateLimit-Remaining": String(
          rate.remaining,
        ),
      },
    });
  } catch (error) {
    return json(
      {
        error: safeError(error),
      },
      500,
    );
  }
}