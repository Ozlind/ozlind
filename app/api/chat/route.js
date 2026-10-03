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

import { checkUserRateLimit } from "@/lib/rate-limit";

import {
  createAgentTask,
  setAgentStep,
  verifyAgentOutput,
} from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function sse(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/* -------------------------------------------------------------------------- */
/* MESSAGE HELPERS                                                            */
/* -------------------------------------------------------------------------- */

function userText(message) {
  if (typeof message?.content === "string") {
    return message.content;
  }

  if (Array.isArray(message?.content)) {
    return message.content
      .filter(
        (part) => part?.type === "text",
      )
      .map(
        (part) => part.text || "",
      )
      .join(" ");
  }

  return "";
}

/*
 * Short follow-ups such as:
 *
 * "and tomorrow?"
 *
 * need the previous user message
 * to make the research query meaningful.
 */
function buildSearchQuery(messages) {
  const userMessages = messages
    .filter(
      (message) =>
        message.role === "user",
    )
    .map(userText)
    .map((text) =>
      text
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);

  const latest =
    userMessages[
      userMessages.length - 1
    ] || "";

  const previous =
    userMessages[
      userMessages.length - 2
    ] || "";

  if (
    latest.length < 35 &&
    previous
  ) {
    return `${previous.slice(
      0,
      200,
    )} ${latest}`.trim();
  }

  return latest;
}

function looksLikeNews(query) {
  return /\b(news|latest|breaking|headlines|today|tonight|this week|happening|happened|score|won|results?)\b/i.test(
    query,
  );
}

function publicSources(sources) {
  return sources.map(
    ({
      title,
      url,
      domain,
    }) => ({
      title,
      url,
      domain,
    }),
  );
}

/* -------------------------------------------------------------------------- */
/* TAVILY RESEARCH                                                            */
/* -------------------------------------------------------------------------- */

async function performResearch(
  query,
  signal,
) {
  const tavilyKey =
    process.env.TAVILY_API_KEY;

  if (!tavilyKey) {
    return {
      sources: [],
      notice:
        "Web research is not configured, so I continued without live sources.",
    };
  }

  const normalizedQuery =
    String(query || "")
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
    () =>
      controller.abort(),
    12_000,
  );

  const abortParent =
    () =>
      controller.abort();

  signal?.addEventListener(
    "abort",
    abortParent,
    {
      once: true,
    },
  );

  try {
    const response =
      await fetch(
        "https://api.tavily.com/search",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization: `Bearer ${tavilyKey}`,
          },

          body: JSON.stringify({
            api_key:
              tavilyKey,

            query:
              normalizedQuery,

            search_depth:
              "basic",

            include_answer:
              false,

            max_results: 5,

            ...(looksLikeNews(
              normalizedQuery,
            )
              ? {
                  topic: "news",
                  days: 7,
                }
              : {}),
          }),

          signal:
            controller.signal,

          cache:
            "no-store",
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

    if (
      !Array.isArray(
        data?.results,
      )
    ) {
      return {
        sources: [],
        notice:
          "Web research returned no usable sources, so I continued without live sources.",
      };
    }

    const sources =
      data.results
        .filter(
          (item) =>
            item &&
            typeof item.url ===
              "string" &&
            item.url.trim(),
        )
        .slice(0, 5)
        .map((item) => {
          let domain = "";

          try {
            domain =
              new URL(
                item.url,
              ).hostname;
          } catch {
            // Invalid URL.
          }

          return {
            title:
              typeof item.title ===
                "string" &&
              item.title.trim()
                ? item.title.trim()
                : item.url,

            url:
              item.url,

            domain,

            content:
              typeof item.content ===
                "string"
                ? item.content.slice(
                    0,
                    1200,
                  )
                : "",
          };
        });

    return {
      sources,

      notice:
        sources.length
          ? null
          : "Web research returned no usable sources, so I continued without live sources.",
    };
  } catch (error) {
    if (
      signal?.aborted
    ) {
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

export async function POST(
  request,
) {
  try {
    /* ---------------------------------------------------------------------- */
    /* 1. RATE LIMIT                                                          */
    /* ---------------------------------------------------------------------- */

    const rate =
      await checkUserRateLimit();

    if (
      rate.unauthorized
    ) {
      return json(
        {
          error:
            "Your session has expired. Please sign in again.",
        },
        401,
      );
    }

    if (!rate.allowed) {
      return json(
        {
          error:
            "Too many requests. Please wait a moment and try again.",
        },
        429,
        {
          "Retry-After":
            String(
              rate.retryAfterSeconds,
            ),

          "X-RateLimit-Remaining":
            "0",
        },
      );
    }

    /* ---------------------------------------------------------------------- */
    /* 2. PARSE REQUEST                                                       */
    /* ---------------------------------------------------------------------- */

    let body;

    try {
      body =
        await request.json();
    } catch {
      return json(
        {
          error:
            "Invalid JSON request.",
        },
        400,
      );
    }

    if (
      !body ||
      typeof body !==
        "object" ||
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
      validateMessages(
        body.messages,
      );

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

    const allowedModes =
      new Set([
        "auto",
        "fast",
        "pro",
        "vision",
      ]);

    const mode =
      typeof body.mode ===
        "string" &&
      allowedModes.has(
        body.mode,
      )
        ? body.mode
        : "auto";

    /* ---------------------------------------------------------------------- */
    /* 5. VISION                                                              */
    /* ---------------------------------------------------------------------- */

    const vision =
      hasVision(messages);

    /* ---------------------------------------------------------------------- */
    /* 6. RESEARCH                                                            */
    /* ---------------------------------------------------------------------- */

    const userQuery =
      latestUserMessage(
        messages,
      );

    const researchEnabled =
      shouldResearch(
        body,
        userQuery,
      );

    /* ---------------------------------------------------------------------- */
    /* 7. CREATE AGENT TASK                                                   */
    /* ---------------------------------------------------------------------- */

    const task =
      createAgentTask({
        query:
          userQuery,

        vision,

        research:
          researchEnabled,

        mode,
      });

    /* ---------------------------------------------------------------------- */
    /* 8. SELECT PROVIDERS                                                    */
    /* ---------------------------------------------------------------------- */

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
        async start(
          controller,
        ) {
          let closed =
            false;

          let streamedText =
            "";

          const send = (
            event,
            data,
          ) => {
            if (
              closed ||
              request.signal?.aborted
            ) {
              return;
            }

            try {
              controller.enqueue(
                encoder.encode(
                  sse(
                    event,
                    data,
                  ),
                ),
              );
            } catch {
              closed =
                true;
            }
          };

          const close =
            () => {
              if (closed) {
                return;
              }

              closed =
                true;

              try {
                controller.close();
              } catch {
                // Already closed.
              }
            };

          const status =
            (
              message,
              stepId,
            ) => {
              if (stepId) {
                setAgentStep(
                  task,
                  stepId,
                  "running",
                );
              }

              send(
                "status",
                {
                  type:
                    "status",

                  message,
                },
              );
            };

          try {
            /* -------------------------------------------------------------- */
            /* READY                                                          */
            /* -------------------------------------------------------------- */

            send(
              "ready",
              {
                type:
                  "ready",
              },
            );

            /* -------------------------------------------------------------- */
            /* AGENT TASK                                                     */
            /* -------------------------------------------------------------- */

            send(
              "agent",
              {
                type:
                  "agent",

                taskId:
                  task.taskId,

                status:
                  "planning",

                goal:
                  task.goal,

                kind:
                  task.kind,

                steps:
                  task.steps,
              },
            );

            /* -------------------------------------------------------------- */
            /* UNDERSTAND                                                     */
            /* -------------------------------------------------------------- */

            status(
              "Planning task…",
              "understand",
            );

            setAgentStep(
              task,
              "understand",
              "completed",
            );

            /* -------------------------------------------------------------- */
            /* RESEARCH                                                       */
            /* -------------------------------------------------------------- */

            let researchSources =
              [];

            let researchNotice =
              null;

            let researchAnswer =
              null;

            if (
              researchEnabled
            ) {
              status(
                "Searching the web…",
                "research",
              );

              const research =
                await performResearch(
                  buildSearchQuery(
                    messages,
                  ),
                  request.signal,
                );

              researchSources =
                research.sources;

              researchNotice =
                research.notice;

              researchAnswer =
                research.answer ||
                null;

              setAgentStep(
                task,
                "research",
                "completed",
              );
            }

            /* -------------------------------------------------------------- */
            /* ABORT CHECK                                                    */
            /* -------------------------------------------------------------- */

            if (
              request.signal?.aborted
            ) {
              close();
              return;
            }

            /* -------------------------------------------------------------- */
            /* SYSTEM PROMPT                                                  */
            /* -------------------------------------------------------------- */

            const prompt =
              systemPrompt(
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

            /* -------------------------------------------------------------- */
            /* RESEARCH NOTICE                                                */
            /* -------------------------------------------------------------- */

            if (
              researchNotice
            ) {
              send(
                "notice",
                {
                  type:
                    "notice",

                  message:
                    researchNotice,
                },
              );
            }

            /* -------------------------------------------------------------- */
            /* SOURCES                                                        */
            /* -------------------------------------------------------------- */

            if (
              researchSources.length
            ) {
              send(
                "sources",
                {
                  type:
                    "sources",

                  sources:
                    publicSources(
                      researchSources,
                    ),
                },
              );
            }

            /* -------------------------------------------------------------- */
            /* RESPONSE                                                       */
            /* -------------------------------------------------------------- */

            status(
              "Preparing response…",
              "respond",
            );

            let selectedProvider =
              null;

            let selectedModel =
              null;

            await streamFromProviders(
              {
                messages,

                mode,

                vision,

                systemPrompt:
                  prompt,

                providers,

                signal:
                  request.signal,

                onProvider:
                  (
                    provider,
                    model,
                  ) => {
                    selectedProvider =
                      provider;

                    selectedModel =
                      model;

                    send(
                      "meta",
                      {
                        type:
                          "meta",

                        provider,

                        model,
                      },
                    );
                  },

                onDelta:
                  (
                    content,
                  ) => {
                    if (
                      typeof content !==
                        "string" ||
                      !content
                    ) {
                      return;
                    }

                    streamedText +=
                      content;

                    send(
                      "delta",
                      {
                        type:
                          "delta",

                        content,
                      },
                    );
                  },
              },
            );

            /* -------------------------------------------------------------- */
            /* ABORT CHECK                                                    */
            /* -------------------------------------------------------------- */

            if (
              request.signal?.aborted
            ) {
              close();
              return;
            }

            setAgentStep(
              task,
              "respond",
              "completed",
            );

            /* -------------------------------------------------------------- */
            /* VERIFY                                                         */
            /* -------------------------------------------------------------- */

            status(
              "Checking response…",
              "verify",
            );

            const verification =
              verifyAgentOutput(
                streamedText,
              );

            if (
              !verification.ok
            ) {
              throw new Error(
                verification.reason,
              );
            }

            setAgentStep(
              task,
              "verify",
              "completed",
            );

            task.status =
              "completed";

            /* -------------------------------------------------------------- */
            /* AGENT COMPLETE                                                */
            /* -------------------------------------------------------------- */

            send(
              "agent",
              {
                type:
                  "agent",

                taskId:
                  task.taskId,

                status:
                  "completed",

                steps:
                  task.steps,

                verification:
                  {
                    ok: true,

                    characterCount:
                      verification.characterCount,
                  },
              },
            );

            /* -------------------------------------------------------------- */
            /* CLEAR STATUS                                                   */
            /* -------------------------------------------------------------- */

            if (
              selectedProvider &&
              selectedModel
            ) {
              send(
                "notice",
                {
                  type:
                    "notice",

                  message:
                    "",
                },
              );
            }

            send(
              "status",
              {
                type:
                  "status",

                message:
                  "",
              },
            );

            /* -------------------------------------------------------------- */
            /* DONE                                                           */
            /* -------------------------------------------------------------- */

            send(
              "done",
              {
                type:
                  "done",

                taskId:
                  task.taskId,
              },
            );

            close();
          } catch (error) {
            /* -------------------------------------------------------------- */
            /* ABORT                                                         */
            /* -------------------------------------------------------------- */

            if (
              closed ||
              request.signal?.aborted
            ) {
              close();
              return;
            }

            /* -------------------------------------------------------------- */
            /* AGENT FAILURE                                                 */
            /* -------------------------------------------------------------- */

            task.status =
              "failed";

            send(
              "agent",
              {
                type:
                  "agent",

                taskId:
                  task.taskId,

                status:
                  "failed",

                steps:
                  task.steps,
              },
            );

            /* -------------------------------------------------------------- */
            /* USER-SAFE ERROR                                                */
            /* -------------------------------------------------------------- */

            const friendly =
              safeError(error);

            send(
              "error",
              {
                type:
                  "error",

                error:
                  vision &&
                  friendly ===
                    "OZLIND could not complete that request. Please try again."
                    ? "OZLIND could not analyse that image right now. Please try again shortly."
                    : friendly,
              },
            );

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